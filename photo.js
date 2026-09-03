/* 班级合影小游戏 —— 涂鸦小孩版
 * 规则：两条架子上站 10 个孩子，点选 5 个拍合影，
 * 按他们共享最多的特征凑牌型计分；拍完入选的离开、补新面孔。
 * 角色由 doodle.js 生成（doodleRecipe/drawDoodle/doodleDims）；
 * 纸面/纸纹由 app.js 的 foto 模式提供（papier/makeStift/makePalette/pointer 等）。
 */
'use strict';

/* ================= 牌型 ================= */
/* 判定维度：物种 / 头顶 / 眼镜 / 发型大类（doodle.js 的 doodleDims）。
 * 每个维度把 5 个取值按重复度归类，取牌面最好的维度计分。 */

function kindZuege(kind) {
  return doodleDims(kind.rec);
}

// 一个维度 5 个取值 → [牌型名, 基础分, 倍率, 共享值说明]
function musterAusZaehl(zaehl) {
  const eintraege = Object.entries(zaehl).sort((a, b) => b[1] - a[1]);
  const c = eintraege.map((e) => e[1]);
  if (c[0] === 5) return ['一整窝', 160, 8, `全是${eintraege[0][0]}`];
  if (c[0] === 4) return ['四条', 110, 5, `四个${eintraege[0][0]}`];
  if (c[0] === 3 && c[1] === 2) return ['满堂红', 80, 4, `三${eintraege[0][0]}两${eintraege[1][0]}`];
  if (c[0] === 3) return ['三条', 50, 3, `三个${eintraege[0][0]}`];
  if (c[0] === 2 && c[1] === 2) return ['两对', 35, 2, `${eintraege[0][0]}+${eintraege[1][0]}`];
  if (c[0] === 2) return ['一对', 20, 1, `两个${eintraege[0][0]}`];
  return ['彩虹班', 60, 3, ''];   // 5 人全不同
}

/* ================= 道具 =================
 * 物件 = 种子化参数包 + 一幅铅笔小画 + 一条计分效果（数值即画法：
 * 灯笼光圈多大就加多少分、喇叭口多大就喊多响、玩偶画的是什么动物就补什么物种）。
 * 效果在 besteHand 计分管线里按顺序应用。
 */

const REQUISITEN = {
  denglong: {
    name: '灯笼',
    roll: (r) => ({ r: r.range(.8, 1.6) }),
    desc: (p) => `基础分 +${Math.round(p.r * 20)}`,
    draw(st, x, y, s, p) {
      const rw = s * .3 * Math.sqrt(p.r), rh = s * .36 * Math.sqrt(p.r);
      st.line(kreisPts(x, y, s * .5 * p.r, s * .5 * p.r, 20, .03, 8), 1, { closed: true, label: 4, alpha: .3 });
      st.line(kreisPts(x, y, rw, rh, 16, .05, 7), 1.5, { closed: true, label: 1 });
      st.line([[x - rw * .55, y - rh], [x + rw * .55, y - rh]], 1.4, { label: 2 });
      st.line([[x - rw * .45, y + rh], [x + rw * .45, y + rh]], 1.4, { label: 3 });
      st.line([[x, y - rh - s * .05], [x, y - rh - s * .12]], 1.2, { label: 5 });
    },
    basis: (p) => Math.round(p.r * 20),
    note: (p) => `+灯笼${Math.round(p.r * 20)}`,
  },
  laba: {
    name: '喇叭',
    roll: (r) => ({ winkel: r.range(.5, 1.1) }),
    desc: () => '倍率 ≥3 时 +1',
    draw(st, x, y, s, p) {
      const a = p.winkel;
      st.line([[x - s * .3, y - s * .1], [x + s * .28, y - s * .1 - a * s * .22], [x + s * .28, y + s * .1 + a * s * .22], [x - s * .3, y + s * .1]], 1.5, { closed: true, label: 1 });
      st.line(kreisPts(x + s * .28, y, s * .07, a * s * .22, 12, .05, 3), 1.3, { closed: true, label: 2 });
      st.line([[x - s * .34, y - s * .06], [x - s * .3, y], [x - s * .34, y + s * .06]], 1.2, { label: 4 });
    },
    note: () => '喇叭×+1',
  },
  wanou: {
    name: '玩偶',
    roll: (r) => ({ art: r.pick(['dog', 'cat', 'rabbit', 'bear']) }),
    desc: (p) => `物种计数：${ART_NAME[p.art]} +1`,
    draw(st, x, y, s, p) {
      // 小动物头 + 身体，耳朵随物种（画的是什么动物就补什么）
      st.line(kreisPts(x, y - s * .12, s * .2, s * .18, 14, .05, 5), 1.4, { closed: true, label: 1 });
      if (p.art === 'cat') {
        for (const sd of [-1, 1]) st.line([[x + sd * s * .08, y - s * .27], [x + sd * s * .14, y - s * .4], [x + sd * s * .19, y - s * .26]], 1.3, { closed: true, label: 2 + sd });
      } else if (p.art === 'dog') {
        for (const sd of [-1, 1]) st.line(bogenPts(x + sd * s * .19, y - s * .05, s * .08, s * .16, sd > 0 ? -.8 : Math.PI + -.8, sd > 0 ? .8 : Math.PI + .8, 6), 1.3, { label: 4 + sd });
      } else if (p.art === 'rabbit') {
        for (const sd of [-1, 1]) st.line(bogenPts(x + sd * s * .08, y - s * .42, s * .05, s * .16, Math.PI * .9, Math.PI * 2.1, 6), 1.3, { label: 6 + sd });
      } else {
        for (const sd of [-1, 1]) st.line(bogenPts(x + sd * s * .13, y - s * .27, s * .07, s * .08, Math.PI, TAU2, 6), 1.3, { label: 8 + sd });
      }
      st.dot(x - s * .06, y - s * .13, s * .018, .8, 10);
      st.dot(x + s * .06, y - s * .13, s * .018, .8, 11);
      st.line([[x - s * .04, y - s * .06], [x + s * .04, y - s * .05]], 1.1, { label: 12 });
      st.line(kreisPts(x, y + s * .2, s * .13, s * .11, 12, .05, 6), 1.3, { closed: true, label: 13 });
    },
    extraCount: (p) => ({ dim: 'art', value: ART_NAME[p.art], n: 1, note: `玩偶+1${ART_NAME[p.art]}` }),
  },
  yanjing: {
    name: '眼镜盒',
    roll: () => ({}),
    desc: () => '眼镜共享计数 +1',
    draw(st, x, y, s, p) {
      st.line([[x - s * .32, y - s * .1], [x + s * .32, y - s * .1], [x + s * .36, y + s * .12], [x - s * .36, y + s * .12]], 1.5, { closed: true, label: 1 });
      for (const sd of [-1, 1]) st.line(kreisPts(x + sd * s * .12, y - s * .02, s * .09, s * .09, 12, .04, 2 + sd), 1.3, { closed: true, label: 3 + sd });
      st.line([[x - s * .03, y - s * .02], [x + s * .03, y - s * .02]], 1.1, { label: 5 });
    },
    extraCount: () => ({ dim: 'brille', value: '有镜', n: 1, note: '眼镜盒+1' }),
  },
  qizhi: {
    name: '旗帜',
    roll: () => ({}),
    desc: () => '彩虹班 ×2',
    draw(st, x, y, s, p) {
      st.line([[x - s * .28, y - s * .38], [x - s * .28, y + s * .38]], 1.5, { label: 1 });
      // 五色旗面（彩虹班 = 五个全不同）
      for (let i = 0; i < 5; i++) {
        st.line([[x - s * .28, y - s * .36 + i * s * .09], [x + s * .26, y - s * .36 + i * s * .09 + Math.sin(i * 2) * s * .02]], 1.4, { label: 2 + i, alpha: .45 + i * .12 });
      }
      st.line([[x - s * .28, y - s * .38], [x + s * .26, y - s * .34], [x + s * .26, y + s * .1], [x - s * .28, y + s * .08]], 1.3, { label: 7, alpha: .8 });
    },
    note: () => '旗帜×2',
  },
  xiangpi: {
    name: '橡皮',
    roll: () => ({}),
    desc: () => '一对升级为两对',
    draw(st, x, y, s, p) {
      st.line([[x - s * .26, y - s * .12], [x + s * .2, y - s * .12], [x + s * .26, y + s * .1], [x - s * .2, y + s * .1]], 1.5, { closed: true, label: 1 });
      st.line([[x - s * .02, y - s * .12], [x + s * .04, y + s * .1]], 1.2, { label: 2 });
      // 擦到一半的字和碎屑
      st.line([[x - s * .3, y + s * .24], [x - s * .05, y + s * .24]], 1.4, { label: 3, alpha: .3 });
      st.dot(x + s * .12, y + s * .22, s * .015, .5, 4);
      st.dot(x + s * .2, y + s * .26, s * .012, .5, 5);
    },
    note: () => '橡皮升级',
  },
};

