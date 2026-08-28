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

// 方形舞台：居中偏上，避开顶部标题与底部按钮
function buehne() {
  const s = Math.min(innerWidth - 32, innerHeight - 200);
  return { s, x: (innerWidth - s) / 2, y: Math.max(78, (innerHeight - 44 - s) / 2) };
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
  papier();
  zeichneBuehne(t);
  requestAnimationFrame(rahmen);
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
