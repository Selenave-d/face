/* 纸上的小人 · 一群朋友 —— 仿 name-me（little followers）
 * app.js 只当引擎用（与合影模式同法），排版与主循环在这里：
 *   · 底部手绘滑块 1~500，非线性映射到 1~N 个可见的人，末位分数淡入；
 *   · 拖拽直接跟手，松手/键盘后 180ms 吸附到整数；
 *   · 拉满 500：全员循环起跳 + 手绘烟花，离开最大值即停；
 *   · URL 参数 ?count=N 可直接开场；人少时（≤12）报得出每个人的名字。
 */

/* ================= 站位与人群 ================= */

// 六排人，后→前：越靠前个头越大、人数越少
const REIHEN_FAKTOR = [.6, .7, .82, .95, 1.1, 1.28];
const REIHEN_ZAHL = {
  breit: [10, 10, 9, 8, 6, 5],    // ≥1100px：48 人
  mittel: [9, 9, 8, 7, 5, 4],     // ≥720px：42 人
  schmal: [7, 7, 6, 6, 4, 4],     // 窄屏：34 人
};
const BODEN_RAUM = 158;    // 底部给滑块留的地
const TITEL_RAUM = 100;    // 顶部给标题留的天

let saat = 91;             // 人群种子（换一群时重掷）
let leute = [];            // Head 实例，下标 = 站位（绘制顺序：后→前）
let plaetze = [];          // { x, bodenY, mass, rang }

// 头心到脚底的世界单位（与单人排版同一个公式）
const fussWelt = (h) => {
  const k = h.dna.kopf, kopfH = k.ry * 1.9;
  return k.ry + .16 + h.dna.koerper.ratio * kopfH;
};

function platzeLegen() {
  const plan = innerWidth >= 1100 ? REIHEN_ZAHL.breit
    : innerWidth >= 720 ? REIHEN_ZAHL.mittel : REIHEN_ZAHL.schmal;
  const R = plan.length;
  const anzahl = plan.reduce((a, b) => a + b, 0);
  // 窗口变宽只会在边上长出新面孔；变窄则从队尾收回
  while (leute.length < anzahl) leute.push(new Head(saat + leute.length * 7));
  leute.length = anzahl;
  for (const h of leute) headCache(h);

  const rand = innerWidth * .04 + 14;
  const bodenVorn = innerHeight - BODEN_RAUM;
  // 个头基准：最挤的一行也要塞得下（2.9 ≈ 平均肩宽 × 安全边）
  let mass0 = Infinity;
  for (let r = 0; r < R; r++) {
    mass0 = Math.min(mass0, (innerWidth - rand * 2) / (plan[r] * REIHEN_FAKTOR[r] * 2.9));
  }
  // 天花板：最高那排（连帽子带名字）不许钻进标题区；超矮窗口（内嵌 iframe 等）兜底为正值，免得负缩放把人倒画
  let spanntMax = 0;
  for (const h of leute) spanntMax = Math.max(spanntMax, raumBedarf(h).oben + fussWelt(h) + .4);
  const sumF = REIHEN_FAKTOR.slice(1).reduce((a, b) => a + b, 0);
  mass0 = Math.max(3, Math.min(mass0, (bodenVorn - TITEL_RAUM) / (.48 * sumF + spanntMax * REIHEN_FAKTOR[0])));
  const mass = REIHEN_FAKTOR.map((f) => f * mass0);
  // 地面线：前排最低，往后每行抬高约半个人
  const boden = new Array(R);
  boden[R - 1] = bodenVorn;
  for (let r = R - 2; r >= 0; r--) boden[r] = boden[r + 1] - .48 * mass[r + 1];

  // 站位：行内均分 + 种子抖动，构图每次 resize 都稳定
  const quer = strom(20260826, 'plaetze');
  plaetze = [];
  for (let r = 0; r < R; r++) {
    const n = plan[r], m = mass[r];
    const step = (innerWidth - rand * 2) / n;
    for (let i = 0; i < n; i++) {
      plaetze.push({
        x: rand + step * (i + .5) + quer.range(-1, 1) * step * .14,
        bodenY: boden[r] + quer.range(-1, 1) * m * .09,
        mass: m, reihe: r,
      });
    }
  }
  // 出场序：第一个是前排正中（头一个朋友最醒目），其余从后排到前排、由中间向两边
  const mitte = innerWidth / 2;
  let vorn = 0, bestD = 1e9;
  plaetze.forEach((p, i) => {
    if (p.reihe !== R - 1) return;
    const d = Math.abs(p.x - mitte);
    if (d < bestD) { bestD = d; vorn = i; }
  });
  plaetze.map((p, i) => ({ i, key: i === vorn ? -1 : p.reihe * 1e4 + Math.abs(p.x - mitte) }))
    .sort((a, b) => a.key - b.key)
    .forEach((e, rang) => { plaetze[e.i].rang = rang; });

  plaetze.forEach((p, i) => {
    const h = leute[i];
    h.mass = p.mass;
    h.cx = p.x;
    h.cy = p.bodenY - fussWelt(h) * p.mass;
    h.nameY = p.bodenY + p.mass * .3;
  });
}