/* 计分管线：牌型 → 橡皮升级 → 灯笼基础分 → 旗帜/喇叭倍率 → 汇总 */
function besteHand(kinder, items = []) {
  const dims = ['art', 'kopf', 'brille', 'frisur'];
  const extras = items.map((it) => REQUISITEN[it.familie].extraCount?.(it.params)).filter(Boolean);
  let best = null;
  for (const dim of dims) {
    const zaehl = {};
    for (const k of kinder) {
      const v = kindZuege(k)[dim];
      zaehl[v] = (zaehl[v] || 0) + 1;
    }
    for (const ex of extras) if (ex.dim === dim) zaehl[ex.value] = (zaehl[ex.value] || 0) + ex.n;
    const [name, basis, mult, info] = musterAusZaehl(zaehl);
    const punkte = (basis + kinder.length * 10) * mult;
    if (!best || punkte > best.punkte) best = { name, basis, mult, dim, punkte, info };
  }
  const notes = [];
  for (const ex of extras) if (ex.dim === best.dim) notes.push(ex.note);
  // 橡皮：只有一对时擦掉一个异类，升级为两对
  if (best.name === '一对' && items.some((it) => it.familie === 'xiangpi')) {
    best = { ...best, name: '两对', basis: 35, mult: 2 };
    notes.push(REQUISITEN.xiangpi.note());
  }
  // 灯笼：光圈换成基础分
  let basis = best.basis;
  for (const it of items) {
    if (it.familie === 'denglong') {
      basis += REQUISITEN.denglong.basis(it.params);
      notes.push(REQUISITEN.denglong.note(it.params));
    }
  }
  // 倍率类：旗帜（彩虹班 ×2）、喇叭（倍率 ≥3 再 +1）
  let mult = best.mult;
  if (best.name === '彩虹班' && items.some((it) => it.familie === 'qizhi')) {
    mult *= 2;
    notes.push(REQUISITEN.qizhi.note());
  }
  if (mult >= 3 && items.some((it) => it.familie === 'laba')) {
    mult += 1;
    notes.push(REQUISITEN.laba.note());
  }
  const punkte = (basis + kinder.length * 10) * mult;
  return { ...best, basis, mult, punkte, notes };
}

/* ================= 班级过滤器 =================
 * 偏好而非隐藏：新孩子按过滤器收敛（80% 命中），已站架的不受影响。
 * 选择不进种子、不持久化。 */

const filter = { art: 'alle', media: 'alle' };

/* ================= 班级 ================= */

const KINDER_PRO_REIHE = 5;
const kinder = [];
let klassenSeed = (Math.random() * 1e9) | 0;   // 每次打开都是新的一班
let gesamt = 0;                 // 累计总分
const knipsBtn = document.getElementById('knips');

