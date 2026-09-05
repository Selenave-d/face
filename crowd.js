/* 纸上的小人 · 一群朋友 —— 仿 name-me（little followers）
 * app.js 只当引擎用（与合影模式同法），排版与主循环在这里：
 *   · 底部手绘滑块 1~500，非线性映射到 1~N 个可见的人，末位分数淡入；
 *   · 拖拽直接跟手，松手/键盘后 180ms 吸附到整数；
 *   · 拉满 500：全员循环起跳 + 手绘烟花，离开最大值即停；
 *   · URL 参数 ?count=N 可直接开场；人少时（≤12）报得出每个人的名字。
 */

/* ================= 站位与人群 ================= */

// 六档深度，后→前：越靠前个头越大、人数越少（站位本身按 name-me 式散点，见 platzeLegen）
const REIHEN_FAKTOR = [.6, .7, .82, .95, 1.1, 1.28];
const REIHEN_ZAHL = {
  breit: [10, 10, 9, 8, 6, 5],    // ≥1100px：48 人
  mittel: [9, 9, 8, 7, 5, 4],     // ≥720px：42 人
  schmal: [7, 7, 6, 6, 4, 4],     // 窄屏：34 人
};
const BODEN_RAUM = 158;    // 底部给滑块留的地
const TITEL_RAUM = 140;    // 顶部给标题+导航行留的天

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
  // （跨过 720/1100 宽度档时人数变了，站位会整体重排；同档内 resize 稳定）
  while (leute.length < anzahl) leute.push(new Head(saat + leute.length * 7));
  leute.length = anzahl;
  for (const h of leute) headCache(h);

  const rand = innerWidth * .04 + 14;
  const spanX = innerWidth - rand * 2;
  const bodenVorn = innerHeight - BODEN_RAUM;
  // 个头基准：最挤的一档也要塞得下（2.9 ≈ 平均肩宽 × 安全边）；散点比整行多浪费一成宽度
  let mass0 = Infinity;
  for (let r = 0; r < R; r++) {
    mass0 = Math.min(mass0, spanX / (plan[r] * REIHEN_FAKTOR[r] * 2.9 * 1.1));
  }
  // 天花板：最高的人（连帽子带名字）不许钻进标题区；超矮窗口（内嵌 iframe 等）兜底为正值，免得负缩放把人倒画
  let spanntMax = 0;
  for (const h of leute) spanntMax = Math.max(spanntMax, raumBedarf(h).oben + fussWelt(h) + .4);
  const sumF = REIHEN_FAKTOR.slice(1).reduce((a, b) => a + b, 0);
  mass0 = Math.max(3, Math.min(mass0, (bodenVorn - TITEL_RAUM) / (.48 * sumF + spanntMax * REIHEN_FAKTOR[0])));

  /* name-me 式自由站位：深度仍按六档出发（各档人数/个头比例照旧），但位置
   * 由"中心偏置 + 碰撞拒绝"采样散开——远看是一群人围着，不再是整齐的六排。
   * 布局只取决于（种子、人数），resize 时同一张脸仍站在同一个相对位置。 */
  const quer = strom(saat + anzahl * 97, 'haufen');
  const bodenHinten = bodenVorn - .48 * sumF * mass0;
  const spanBoden = bodenVorn - bodenHinten;
  const massVon = (v) => mass0 * (REIHEN_FAKTOR[0] + (REIHEN_FAKTOR[R - 1] - REIHEN_FAKTOR[0]) * v);

  const roh = [];
  // 前排先落位（第一个朋友站前排正中），再往后排撒——中心先被占住，聚堆感更强
  for (let r = R - 1; r >= 0; r--) {
    const vb = r / (R - 1);
    for (let k = 0; k < plan[r]; k++) {
      let wahl = null, wahlStand = -1;
      for (let versuch = 0; versuch < 36; versuch++) {
        // 前排头一个：先在正中 ±6% 挑位置，领衔的朋友一定站 C 位；
        // 其余人均匀散开、再按第二个随机把幅度往中间收（边上来得稀）
        const u = (r === R - 1 && k === 0 && versuch < 12)
          ? .5 + quer.range(-1, 1) * .06
          : .5 + quer.range(-1, 1) * .5 * (1 - .34 * Math.abs(quer.range(-1, 1)));
        // 深度从本档基准出发抖动 ±0.78 档，前后排的边界糊掉
        const v = clamp(vb + quer.range(-1, 1) * .78 / (R - 1), 0, 1);
        const m = massVon(v);
        const x = rand + u * spanX;
        const bodenY = bodenHinten + v * spanBoden;
        // 分离度 = 与已落位者两轴约束里最差的一个（≥1 即肩距与遮挡双达标）
        let stand = Infinity;
        for (const s of roh) {
          const dx = Math.abs(x - s.x), dy = Math.abs(bodenY - s.bodenY);
          stand = Math.min(stand, Math.max(dx / ((m + s.mass) * 1.5), dy / ((m + s.mass) * 1.05)));
        }
        if (stand >= 1) { wahl = { x, bodenY, mass: m, v }; break; }
        // 深度跨度小于遮挡半径，多数候选注定撞车：留分离度最高的那个，叠得最轻
        if (stand > wahlStand) { wahlStand = stand; wahl = { x, bodenY, mass: m, v }; }
      }
      roh.push(wahl);
    }
  }

  // 按地面深度排序：数组序 = 绘制序（后→前），leute 里的脸按这个序认领站位
  roh.sort((a, b) => a.bodenY - b.bodenY);
  plaetze = roh.map((p) => ({ ...p, rang: 0, reihe: Math.min(R - 1, Math.round(p.v * (R - 1))) }));
  // 出场序：第一个是前排正中（头一个朋友最醒目），其余从后到前、由中间向两边
  const mitte = innerWidth / 2;
  let vorn = 0, bestD = 1e9;
  plaetze.forEach((p, i) => {
    if (p.v < .82) return;
    const d = Math.abs(p.x - mitte);
    if (d < bestD) { bestD = d; vorn = i; }
  });
  plaetze.map((p, i) => ({ i, key: i === vorn ? -1 : p.v * 1e4 + Math.abs(p.x - mitte) }))
    .sort((a, b) => a.key - b.key)
    .forEach((e, rang) => { plaetze[e.i].rang = rang; });

  // 报得上名字的前 12 人：名字带离得太近的往下错一行（名字画在人群之上，见 rahmen）
  const gesetzt = [];
  for (const p of plaetze.filter((q) => q.rang <= 12).sort((a, b) => a.bodenY - b.bodenY)) {
    p.nameHub = 0;
    for (const b of gesetzt) {
      if (Math.abs(p.x - b.x) < 64 && Math.abs((p.bodenY + p.mass * .3) - (b.bodenY + b.mass * .3 + b.nameHub)) < 17) {
        p.nameHub = 17;
        break;
      }
    }
    gesetzt.push(p);
  }

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
let bodenStift = null, bodenTick = -1;   // 地面线与影子的笔（与滑块同款 8fps 沸腾）

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
// 庆祝重启节拍：等最慢的动作（挥手）跑完一个自然周期再全员重来，免得掐在半空
const FEIER_TAKT = Math.max(SPRUNG_PERIODE, AKTIONEN.wave.periode, AKTIONEN.dance.periode);

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
  // 全员周期性庆祝：多数人起跳，散着几个挥手/跳舞的，像真的在欢呼（name-me 式）
  if (t >= sprungBei) {
    leute.forEach((h, i) => {
      if (h.akBis > t + .05) return;   // 上一拍的动作还没演完：让它演完，下一拍归队
      const art = i % 6;
      const name = art === 1 ? 'wave' : art === 4 ? 'dance' : 'jump';
      h.setAktion(name, t, AKTIONEN[name].periode);   // 各按自然周期收尾，重开时不从半空拽回
    });
    sprungBei = t + FEIER_TAKT;
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

/* ================= 头部精灵缓存 =================
 * 一个人一张离屏画布：key 按 12fps 换帧（眨眼/嘟囔/动作过渡期间升到 24fps），
 * 48 人 × 60fps 的全量重算（颅骨点云投影 + 全部笔画）压成 miss 时才算，其余帧 drawImage。
 * 关键正确性：笔（stift）闭包绑着创建它的 ctx，离屏渲染前必须废弃旧笔。 */
function kopfSprite(h, p, t, namenAn) {
  const qt = Math.floor(t * 12) / 12;
  const schnell = (h.plappertBis > t || h.akVon || h.blinzeltBis > qt) ? 2 : 1;
  const key = `${Math.floor(t * 12 * schnell)}|${h.akName}|${namenAn ? 1 : 0}|${Math.round(p.mass * 10)}`;
  let sp = h.sprite;
  if (sp && sp.key === key) return sp;
  const sdpr = Math.min(dpr, p.reihe < 3 ? 1.25 : 1.75);   // 后排小精灵省显存
  const oben = raumBedarf(h).oben;
  const W = p.mass * 4.4;                    // 横向最远：挥手 ±2.4 / 帽檐 ±2.1，取保守值
  const H = (oben + fussWelt(h) + 1.55) * p.mass;   // 头顶余量 + 全身 + 脚下名字
  if (!sp) sp = h.sprite = { cv: document.createElement('canvas') };
  sp.key = key;
  sp.w = W; sp.h = H;
  sp.topY = h.cy - (oben + .95) * p.mass;    // 画布顶在屏幕上的 y（头顶余量含跳跃上抛）
  const pw = Math.max(1, Math.ceil(W * sdpr)), ph = Math.max(1, Math.ceil(H * sdpr));
  if (sp.cv.width !== pw || sp.cv.height !== ph) { sp.cv.width = pw; sp.cv.height = ph; }
  const cc = sp.cv.getContext('2d');
  cc.setTransform(sdpr, 0, 0, sdpr, 0, 0);
  cc.clearRect(0, 0, W, H);
  h.cache.stift = null; h.cache.stiftTick = -1; h.cache.stiftMass = -1;   // 换笔：笔绑着旧 ctx
  const proxy = Object.create(h);            // 只喂给 drawHead，绝不进 update()
  proxy.cx = W / 2;
  proxy.cy = h.cy - sp.topY;
  proxy.nameY = h.nameY - sp.topY;           // 名字是屏幕绝对坐标，换算进画布
  drawHead(cc, proxy, t);
  return sp;
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

  // 地面线：比最前排的脚再低几像素，画在人群后面，身体自然盖住脚后的线
  const bt = Math.floor(t * 8);
  if (bodenTick !== bt) { bodenStift = makeStift(ctx, 555, UI_PAL.tinte, 1, bt); bodenTick = bt; }
  const bodenY = innerHeight - BODEN_RAUM + 5;
  // 人多地陷：滑到八十人往上，地面线中点被慢慢压弯最多 6px——满 500 压到最低，
  // 与全员起跳同框（wert 拖拽中连续，拱度实时渐变）
  bodenStift.zug(
    [{ x: innerWidth * .04, y: bodenY }, { x: innerWidth * .5, y: bodenY + 3 + 3 * clamp((wert - 80) / 420, 0, 1) }, { x: innerWidth * .96, y: bodenY }],
    { spur: 'bodenlinie', w: 1.4, deckung: .6, eckig: true });

  // 人群：站位顺序已是后→前，直接按序画，前排自然盖住后排的脚
  const sicht = sichtbarAus(wert);
  const namenAn = sicht <= 12.5;   // 朋友还叫得出名字的时候，报上名来
  for (let i = 0; i < plaetze.length; i++) {
    const p = plaetze[i], h = leute[i];
    const alpha = clamp(sicht - p.rang, 0, 1);
    if (alpha <= 0) continue;
    h.update(dt, t, pointer);
    h.zeigeName = false;   // 名字改在人群之上统一画（循环后），不再被前排身体盖住
    if (alpha < 1) ctx.globalAlpha = alpha;
    // 脚下影子：三根短斜线，跳起时人离地、影子钉在原地并收窄变淡
    const dy = h.akName === 'jump' ? h.motionPose(t).dy : 0;
    const schrumpf = 1 - Math.max(0, -dy) * .7;
    for (let f = 0; f < 3; f++) {
      const fo = (f - 1) * .12;
      bodenStift.zug([
        { x: p.x + (fo - .1) * p.mass * schrumpf, y: p.bodenY + 2 + f },
        { x: p.x + (fo + .1) * p.mass * schrumpf, y: p.bodenY + 3 + f },
      ], { spur: `schatten${i}-${f}`, w: 1, deckung: .22 * schrumpf, eckig: true });
    }
    // 精灵缓存命中即贴图；未命中才整颗头重画（12fps 换帧，翻书感不变）
    const sp = kopfSprite(h, p, t, namenAn);
    ctx.drawImage(sp.cv, Math.round(p.x - sp.w / 2), Math.round(sp.topY), sp.w, sp.h);
    ctx.globalAlpha = 1;
  }
  // 名字画在人群之上：可见人数少时才报名，淡入与人同步，样式与单人页一致
  if (namenAn) {
    ctx.save();
    ctx.font = `13px "Kaiti", "STKaiti", "楷体", serif`;
    try { ctx.letterSpacing = '2px'; } catch (e) { /* 旧浏览器忽略 */ }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8b8894';
    for (let i = 0; i < plaetze.length; i++) {
      const p = plaetze[i];
      const alpha = clamp(sicht - p.rang, 0, 1);
      if (alpha <= 0) continue;
      if (alpha < 1) ctx.globalAlpha = alpha;
      ctx.fillText(leute[i].dna.name, p.x, p.bodenY + p.mass * .3 + (p.nameHub || 0));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
  plaetze: () => plaetze.map((p) => ({ rang: p.rang, x: Math.round(p.x), bodenY: Math.round(p.bodenY), v: +p.v.toFixed(2), mass: Math.round(p.mass) })),
  feier: () => feier,
  raketen: () => raketen.length,
};