/* ================= 计数：1~500 → 1~N ================= */

// 幂次映射：小数目段灵敏（第 2 个朋友约在 51 出现），大数目段每人都值好几个
function sichtbarAus(w) {
  return 1 + (leute.length - 1) * Math.pow((w - 1) / 499, 1.65);
}

let wert = 1, ziel = 1;      // wert 连续（拖拽/吸附中），ziel 是整数目标
let ziehe = false;           // 指针正握着手柄
let schnappVon = 0, schnappBis = 0, schnappT = -1;   // 松手/键盘后的整数吸附
let jetzt = 0;

function snappZu(n) {
  ziel = Math.round(clamp(n, 1, 500));
  schnappVon = wert;
  schnappBis = ziel;
  schnappT = jetzt;
}

// URL 参数 ?count=N 直接开场
{
  const n = parseInt(new URLSearchParams(location.search).get('count'), 10);
  if (n >= 1 && n <= 500) wert = ziel = n;
}

/* ================= 滑块 ================= */

const schieberEl = document.getElementById('schieber');
const zahlEl = document.getElementById('zahl');
const zaehlerEl = document.getElementById('zaehler');
const andereEl = document.getElementById('andere');

const UI_PAL = makePalette({ hautT: .5, haarT: .1, akzentT: .5, tinteT: .5 });
let schiebStift = null, schiebTick = -1;

function wertAusX(x) {
  const b = schieberEl.getBoundingClientRect();
  return 1 + 499 * clamp((x - b.left) / b.width, 0, 1);
}

schieberEl.addEventListener('pointerdown', (e) => {
  ziehe = true;
  schnappT = -1;
  schieberEl.setPointerCapture(e.pointerId);
  wert = ziel = wertAusX(e.clientX);
});
schieberEl.addEventListener('pointermove', (e) => {
  if (ziehe) wert = ziel = wertAusX(e.clientX);
});
// 触屏滚动接管 / 失焦时浏览器发 pointercancel 而非 pointerup：也要正常结束拖拽，
// 否则手柄永久卡在握住态、吸附动画失效
const endeZug = () => {
  if (!ziehe) return;
  ziehe = false;
  snappZu(wert);
};
schieberEl.addEventListener('pointerup', () => endeZug());
schieberEl.addEventListener('pointercancel', () => endeZug());
schieberEl.addEventListener('lostpointercapture', () => endeZug());
schieberEl.addEventListener('keydown', (e) => {
  if (e.key === 'Home') { e.preventDefault(); snappZu(1); return; }
  if (e.key === 'End') { e.preventDefault(); snappZu(500); return; }
  const schritt = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -25, PageUp: 25 }[e.key];
  if (schritt === undefined) return;
  e.preventDefault();
  snappZu(ziel + schritt);   // 以已提交的整数为基准，连按不会因吸附动画在飞而走丢
});

andereEl?.addEventListener('click', () => {
  saat = Math.floor(Math.random() * 1e9);
  leute = [];
  platzeLegen();
});