function neuesKind(platz) {
  const seed = klassenSeed++;
  // 过滤器：偏好收敛（80% 命中），"全部"按配方权重
  const erzwinge = {};
  const fr = strom(seed, 'filter');
  if (filter.art !== 'alle' && fr.chance(.8)) erzwinge.art = filter.art;
  if (filter.media !== 'alle' && fr.chance(.8)) erzwinge.media = filter.media;
  const rec = doodleRecipe(seed, erzwinge);
  return {
    rec, platz,
    name: chinesischerName(strom(rec.seed, 'name')),
    blinkWuerfel: strom(rec.seed, 'blinzeln').n,
    naeBlink: 1 + strom(rec.seed, 'blinzeln').n() * 4,
    blinkBis: 0,
    hopT: -9, hopAmp: 0,        // 弹跳（选中/拍照）
    face: 'ruhig',              // 表情：ruhig|froh|boese|angst|weint|schlaeft
    bx: 0, by: 0,               // 平滑后的视线（-1..1）
    launeWuerfel: strom(rec.seed, 'laune').n,
    laune: null, launeBis: 0,   // 偶发小情绪（自己笑/恼/哭/打盹）
    naechsteLaune: 6 + strom(rec.seed, 'laune').n() * 18,
    ox: 0, oy: 0,               // 过场位移（走入/走出）
    zustand: 'da',              // da | geht | kommt
    seit: 0,
  };
}

// 两排架子：后排略小略高，前排略大略低
function platzGeometrie(platz) {
  const reihe = Math.floor(platz / KINDER_PRO_REIHE);   // 0 = 后排, 1 = 前排
  const i = platz % KINDER_PRO_REIHE;
  const hinten = reihe === 0;
  const fussY = innerHeight * (hinten ? .5 : .8);
  const x = innerWidth * ((i + .5) / KINDER_PRO_REIHE);
  return { x, fussY, hinten };
}

function platzieren(kind) {
  const g = platzGeometrie(kind.platz);
  // 涂鸦小孩总高约 1.65k：k 由行高推出；窄屏再按「每行 5 人的间隔」收紧，前排不至于叠成一串
  kind.k = Math.min(g.hinten ? innerHeight * .115 : innerHeight * .15, innerWidth / 5.6);
  kind.x = g.x + kind.ox;
  kind.footY = g.fussY + kind.oy;
  kind.nameY = g.fussY + kind.k * .2 + kind.oy;
  kind.g = g;
}

for (let p = 0; p < KINDER_PRO_REIHE * 2; p++) {
  const kind = neuesKind(p);
  kinder.push(kind);
}

/* ================= 选择 ================= */

const gewaehlt = new Set();

function kindBei(x, y) {
  let best = null, bestD = 1e9;
  for (const kind of kinder) {
    if (kind.zustand !== 'da') continue;
    const dx = x - kind.x, dy = y - (kind.footY - kind.k * .85);
    const d = Math.hypot(dx / (kind.k * .62), dy / (kind.k * 1.0));
    if (d < 1 && d < bestD) { bestD = d; best = kind; }
  }
  return best;
}

function waehle(kind, t) {
  if (!kind || kind.zustand !== 'da') return false;
  const idx = kinder.indexOf(kind);
  if (gewaehlt.has(idx)) {
    gewaehlt.delete(idx);
    kind.face = 'ruhig';
  } else {
    if (gewaehlt.size >= 5) return false;
    gewaehlt.add(idx);
    kind.hopT = t;              // 选中原地小跳一下
    kind.hopAmp = .3;
    kind.face = 'froh';         // 被选中就笑
  }
  knipsBtn.disabled = gewaehlt.size !== 5;
  return true;
}

canvas.addEventListener('click', (e) => {
  const t = performance.now() / 1000;
  if (klickSperre) { klickSperre = false; return; }   // 长按逗完表情，吞掉这次 click
  if (phase === 'draft') {           // 二选一期间点选孩子无效
    const i = karteBei(e.clientX, e.clientY);
    if (i >= 0) draftPick(i, t);
    return;
  }
  if (phase !== 'idle') return;
  waehle(kindBei(e.clientX, e.clientY), t);
});

/* 长按逗一下：按住一个孩子 ~0.4s 循环换表情（单击仍是选择/取消，互不干扰） */
const FOLGE = ['ruhig', 'froh', 'boese', 'angst', 'weint', 'schlaeft'];
let klickSperre = false;
let druckTimer = 0;
canvas.addEventListener('pointerdown', (e) => {
  klickSperre = false;
  if (phase !== 'idle') return;
  const kind = kindBei(e.clientX, e.clientY);
  if (!kind) return;
  clearTimeout(druckTimer);
  druckTimer = setTimeout(() => {
    if (phase !== 'idle') return;
    klickSperre = true;
    kind.laune = null;                     // 手动表情优先，压过自动小情绪
    const i = FOLGE.indexOf(kind.face);
    kind.face = FOLGE[(i >= 0 ? i + 1 : 1) % FOLGE.length];
    kind.hopT = performance.now() / 1000;  // 换表情小跳一下：输入要有即时可见反馈
    kind.hopAmp = .2;
  }, 400);
});
const druckEnde = () => clearTimeout(druckTimer);
canvas.addEventListener('pointerup', druckEnde, { passive: true });
canvas.addEventListener('pointerleave', druckEnde, { passive: true });
canvas.addEventListener('pointercancel', druckEnde, { passive: true });

/* ================= 拍合影过场 ================= */

let phase = 'idle';           // idle | sprung | draft | raus | rein
let sprungT = 0;              // 拍照时刻（整个过场按绝对时间表推进）
let rausBeginn = 0, reinBeginn = 0;
let rausFertig = false;       // 补位是否已执行（幂等，冻结时间下也安全）
let ergebnis = null;          // { name, basis, mult, punkte, dim, notes }
let bannerBis = 0;

// 道具：已收物件（最多 6，收满替换最旧）与二选一状态
const besitz = [];
let draft = null;             // { items:[a,b], seit, wahl, wahlT, umgesetzt }
let draftZaehler = 0;

/* 冲洗合影：拍照后在右下角留一张贴纸照片（五人小合影 + 牌型标题），
 * 最多叠三张当成绩册——旧的垫在下面，越旧越偏越淡。 */
const abzuege = [];           // { recs: [...5], titel }

