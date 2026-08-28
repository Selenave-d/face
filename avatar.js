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

// 方形舞台：居中偏上，避开顶部标题、动作行与底部按钮
function buehne() {
  const s = Math.min(innerWidth - 32, innerHeight - 216);
  return { s, x: (innerWidth - s) / 2, y: Math.max(78, (innerHeight - 62 - s) / 2) };
}

function zeichneBuehne(t) {
  const tick = Math.floor(t * 8);
  if (uiTick !== tick) { uiStift = makeStift(ctx, saat * 7 + 3, TINTE, 1, tick); uiTick = tick; }
  const b = buehne();
  // 一张略亮的纸片 + 手绘方框
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(b.x, b.y, b.s, b.s);
  uiStift.zug([
    { x: b.x, y: b.y }, { x: b.x + b.s, y: b.y },
    { x: b.x + b.s, y: b.y + b.s }, { x: b.x, y: b.y + b.s },
  ], { spur: 'rahmen', geschlossen: true, w: 1.4, deckung: .8 });
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
  const bedarf = raumBedarf(kopf);
  // 笔闭包绑 ctx：离屏渲染前作废旧笔；渲染后同样作废，主画布下一帧重绑
  kopf.cache.stift = null; kopf.cache.stiftTick = -1; kopf.cache.stiftMass = -1;
  const cx0 = kopf.cx, cy0 = kopf.cy, mass0 = kopf.mass;
  kopf.mass = PX / (bedarf.oben + 2.25);
  kopf.cx = PX / 2;
  kopf.cy = bedarf.oben * kopf.mass + PX * .07;
  drawHead(oc, kopf, performance.now() / 1000);
  kopf.cx = cx0; kopf.cy = cy0; kopf.mass = mass0;
  kopf.cache.stiftTick = -1; kopf.cache.stiftMass = -1;
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
  papier();
  zeichneBuehne(t);
  requestAnimationFrame(rahmen);
}

/* ================= 面部小动作（逗它） =================
 * 直接覆写引擎的视线/眼皮/嘴部状态；动作结束后 update() 的弹簧自然把脸拉回日常。 */
const aktion = {};

function gesichtAktion(art) {
  const t = performance.now() / 1000;
  if (art === 'sprich') aktion.sprichBis = t + 1.5;
  else if (art === 'blinz') aktion.blinzPlan = [t + .05, t + .45, t + .9];
  else if (art === 'muede') aktion.muedeBis = t + 2.8;
  else if (art === 'links' || art === 'rechts') {
    aktion.blickBis = t + 2.2;
    aktion.blickZiel = { x: art === 'links' ? -.55 : .55, y: 0 };
  }
}

function gesichtTick(t) {
  const qt = Math.floor(t * 12) / 12;
  if (t < (aktion.sprichBis || 0)) kopf.plappertBis = qt + .12;
  if (aktion.blinzPlan && aktion.blinzPlan.length && qt >= aktion.blinzPlan[0] - .02) {
    kopf.blinzeltBis = qt + .14;
    aktion.blinzPlan.shift();
  }
  if (t < (aktion.muedeBis || 0)) kopf.wach += (0.12 - kopf.wach) * .12;
  if (t < (aktion.blickBis || 0)) {
    kopf.yaw += (aktion.blickZiel.x - kopf.yaw) * .14;
    kopf.pitch += (aktion.blickZiel.y - kopf.pitch) * .14;
    kopf.blickX += (aktion.blickZiel.x * 1.6 - kopf.blickX) * .2;
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
  try { history.replaceState(null, '', '?seed=' + saat); } catch (e) { /* file:// 可能拒绝 */ }
  setTimeout(frisch, 100);
});

document.getElementById('speicher').addEventListener('click', () => {
  const url = window.__avatarPNG || avatarPNG();
  const a = document.createElement('a');
  a.href = url;
  a.download = `papier-avatar-${saat}.png`;
  a.click();
});

// 逗它：按钮触发，点画布（戳脸）随机来一个
const GESTEN = ['sprich', 'blinz', 'muede', 'links', 'rechts'];
document.querySelectorAll('#gesichte button').forEach((b) => {
  b.addEventListener('click', () => gesichtAktion(b.dataset.g));
});
canvas.addEventListener('click', () => gesichtAktion(GESTEN[(Math.random() * GESTEN.length) | 0]));

// 调试钩子：无头验证用（每帧刷新的纯状态对象，读取无副作用）
window.__avatar = { saat: 0, yaw: 0, wach: 1, plappertBis: 0, blinzeltBis: 0 };
function hookSync() {
  const h = window.__avatar;
  h.saat = saat; h.yaw = kopf.yaw; h.wach = kopf.wach;
  h.plappertBis = kopf.plappertBis; h.blinzeltBis = kopf.blinzeltBis;
}