function schieberZeichnen(t) {
  const b = schieberEl.getBoundingClientRect();
  const tick = Math.floor(t * 8);
  if (schiebTick !== tick) {
    schiebStift = makeStift(ctx, 4242, UI_PAL.tinte, 1, tick);
    schiebTick = tick;
  }
  const U = 42;                 // 1 世界单位 = 42px，笔画粗细与头部一致的语言
  const L = b.width / U;
  const p = (wert - 1) / 499;
  const hx = L * p;
  const s = schiebStift;
  ctx.save();
  ctx.translate(b.left, b.top + b.height / 2);
  ctx.scale(U, U);
  // 轨道：上下双线围出一条槽
  s.zug([{ x: 0, y: -.12 }, { x: L, y: -.12 }], { spur: 'bahnO', w: .05, deckung: .75, eckig: true });
  s.zug([{ x: 0, y: .12 }, { x: L, y: .12 }], { spur: 'bahnU', w: .04, deckung: .5, eckig: true });
  // 刻度：1 / ¼ / ½ / ¾ / 500
  for (let i = 0; i <= 4; i++) {
    const x = L * i / 4, lang = (i === 0 || i === 4) ? .28 : .16;
    s.zug([{ x, y: .12 }, { x, y: .12 + lang }], { spur: 'tick' + i, w: .045, deckung: .6, eckig: true });
  }
  // 进度：斜排线像铅笔涂满，用的是调色板里的暖橘红
  for (let x = .12; x < hx - .1; x += .34) {
    s.zug([{ x, y: -.1 }, { x: x + .22, y: .1 }], { spur: 'schr' + (Math.round(x * 3) % 3), w: .032, deckung: .5, farbe: UI_PAL.akzent, eckig: true });
  }
  // 手柄：一个会抖的小圆钮，握住时胀一点
  const r = (ziehe ? .54 : .45) + Math.sin(t * 9) * .012;
  const kreis = [];
  for (let i = 0; i <= 14; i++) {
    const a = i / 14 * TAU;
    kreis.push({ x: hx + Math.cos(a) * r, y: Math.sin(a) * r });
  }
  s.zug(kreis, { spur: 'griff', w: .06, geschlossen: true, deckung: .95, spitz: .3 });
  s.zug([{ x: hx, y: -r * .6 }, { x: hx, y: r * .6 }], { spur: 'griffStrich', w: .05, deckung: .8, eckig: true });
  ctx.restore();
  // 端点数字（屏幕像素层，与页面 Courier 小字一致）
  ctx.save();
  ctx.font = '12px "Courier New", monospace';
  ctx.fillStyle = '#a89f93';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('1', b.left, b.top + b.height / 2 + 20);
  ctx.fillText('500', b.left + b.width, b.top + b.height / 2 + 20);
  ctx.restore();
}

let letzteZahl = -1;
function uiSync() {
  const n = Math.round(wert);
  if (n === letzteZahl) return;
  letzteZahl = n;
  zahlEl.textContent = n;
  zaehlerEl.textContent = n + ' / 500';
  schieberEl.setAttribute('aria-valuenow', n);
  schieberEl.setAttribute('aria-valuetext', n + ' 个朋友');
}

/* ================= 庆祝：满 500 全员起跳 + 烟花 ================= */

let feier = false;
let sprungBei = 0, raketenBei = 0;
const raketen = [];
let raketeSaat = 0;
const SPRUNG_PERIODE = 1.7;   // 起跳动作整周期（含落地回弹），重启要等它走完

// 低饱和的墨水烟花：暖红、赭金、苔绿、灰紫
const KNALL = [oklch(.68, .17, 28), oklch(.74, .15, 85), oklch(.66, .13, 152), oklch(.64, .15, 300)];

function machRakete(t) {
  const r = Math.random;
  const strahlen = [];
  const n = 9 + (r() * 5 | 0);
  for (let i = 0; i < n; i++) {
    strahlen.push({ a: r() * TAU, l: .72 + r() * .38, farbe: KNALL[(r() * KNALL.length) | 0] });
  }
  return {
    x: innerWidth * (.08 + r() * .84),
    y: TITEL_RAUM + 26 + r() * Math.min(innerHeight * .3, 250),
    seit: t, dauer: .85 + r() * .45,
    radius: Math.min(innerWidth, innerHeight) * (.055 + r() * .055),
    strahlen,
    spur: 'rk' + (raketeSaat++),
  };
}