/* 墨渍：墨水介质的孩子离场时，在站过的架子上留一片渐渐变淡的墨渍（墙上的记忆） */
const mauernFlecken = [];     // { x, y, seed, von }

function machRequisit() {
  const r = strom((klassenSeed * 7 + ++draftZaehler * 7919) | 0, 'requisit');
  // 未拥有的家族优先；全齐了就随便来（收下时会替换最旧）
  const frei = Object.keys(REQUISITEN).filter((f) => !besitz.some((b) => b.familie === f));
  const familie = frei.length ? r.pick(frei) : r.pick(Object.keys(REQUISITEN));
  return { familie, params: REQUISITEN[familie].roll(r) };
}

function draftStart(t) {
  draft = { items: [machRequisit(), machRequisit()], seit: t, wahl: -1, wahlT: 0, umgesetzt: false };
  phase = 'draft';
}

function draftPick(i, t) {
  if (phase !== 'draft' || !draft || draft.wahl >= 0) return;
  draft.wahl = i;
  draft.wahlT = t;
  const item = draft.items[i];
  if (besitz.length >= 6) besitz.shift();   // 收满后新收的替换最旧
  besitz.push(item);
}

function knips(t) {
  if (gewaehlt.size !== 5 || phase !== 'idle') return;
  ergebnis = besteHand([...gewaehlt].map((i) => kinder[i]), besitz);
  gesamt += ergebnis.punkte;
  bannerBis = t + 2;
  // 冲洗一张贴纸照片：记住这五个人和牌型
  abzuege.push({ recs: [...gewaehlt].map((i) => kinder[i].rec), titel: ergebnis.name });
  if (abzuege.length > 3) abzuege.shift();
  phase = 'sprung';
  sprungT = t;
  rausFertig = false;
  let staffel = 0;
  for (const i of gewaehlt) {
    kinder[i].hopT = t + staffel++ * .06;   // 拍照齐跳（略错峰）
    kinder[i].hopAmp = .5;
  }
}
knipsBtn.addEventListener('click', () => knips(performance.now() / 1000));

// 换一班：全新十个孩子，总分与道具保留，状态机回 idle，架上陈设跟着换
function neueKlasse() {
  gewaehlt.clear();
  knipsBtn.disabled = true;
  phase = 'idle';
  ergebnis = null;
  draft = null;
  dekoSaat = Math.floor(Math.random() * 1e9);
  kinder.length = 0;
  for (let p = 0; p < KINDER_PRO_REIHE * 2; p++) kinder.push(neuesKind(p));
}
document.getElementById('klasse').addEventListener('click', neueKlasse);

function phaseTick(t) {
  if (phase === 'idle') return;
  const e = t - sprungT;
  if (e > 1.1 && phase === 'sprung') draftStart(t);
  // 二选一超过 8 秒没点：自动收下左边那张（防"卡住"）
  if (phase === 'draft' && draft.wahl < 0 && t - draft.seit > 8) draftPick(0, t);
  // 二选一收下后，走原补位流程（离开 → 新面孔 → 回 idle）
  if (phase === 'draft' && draft.wahl >= 0 && t - draft.wahlT > .35 && !draft.umgesetzt) {
    draft.umgesetzt = true;
    phase = 'raus';
    rausBeginn = t;
    for (const i of gewaehlt) {
      const kind = kinder[i];
      kind.zustand = 'geht'; kind.seit = t; kind.face = 'weint';
      if (kind.rec.media === 'ink') {   // 墨水孩子走的时候渗一片墨渍在架子上
        mauernFlecken.push({ x: kind.x, y: kind.footY - kind.k * .15, seed: kind.rec.seed, von: t });   // .15k：下缘吻住架子线
        if (mauernFlecken.length > 8) mauernFlecken.shift();
      }
    }
  }
  if (phase === 'raus' && t - rausBeginn > .7 && !rausFertig) {
    rausFertig = true;
    phase = 'rein';
    reinBeginn = t;
    for (const i of [...gewaehlt]) {
      const kind = neuesKind(kinder[i].platz);
      kind.zustand = 'kommt';
      kind.seit = t;
      kind.face = 'angst';
      kind.ox0 = (kind.platz % KINDER_PRO_REIHE < 2.5 ? -1 : 1) * innerWidth * .3;
      kind.ox = kind.ox0;
      kinder[i] = kind;
    }
    gewaehlt.clear();
    knipsBtn.disabled = true;
  }
  if (phase === 'rein' && t - reinBeginn > .7) {
    phase = 'idle';
    draft = null;
  }
}

/* ================= 过滤器按钮绑定 ================= */

for (const [gruppe, key] of [['filterArt', 'art'], ['filterMedia', 'media']]) {
  const box = document.getElementById(gruppe);
  if (!box) continue;
  box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    filter[key] = b.dataset.v;
    box.querySelectorAll('button').forEach((x) => x.classList.toggle('an', x === b));
    neueKlasse();   // 过滤器立即生效：整班按新偏好重抽
  }));
}

/* ================= 绘制 ================= */

const TINTE = makePalette({ hautT: .5, haarT: .1, akzentT: .5, tinteT: .5 }).tinte;
let wandStift = makeStift(ctx, 42, TINTE, 1, 0), wandTick = 0;
// 架子线/选中圈按 8fps 换笔沸腾，与全站笔触节奏一致（笔的噪声按 tick 量化）
function wandPenne(t) {
  const tick = Math.floor(t * 8);
  if (wandTick !== tick) { wandStift = makeStift(ctx, 42, TINTE, 1, tick); wandTick = tick; }
  return wandStift;
}

function regale(t) {
  // 两条架子线：手绘横线，脚下三尺
  for (const reihe of [0, 1]) {
    const g = platzGeometrie(reihe * KINDER_PRO_REIHE);
    wandPenne(t).zug(
      [{ x: innerWidth * .06, y: g.fussY + 4 }, { x: innerWidth * .5, y: g.fussY + 6 }, { x: innerWidth * .94, y: g.fussY + 4 }],
      { spur: `regal${reihe}`, w: 1.4, wackel: .5, farbe: TINTE, deckung: .75 });
  }
}

