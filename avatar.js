/* 纸上的小人 · 头像 —— 随机头像生成器
 * 方形舞台上一幅手绘胸像（无名字）：眨眼、呼吸、眼神跟指针走，线条 8fps 沸腾。
 * ?seed=N 同种子同头像；「存头像」导出 512×512 PNG；
 * window.__avatarPNG 常备当前头像的 dataURL，供自动化（paper-avatar skill）直接取用。
 */
'use strict';

const TINTE = makePalette({ hautT: .5, haarT: .1, akzentT: .5, tinteT: .5 }).tinte;

let saat = (() => {
  const s = parseInt(new URLSearchParams(location.search).get('seed'), 10);
  return Number.isFinite(s) && s > 0 ? s : (Math.random() * 1e9) | 0;
})();

function neuesKopf(seed) {
  saat = seed;
  const h = new Head(seed);
  headCache(h);
  h.zeigeName = false;   // 头像不要名字
  return h;
}
let kopf = neuesKopf(saat);

let uiStift = null, uiTick = -1;

// 方形舞台：居中偏上，避开顶部标题（手机端导航更高，多让）、动作行与底部按钮
function buehne() {
  const s = Math.max(120, Math.min(innerWidth - 32, innerHeight - 216));
  const yMin = innerWidth < 720 ? 150 : 78;
  return { s, x: (innerWidth - s) / 2, y: Math.max(yMin, (innerHeight - 62 - s) / 2) };
}

function zeichneBuehne(t) {
  const tick = Math.floor(t * 8);
  if (uiTick !== tick) { uiStift = makeStift(ctx, saat * 7 + 3, TINTE, 1, tick); uiTick = tick; }
  const b = buehne();
  // 一张略亮的纸片 + 手绘方框（不透明纸色会盖掉整页 grain，补一层纸纹）
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(b.x, b.y, b.s, b.s);
  if (grainPattern) { ctx.fillStyle = grainPattern; ctx.fillRect(b.x, b.y, b.s, b.s); }
  uiStift.zug([
    { x: b.x, y: b.y }, { x: b.x + b.s, y: b.y },
    { x: b.x + b.s, y: b.y + b.s }, { x: b.x, y: b.y + b.s },
  ], { spur: 'rahmen', geschlossen: true, w: 1.4, deckung: .8 });
  // 四角裁切线：一张待裁切的证件照底片（导出走 avatarPNG，不带这些印刷标记）
  const cm = 4, cl = 11;   // 外偏与线长都收在舞台两侧 ≥16px 的余量内
  [[b.x, b.y, 1, 1], [b.x + b.s, b.y, -1, 1], [b.x, b.y + b.s, 1, -1], [b.x + b.s, b.y + b.s, -1, -1]]
    .forEach(([ex, ey, sx, sy], i) => {
      uiStift.zug([{ x: ex - sx * cm, y: ey - sy * cm }, { x: ex - sx * (cm + cl), y: ey - sy * cm }],
        { spur: `beschnitt-h${i}`, w: 1, deckung: .5, eckig: true });
      uiStift.zug([{ x: ex - sx * cm, y: ey - sy * cm }, { x: ex - sx * cm, y: ey - sy * (cm + cl) }],
        { spur: `beschnitt-v${i}`, w: 1, deckung: .5, eckig: true });
    });
  // 胸像：与一墙脸同一套裁切（带肩块），按帽子/发量自适应缩放
  const bedarf = raumBedarf(kopf);
  kopf.mass = b.s / (bedarf.oben + 2.25);
  kopf.cx = b.x + b.s / 2;
  kopf.cy = b.y + bedarf.oben * kopf.mass + b.s * .07;
  drawHead(ctx, kopf, t);
  return b;
}

/* ================= 导出：512×512 PNG ================= */

function avatarPNG() {
  const PX = 512;
  const out = document.createElement('canvas');
  out.width = PX; out.height = PX;
  const oc = out.getContext('2d');
  oc.fillStyle = '#fbf8f1';
  oc.fillRect(0, 0, PX, PX);
  // 导出也带纸纹；个别环境不允许跨画布用 pattern 时保持纯色
  try { if (grainPattern) { oc.fillStyle = grainPattern; oc.fillRect(0, 0, PX, PX); } } catch (e) { /* 纯色即可 */ }
  const bedarf = raumBedarf(kopf);
  // 笔闭包绑 ctx：离屏渲染前作废旧笔；渲染后同样作废，主画布下一帧重绑
  kopf.cache.stift = null; kopf.cache.stiftTick = -1; kopf.cache.stiftMass = -1;
  const cx0 = kopf.cx, cy0 = kopf.cy, mass0 = kopf.mass;
  const blinz0 = kopf.blinzeltBis, plapp0 = kopf.plappertBis;
  kopf.blinzeltBis = 0; kopf.plappertBis = 0;   // 快照不拍眨眼/嘟嘴的瞬间
  kopf.mass = PX / (bedarf.oben + 2.25);
  kopf.cx = PX / 2;
  kopf.cy = bedarf.oben * kopf.mass + PX * .07;
  drawHead(oc, kopf, performance.now() / 1000);
  kopf.cx = cx0; kopf.cy = cy0; kopf.mass = mass0;
  kopf.blinzeltBis = blinz0; kopf.plappertBis = plapp0;
  kopf.cache.stift = null; kopf.cache.stiftTick = -1; kopf.cache.stiftMass = -1;
  return out.toDataURL('image/png');
}

function frisch() {   // 换头像/初次加载后刷新导出缓存
  try { window.__avatarPNG = avatarPNG(); } catch (e) { window.__avatarPNG = null; }
}