function feierTick(t) {
  const voll = wert >= 499.5;
  if (voll && !feier) {
    feier = true;
    sprungBei = 0;
    raketenBei = 0;
  } else if (!voll) {
    feier = false;
    return;
  }
  // 全员同步起跳，落完整个周期（含回弹）再跳，不打断半空姿态
  if (t >= sprungBei) {
    for (const h of leute) h.setAktion('jump', t, SPRUNG_PERIODE);
    sprungBei = t + SPRUNG_PERIODE;
  }
  // 每零点几秒补一批烟花
  if (t >= raketenBei) {
    const n = 4 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) raketen.push(machRakete(t + Math.random() * .35));
    raketenBei = t + .72;
  }
}

let knallStift = null, knallTick = -1;

function raketenZeichnen(t) {
  if (!raketen.length) return;
  const tick = Math.floor(t * 8);
  if (knallTick !== tick) {
    knallStift = makeStift(ctx, 7331, UI_PAL.tinte, 1, tick);
    knallTick = tick;
  }
  const U = 44;
  for (let i = raketen.length - 1; i >= 0; i--) {
    const rk = raketen[i];
    const p = (t - rk.seit) / rk.dauer;
    if (p < 0) continue;
    if (p >= 1) { raketen.splice(i, 1); continue; }
    const wand = 1 - Math.pow(1 - p, 3);          // 先快后慢地张开
    const fade = Math.min(1, (1 - p) * 2.4);      // 尾段淡出
    ctx.save();
    ctx.translate(rk.x, rk.y);
    ctx.scale(U, U);
    const R = rk.radius / U;
    for (const st of rk.strahlen) {
      const l = st.l * R * wand;
      const cos = Math.cos(st.a), sin = Math.sin(st.a);
      knallStift.zug(
        [{ x: cos * R * .06, y: sin * R * .06 }, { x: cos * l, y: sin * l }],
        { spur: rk.spur + st.a, w: .05, deckung: .92 * fade, farbe: st.farbe },
      );
      knallStift.punkt({ x: cos * l, y: sin * l }, .09, st.farbe, { spur: rk.spur + 'p' + st.a, deckung: fade });
    }
    ctx.restore();
  }
}

/* ================= 主循环 ================= */

let vorige = 0;
function rahmen(now) {
  // __freezeT 是调试钩子：固定时间戳用来截指定状态
  const t = (typeof window !== 'undefined' && window.__freezeT != null) ? window.__freezeT : now / 1000;
  const dt = vorige ? Math.min(t - vorige, .05) : .016;
  vorige = t;
  jetzt = t;

  // 松手/键盘之后的整数吸附（180ms，先快后慢）
  if (!ziehe && schnappT >= 0) {
    const f = clamp((t - schnappT) / .18, 0, 1);
    wert = schnappVon + (schnappBis - schnappVon) * (1 - (1 - f) * (1 - f));
    if (f >= 1) { wert = schnappBis; schnappT = -1; }
  }

  papier();
  feierTick(t);

  // 人群：站位顺序已是后→前，直接按序画，前排自然盖住后排的脚
  const sicht = sichtbarAus(wert);
  const namenAn = sicht <= 12.5;   // 朋友还叫得出名字的时候，报上名来
  for (let i = 0; i < plaetze.length; i++) {
    const p = plaetze[i], h = leute[i];
    const alpha = clamp(sicht - p.rang, 0, 1);
    if (alpha <= 0) continue;
    h.update(dt, t, pointer);
    h.zeigeName = namenAn;
    if (alpha < 1) ctx.globalAlpha = alpha;
    drawHead(ctx, h, t);
    ctx.globalAlpha = 1;
  }
  raketenZeichnen(t);
  schieberZeichnen(t);
  uiSync();
  requestAnimationFrame(rahmen);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  platzeLegen();
}
addEventListener('resize', resize);
resize();
requestAnimationFrame(rahmen);

/* 调试钩子：无头验证用 */
window.__menge = {
  v: 2,
  set: (n) => snappZu(n),
  zieh: (n) => { wert = ziel = clamp(n, 1, 500); },   // 跳过吸附动画
  wert: () => wert,
  sichtbar: () => sichtbarAus(wert),
  leute: () => leute.length,
  plaetze: () => plaetze.map((p) => ({ rang: p.rang, x: Math.round(p.x), mass: Math.round(p.mass) })),
  feier: () => feier,
  raketen: () => raketen.length,
};