/* ================= 架上陈设：纯装饰小物 =================
 * 与计分道具（REQUISITEN）无关：书摞/盆栽/笔筒只站在架子的空档里当布景。
 * 布局由 dekoSaat 记忆（换一班换陈设），label 用 400+ 段，不与道具/卡片冲突。 */

const REGAL_DEKO = {
  // 一摞书：2~4 本微错位的圆角方块摞起来，书脊一道刻线
  buecher: {
    draw(st, x, y, s, r, lb) {
      const n = 2 + Math.floor(r.n() * 2.99);
      let yy = y;
      for (let i = 0; i < n; i++) {
        const bw = s * (.5 + r.n() * .2), bh = s * (.16 + r.n() * .06);
        const x0 = x - bw / 2 + r.range(-1, 1) * s * .04;
        const kip = r.range(-1, 1) * s * .045;
        st.line([[x0, yy], [x0 + bw, yy], [x0 + bw + kip, yy - bh], [x0 + kip, yy - bh]], 1.1, { label: lb + i, closed: true, alpha: .82 });
        st.line([[x0 + bw * .52, yy], [x0 + bw * .52 + kip, yy - bh]], .7, { label: lb + 4 + i, alpha: .4 });   // 4+i ≤ 7，不撞下一槽基值
        yy -= bh * .92;
      }
    },
  },
  // 小盆栽：梯形盆 + 盆沿，3~5 笔从盆口张开的弧形叶
  topf: {
    draw(st, x, y, s, r, lb) {
      const tw = s * .34;
      st.line([[x - tw / 2, y - s * .42], [x + tw / 2, y - s * .42], [x + tw * .34, y], [x - tw * .34, y]], 1.1, { label: lb, closed: true, alpha: .85 });
      st.line([[x - tw * .55, y - s * .46], [x + tw * .55, y - s * .46]], 1, { label: lb + 1, alpha: .7 });
      const n = 3 + Math.floor(r.n() * 2.6);
      for (let i = 0; i < n; i++) {
        const mitte = Math.PI * 1.5 + (i / Math.max(1, n - 1) - .5) * 1.9;
        st.line(bogenPts(x, y - s * .44, s * .17, s * .33, mitte - .45, mitte + .45, 6), 1.1, { label: lb + 2 + i, alpha: .8 });
      }
    },
  },
  // 笔筒水杯：两侧竖线 + 杯口半椭圆 + 水面浅弧，斜插一支铅笔
  becher: {
    draw(st, x, y, s, r, lb) {
      const bw = s * .13, bh = s * .42;
      st.line([[x - bw, y], [x - bw - s * .012, y - bh]], 1.1, { label: lb, alpha: .85 });
      st.line([[x + bw, y], [x + bw + s * .012, y - bh]], 1.1, { label: lb + 1, alpha: .85 });
      st.line(bogenPts(x + s * .006, y - bh, bw, s * .035, Math.PI, Math.PI * 2, 7), 1.1, { label: lb + 2, alpha: .85 });
      st.line(bogenPts(x, y - bh * .55, bw * .94, s * .028, 0, Math.PI, 7), .8, { label: lb + 3, alpha: .5 });
      st.line([[x - bw * .3, y - bh * .92], [x + bw * .55, y - bh * 1.5]], 1, { label: lb + 4, alpha: .8 });
      st.line([[x + bw * .46, y - bh * 1.42], [x + bw * .64, y - bh * 1.56]], 1.3, { label: lb + 5, alpha: .8 });
    },
  },
};

let dekoSaat = Math.floor(Math.random() * 1e9);
let dekoMemo = { saat: -1, slots: null };

function regalDekoSlots() {
  if (dekoMemo.saat !== dekoSaat) {
    const r = strom(dekoSaat, 'deko');
    const lucken = [0, 1, 2, 3];   // 孩子槽位之间的四个空档（宽度的 20/40/60/80%）
    for (let i = lucken.length - 1; i > 0; i--) {
      const j = Math.floor(r.n() * (i + 1));
      [lucken[i], lucken[j]] = [lucken[j], lucken[i]];
    }
    dekoMemo = {
      saat: dekoSaat,
      slots: lucken.slice(0, 2 + Math.floor(r.n() * 1.9)).map((luck, i) => ({
        luck,
        reihe: r.n() < .55 ? 0 : 1,
        typ: ['buecher', 'topf', 'becher'][Math.floor(r.n() * 3)],
        lb: 400 + i * 8,
      })),
    };
  }
  return dekoMemo.slots;
}

function zeichneRegalDeko(t) {
  if (innerWidth < 640) return;   // 窄屏孩子已彼此相叠，空档放不下东西
  const st = requisitStift(t);
  for (const s of regalDekoSlots()) {
    const x = innerWidth * (s.luck + 1) / KINDER_PRO_REIHE;
    const y = innerHeight * (s.reihe === 0 ? .5 : .8) + 5;   // 底边吻住架子线
    // 每槽一条独立的参数流：每帧从头重放，物体形状逐帧稳定
    REGAL_DEKO[s.typ].draw(st, x, y, innerHeight * (s.reihe === 0 ? .055 : .075),
      strom(dekoSaat + s.luck * 197 + s.reihe * 31, 'deko'), s.lb);
  }
}

function zeichneWahl(kind, t) {
  // 选中：脚下画个圈
  const r = kind.k * (.6 + Math.sin(t * 3) * .02);
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    pts.push({ x: kind.x + Math.cos(a) * r, y: kind.footY + kind.k * .02 + Math.sin(a) * r * .22 });
  }
  wandPenne(t).zug(pts, { spur: 'wahl', geschlossen: true, w: 1.6, wackel: 1, deckung: .85, farbe: '#b0654a' });
}

function zeichneName(kind) {
  ctx.save();
  ctx.font = `13px "Kaiti", "STKaiti", "楷体", serif`;
  try { ctx.letterSpacing = '2px'; } catch (e) { /* 旧浏览器忽略 */ }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8b8894';
  ctx.fillText(kind.name, kind.x, kind.nameY);
  ctx.restore();
}

