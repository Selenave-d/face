/* 涂鸦小孩生成器 —— 大圆头小身子的铅笔涂鸦角色
 * 三层结构：
 *   配方 doodleRecipe(seed) —— 一个整数推出完整角色（确定性，部件级子流随机）
 *   物种画像 ARTEN/castingFor —— 画像只是部件维度上的偏置表：
 *     { style: {a: 55, b: 25} } 加权选 / [min, max] 范围 / 数字 概率，
 *     未提及的维度用默认值——狗不是新画法，是同一目录里骰子灌了铅。
 *   笔触 blei —— 石墨灰多遍轻描 + 涂鸦排线填充，抖动按 8fps 量化沸腾。
 * 动画：呼吸 bob、眨眼、摇尾，相位按 12fps 量化。
 */
'use strict';

/* ================= 随机 ================= */

function _h2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
function _mb(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dRng(seed, label) {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) { h ^= label.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = _mb((_h2(seed ^ (h >>> 0), 2654435761) >>> 0));
  for (let i = 0; i < 5; i++) r();
  return {
    n: r,
    range: (a, b) => a + r() * (b - a),
    chance: (p) => r() < p,
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    wpick: (pairs) => {
      let sum = 0;
      for (const p of pairs) sum += p[1];
      let x = r() * sum;
      for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
  };
}
const _clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const TAU2 = Math.PI * 2;

/* ================= 物种画像 =================
 * 三种条目：{ style: {…} } 加权选 / [min,max] 范围 / 概率。
 * 人类克制兽性选项；狗压向垂耳+吻部+斑点+无毛；猫压向猫耳+三角鼻+胡须。
 */

const ARTEN = {
  human: {
    w: 68,
    cast: {
      skull: { shape: { round: 45, wide: 20, tall: 15, drop: 12, square: 8 }, dark: .16 },
      crest: { style: { none: 70, sprout: 9, halo: 7, bolt: 6, flower: 8 } },
      eyes: { type: { saucer: 28, dot: 20, wide: 12, happy: 10, sleepy: 10, sparkle: 8, closed: 6, angry: 4, spiral: 2 } },
      mouth: { style: { wobble: 22, tiny: 18, smirk: 14, frown: 12, zigzag: 10, grit: 8, buckteeth: 8, stitch: 4, tongue: 4 } },
      nose: { style: { none: 30, button: 28, line: 24, triangle: 18 } },
      hair: { style: { bald: 10, bob: 13, messy: 12, spiky: 10, bowl: 10, curly: 9, buzz: 8, afro: 6, pigtails: 8, long: 6, buns: 5, topknot: 4, mohawk: 3, cowlick: 3 } },
      tail: { style: { none: 100 } },
      extras: { spots: .06, freckles: .32, whiskers: 0, glasses: .2, tears: .12 },
    },
  },
  dog: {
    w: 13,
    cast: {
      skull: { shape: { round: 42, wide: 28, drop: 18, tall: 12 }, muzzle: [.3, .48], fett: [1.05, 1.35], dark: .24 },
      crest: { style: { floppy: 82, bear: 10, none: 8 }, len: [1.3, 1.9] },
      eyes: { type: { dot: 58, happy: 18, closed: 10, saucer: 14 } },
      nose: { style: { button: 72, triangle: 28 }, size: [1.4, 2] },
      mouth: { style: { cat: 38, tongue: 26, wobble: 18, tiny: 10, buckteeth: 8 } },
      hair: { style: { bald: 88, messy: 8, cowlick: 4 } },
      tail: { style: { wag: 55, curl: 30, puff: 15 } },
      extras: { spots: .5, freckles: .1, whiskers: .25, glasses: .05, tears: .05 },
    },
  },
  cat: {
    w: 13,
    cast: {
      skull: { shape: { round: 50, wide: 26, square: 12, drop: 12 }, muzzle: [.16, .28], fett: [.7, .9], dark: .2 },
      crest: { style: { cat: 90, none: 10 }, len: [.8, 1.2] },
      eyes: { type: { dot: 55, saucer: 20, closed: 15, happy: 10 }, sx: [1.15, 1.35] },
      nose: { style: { triangle: 75, button: 25 } },
      mouth: { style: { cat: 78, tiny: 12, tongue: 10 } },
      hair: { style: { bald: 90, messy: 10 } },
      tail: { style: { curl: 55, wag: 35, puff: 10 } },
      extras: { whiskers: .9, spots: .3, freckles: .1, glasses: .05, tears: .05 },
    },
  },
  rabbit: {
    w: 3,
    cast: {
      skull: { shape: { round: 55, tall: 25, drop: 20 }, dark: .1 },
      crest: { style: { bunny: 96, none: 4 }, len: [1.7, 2.3] },
      eyes: { type: { dot: 55, saucer: 25, happy: 20 } },
      nose: { style: { triangle: 70, button: 30 } },
      mouth: { style: { buckteeth: 55, cat: 25, tiny: 20 } },
      hair: { style: { bald: 90, messy: 10 } },
      tail: { style: { puff: 80, none: 20 } },
      extras: { whiskers: .5, freckles: .2, spots: .2, glasses: .05, tears: .05 },
    },
  },
  bear: {
    w: 3,
    cast: {
      skull: { shape: { round: 60, wide: 25, drop: 15 }, dark: .16 },
      crest: { style: { bear: 96, none: 4 } },
      eyes: { type: { dot: 65, saucer: 20, happy: 15 } },
      nose: { style: { button: 85, triangle: 15 }, size: [1.3, 1.8] },
      mouth: { style: { wobble: 40, cat: 25, tiny: 20, tongue: 15 } },
      hair: { style: { bald: 92, messy: 8 } },
      tail: { style: { puff: 60, none: 40 } },
      extras: { spots: .1, freckles: .15, whiskers: .1, glasses: .08, tears: .05 },
    },
  },
  // 梦魇（仿 name-me 的 nightmare）：尖角 + 锯齿嘴 + 空洞眼/旋涡眼，
  // 一半是墨色，偶尔多一只额眼 —— 极稀有，一出就是主角
  alp: {
    w: 2,
    cast: {
      skull: { shape: { tall: 35, round: 30, drop: 20, wide: 15 }, dark: .55 },
      crest: { style: { horns: 92, none: 8 }, len: [.9, 1.35] },
      eyes: { type: { hollow: 38, spiral: 20, saucer: 16, dot: 14, wide: 8, angry: 4 }, stirnauge: .45 },
      nose: { style: { none: 40, triangle: 35, line: 25 } },
      mouth: { style: { zigzag: 45, stitch: 20, frown: 15, wobble: 10, tiny: 10 } },
      hair: { style: { bald: 85, messy: 15 } },
      tail: { style: { curl: 55, wag: 20, none: 25 } },
      extras: { spots: .35, freckles: 0, whiskers: 0, glasses: 0, tears: .12 },
    },
  },
};

// 画像助手：物种有意见就听物种的，没有就用默认值
function castingFor(artId) {
  const cast = ARTEN[artId]?.cast ?? {};
  return (partId) => {
    const t = cast[partId] ?? {};
    return {
      pick(r, key, defaultPairs) {
        const w = t[key];
        const pairs = (w && typeof w === 'object' && !Array.isArray(w))
          ? Object.entries(w).filter(([, n]) => n > 0)
          : defaultPairs;
        return r.wpick(pairs);
      },
      range(r, key, lo, hi) {
        const v = t[key];
        return Array.isArray(v) ? r.range(v[0], v[1]) : r.range(lo, hi);
      },
      chance(r, key, p) {
        const v = t[key];
        return r.chance(typeof v === 'number' ? v : p);
      },
    };
  };
}

/* ================= 配方：一个 seed 一个角色 ================= */

function doodleRecipe(seed, erzwinge = {}) {
  // erzwinge：外部强制物种/介质（合影页的过滤器用），不走权重
  const art = erzwinge.art ?? dRng(seed, 'art').wpick(Object.entries(ARTEN).map(([id, a]) => [id, a.w]));
  const C = castingFor(art);
  const cS = C('skull'), cC = C('crest'), cE = C('eyes'), cM = C('mouth'),
    cN = C('nose'), cH = C('hair'), cT = C('tail'), cX = C('extras');
  const rS = dRng(seed, 'skull'), rC = dRng(seed, 'crest'), rE = dRng(seed, 'eyes'),
    rM = dRng(seed, 'mouth'), rN = dRng(seed, 'nose'), rH = dRng(seed, 'hair'),
    rT = dRng(seed, 'tail'), rX = dRng(seed, 'extras'), rA = dRng(seed, 'anim');
  return {
    seed, art,
    media: erzwinge.media ?? dRng(seed, 'media').wpick([['graphite', 45], ['watercolour', 25], ['ink', 20], ['marker', 10]]),
    farbe: dRng(seed, 'farbe').n(),   // 水彩/马克笔的色调池位置
    skull: {
      s: cS.range(rS, 's', .9, 1.15),
      wf: cS.range(rS, 'wf', .86, 1.1),
      shape: cS.pick(rS, 'shape', [['round', 45], ['wide', 20], ['tall', 15], ['drop', 12], ['square', 8]]),
      dark: cS.chance(rS, 'dark', .16),
      muzzle: cS.range(rS, 'muzzle', 0, 0),
      fett: cS.range(rS, 'fett', .9, 1.2),   // 吻部肥瘦（狗长肥、猫小扁）
      muzzleY: cS.range(rS, 'muzzleY', .5, .68),
      wob: rS.n() * 100,
    },
    crest: {
      style: cC.pick(rC, 'style', [['none', 70], ['sprout', 9], ['halo', 7], ['bolt', 6], ['flower', 8]]),
      len: cC.range(rC, 'len', 1, 1.4),
      ohrHaengt: rC.chance(.3) ? rC.pick([-1, 1]) : 0,   // 兔耳一竖一垂
    },
    eyes: {
      type: cE.pick(rE, 'type', [['saucer', 28], ['dot', 22], ['wide', 12], ['happy', 10], ['sleepy', 10], ['sparkle', 8], ['closed', 8], ['angry', 6], ['spiral', 4]]),
      scale: cE.range(rE, 'scale', .9, 1.2),
      sx: cE.range(rE, 'sx', .9, 1.1),
      stirnauge: cE.chance(rE, 'stirnauge', 0),   // 魇的额眼
    },
    mouth: { style: cM.pick(rM, 'style', [['wobble', 22], ['tiny', 18], ['smirk', 14], ['frown', 12], ['zigzag', 10], ['grit', 8], ['buckteeth', 8], ['stitch', 4], ['cat', 8], ['tongue', 6]]) },
    nose: { style: cN.pick(rN, 'style', [['none', 30], ['button', 28], ['line', 24], ['triangle', 18]]), size: cN.range(rN, 'size', .9, 1.2) },
    hair: { style: cH.pick(rH, 'style', [['bald', 12], ['bob', 13], ['messy', 12], ['spiky', 10], ['bowl', 10], ['curly', 9], ['buzz', 8], ['afro', 6], ['pigtails', 7], ['long', 5], ['buns', 4], ['topknot', 3], ['mohawk', 2], ['cowlick', 3]]) },
    torso: { dark: rS.chance(.6) && false, shape: dRng(seed, 'torso').pick([['bean', 40], ['round', 30], ['pear', 30]]) },
    tail: { style: cT.pick(rT, 'style', [['none', 100]]) },
    extras: {
      spots: cX.chance(rX, 'spots', .06),
      freckles: cX.chance(rX, 'freckles', .3),
      whiskers: cX.chance(rX, 'whiskers', 0),
      glasses: cX.chance(rX, 'glasses', .18),
      tears: cX.chance(rX, 'tears', .1),
    },
    anim: { phase: rA.n() * TAU2, tempo: rA.range(.8, 1.3), blink: dRng(seed, 'blinzeln') },
  };
}
// 身体跟随头一起深色（在配方层决定，避免渲染时再掷）
function torsoDark(rec) { return rec.skull.dark; }

/* ================= 介质 =================
 * 三杠杆独立：物种（什么动物）× 介质（什么画的）× 参数（哪个个体）。
 * 部件永不直接调画法，只问三个原语：
 *   line/dot  轮廓与点（各介质自己的线宽、遍数、墨色）
 *   tone      填块（排线 / 淡彩晕染 / 平涂）
 *   haut      头与身体的处理（深色角色怎么"涂黑"、浅色角色留不留纸白）
 * 换介质 = 换 MEDIA 表一行，全身自动变。
 */

const GRAFIT = '58,54,48';

// 水彩暖色池：雾蓝 / 灰粉 / 燕麦 / 鼠尾草
const WASH_POOL = [
  [150, 168, 180], [205, 170, 168], [210, 195, 165], [170, 185, 165],
];

const MEDIA = {
  // 石墨：灰线两遍 + 排线（现状）
  graphite: {
    farbe: GRAFIT, w: 1, passes: 2, jitter: 1, alpha: .78,
    dunkel: '58,54,48',
  },
  // 墨水：更黑更粗的主线 + 一遍自信的深色重描，排线更密
  ink: {
    farbe: '42,38,32', w: 1.35, passes: 2, jitter: .8, alpha: .9,
    dunkel: '42,38,32', luecke: .75,
  },
  // 水彩：细灰线 + 淡彩晕染（色块故意错位溢出轮廓）
  watercolour: {
    farbe: '110,105,98', w: .85, passes: 1, jitter: .6, alpha: .6,
    wash: .3, dunkelWash: .45,
  },
  // 马克笔：线宽 ×1.8、单遍少抖动、平涂高覆盖仍带一点透纸感
  marker: {
    farbe: '48,44,40', w: 1.8, passes: 1, jitter: .35, alpha: .88,
    wash: .8, dunkelWash: .85,
  },
};

function bleiStift(ctx, tick, mediaId, farbT = 0) {
  const M = MEDIA[mediaId] ?? MEDIA.graphite;
  const washRGB = WASH_POOL[Math.min(WASH_POOL.length - 1, Math.floor(farbT * WASH_POOL.length))];
  const istWash = mediaId === 'watercolour' || mediaId === 'marker';
  // 每个笔画标签 + tick 推一个抖动种子
  const jr = (label, i) => _mb(_h2(tick, _h2(label, i)));
  function line(pts, w = 1.3, opt = {}) {
    const label = opt.label ?? 0;
    const jitter = (opt.jitter ?? .5) * M.jitter;
    const alpha = (opt.alpha ?? M.alpha);
    const passes = M.passes;
    for (let pass = 0; pass < passes; pass++) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const r = jr(label, i * 7 + pass * 131);
        const jx = (r() - .5) * jitter * 2, jy = (r() - .5) * jitter * 2;
        if (i === 0) ctx.moveTo(pts[i][0] + jx, pts[i][1] + jy);
        else ctx.lineTo(pts[i][0] + jx, pts[i][1] + jy);
      }
      if (opt.closed) ctx.closePath();
      // 第二遍：墨水是自信重描（更深更实），石墨是淡淡错位
      const pa = pass ? (mediaId === 'ink' ? alpha * .55 : alpha * .28) : alpha;
      ctx.strokeStyle = `rgba(${M.farbe},${pa})`;
      ctx.lineWidth = (pass ? w * .68 : w) * M.w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  function dot(x, y, r, alpha = .85, label = 1) {
    const j = jr(label, 3);
    ctx.beginPath();
    ctx.arc(x + (j() - .5) * r * .3, y + (j() - .5) * r * .3, r * (0.92 + j() * .16), 0, TAU2);
    ctx.fillStyle = `rgba(${M.farbe},${Math.min(1, alpha)})`;
    ctx.fill();
  }
  function paperDot(x, y, r, alpha = .95) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU2);
    ctx.fillStyle = `rgba(246,243,237,${alpha})`;
    ctx.fill();
  }
  function poly(pts, geschlossen = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (geschlossen) ctx.closePath();
  }
  // 排线（石墨/墨水的填块手法；水彩/马克笔不直接调这个）
  function hatch(pts, gap, winkel, alpha = .7, label = 9, w = 1) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    }
    ctx.save();
    poly(pts);
    ctx.clip();
    const cos = Math.cos(winkel), sin = Math.sin(winkel);
    const diag = Math.hypot(x1 - x0, y1 - y0);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const luecke = gap * (M.luecke ?? 1);
    for (let d = -diag / 2; d < diag / 2; d += luecke) {
      const r = jr(label, Math.round(d * 13));
      const j1 = (r() - .5) * gap, j2 = (r() - .5) * gap;
      ctx.beginPath();
      ctx.moveTo(cx + cos * (d + j1) - sin * diag, cy + sin * (d + j1) + cos * diag);
      ctx.lineTo(cx + cos * (d + j2) + sin * diag, cy + sin * (d + j2) - cos * diag);
      ctx.strokeStyle = `rgba(${M.farbe},${alpha * (.55 + r() * .45)})`;
      ctx.lineWidth = w * M.w;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }
  // 淡彩晕染：色块错位溢出轮廓（套色不准），两遍更匀
  function wash(pts, rgb, alpha, label) {
    for (let pass = 0; pass < 2; pass++) {
      const r = jr(label, pass * 77);
      const dx = (r() - .5) * 5, dy = (r() - .5) * 5;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * (pass ? .55 : 1)})`;
      ctx.fill();
      ctx.restore();
    }
  }
  /* —— 原语 tone：填块（斑点、发盖、耳朵等局部色） —— */
  function tone(pts, opt = {}) {
    const dunkel = !!opt.dunkel;
    if (!istWash) {
      hatch(pts, (dunkel ? .05 : .06) * (opt.k ?? 10) / 10, -.9, dunkel ? .8 : .3, opt.label ?? 9);
      return;
    }
    const rgb = dunkel ? [120, 105, 100] : washRGB;
    wash(pts, rgb, dunkel ? M.dunkelWash : M.wash, opt.label ?? 10);
  }
  /* —— 原语 haut：头与身体的处理 —— */
  function haut(pts, dunkel, opt = {}) {
    if (dunkel) {
      if (istWash) {
        wash(pts, [125, 110, 105], .4, 11);
        hatch(pts, .07 * (opt.k ?? 10) / 10, -.9, .35, 12);   // 深色角色：淡彩 + 局部排线
      } else {
        hatch(pts, .055 * (opt.k ?? 10) / 10, -.9, .8, 14);
      }
      return;
    }
    // 浅色角色：水彩给一层淡淡的个人色调，其余留纸白
    if (mediaId === 'watercolour') wash(pts, washRGB, .22, 13);
  }
  return { line, dot, paperDot, poly, hatch, wash, tone, haut, washRGB, istWash };
}

/* ================= 部件画法 ================= */

function kreisPts(cx, cy, rx, ry, n = 20, wob = 0, seed = 1) {
  const pts = [];
  const r = _mb(seed | 0);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU2;
    const f = 1 + (wob ? (r() - .5) * wob : 0);
    pts.push([cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f]);
  }
  return pts;
}
function bogenPts(cx, cy, rx, ry, a0, a1, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}
// Chaikin 平滑：折线变肉
function chaikin2(pts) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25],
      [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// 脊线加成头尾不同宽的锥形轮廓（垂耳/尾巴的骨肉）
function tapered(spine, w0, w1) {
  const L = [], R = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const d = Math.hypot(nx, ny) || 1;
    nx /= d; ny /= d;
    const t = i / (spine.length - 1);
    const hw = (w0 + (w1 - w0) * t) / 2;
    L.push([spine[i][0] + nx * hw, spine[i][1] + ny * hw]);
    R.push([spine[i][0] - nx * hw, spine[i][1] - ny * hw]);
  }
  return L.concat(R.reverse());
}

/* 头轮廓：大圆/扁豆，按形状微调 */
function kopfPoly(rec, k) {
  const s = rec.skull;
  let rx = .44 * s.wf * s.s, ry = .44 * s.s;
  if (s.shape === 'wide') rx *= 1.14;
  if (s.shape === 'tall') ry *= 1.13;
  if (s.shape === 'drop') ry *= 1.04;
  const pts = [];
  const r = _mb(_h2(rec.seed, 7));
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU2;
    const f = 1 + (r() - .5) * .06;
    let x = Math.cos(a) * rx * f, y = Math.sin(a) * ry * f;
    if (s.shape === 'drop' && y > 0) y *= 1.14;
    if (s.shape === 'square') y += Math.abs(Math.cos(a)) * ry * .08 * (y > 0 ? 1 : -1) - ry * .04;
    pts.push([x * k, (y - .95) * k]);
  }
  return pts;
}

/* 眉毛：只有怒/怕表情有（平静的孩子不画眉）
 * 怒 = 内端下压；怕 = 内端挑高的八字 */
function zeichneBrauen(stift, rec, k, face) {
  if (face !== 'boese' && face !== 'angst') return;
  const ex = .44 * rec.skull.wf * rec.skull.s * .44 * rec.eyes.sx * k;
  const ey = -.98 * k - .13 * k * rec.eyes.scale;
  for (const s of [-1, 1]) {
    if (face === 'boese') {
      // 外高内低，压向眼睛
      stift.line([[s * (ex + .09 * k), ey - .04 * k], [s * (ex - .06 * k), ey + .02 * k]], 1.6, { label: 200 + s });
    } else {
      // 内高外低的八字
      stift.line([[s * (ex - .07 * k), ey - .05 * k], [s * (ex + .08 * k), ey + .01 * k]], 1.3, { label: 202 + s, alpha: .8 });
    }
  }
}

/* 睡觉的 Zzz：头顶右上方飘两个 z，按相位若隐若现 */
function zeichneZzz(stift, rec, k, qt) {
  const auf = (qt * .5 + rec.anim.phase) % 3;   // 3 秒一轮，前 2 秒可见
  if (auf > 2) return;
  const fade = auf > 1 ? 2 - auf : 1;
  const R = .44 * rec.skull.s * k;
  const z = (x, y, g, label, alpha) => {
    stift.line([[x, y], [x + g, y], [x, y + g * .9], [x + g, y + g * .9]], 1.2, { label, alpha });
  };
  z(R * .7, -1.45 * k, .09 * k, 210, .5 * fade);
  z(R * .95, -1.62 * k, .12 * k, 211, .7 * fade);
}

function zeichneAugen(stift, rec, k, blink, face = 'ruhig', blick = null) {
  const s = rec.eyes;
  const ex = .44 * rec.skull.wf * rec.skull.s * .44 * s.sx * k;
  const ey = -.98 * k;
  // 视线：瞳孔在眼眶里小幅瞟动（blick.x/y ∈ [-1,1]；空洞眼没有瞳孔，直勾勾的）
  const gx = blick?.x ?? 0, gy = blick?.y ?? 0;
  const dx = gx * .028 * k, dy = gy * .022 * k;
  // 表情换眼：笑=笑眼、怕=大圆眼，其余用配方眼型
  const typ = face === 'froh' ? 'happy' : face === 'angst' ? 'wide' : s.type;
  const sc = s.scale * (face === 'angst' ? 1.2 : 1);
  for (const seite of [-1, 1]) {
    const x = seite * ex;
    if (blink) {   // 眨眼帧/哭/睡：一条弯线
      stift.line(bogenPts(x, ey, .09 * k * sc, .07 * k * sc, Math.PI * .15, Math.PI * .85, 6), 1.4, { label: 31 + seite });
      continue;
    }
    switch (typ) {
      case 'dot':
        stift.dot(x + dx, ey + dy, .042 * k * sc, .88, 33 + seite);
        break;
      case 'wide':
        stift.dot(x + dx, ey + dy, .085 * k * sc, .85, 33 + seite);
        stift.paperDot(x + dx - .02 * k, ey + dy - .02 * k, .028 * k * sc);
        break;
      case 'saucer':
        stift.paperDot(x, ey, .105 * k * sc);
        stift.line(kreisPts(x, ey, .105 * k * sc, .115 * k * sc, 16, .04, rec.seed + seite), 1.4, { closed: true, label: 34 + seite });
        stift.dot(x + dx, ey + .01 * k + dy, .042 * k * sc, .9, 35 + seite);
        break;
      case 'hollow':
        // 空洞眼：只有一圈空眶和瞳孔的空位，里面一道细圈当回声
        stift.paperDot(x, ey, .105 * k * sc);
        stift.line(kreisPts(x, ey, .105 * k * sc, .115 * k * sc, 16, .05, rec.seed + seite), 1.4, { closed: true, label: 45 + seite });
        stift.line(kreisPts(x, ey, .032 * k * sc, .032 * k * sc, 8, .03, rec.seed + seite * 3), 1, { closed: true, label: 49 + seite, alpha: .5 });
        break;
      case 'sparkle': {
        stift.paperDot(x, ey, .1 * k * sc);
        stift.line(kreisPts(x, ey, .1 * k * sc, .11 * k * sc, 16, .04, rec.seed + seite), 1.3, { closed: true, label: 36 + seite });
        const r = .06 * k * sc;
        stift.line([[x, ey - r], [x + r * .3, ey - r * .3], [x + r, ey], [x + r * .3, ey + r * .3], [x, ey + r], [x - r * .3, ey + r * .3], [x - r, ey], [x - r * .3, ey - r * .3]], 1.2, { closed: true, label: 37 + seite });
        break;
      }
      case 'happy':
        stift.line(bogenPts(x, ey + .03 * k, .09 * k * sc, .09 * k * sc, Math.PI * 1.12, Math.PI * 1.88, 8), 1.5, { label: 38 + seite });
        break;
      case 'closed':
        stift.line(bogenPts(x, ey, .09 * k * sc, .07 * k * sc, Math.PI * .15, Math.PI * .85, 6), 1.5, { label: 39 + seite });
        break;
      case 'sleepy':
        stift.line([[x - .09 * k * sc, ey - .03 * k], [x + .09 * k * sc, ey - .03 * k]], 1.4, { label: 40 + seite });
        stift.dot(x + dx * .7, ey + .025 * k + dy * .6, .032 * k * sc, .8, 41 + seite);
        break;
      case 'angry':
        stift.line([[x - .09 * k * sc, ey - .1 * k * seite * 0 + (seite < 0 ? -.02 : -.06) * k], [x + .09 * k * sc, ey + (seite < 0 ? -.06 : -.02) * k]], 1.4, { label: 42 + seite });
        stift.dot(x + dx * .7, ey + .02 * k + dy * .6, .04 * k * sc, .88, 43 + seite);
        break;
      case 'spiral': {
        const pts = [];
        for (let i = 0; i <= 14; i++) {
          const t = i / 14, a = t * TAU2 * 1.8 + seite;
          pts.push([x + Math.cos(a) * .08 * k * sc * t, ey + Math.sin(a) * .08 * k * sc * t]);
        }
        stift.line(pts, 1.2, { label: 44 + seite });
        break;
      }
    }
  }
  // 额眼（魇）：眉心上方多一只小圆眼，跟着视线一起瞟
  if (rec.eyes.stirnauge) {
    const fy = ey - .27 * k;
    if (blink) stift.line([[dx * .6 - .028 * k, fy + dy * .5], [dx * .6 + .028 * k, fy + dy * .5]], 1.2, { label: 201 });
    else {
      stift.paperDot(dx * .6, fy + dy * .5, .036 * k);
      stift.dot(dx * .6, fy + dy * .5, .03 * k, .85, 202);
    }
  }
}

function zeichneNase(stift, rec, k) {
  const n = rec.nose;
  const ny = (-.95 + .18) * k;
  if (rec.skull.muzzle > 0) return;   // 吻部上的鼻子在吻部里画
  const size = n.size;
  if (n.style === 'button') stift.dot(0, ny, .045 * k * size, .9, 51);
  else if (n.style === 'line') stift.line([[0, ny - .05 * k * size], [0, ny + .05 * k * size]], 1.4, { label: 52 });
  else if (n.style === 'triangle') {
    const r = .05 * k * size;
    stift.line([[0, ny + r], [-r, ny - r * .6], [r, ny - r * .6]], 1.3, { closed: true, label: 53 });
    stift.dot(0, ny - r * .1, r * .5, .7, 54);
  }
}

function zeichneMund(stift, rec, k, face = 'ruhig') {
  // 表情换嘴：笑=大笑弧、怒=下撇/咬牙、怕=抖、哭=大幅下撇、睡=小点
  let m = rec.mouth.style;
  if (face === 'froh') m = 'laecheln';
  else if (face === 'boese') m = rec.mouth.style === 'grit' ? 'grit' : 'frown';
  else if (face === 'angst') m = 'zittern';
  else if (face === 'weint') m = 'weint';
  else if (face === 'schlaeft') m = 'tiny';
  const my = (-.95 + .34) * k;
  const w = .13 * k;
  if (m === 'laecheln') {
    stift.line(bogenPts(0, my - .03 * k, w * 1.1, .1 * k, Math.PI * .1, Math.PI * .9, 9), 1.6, { label: 59 });
    return;
  }
  if (m === 'zittern') {
    // 怕：小幅高频的抖线
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push([-w * .7 + i * w * .7 / 3, my + (i % 2 ? .025 : -.02) * k]);
    stift.line(pts, 1.2, { label: 58 });
    return;
  }
  if (m === 'weint') {
    stift.line(bogenPts(0, my + .09 * k, w * .9, .09 * k, Math.PI * 1.1, Math.PI * 1.9, 9), 1.5, { label: 57 });
    return;
  }
  switch (m) {
    case 'wobble':
      stift.line([[-w, my], [-w * .4, my - .03 * k], [w * .2, my + .03 * k], [w, my - .01 * k]], 1.4, { label: 61 });
      break;
    case 'tiny':
      stift.line([[-w * .4, my], [w * .4, my + .01 * k]], 1.5, { label: 62 });
      break;
    case 'zigzag':
      stift.line([[-w, my - .02 * k], [-w * .5, my + .04 * k], [0, my - .02 * k], [w * .5, my + .04 * k], [w, my - .02 * k]], 1.3, { label: 63 });
      break;
    case 'smirk':
      stift.line([[-w * .8, my + .02 * k], [w * .5, my - .01 * k], [w, my - .05 * k]], 1.4, { label: 64 });
      break;
    case 'frown':
      stift.line(bogenPts(0, my + .08 * k, w * .7, .07 * k, Math.PI * 1.15, Math.PI * 1.85, 8), 1.4, { label: 65 });
      break;
    case 'grit': {
      stift.line([[-w, my - .04 * k], [w, my - .04 * k], [w, my + .04 * k], [-w, my + .04 * k]], 1.3, { closed: true, label: 66 });
      stift.line([[-w * .33, my - .04 * k], [-w * .33, my + .04 * k]], 1, { label: 67, alpha: .6 });
      stift.line([[w * .33, my - .04 * k], [w * .33, my + .04 * k]], 1, { label: 68, alpha: .6 });
      break;
    }
    case 'buckteeth': {
      stift.line([[-w * .8, my], [w * .8, my]], 1.4, { label: 69 });
      stift.line([[-.035 * k, my], [.035 * k, my], [.035 * k, my + .07 * k], [-.035 * k, my + .07 * k]], 1.2, { closed: true, label: 70 });
      break;
    }
    case 'stitch':
      stift.line([[-w, my], [w, my]], 1.3, { label: 71 });
      for (const dx of [-.5, 0, .5]) {
        stift.line([[dx * w, my - .03 * k], [dx * w, my + .03 * k]], 1, { label: 72 + dx * 10, alpha: .6 });
      }
      break;
    case 'cat':
      stift.line(bogenPts(-w * .5, my - .02 * k, w * .5, .06 * k, Math.PI * .1, Math.PI * .9, 6), 1.4, { label: 73 });
      stift.line(bogenPts(w * .5, my - .02 * k, w * .5, .06 * k, Math.PI * .1, Math.PI * .9, 6), 1.4, { label: 74 });
      break;
    case 'tongue': {
      stift.line(bogenPts(0, my - .04 * k, w * .8, .1 * k, Math.PI * .1, Math.PI * .9, 8), 1.4, { label: 75 });
      stift.line(bogenPts(0, my + .02 * k, w * .35, .06 * k, Math.PI * .1, Math.PI * .9, 6), 1.2, { label: 76, alpha: .6 });
      break;
    }
  }
}

/* 吻部（狗/猫）：下颌前方一个独立的卵形"吻瓣"，带自己的轮廓线 ——
 * 光在颅骨上凸起只读出长下巴，第二道轮廓才读出吻。
 * 扣鼻/三角鼻坐在瓣尖，嘴在瓣下缘：鼻和嘴的位置都由吻瓣发布。
 * snoutLen(muzzle) 管长短、snoutFett(fett) 管肥瘦：猫小扁、狗长肥。 */
function zeichneMuzzle(stift, rec, k, face = 'ruhig') {
  const s = rec.skull;
  if (s.muzzle <= 0) return;
  const fett = s.fett ?? 1;
  const my = (-.95 + s.muzzleY * .8) * k;
  const rx = s.muzzle * k * .5 * fett;
  const ry = s.muzzle * k * .44 * fett * (rec.art === 'cat' ? .78 : 1);
  // 吻瓣本体：微坠的卵形（下端略沉，才挂在下巴上）
  const lappen = [];
  const r = _mb(_h2(rec.seed, 17));
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU2;
    const f = 1 + (r() - .5) * .05;
    let x = Math.cos(a) * rx * f, y = Math.sin(a) * ry * f;
    if (y > 0) y *= 1.12;
    lappen.push([x, my + y]);
  }
  if (s.dark) stift.tone(lappen, { dunkel: true, label: 18, k });
  stift.line(lappen, 1.5, { closed: true, label: 80 });
  // 吻尖的鼻：实心小扣或实心三角，贴在瓣的上缘
  const nx = 0, ny = my - ry * .8;
  const nr = .05 * k * rec.nose.size;
  if (rec.nose.style === 'triangle') {
    stift.line([[nx, ny + nr * .8], [nx - nr, ny - nr * .6], [nx + nr, ny - nr * .6]], 1.4, { closed: true, label: 81 });
    stift.dot(nx, ny - nr * .1, nr * .62, .9, 82);
  } else {
    stift.dot(nx, ny, nr, .92, 83);
  }
  // 嘴在瓣下缘，按表情换
  const mundY = my + ry * .62;
  if (face === 'froh') {
    stift.line(bogenPts(0, mundY - .02 * k, .11 * k, .08 * k, Math.PI * .1, Math.PI * .9, 8), 1.5, { label: 89 });
  } else if (face === 'weint' || face === 'boese') {
    stift.line(bogenPts(0, mundY + .05 * k, .09 * k, .06 * k, Math.PI * 1.12, Math.PI * 1.88, 8), 1.4, { label: 89 });
  } else if (face === 'angst') {
    stift.dot(0, mundY, .035 * k, .7, 89);
  } else if (rec.mouth.style === 'cat') {
    // 猫嘴：一个 W，从瓣尖垂下来两瓣弧
    const w = .1 * k;
    stift.line(bogenPts(-w * .5, mundY - .01 * k, w * .5, .05 * k, Math.PI * .1, Math.PI * .9, 6), 1.3, { label: 84 });
    stift.line(bogenPts(w * .5, mundY - .01 * k, w * .5, .05 * k, Math.PI * .1, Math.PI * .9, 6), 1.3, { label: 85 });
  } else if (rec.mouth.style === 'tongue') {
    stift.line(bogenPts(0, mundY, .08 * k, .07 * k, Math.PI * .1, Math.PI * .9, 8), 1.4, { label: 86 });
    stift.dot(0, mundY + .05 * k, .03 * k, .5, 87);
  } else {
    stift.line([[-.08 * k, mundY], [.08 * k, mundY + .01 * k]], 1.3, { label: 88 });
  }
}

/* 头顶：苗/光环/闪电/花/垂耳/熊耳/猫耳/角/长耳 */
function zeichneCrest(stift, rec, k, kopf) {
  const c = rec.crest;
  if (c.style === 'none') return;
  let topY = 1e9;
  for (const p of kopf) topY = Math.min(topY, p[1]);
  const R = .44 * rec.skull.s * k;
  const len = c.len;
  switch (c.style) {
    case 'sprout': {
      stift.line([[0, topY], [.01 * k, topY - .12 * k * len]], 1.4, { label: 90 });
      stift.line(bogenPts(.05 * k * len, topY - .13 * k * len, .05 * k * len, .03 * k * len, -.5, 2.6, 6), 1.3, { label: 91 });
      stift.line(bogenPts(-.05 * k * len, topY - .13 * k * len, .05 * k * len, .03 * k * len, .5, 3.6, 6), 1.3, { label: 92 });
      break;
    }
    case 'halo':
      stift.line(kreisPts(0, topY - .12 * k * len, R * .45, R * .45 * .3, 18, .03, rec.seed + 5), 1.5, { closed: true, label: 93 });
      break;
    case 'bolt': {
      const b = .08 * k * len;
      stift.line([[0, topY - .02 * k], [b * .8, topY - b], [b * .2, topY - b * 1.1], [b, topY - b * 2.2], [0, topY - b * 1.2], [b * .55, topY - b * 1.1]], 1.3, { label: 94 });
      break;
    }
    case 'flower': {
      stift.line([[0, topY], [0, topY - .08 * k * len]], 1.3, { label: 95 });
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU2 - Math.PI / 2;
        stift.line(kreisPts(Math.cos(a) * .05 * k * len, topY - .1 * k * len + Math.sin(a) * .05 * k * len, .04 * k * len, .04 * k * len, 8), 1.1, { closed: true, label: 96 + i, alpha: .7 });
      }
      stift.dot(0, topY - .1 * k * len, .02 * k, .8, 97);
      break;
    }
    case 'floppy': {
      // 垂耳：从头顶两侧垂下的长瓣——根宽梢圆、下垂带弧度、一道内耳细线
      for (const sd of [-1, 1]) {
        const L = R * 1.15 * len;
        const fettOhr = .55 + .45 * len;   // 长耳必须更宽，不然是挂面
        const bx = sd * R * .6, by = topY + R * .12;
        const spine = chaikin2(chaikin2([
          [bx - sd * R * .05, by],
          [bx + sd * R * .26, by + L * .2],
          [bx + sd * R * .3, by + L * .68],
          [bx + sd * R * .2, by + L],
        ]));
        const ohr = tapered(spine, R * .3 * fettOhr, R * .17 * fettOhr);
        if (stift.istWash) stift.tone(ohr, { label: 99 + sd, k });
        stift.line(ohr, 1.5, { closed: true, label: 98 + sd });
        // 内耳细线：同一条下垂曲线，短一截
        const innen = chaikin2(chaikin2([
          [bx + sd * R * .03, by + R * .06],
          [bx + sd * R * .22, by + L * .3],
          [bx + sd * R * .18, by + L * .74],
        ]));
        stift.line(tapered(innen, R * .09 * fettOhr, R * .05 * fettOhr), 1, { closed: true, label: 97 + sd, alpha: .45 });
      }
      break;
    }
    case 'bear':
      for (const s of [-1, 1]) {
        const x = s * R * .55;
        stift.line(bogenPts(x, topY + R * .12, R * .26, R * .3, Math.PI, TAU2, 8), 1.5, { label: 100 + s });
        stift.line(bogenPts(x, topY + R * .14, R * .12, R * .14, Math.PI, TAU2, 6), 1.1, { label: 102 + s, alpha: .55 });
      }
      break;
    case 'cat':
      for (const s of [-1, 1]) {
        const x0 = s * R * .35, x1 = s * R * .8;
        const poly = [[x0, topY + R * .12], [s * R * .62, topY - R * .5 * len], [x1, topY + R * .18]];
        if (stift.istWash) stift.tone(poly, { label: 105 + s, k });
        stift.line(poly, 1.5, { closed: true, label: 104 + s });
        // 内耳线：小一号同形
        stift.line([[x0 + s * R * .1, topY + R * .1], [s * R * .62, topY - R * .32 * len], [x1 - s * R * .1, topY + R * .14]], 1, { label: 103 + s, alpha: .5 });
      }
      break;
    case 'bunny':
      for (const s of [-1, 1]) {
        // 长椭圆耳：允许一竖一垂（垂的那只向外倒）
        const haengt = rec.crest.ohrHaengt === s;
        const x = s * R * .32;
        if (haengt) {
          const spine = chaikin2([
            [x, topY + R * .05],
            [x + s * R * .3, topY - R * .3],
            [x + s * R * .38, topY + R * .35],
          ]);
          stift.line(tapered(spine, R * .16, R * .09), 1.5, { closed: true, label: 106 + s });
        } else {
          stift.line(bogenPts(x, topY - R * .55 * len, R * .18, R * .65 * len, Math.PI * .9, Math.PI * 2.1, 10), 1.5, { label: 106 + s });
          stift.line(bogenPts(x, topY - R * .5 * len, R * .08, R * .45 * len, Math.PI * .95, Math.PI * 2.05, 8), 1, { label: 108 + s, alpha: .5 });
        }
      }
      break;
    case 'horns':
      for (const s of [-1, 1]) {
        stift.line([[s * R * .5, topY + R * .1], [s * R * .75, topY - R * .3 * len], [s * R * .55, topY - R * .45 * len]], 1.6, { label: 110 + s });
      }
      break;
  }
}

/* 发型：秃/bob/乱/刺/碗/卷/板寸/爆炸/双辫/长/丸子/冲天/莫西干/翘毛 */
function zeichneHair(stift, rec, k, kopf) {
  const h = rec.hair.style;
  if (h === 'bald') {
    // 秃：两三根倔强的毛
    const r = _mb(_h2(rec.seed, 21));
    for (let i = 0; i < 3; i++) {
      let topY = 1e9, topX = 0;
      for (const p of kopf) if (p[1] < topY) { topY = p[1]; topX = p[0]; }
      const dx = (r() - .5) * .2 * k;
      stift.line([[topX + dx, topY + .02 * k], [topX + dx * 1.6 + (r() - .5) * .04 * k, topY - .07 * k]], 1.2, { label: 120 + i, alpha: .6 });
    }
    return;
  }
  const s = rec.skull;
  const R = .44 * s.s * k;
  const cy = -.95 * k;
  switch (h) {
    case 'bob': case 'bowl': case 'long': case 'pigtails': case 'buns': case 'topknot': case 'cowlick': {
      // 发盖：从一侧颞部过头顶到另一侧，下缘是眼睛上方的一道波浪线
      const a0 = Math.PI * (h === 'bowl' ? 1.12 : .95), a1 = Math.PI * (h === 'bowl' ? 1.88 : 2.05);
      const oben = bogenPts(0, cy, R * 1.04 * s.wf, R * 1.05, a0, a1, 18);
      const yCut = cy - R * (h === 'bowl' ? .45 : .25);
      const [lx] = oben[0], [rx2] = oben[oben.length - 1];
      const unten = [];
      for (let i = 10; i >= 0; i--) {
        const t = i / 10;
        unten.push([rx2 * t + lx * (1 - t), yCut + Math.sin(i * 1.7) * .015 * k]);
      }
      const poly = oben.concat(unten);
      if (stift.istWash) stift.tone(poly, { label: 121, k });   // 水彩/马克笔：发盖上色
      stift.line(poly, 1.5, { closed: true, label: 122 });
      if (h === 'long') {
        for (const sd of [-1, 1]) {
          stift.line([[sd * R * .9, yCut], [sd * R * 1.02, cy + R * 1.1], [sd * R * .8, cy + R * 1.35]], 1.5, { label: 123 + sd });
        }
      }
      if (h === 'pigtails') {
        for (const sd of [-1, 1]) {
          const bx = sd * R * 1.05, by = cy - R * .1;
          stift.line(kreisPts(bx, by, R * .22, R * .3, 12, .1, rec.seed + sd), 1.5, { closed: true, label: 124 + sd });
          stift.line([[bx - sd * R * .1, by - R * .2], [bx + sd * R * .12, by + R * .25]], 1, { label: 125 + sd, alpha: .5 });
        }
      }
      if (h === 'buns' || h === 'topknot') {
        const stellen = h === 'buns' ? [-1, 1] : [0];
        for (const sd of stellen) {
          const bx = sd * R * .55, by = cy - R * 1.05;
          stift.line(kreisPts(bx, by, R * .18, R * .16, 12, .08, rec.seed + sd), 1.5, { closed: true, label: 126 + sd });
        }
      }
      if (h === 'cowlick') {
        const pts = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10, a = t * TAU2 * 1.3;
          pts.push([R * .1 + Math.cos(a) * R * .14 * t, cy - R * (1.02 + .25 * t)]);
        }
        stift.line(pts, 1.3, { label: 128 });
      }
      break;
    }
    case 'messy': {
      const r = _mb(_h2(rec.seed, 23));
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * (1.1 + i * .11);
        const x0 = Math.cos(a) * R * 1.0 * s.wf, y0 = cy + Math.sin(a) * R * 1.02;
        const x1 = Math.cos(a + .06) * R * 1.0 * s.wf, y1 = cy + Math.sin(a + .06) * R * 1.02;
        const xm = (x0 + x1) / 2 + (r() - .5) * .06 * k, ym = Math.min(y0, y1) - (.05 + r() * .09) * k;
        stift.line([[x0, y0], [xm, ym], [x1, y1]], 1.5, { label: 130 + i });
      }
      break;
    }
    case 'spiky': case 'mohawk': {
      const n = h === 'mohawk' ? 5 : 7;
      const breit = h === 'mohawk' ? .5 : 1.4;
      for (let i = 0; i < n; i++) {
        const t = (i + .5) / n - .5;
        const a = -Math.PI / 2 + t * breit;
        const x0 = Math.cos(a - .1) * R * .95 * s.wf, y0 = cy + Math.sin(a - .1) * R * .98;
        const x1 = Math.cos(a + .1) * R * .95 * s.wf, y1 = cy + Math.sin(a + .1) * R * .98;
        const xs = Math.cos(a) * R * (1.25 + (i % 2) * .15) * s.wf, ys = cy + Math.sin(a) * R * (1.3 + (i % 2) * .15);
        stift.line([[x0, y0], [xs, ys], [x1, y1]], 1.5, { label: 132 + i });
      }
      break;
    }
    case 'curly': {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.06 + i * .15);
        const x = Math.cos(a) * R * .95 * s.wf, y = cy + Math.sin(a) * R * .95;
        stift.line(kreisPts(x, y, R * .16, R * .15, 10, .06, rec.seed + i), 1.4, { closed: true, label: 134 + i });
      }
      break;
    }
    case 'buzz': {
      const r = _mb(_h2(rec.seed, 25));
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (1.02 + r() * .96);
        const x = Math.cos(a) * R * .97 * s.wf, y = cy + Math.sin(a) * R * .99;
        stift.line([[x, y], [x + Math.cos(a) * .04 * k, y + Math.sin(a) * .04 * k]], 1.1, { label: 136 + i, alpha: .7 });
      }
      break;
    }
    case 'afro': {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const a = Math.PI + (i / 15) * Math.PI;
        const f = 1.15 + Math.sin(i * 2.3) * .12;
        pts.push([Math.cos(a) * R * 1.05 * f * s.wf, cy + Math.sin(a) * R * 1.05 * f]);
      }
      stift.line(pts, 1.5, { label: 138 });
      stift.line([[-R * .9, cy - R * .2], [0, cy - R * .05], [R * .9, cy - R * .2]], 1.3, { label: 139, alpha: .7 });
      break;
    }
  }
}

/* 尾巴：摇/卷/绒球 */
function zeichneSchwanz(stift, rec, k, wag) {
  const t = rec.tail.style;
  if (t === 'none') return;
  const bx = .3 * k, by = -.32 * k;
  if (t === 'wag') {
    // 摇尾：从身体侧后向上卷的弧，梢上一点绒
    const pts = bogenPts(0, 0, .24 * k, .3 * k, Math.PI * .35, Math.PI * 1.5, 9)
      .map((p) => {
        const a = wag * .18;
        return [bx + p[0] * Math.cos(a) - p[1] * Math.sin(a), by - .06 * k + p[0] * Math.sin(a) + p[1] * Math.cos(a)];
      });
    stift.line(pts, 1.5, { label: 140 });
    stift.dot(pts[pts.length - 1][0], pts[pts.length - 1][1], .035 * k, .6, 141);
  } else if (t === 'curl') {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const tt = i / 14, a = tt * TAU2 * 1.6;
      pts.push([bx + .08 * k + Math.cos(a) * .13 * k * tt, by + Math.sin(a) * .13 * k * tt]);
    }
    stift.line(pts, 1.4, { label: 142 });
  } else {
    stift.line(kreisPts(bx + .1 * k, by, .1 * k, .1 * k, 10, .18, rec.seed + 3), 1.4, { closed: true, label: 143 });
  }
}

/* 墨块斑点：单独拆出来，画在五官之前 —— 墨可以糊在头发和身上，但不能盖住眼睛嘴 */
function zeichneFlecken(stift, rec, k) {
  if (!rec.extras.spots) return;
  const cy = -.95 * k;
  const R = .44 * rec.skull.s * k;
  const r = _mb(_h2(rec.seed, 41));
  const n = 2 + Math.floor(r() * 3);
  const ex = .44 * rec.skull.wf * rec.skull.s * .44 * rec.eyes.sx * k;
  const stellen = [
    () => [(r() < .5 ? 1 : -1) * ex * (1.35 + r() * .35), cy - R * (.25 + r() * .25)],   // 眉骨外侧（不压眼睛）
    () => [(r() < .5 ? 1 : -1) * R * (0.7 + r() * .3), cy - R * (0.5 + r() * .4)],           // 耳侧
    () => [(r() - .5) * R * .5, -.3 * k + (r() - .5) * .16 * k],                             // 身上
    () => [(r() - .5) * R * 1.1, cy + (r() - .5) * R * .8],
  ];
  for (let i = 0; i < n; i++) {
    const [sx, sy] = stellen[i % stellen.length]();
    const fleck = kreisPts(sx, sy, (.07 + r() * .07) * k, (.05 + r() * .06) * k, 10, .28, rec.seed + i * 13);
    stift.tone(fleck, { dunkel: true, label: 150 + i, k });
    stift.line(fleck, 1, { closed: true, label: 151 + i, alpha: .5 });
  }
}

/* 附加：雀斑/胡须/眼镜/泪 */
function zeichneExtras(stift, rec, k, kopf, face = 'ruhig') {
  const x = rec.extras;
  const cy = -.95 * k;
  const R = .44 * rec.skull.s * k;
  if (x.freckles) {
    for (const s of [-1, 1]) {
      const r = _mb(_h2(rec.seed, 43 + s));
      for (let i = 0; i < 3; i++) {
        stift.dot(s * R * .5 + (r() - .5) * .08 * k, cy + .14 * k + (r() - .5) * .05 * k, .012 * k, .5, 152 + i + s);
      }
    }
  }
  if (x.whiskers) {
    // 胡须从颊上向外伸：起点按吻瓣实际半宽外推，宽吻的狗不会从吻里长出胡须
    const my = cy + .28 * k;
    const schnauzeRx = rec.skull.muzzle * k * .5 * (rec.skull.fett ?? 1);
    const x0 = Math.max(R * .55, schnauzeRx + .06 * k);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        stift.line([[s * x0, my + (i - 1) * .03 * k], [s * (x0 + R * .5), my + (i - 1) * .07 * k]], 1, { label: 155 + i + s * 10, alpha: .6 });
      }
    }
  }
  if (x.glasses) {
    const ey = -.98 * k;
    const ex = .44 * rec.skull.wf * rec.skull.s * .44 * rec.eyes.sx * k;
    for (const s of [-1, 1]) {
      stift.line(kreisPts(s * ex, ey, .15 * k, .15 * k, 16, .03, rec.seed + s), 1.3, { closed: true, label: 158 + s });
    }
    stift.line([[-ex + .15 * k, ey], [ex - .15 * k, ey]], 1.2, { label: 160 });
    for (const s of [-1, 1]) {
      stift.line([[s * (ex + .15 * k), ey - .01 * k], [s * R * 1.02, ey - .06 * k]], 1.1, { label: 161 + s, alpha: .65 });
    }
  }
  if (x.tears || face === 'weint') {
    // 泪滴：哭表情必掉，且更大、可能两行
    const ey = -.98 * k;
    const tropfen = (tx, ty, g, label, alpha) => {
      stift.line([[tx, ty + g], [tx - g * .4, ty + g * .35], [tx, ty], [tx + g * .4, ty + g * .35]], 1.1, { closed: true, label, alpha });
    };
    tropfen(R * .45, ey + .12 * k, .07 * k, 163, .75);
    if (face === 'weint') tropfen(-R * .45, ey + .14 * k, .09 * k, 164, .8);
  }
}

/* ================= 整只绘制 =================
 * (X, footY) 是脚底位置，k = 像素/单位。anim = { blink, hop(px, 负值向上) }
 */

function drawDoodle(ctx, rec, X, footY, k, t, anim = {}) {
  const tick = Math.floor(t * 8);
  const qt = Math.floor(t * 12) / 12;
  const stift = bleiStift(ctx, _h2(rec.seed, tick), rec.media, rec.farbe);
  const bob = Math.sin(qt * 2.2 * rec.anim.tempo + rec.anim.phase) * .018 * k;
  const wag = Math.sin(qt * 5 + rec.anim.phase);
  const kopf = kopfPoly(rec, k);
  // 表情：平静（配方原样）/ 笑 / 怒 / 怕 / 哭 / 睡 —— 眼嘴换画法、怒怕加眉
  const face = anim.face ?? 'ruhig';

  ctx.save();
  ctx.translate(X, footY + bob + (anim.hop ?? 0));

  // 尾巴在身体后面
  zeichneSchwanz(stift, rec, k, wag);

  // 腿与脚：细棍
  for (const s of [-1, 1]) {
    stift.line([[s * .1 * k, -.12 * k], [s * .13 * k, -.01 * k]], 1.4, { label: 170 + s });
    stift.line([[s * .13 * k - (s > 0 ? .01 * k : -.01 * k), -.01 * k], [s * .19 * k, -.01 * k]], 1.4, { label: 172 + s });
  }
  // 身体：小椭圆（haut 原语决定深色/浅色/介质填法）
  const koerper = kreisPts(0, -.3 * k, .26 * k, .21 * k, 18, .05, rec.seed + 11);
  stift.haut(koerper, torsoDark(rec), { k });
  stift.line(koerper, 1.5, { closed: true, label: 13 });
  // 手臂：细棍下垂
  for (const s of [-1, 1]) {
    stift.line([[s * .27 * k, -.4 * k], [s * .36 * k, -.18 * k]], 1.4, { label: 174 + s });
    stift.dot(s * .36 * k, -.17 * k, .028 * k, .7, 175 + s);
  }

  // 头
  stift.haut(kopf, rec.skull.dark, { k });
  stift.line(kopf, 1.6, { closed: true, label: 15, jitter: .6 });

  // 头顶与发型
  zeichneCrest(stift, rec, k, kopf);
  zeichneHair(stift, rec, k, kopf);
  // 墨块斑点：在五官之前落墨（可以糊在头发身上，不盖眼睛）
  zeichneFlecken(stift, rec, k);

  // 脸：按表情换眼/眉/嘴（blick = 视线偏移，瞳孔小幅瞟动）
  zeichneBrauen(stift, rec, k, face);
  zeichneAugen(stift, rec, k, anim.blink || face === 'weint' || face === 'schlaeft', face, anim.blick);
  if (rec.skull.muzzle > 0) {
    zeichneMuzzle(stift, rec, k, face);
  } else {
    zeichneNase(stift, rec, k);
    zeichneMund(stift, rec, k, face);
  }
  zeichneExtras(stift, rec, k, kopf, face);
  if (face === 'schlaeft') zeichneZzz(stift, rec, k, qt);

  ctx.restore();
}

/* ================= 牌型维度 ================= */

const ART_NAME = { human: '人', dog: '狗', cat: '猫', rabbit: '兔', bear: '熊', alp: '魇' };

function doodleDims(rec) {
  const c = rec.crest.style;
  return {
    art: ART_NAME[rec.art] ?? rec.art,
    kopf: ['floppy', 'bear', 'cat', 'bunny'].includes(c) ? '耳'
      : c === 'horns' ? '角'
      : c === 'halo' ? '光环' : '无',
    brille: rec.extras.glasses ? '有镜' : '无镜',
    frisur: rec.hair.style === 'bald' ? '秃'
      : ['pigtails', 'long'].includes(rec.hair.style) ? '长'
      : ['buns', 'topknot'].includes(rec.hair.style) ? '髻'
      : ['afro', 'curly', 'messy'].includes(rec.hair.style) ? '卷' : '短',
  };
}