/* ================= 主循环与按钮 ================= */

let vorige = 0;
function rahmen(now) {
  const t = now / 1000;
  const dt = vorige ? Math.min(t - vorige, .05) : .016;
  vorige = t;
  kopf.update(dt, t, pointer);
  gesichtTick(t);
  hookSync();
  gesichtKnopfe();
  papier();
  zeichneBuehne(t);
  requestAnimationFrame(rahmen);
}

/* ================= 面部表情与小动作（逗它） =================
 * 表情与视线是持续开关（留存）：点了就一直保持，换表情或按「回神」才解除；
 * 说话/眨眼是一次性小演出。
 * 表情 = 覆写引擎的五官选型（head.gesicht，app.js 的 drawHead 会读）；
 * 视线/犯困 = 每帧在 update() 之后覆写状态，回神后由引擎弹簧自然拉回。 */
/* 表情表 GESICHT_FORMEN 由 app.js 提供（头像页与一墙脸放大视图共用） */
let gesichtForm = null;    // 当前持续表情（null = 日常）
let blickZiel = null;      // 当前持续视线（null = 自在张望）

const einmal = {};         // 一次性演出：说话/眨眼

function gesichtAktion(art) {
  const t = performance.now() / 1000;
  if (art === 'sprich') einmal.sprichBis = t + 1.5;
  else if (art === 'blinz') einmal.blinzPlan = [t + .05, t + .45, t + .9];
  else if (art === 'aufwachen') {   // 回神：清表情、清视线
    gesichtForm = null; blickZiel = null;
    kopf.gesicht = null;
    setTimeout(frisch, 1300);       // 等弹簧回到日常再刷新导出快照
  } else if (GESICHT_FORMEN[art]) {   // 表情开关：再点一次取消
    gesichtForm = gesichtForm === art ? null : art;
    kopf.gesicht = gesichtForm ? GESICHT_FORMEN[gesichtForm] : null;
    setTimeout(frisch, gesichtForm === 'muede' ? 1300 : 200);   // 犯困要等眼皮垂下
  } else if (art === 'links' || art === 'rechts') {
    const ziel = { x: art === 'links' ? -.55 : .55, y: 0 };
    blickZiel = (blickZiel && blickZiel.x === ziel.x) ? null : ziel;   // 再点取消
    setTimeout(frisch, 1300);   // 转头到位/回中都给弹簧时间
  }
}

function gesichtTick(t) {
  const qt = Math.floor(t * 12) / 12;
  if (t < (einmal.sprichBis || 0)) kopf.plappertBis = qt + .12;
  if (einmal.blinzPlan && einmal.blinzPlan.length && qt >= einmal.blinzPlan[0] - .02) {
    kopf.blinzeltBis = qt + .14;
    einmal.blinzPlan.shift();
  }
  if (blickZiel) {
    kopf.yaw += (blickZiel.x - kopf.yaw) * .14;
    kopf.pitch += (blickZiel.y - kopf.pitch) * .14;
    kopf.blickX += (blickZiel.x * 1.6 - kopf.blickX) * .2;
  }
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
addEventListener('resize', resize);
resize();
requestAnimationFrame(rahmen);
setTimeout(frisch, 100);   // 首帧画完再导出

document.getElementById('neues').addEventListener('click', () => {
  kopf = neuesKopf((Math.random() * 1e9) | 0);
  gesichtForm = null; blickZiel = null;   // 新人不继承旧表情
  einmal.sprichBis = 0; einmal.blinzPlan = null;   // 也不继承旧演出
  try { history.replaceState(null, '', '?seed=' + saat); } catch (e) { /* file:// 可能拒绝 */ }
  setTimeout(frisch, 100);
});

document.getElementById('speicher').addEventListener('click', () => {
  const url = avatarPNG();          // 永远现算：不吃可能过期的延迟快照
  window.__avatarPNG = url;
  const a = document.createElement('a');
  a.href = url;
  a.download = `papier-avatar-${saat}.png`;
  a.click();
});

// 逗它：按钮触发（表情/视线为开关，主按钮样式的「回神」清空），点画布随机来一个
const GESTEN = ['sprich', 'blinz', 'froh', 'boese', 'traurig', 'muede', 'links', 'rechts'];
const gesichtKnopfListe = [...document.querySelectorAll('#gesichte button')];
gesichtKnopfListe.forEach((b) => {
  b.addEventListener('click', () => gesichtAktion(b.dataset.g));
});
canvas.addEventListener('click', () => gesichtAktion(GESTEN[(Math.random() * GESTEN.length) | 0]));

// 开关态同步到按钮样式（按钮列表已缓存，不每帧查询）
function gesichtKnopfe() {
  for (const b of gesichtKnopfListe) {
    const g = b.dataset.g;
    const an = g === gesichtForm || (blickZiel && ((g === 'links' && blickZiel.x < 0) || (g === 'rechts' && blickZiel.x > 0)));
    b.classList.toggle('an', !!an);
  }
}

// 调试钩子：无头验证用（每帧刷新的纯状态对象，读取无副作用）
window.__avatar = { saat: 0, yaw: 0, wach: 1, plappertBis: 0, blinzeltBis: 0, gesicht: '' };
function hookSync() {
  const h = window.__avatar;
  h.saat = saat; h.yaw = kopf.yaw; h.wach = kopf.wach;
  h.plappertBis = kopf.plappertBis; h.blinzeltBis = kopf.blinzeltBis;
  h.gesicht = gesichtForm || '';
}