function zeichneBanner(t) {
  if (!ergebnis || t > bannerBis) return;
  const rest = bannerBis - t;
  const alpha = Math.min(1, rest / .5, (2 - rest) * 4 + .2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.font = '18px "Courier New", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2e2839';
  const dimName = { art: '物种', kopf: '头顶', brille: '眼镜', frisur: '发型' }[ergebnis.dim];
  const detail = ergebnis.info ? `${dimName}·${ergebnis.info}` : dimName;
  const requis = ergebnis.notes?.length ? `　${ergebnis.notes.join(' ')}` : '';
  // 手机端横幅下移，避开右上角的过滤器两行（其下沿约 145）
  ctx.fillText(`${ergebnis.name}！(${detail}) (${ergebnis.basis}+50)×${ergebnis.mult} = ${ergebnis.punkte}${requis}`, innerWidth / 2, innerWidth < 720 ? 164 : 92);
  ctx.restore();
}

function zeichneGesamt() {
  ctx.save();
  ctx.font = '12px "Courier New", ui-monospace, monospace';
  try { ctx.letterSpacing = '2px'; } catch (e) { /*  ignore */ }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a7268';
  // 手机端总分靠左，与右侧物种过滤器同一行；桌面居中在标题下
  if (innerWidth < 720) { ctx.textAlign = 'left'; ctx.fillText(`总分 ${gesamt}`, 16, 104); }
  else ctx.fillText(`总分 ${gesamt}`, innerWidth / 2, 64);
  // 长按逗表情的小提示（只在待机时显示，放在孩子头顶上方的空白带）
  if (phase === 'idle') {
    ctx.fillStyle = '#a89f93';
    ctx.fillText('长按孩子 逗一下表情', innerWidth / 2, 170);
  }
  ctx.restore();
}

/* ================= 道具绘制 ================= */

// 道具小画统一用石墨笔（8fps 沸腾与角色一致）
function requisitStift(t) { return bleiStift(ctx, Math.floor(t * 8), 'graphite', .5); }

// 卡片几何：中央两张 170×210（窄屏随宽度收缩，320px 的手机也能并排放下）
function kartenLayout() {
  const w = Math.min(170, Math.floor((innerWidth - 76) / 2)), h = Math.round(w * 210 / 170);
  const y = innerHeight / 2 - h / 2 - 10;
  return [
    { x: innerWidth / 2 - w - 24, y, w, h },
    { x: innerWidth / 2 + 24, y, w, h },
  ];
}
function karteBei(px, py) {
  if (!draft) return -1;
  const l = kartenLayout();
  for (let i = 0; i < 2; i++) {
    const k = l[i];
    if (px >= k.x && px <= k.x + k.w && py >= k.y && py <= k.y + k.h) return i;
  }
  return -1;
}

// 卡面圆角：没有 ctx.roundRect 的旧浏览器退回 arcTo 手画，
// 免得一次 TypeError 把整个 requestAnimationFrame 循环打断
function kartonRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function zeichneKarte(item, k, t, idx) {
  const st = requisitStift(t);
  const f = k.w / 170;   // 窄屏卡片收缩时，卡面内容同比缩放
  // 出现/收下的小弹跳（过冲曲线）
  const ein = Math.min(1, (t - draft.seit) / .35);
  const raus = draft.wahl === idx ? Math.min(1, (t - draft.wahlT) / .3) : 0;
  // 小弹跳：中途过冲 8%，落定回到原尺寸（命中框就是原尺寸，不能停在放大态）
  const skal = (.8 + .2 * ein + .18 * Math.sin(ein * Math.PI)) * (1 + raus * .25 * Math.sin(raus * Math.PI));
  ctx.save();
  ctx.translate(k.x + k.w / 2, k.y + k.h / 2);
  ctx.scale(skal, skal);
  // 卡面：纸白圆角卡 + 细框
  kartonRect(-k.w / 2, -k.h / 2, k.w, k.h, 10);
  ctx.fillStyle = 'rgba(246,243,237,.94)';
  ctx.fill();
  st.line([[-k.w / 2 + 8, -k.h / 2], [k.w / 2 - 8, -k.h / 2]], 1.1, { label: 300 + idx, alpha: .55 });
  st.line([[-k.w / 2 + 8, k.h / 2], [k.w / 2 - 8, k.h / 2]], 1.1, { label: 302 + idx, alpha: .55 });
  st.line([[-k.w / 2, -k.h / 2 + 8], [-k.w / 2, k.h / 2 - 8]], 1.1, { label: 304 + idx, alpha: .55 });
  st.line([[k.w / 2, -k.h / 2 + 8], [k.w / 2, k.h / 2 - 8]], 1.1, { label: 306 + idx, alpha: .55 });
  // 物件小画（96px REF 框）
  REQUISITEN[item.familie].draw(st, 0, -k.h / 2 + 66 * f, 96 * f, item.params);
  // 名字与效果
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '16px "Kaiti", "STKaiti", "楷体", serif';
  ctx.fillStyle = '#2e2839';
  ctx.fillText(REQUISITEN[item.familie].name, 0, 28 * f);
  ctx.font = '11px "Courier New", ui-monospace, monospace';
  ctx.fillStyle = '#7a7268';
  ctx.fillText(REQUISITEN[item.familie].desc(item.params), 0, 52 * f);
  if (besitz.length >= 6) ctx.fillText('（收满：替换最旧）', 0, 70 * f);
  if (draft.wahl === idx) {
    ctx.font = '13px "Kaiti", "STKaiti", "楷体", serif';
    ctx.fillStyle = '#b0654a';
    ctx.fillText('收下了', 0, k.h / 2 - 22 * f);
  }
  ctx.restore();
}

function zeichneDraft(t) {
  if (phase !== 'draft' || !draft) return;
  // 背景压暗：聚焦到两张卡片上
  ctx.save();
  ctx.fillStyle = 'rgba(246,243,237,.72)';
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.restore();
  // 提示与未点脉冲
  const warten = t - draft.seit;
  ctx.save();
  ctx.font = '13px "Kaiti", "STKaiti", "楷体", serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = warten > 4 && Math.sin(t * 5) > 0 ? '#b0654a' : '#8b8894';
  ctx.fillText(warten > 6 ? '不点就自动收左边了…' : '点 一 张 收 下', innerWidth / 2, kartenLayout()[0].y - 22);
  ctx.restore();
  const l = kartenLayout();
  for (let i = 0; i < 2; i++) {
    // 2 秒后还没点：卡片轻微呼吸脉冲
    const puls = draft.wahl < 0 && warten > 2 ? 1 + Math.sin(t * 4 + i) * .012 : 1;
    ctx.save();
    ctx.translate(l[i].x + l[i].w / 2, l[i].y + l[i].h / 2);
    ctx.scale(puls, puls);
    ctx.translate(-l[i].x - l[i].w / 2, -l[i].y - l[i].h / 2);
    zeichneKarte(draft.items[i], l[i], t, i);
    ctx.restore();
  }
}

// 墨渍：两三个交叠的歪圆，形状随种子定死（干了的墨不再沸腾），24 秒内慢慢淡去
function zeichneMauernFlecken(t) {
  for (let i = mauernFlecken.length - 1; i >= 0; i--) {
    const f = mauernFlecken[i];
    const alter = t - f.von;
    if (alter > 24) { mauernFlecken.splice(i, 1); continue; }
    const alpha = .26 * (1 - alter / 24);
    ctx.save();
    for (const [dx, dy, r] of [[0, 0, 16], [10, 6, 9], [-9, 8, 7]]) {
      const pts = kreisPts(f.x + dx, f.y + dy, r, r * .8, 12, .22, f.seed + dx);
      ctx.beginPath();
      pts.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = `rgba(42,38,32,${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

// 冲洗合影：右下角的贴纸照片堆（最新的在最上，旧的垫底偏移淡出）
function zeichneAbzuege(t) {
  const n = abzuege.length;
  if (!n) return;
  const st = requisitStift(t);
  const mob = innerWidth < 720;
  const w = mob ? 150 : 178, band = mob ? 22 : 28, h = w * .72 + band;
  abzuege.forEach((ab, idx) => {
    const rang = n - 1 - idx;   // 0 = 最新最上；旧的往左下垫，不出屏
    const x = innerWidth - w - (mob ? 10 : 26) - rang * 9;
    const y = (mob ? innerHeight - h - 168 : innerHeight - h - 60) + rang * 9;
    ctx.save();
    if (rang) ctx.globalAlpha = .55;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((idx % 2 ? -1 : 1) * (.025 + rang * .01));
    ctx.translate(-w / 2, -h / 2);
    // 照片纸：暖白 + 四边手绘细线
    ctx.fillStyle = 'rgba(251,248,241,.96)';
    ctx.fillRect(0, 0, w, h - band + 4);
    st.line([[8, 0], [w - 8, 0]], 1, { label: 340 + idx * 7, alpha: .5 });
    st.line([[8, h - band + 4], [w - 8, h - band + 4]], 1, { label: 341 + idx * 7, alpha: .5 });
    st.line([[0, 8], [0, h - band - 4]], 1, { label: 342 + idx * 7, alpha: .5 });
    st.line([[w, 8], [w, h - band - 4]], 1, { label: 343 + idx * 7, alpha: .5 });
    // 五人小合影：一排站着，还在轻轻呼吸；微型尺寸走扁平上色
    const kK = (w - 20) / 5 * .78;
    const fussY = h - band - 6;
    ab.recs.forEach((rec, i) => {
      drawDoodle(ctx, rec, 12 + (w - 24) * (i + .5) / 5, fussY, kK, t, { face: 'froh', flach: true });
    });
    // 底边白带上手写牌型
    ctx.font = `${mob ? 9 : 10}px "Kaiti", "STKaiti", "楷体", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8b8894';
    ctx.fillText(ab.titel, w / 2, h - band / 2 + 1);
    // 顶角两片胶带
    ctx.fillStyle = 'rgba(214,203,182,.55)';
    ctx.save();
    ctx.translate(12, 2); ctx.rotate(-.35); ctx.fillRect(-10, -5, 26, 11);
    ctx.restore();
    ctx.save();
    ctx.translate(w - 12, 2); ctx.rotate(.35); ctx.fillRect(-16, -5, 26, 11);
    ctx.restore();
    ctx.restore();
  });
}

// 拍照快门：白闪一帧
function zeichneBlitz(t) {
  if (!sprungT || phase === 'idle') return;
  const d = t - sprungT;
  if (d < 0 || d > .22) return;
  ctx.save();
  ctx.globalAlpha = (1 - d / .22) * .75;
  ctx.fillStyle = '#fffef8';
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.restore();
}

// 拥有栏：左下角逐个排开（~48px 小卡；手机端卡片缩小并上移，避开折行的按钮条）
function zeichneBesitz(t) {
  if (!besitz.length) return;
  const st = requisitStift(t);
  const mob = innerWidth < 720;
  const cw = mob ? 40 : 48, ch = mob ? 40 : 56;
  besitz.forEach((item, i) => {
    const x = 26 + i * (cw + 10), y = innerHeight - (mob ? 90 : 76);
    ctx.save();
    kartonRect(x, y, cw, ch, 6);
    ctx.fillStyle = 'rgba(246,243,237,.8)';
    ctx.fill();
    ctx.restore();
    st.line([[x + 5, y], [x + cw - 5, y]], 1, { label: 320 + i, alpha: .4 });
    st.line([[x + 5, y + ch], [x + cw - 5, y + ch]], 1, { label: 321 + i, alpha: .4 });
    ctx.save();
    ctx.translate(x + cw / 2, y + ch / 2 - 3);
    REQUISITEN[item.familie].draw(st, 0, 0, mob ? 34 : 42, item.params);
    ctx.restore();
    ctx.save();
    ctx.font = (mob ? 8 : 9) + 'px "Kaiti", "STKaiti", "楷体", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a89f93';
    ctx.fillText(REQUISITEN[item.familie].name, x + cw / 2, y + ch - (mob ? 8 : 9));
    ctx.restore();
  });
}

/* ================= 主循环 ================= */

let vorige = 0;
function rahmen(now) {
  // __freezeT 是调试钩子：固定时间戳用来截指定状态
  const t = (typeof window !== 'undefined' && window.__freezeT != null) ? window.__freezeT : now / 1000;
  const dt = vorige ? Math.min(t - vorige, 0.05) : 0;
  vorige = t;

  phaseTick(t);

  // 过场位移（按绝对时间，冻结时间下也确定）
  for (const kind of kinder) {
    if (kind.zustand === 'geht') {
      kind.oy = (t - kind.seit) * innerHeight * .9;
    } else if (kind.zustand === 'kommt') {
      kind.ox = kind.ox0 * Math.max(0, 1 - (t - kind.seit) / .7);
      if (Math.abs(kind.ox) < 2) { kind.ox = 0; kind.zustand = 'da'; }
    }
    platzieren(kind);
  }

  papier();
  regale(t);
  zeichneRegalDeko(t);   // 架上陈设：站在空档里当布景，画在孩子之前形成层次
  zeichneMauernFlecken(t);   // 墨渍在墙上：贴纸之前、孩子们最后
  zeichneAbzuege(t);   // 贴纸照片贴在墙上：画在孩子们后面，人挡住贴纸而不是贴纸挡人

  // 后排先画（前排压住后排的脚，深度自然）
  const geordnet = [...kinder].sort((a, b) => (a.g.hinten ? 0 : 1) - (b.g.hinten ? 0 : 1));
  const qt = Math.floor(t * 12) / 12;
  for (const kind of geordnet) {
    // 眨眼计时（12fps 量化）
    if (qt > kind.naeBlink) {
      kind.blinkBis = qt + .14;
      kind.naeBlink = qt + 1.5 + kind.blinkWuerfel() * 4;
    }
    // 新来的孩子怕 2 秒，然后平静
    if (kind.face === 'angst' && kind.zustand === 'da' && t - kind.seit > 2) kind.face = 'ruhig';
    // 偶发小情绪：平静的孩子过一会儿自己笑一下/恼一下/哭一鼻子/打个盹
    // （只在平时发生；被选中或过场会把 face 改掉，情绪就识趣地退场）
    if (kind.laune) {
      if (kind.face !== kind.laune || t > kind.launeBis) {
        if (kind.face === kind.laune) kind.face = 'ruhig';
        kind.laune = null;
      }
    } else if (phase === 'idle' && kind.zustand === 'da' && kind.face === 'ruhig'
      && !gewaehlt.has(kinder.indexOf(kind)) && t > kind.naechsteLaune) {
      const r = kind.launeWuerfel();
      kind.laune = r < .38 ? 'froh' : r < .6 ? 'boese' : r < .78 ? 'schlaeft' : 'weint';
      kind.face = kind.laune;
      kind.launeBis = t + 1.6 + kind.launeWuerfel() * 1.9;
      kind.naechsteLaune = kind.launeBis + 7 + kind.launeWuerfel() * 18;
    }
    // 视线：指针凑近就盯着指针看，否则各自慢慢东张西望
    let zx, zy;
    if (pointer.active && kind.zustand === 'da'
      && Math.hypot(pointer.x - kind.x, pointer.y - (kind.footY - kind.k * .9)) < kind.k * 7) {
      zx = clamp((pointer.x - kind.x) / (kind.k * 2.4), -1, 1);
      zy = clamp((pointer.y - (kind.footY - kind.k)) / (kind.k * 2.4), -1, 1);
    } else {
      const w = t * .45 * kind.rec.anim.tempo + kind.rec.anim.phase;
      zx = Math.sin(w) * .65 + Math.sin(w * 2.3 + 1.6) * .35;
      zy = Math.sin(w * .8 + 2.2) * .4;
    }
    const gleit = 1 - Math.exp(-dt * 8);
    kind.bx += (zx - kind.bx) * gleit;
    kind.by += (zy - kind.by) * gleit;
    // 弹跳：选中 .3k、拍照 .5k，正弦起落
    const hopDt = t - kind.hopT;
    const hop = hopDt >= 0 && hopDt < .7
      ? -Math.sin(hopDt / .7 * Math.PI) * kind.hopAmp * kind.k
      : 0;
    drawDoodle(ctx, kind.rec, kind.x, kind.footY, kind.k, t, { blink: qt < kind.blinkBis, hop, face: kind.face, blick: { x: kind.bx, y: kind.by } });
    zeichneName(kind);
  }
  for (const i of gewaehlt) {
    if (kinder[i].zustand === 'da') zeichneWahl(kinder[i], t);
  }
  zeichneGesamt();
  zeichneBanner(t);
  zeichneBesitz(t);
  zeichneDraft(t);
  zeichneBlitz(t);
  requestAnimationFrame(rahmen);
}

function resize() {
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  for (const kind of kinder) platzieren(kind);
}
addEventListener('resize', resize);
resize();
requestAnimationFrame(rahmen);

/* 调试钩子：无头验证用 */
window.__foto = {
  waehle: (i) => waehle(kinder[i], performance.now() / 1000),
  knips: () => knips(performance.now() / 1000),
  kinder: () => kinder.map((k) => ({ platz: k.platz, zustand: k.zustand, name: k.name, art: k.rec.art, media: k.rec.media })),
  gesichter: () => kinder.map((k) => k.face).join(','),
  phase: () => phase,
  _kinder: kinder,              // 测试用：可直接改 rec.media / face
  draft: () => draftStart(performance.now() / 1000),   // 强制弹出二选一
  pickDraft: (i) => draftPick(i, performance.now() / 1000),
  besitz: () => besitz.map((b) => b.familie),
  abzuege: () => abzuege.length,
  flecken: () => mauernFlecken.length,
  filter,
};
