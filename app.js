/* 一版摇头晃脑的脑袋 —— avatar-presse 效果复刻
 * 零依赖。三层结构与原作一致：
 *   DNA   —— 这颗头"是谁"：一个 seed 推出的所有稳定特征
 *   Regung —— 它"正在做什么"：转头、瞳孔、眨眼、呼吸、嘟囔
 *   Stift  —— "画成什么样"：填充式笔尖带、双线套印、8fps 沸腾
 *
 * 与初版不同，这里按原作机制重写：
 *   颅骨是一个参数化 3D 壳（超椭球 + 鼓包 + 方感），每帧只做旋转+投影，
 *   轮廓是从点云按角度分桶取最远距离再平滑得到的剪影；
 *   五官贴在壳面上的局部切平面坐标系（feld）里，转头时自然透视变形；
 *   笔触不是 ctx.stroke，而是沿法向抖动、两端收尖的填充色带。
 */
'use strict';

/* ================= 随机数 ================= */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 字符串标签混入种子（FNV），让"眼睛大小"和"头发形状"走各自的流
function labelSeed(seed, label) {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i); h = Math.imul(h, 16777619);
  }
  return (seed ^ (h >>> 0)) >>> 0;
}
// 原作风格的随机流：先扔掉 8 个值，再提供 range/int/pick/chance/weighted
function strom(seed, label) {
  const r = mulberry32((label !== undefined ? labelSeed(seed, label) : seed) * 2654435761 % 4294967296);
  for (let i = 0; i < 8; i++) r();
  return {
    n: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    weighted: (pairs) => {
      let sum = 0;
      for (const p of pairs) sum += p[1];
      let x = r() * sum;
      for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
  };
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

/* ================= 调色板：OKLCH ================= */

function oklch(l, c, h) {
  const hr = (h % 360 + 360) % 360 * Math.PI / 180;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  const L = l + 0.3963377774 * a + 0.2158037573 * b;
  const M = l - 0.1055613458 * a - 0.0638541728 * b;
  const S = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = L * L * L, m3 = M * M * M, s3 = S * S * S;
  const gam = (v) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  const q = (v) => Math.round(clamp(gam(v), 0, 1) * 255);
  return `rgb(${q(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)},${q(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)},${q(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)})`;
}

// 肤色色相池与发色/织物色池（l, c, h 三元的取用规则与原作一致）
const HAUT_HUES = [292, 66, 44, 22, 310, 250];
const HAAR_DUNKEL = [[.3, .03, 285], [.34, .07, 58], [.62, .012, 280], [.72, .08, 76], [.46, .1, 40], [.24, .02, 300]];
const HAAR_BUNT = [[.7, .115, 355], [.63, .12, 305], [.72, .095, 190], [.6, .11, 252], [.88, .015, 280]];
const STOFF_POOL = [[.72, .06, 268], [.66, .09, 200], [.7, .08, 140], [.68, .1, 40]];
const pickIdx = (t, arr) => arr[Math.min(arr.length - 1, Math.floor(t * arr.length))];

function makePalette(p) {
  const hautH = pickIdx(p.hautT, HAUT_HUES);
  const haar = p.haarT >= .82 ? pickIdx((p.haarT - .82) / .18, HAAR_BUNT) : pickIdx(p.haarT / .82, HAAR_DUNKEL);
  const stoff = pickIdx(p.akzentT, STOFF_POOL);
  const tinteL = .25 + p.tinteT * .05;
  return {
    tinte: oklch(tinteL, .03, 282),
    tinteWeich: oklch(tinteL + .28, .02, 282),
    haut: oklch(.955, .007, hautH),
    hautTief: oklch(.918, .0112, hautH),
    schatten: 'rgba(40,30,60,0.075)',
    akzent: oklch(.72, .115, 28),
    haar: oklch(haar[0], haar[1], haar[2]),
    haarDunkel: haar[0] < .5,
    stoff: oklch(stoff[0], stoff[1], stoff[2]),
    stoffTief: oklch(stoff[0] - .28, stoff[1] * 1.15, stoff[2]),
    pflaster: oklch(.93, .03, 80),
  };
}
const PAPIER = oklch(.972, .006, 84);
const PAPIER_DUNKEL = oklch(.86, .01, 84);

/* ================= Stift：填充色带式的笔 =================
 * 一条"线"= 沿路径法向抖动、两端按 spitz 收尖的填充多边形；
 * 默认再叠一遍半宽、抖得更厉害、透明度 0.32 的套印。
 * 噪声表按 spur（笔画名）缓存，混入按 8fps 量化的 tick —— 线条在沸腾。
 */

const STIFT_GROB = 12, STIFT_FEIN = 40, STIFT_N = 52;

function stiftNoise(fnv) {
  // 52 个随机节点：前 12 个低频、后 40 个高频
  const arr = new Float32Array(STIFT_N);
  for (let i = 0; i < STIFT_N; i++) arr[i] = fnv() * 2 - 1;
  return arr;
}
// Catmull-Rom 在节点数组上取值（低频段 + 0.35 高频段）
function noiseAt(arr, u) {
  const seg = (off, n, t) => {
    const x = t * (n - 3), i = Math.floor(x), f = x - i;
    const g = (k) => arr[off + clamp(k, 0, n - 1)];
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    return .5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  };
  return seg(0, STIFT_GROB, u) + .35 * seg(STIFT_GROB, STIFT_FEIN, u);
}

// 去重 → （可选）Catmull-Rom 平滑 → 按弧长 0.022 重采样
function stiftResample(pts, closed, glatt) {
  let src = pts;
  if (!closed) {
    src = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - src[src.length - 1].x, pts[i].y - src[src.length - 1].y);
      if (d > 1e-7) src.push(pts[i]);
    }
  }
  if (src.length < 2) return src;
  if (glatt && src.length > 2) {
    const n = src.length, at = (i) => closed ? src[(i % n + n) % n] : src[clamp(i, 0, n - 1)];
    const sm = [], last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let k = 0; k < 6; k++) {
        const t = k / 6, t2 = t * t, t3 = t2 * t;
        sm.push({
          x: .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    if (!closed) sm.push(src[n - 1]);
    src = sm;
  }
  let total = 0;
  const segs = closed ? src.length : src.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = src[i], b = src[(i + 1) % src.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (total < 1e-6) return src;
  const count = Math.max(6, Math.min(180, Math.round(total / .022)));
  const step = total / count, out = [src[0]];
  let carry = 0;
  for (let i = 0; i < segs; i++) {
    const a = src[i], b = src[(i + 1) % src.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    let t0 = 0;
    while (carry + (1 - t0) * len >= step) {
      t0 += (step - carry) / len;
      out.push({ x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 });
      carry = 0;
    }
    carry += (1 - t0) * len;
  }
  if (!closed) {
    const lastP = src[src.length - 1], tail = out[out.length - 1];
    if (Math.hypot(lastP.x - tail.x, lastP.y - tail.y) > step * .5) out.push(lastP); else out[out.length - 1] = lastP;
  } else {
    // 闭合路径首尾重叠一小段，接缝处的笔尖压力才连续
    const wrap = Math.max(2, Math.round(out.length * .035));
    for (let i = 0; i < wrap; i++) out.push(out[i % out.length]);
  }
  return out;
}

function pathNormals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
}
function fillPoly(ctx, pts, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function scaleAround(pts, k, dx = 0, dy = 0) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  return pts.map((p) => ({ x: cx + (p.x - cx) * k + dx, y: cy + (p.y - cy) * k + dy }));
}

function makeStift(ctx, seed, tinte, breitenSkala, tick) {
  const cache = new Map();
  const tickMix = Math.imul(tick | 0, 2654435761) >>> 0;
  // 每条 spur 两张噪声表：稳的 + 随 tick 沸腾的，按路径长短混合
  const noiseFor = (spur, ruhigGrad) => {
    const key = ruhigGrad <= 0 ? spur + '!' : ruhigGrad >= 1 ? spur : spur + '#' + Math.round(ruhigGrad * 8);
    let hit = cache.get(key);
    if (hit) return hit;
    const base = labelSeed(seed, spur);
    const still = stiftNoise(mulberry32(base));
    let arr;
    if (ruhigGrad <= 0) arr = still;
    else {
      const lively = new Float32Array(STIFT_N);
      const r1 = mulberry32(base), r2 = mulberry32((base ^ tickMix) >>> 0);
      for (let i = 0; i < 6; i++) { r1(); r2(); }
      for (let i = 0; i < STIFT_N; i++) lively[i] = (r1() * 2 - 1) * .62 + (r2() * 2 - 1) * .5;
      arr = new Float32Array(STIFT_N);
      for (let i = 0; i < STIFT_N; i++) arr[i] = still[i] * (1 - ruhigGrad) + lively[i] * ruhigGrad;
    }
    cache.set(key, arr);
    return arr;
  };
  // 套印错位：每颗头固定的微小平移/缩放
  const reg = noiseFor('register', 0);
  const regA = reg[0] * Math.PI, regD = .008 + Math.abs(reg[1]) * .008;
  const register = { dx: Math.cos(regA) * regD, dy: Math.sin(regA) * regD, skal: 1 + reg[2] * .015 };

  // 色带：中心线沿法向抖动，半宽按 sin(πu)^.35 收尖
  function band(pts, w, wackel, noise, spitz) {
    const nrm = pathNormals(pts), n = pts.length - 1, left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const off = noiseAt(noise, u) * wackel;
      const druck = Math.min(1, Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), .35));
      const halb = w * ((1 - spitz + spitz * druck) * (.9 + .1 * noiseAt(noise, (u + .37) % 1))) / 2;
      const nx = nrm[i].x, ny = nrm[i].y;
      const mx = pts[i].x + nx * off, my = pts[i].y + ny * off;
      left.push({ x: mx + nx * halb, y: my + ny * halb });
      right.push({ x: mx - nx * halb, y: my - ny * halb });
    }
    right.reverse();
    return left.concat(right);
  }

  function zug(roh, opt = {}) {
    if (roh.length < 2) return;
    const pts = roh.map((p) => ({ x: p.x, y: p.y }));
    const w = (opt.w ?? .024) * breitenSkala;
    const farbe = opt.farbe ?? tinte;
    const deckung = opt.deckung ?? .9;
    const closed = !!opt.geschlossen;
    const pts2 = stiftResample(pts, closed, !opt.eckig);
    if (pts2.length < 2) return;
    let len = 0;
    for (let i = 1; i < pts2.length; i++) len += Math.hypot(pts2[i].x - pts2[i - 1].x, pts2[i].y - pts2[i - 1].y);
    const wackel = (opt.wackel ?? .007) * Math.max(.5, Math.min(1, len / .5));
    const ruhigGrad = opt.ruhig ? 0 : clamp((len - .4) / .8, 0, 1);
    const spitz = opt.spitz ?? .75;
    fillPoly(ctx, band(pts2, w, wackel, noiseFor(opt.spur || '?', ruhigGrad), spitz), farbe, deckung);
    if (!opt.einlagig) {
      fillPoly(ctx, band(pts2, w * .5, wackel * 1.7 + .004, noiseFor((opt.spur || '?') + '~', ruhigGrad), spitz), farbe, deckung * .32);
    }
  }

  function flaeche(roh, opt = {}) {
    if (roh.length < 3) return;
    const pts = roh.map((p) => ({ x: p.x, y: p.y }));
    let rs = stiftResample(pts, true, !opt.eckig);
    if (opt.spur) {
      const noise = noiseFor(opt.spur, 0), nrm = pathNormals(rs), amp = opt.wackel ?? .006;
      rs = rs.map((p, i) => ({ x: p.x + nrm[i].x * noiseAt(noise, i / (rs.length - 1)) * amp, y: p.y + nrm[i].y * noiseAt(noise, i / (rs.length - 1)) * amp }));
    }
    const deckung = opt.deckung ?? 1;
    if (!opt.trocken) {
      const off = scaleAround(rs, register.skal, register.dx, register.dy);
      fillPoly(ctx, scaleAround(off, 1.03), opt.farbe, deckung * .14);
    }
    fillPoly(ctx, rs, opt.farbe, deckung);
  }

  // 圆点：其实是 wobbly 的小多边形，可选沿壳面切向压扁
  function punkt(p, radius, farbe, opt = {}) {
    if (radius <= 0) return;
    const noise = noiseFor(opt.spur ?? 'punkt', 0);
    const deckung = opt.deckung ?? 1;
    const streck = opt.streck ?? 1;
    const quetschen = .86 + Math.abs(noise[7]) * .16;
    const dreh = (opt.dreh ?? 0) + noise[6] * .6;
    const cosD = Math.cos(dreh), sinD = Math.sin(dreh);
    const cx = p.x + noise[4] * radius * .07, cy = p.y + noise[5] * radius * .07;
    const fx = opt.feld?.ex ?? { x: 1, y: 0 }, fy = opt.feld?.ey ?? { x: 0, y: 1 };
    const fsx = opt.feld?.fx ?? 1, fsy = opt.feld?.fy ?? 1;
    const anz = Math.max(8, Math.min(24, Math.round(6.2832 * radius / .028)));
    const pts = [];
    for (let i = 0; i < anz; i++) {
      const a = i / anz * 6.2832;
      const ex = Math.cos(a) * radius * streck, ey = Math.sin(a) * radius * quetschen;
      const rx = ex * cosD - ey * sinD, ry = ex * sinD + ey * cosD;
      pts.push({ x: cx + fx.x * rx * fsx + fy.x * ry * fsy, y: cy + fx.y * rx * fsx + fy.y * ry * fsy });
    }
    const nrm = pathNormals(pts), amp = Math.min(.007, radius * .15);
    const wob = pts.map((q, i) => ({ x: q.x + nrm[i].x * noiseAt(noise, i / (pts.length - 1)) * amp, y: q.y + nrm[i].y * noiseAt(noise, i / (pts.length - 1)) * amp }));
    if (!opt.ohneSaum) fillPoly(ctx, scaleAround(wob, 1.07), farbe, deckung * .16);
    fillPoly(ctx, wob, farbe, deckung * .94);
  }

  return { zug, flaeche, punkt };
}

// 线宽随头的大小亚线性缩放：大头不会让线等比变粗
const stiftSkala = (mass) => clamp(Math.pow(95 / Math.max(1, mass), .4), .62, 1.3);

/* ================= 颅骨：参数化壳 + 剪影 ================= */

const KAMERA = 4.2;

// 壳面点：超椭球 + 顶部锥度 + 随机鼓包 + 方感
function schaedelPunkt(u, v, k) {
  const cv = Math.cos(v);
  const s = v / (Math.PI / 2);
  const c1 = (k.scheitelHoch + k.kegel) / 2, c2 = (k.scheitelHoch - k.kegel) / 2;
  let w = 1 + c1 * s + c2 * s * s;
  w *= 1 + k.beule * Math.sin(s * Math.PI + k.beulenPhase) * Math.cos(u + k.beulenPhase * 2.3) * .045;
  const kastig = 1 + k.kastig * .26 * (.5 * Math.sin(2 * v) ** 2 + .5 * (cv * Math.sin(2 * u)) ** 2);
  return { x: k.rx * cv * Math.sin(u) * w * kastig, y: k.ry * Math.sin(v) * kastig, z: k.rz * cv * Math.cos(u) * w * kastig };
}
function schaedelNormale(u, v, k) {
  const e = .012;
  const p = schaedelPunkt(u, v, k), pu = schaedelPunkt(u + e, v, k), pv = schaedelPunkt(u, v + e, k);
  const ax = pu.x - p.x, ay = pu.y - p.y, az = pu.z - p.z;
  const bx = pv.x - p.x, by = pv.y - p.y, bz = pv.z - p.z;
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  if (nx * p.x + ny * p.y + nz * p.z < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return { x: nx, y: ny, z: nz };
}
function rotMatrix(pose) {
  const cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw);
  const cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  const cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
  return [
    cr * cy - sr * sp * sy, -sr * cp, cr * sy + sr * sp * cy,
    sr * cy + cr * sp * sy, cr * cp, sr * sy - cr * sp * cy,
    -cp * sy, sp, cp * cy,
  ];
}
function rotPunkt(m, p) {
  return { x: m[0] * p.x + m[1] * p.y + m[2] * p.z, y: m[3] * p.x + m[4] * p.y + m[5] * p.z, z: m[6] * p.x + m[7] * p.y + m[8] * p.z };
}
// 弱透视投影；y 轴翻转到屏幕方向
function projekt(p) {
  const n = KAMERA / (KAMERA - p.z);
  return { x: p.x * n, y: -p.y * n, z: p.z, s: n };
}

// 点云：贵几何只算一次，之后每帧只旋转投影
function wolkeErstellen(k, nu, nv, vVonFn, vBisFn, dickeFn) {
  const xyz = new Float32Array((nu + 1) * (nv + 1) * 3);
  let f = 0;
  for (let i = 0; i <= nu; i++) {
    const u = -Math.PI + (i / nu) * Math.PI * 2;
    const v0 = vVonFn(u), v1 = vBisFn(u);
    if (v1 === v0) continue;
    for (let j = 0; j <= nv; j++) {
      const v = v0 + (v1 - v0) * j / nv;
      const p = schaedelPunkt(u, v, k);
      if (dickeFn) {
        const d = dickeFn(u, v);
        if (d !== 0) {
          const n = schaedelNormale(u, v, k);
          p.x += n.x * d; p.y += n.y * d; p.z += n.z * d;
        }
      }
      xyz[f++] = p.x; xyz[f++] = p.y; xyz[f++] = p.z;
    }
  }
  return { xyz, n: f / 3 };
}

// 剪影：按角度分桶取最远的点，填空、平滑，再按角度重建多边形
function silhouettenGlaettung(radien, bins, passes, von, bis) {
  const tmp = new Float32Array(bins);
  for (let p = 0; p < passes; p++) {
    for (let n = von; n <= bis; n++) {
      const o = (n % bins + bins) % bins;
      let sum = 0, wsum = 0;
      for (let a = -3; a <= 3; a++) {
        const j = n + a;
        if (j < von || j > bis) continue;
        const v = radien[(j % bins + bins) % bins];
        if (v === 0) continue;
        const w = 1 / (1 + a * a);
        sum += v * w; wsum += w;
      }
      tmp[o] = wsum ? sum / wsum : radien[o];
    }
    for (let n = von; n <= bis; n++) {
      const o = (n % bins + bins) % bins;
      radien[o] = tmp[o];
    }
  }
}
function silhouettesAusWolke(wolke, m, opt = {}) {
  const bins = opt.bins ?? 96;
  const r2 = new Float32Array(bins);
  const scale = bins / 6.28318531;
  const { xyz, n } = wolke;
  let hinterR2 = null;
  if (opt.hinter && opt.hinter.length) {
    hinterR2 = new Float32Array(opt.hinter.length);
    for (let i = 0; i < opt.hinter.length; i++) {
      const p = opt.hinter[i];
      hinterR2[i] = p.x * p.x + p.y * p.y;
    }
  }
  const hBins = opt.hinter ? opt.hinter.length / 6.28318531 : 0;
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const rp = rotPunkt(m, { x: xyz[j], y: xyz[j + 1], z: xyz[j + 2] });
    const f = KAMERA / (KAMERA - rp.z);
    const px = rp.x * f, py = -rp.y * f;
    const rr = px * px + py * py;
    const ang = Math.atan2(py, px) + Math.PI;
    if (hinterR2 && rp.z < -.15) {
      let hb = (ang * hBins) | 0;
      hb = clamp(hb, 0, hinterR2.length - 1);
      if (rr <= hinterR2[hb]) continue;   // 被颅骨挡住的后侧点
    }
    let b = (ang * scale) | 0;
    b = clamp(b, 0, bins - 1);
    if (rr > r2[b]) r2[b] = rr;
  }
  const radien = new Float32Array(bins);
  for (let i = 0; i < bins; i++) radien[i] = Math.sqrt(r2[i]);
  // 空桶插值（只做整圈剪影；头发那种局部弧要靠空桶判断边界，不能填）
  if (opt.bogenUm === undefined) for (let i = 0; i < bins; i++) {
    if (radien[i] > 0) continue;
    let a = i, b = i, guard = 0;
    while (radien[(a - 1 + bins) % bins] === 0 && guard++ < bins) a--;
    guard = 0;
    while (radien[(b + 1) % bins] === 0 && guard++ < bins) b++;
    const va = radien[(a - 1 + bins) % bins], vb = radien[(b + 1) % bins];
    if (va === 0 || vb === 0) continue;
    const span = b - a + 2;
    for (let k = a; k <= b; k++) radien[(k % bins + bins) % bins] = va + (vb - va) * (k - a + 1) / span;
    i = b;
  }
  const emit = (von, bis) => {
    const pts = [];
    for (let i = von; i <= bis; i++) {
      const o = (i % bins + bins) % bins;
      const ang = -Math.PI + (o + .5) / bins * Math.PI * 2;
      pts.push({ x: Math.cos(ang) * radien[o], y: Math.sin(ang) * radien[o] });
    }
    return pts;
  };
  if (opt.bogenUm === undefined) {
    silhouettenGlaettung(radien, bins, opt.glaetten ?? 3, 0, bins - 1);
    return emit(0, bins - 1);
  }
  // 只要围绕某个角度的连续弧（用于头发：头顶那半圈）
  let center = ((opt.bogenUm + Math.PI) * scale | 0);
  center = ((center % bins) + bins) % bins;
  const besetzt = (b) => radien[((b % bins) + bins) % bins] > 0;
  if (!besetzt(center)) {
    for (let d = 1; d < bins; d++) {
      if (besetzt(center + d)) { center = (center + d) % bins; break; }
      if (besetzt(center - d)) { center = ((center - d) + bins) % bins; break; }
    }
  }
  if (!besetzt(center)) return [];
  const luecke = Math.max(2, Math.round(bins / 48));
  const laufe = (dir) => {
    let last = 0, leer = 0;
    for (let i = 1; i < bins; i++) {
      if (besetzt(center + dir * i)) { last = i; leer = 0; }
      else if (++leer > luecke) break;
    }
    return last;
  };
  let links = laufe(-1), rechts = laufe(1);
  if (links + rechts + 1 >= bins) { links = Math.floor((bins - 1) / 2); rechts = bins - 1 - links; }
  for (let d = -links; d <= rechts; d++) {
    const o = ((center + d) % bins + bins) % bins;
    if (!radien[o]) radien[o] = (radien[(o - 1 + bins) % bins] + radien[(o + 1) % bins]) / 2;
  }
  silhouettenGlaettung(radien, bins, opt.glaetten ?? 2, center - links, center + rechts);
  return emit(center - links, center + rechts);
}

// feld：壳面上 (u,v) 处的局部坐标系 —— 五官都贴在这里
function feldAn(u, v, ctx3d) {
  const { kopf, m, refU, refV } = ctx3d;
  const e = .012;
  const p0 = projekt(rotPunkt(m, schaedelPunkt(u, v, kopf)));
  const pu = projekt(rotPunkt(m, schaedelPunkt(u + e, v, kopf)));
  const pv = projekt(rotPunkt(m, schaedelPunkt(u, v + e, kopf)));
  const exx = (pu.x - p0.x) / e, exy = (pu.y - p0.y) / e;
  const eyx = (pv.x - p0.x) / e, eyy = (pv.y - p0.y) / e;
  const du = Math.hypot(exx, exy) || 1e-6, dv = Math.hypot(eyx, eyy) || 1e-6;
  const n3 = rotPunkt(m, schaedelNormale(u, v, kopf));
  const feld = {
    x: p0.x, y: p0.y, z: p0.z,
    ex: { x: exx / du, y: exy / du },
    ey: { x: eyx / dv, y: eyy / dv },
    fx: du / refU, fy: dv / refV,
    nrm: { x: n3.x, y: -n3.y },
    nz: n3.z,
    to(a, b, n) {
      let r = this.x + this.ex.x * a * this.fx + this.ey.x * b * this.fy;
      let s = this.y + this.ex.y * a * this.fx + this.ey.y * b * this.fy;
      if (n) { r += this.nrm.x * n; s += this.nrm.y * n; }
      return { x: r, y: s };
    },
  };
  return feld;
}
// 参考刻度：正面 (0,0) 处的导数长度，用来抵消壳面拉伸
function feldReferenz(kopf) {
  const e = .012, m = rotMatrix({ yaw: 0, pitch: 0, roll: 0 });
  const p0 = projekt(rotPunkt(m, schaedelPunkt(0, 0, kopf)));
  const pu = projekt(rotPunkt(m, schaedelPunkt(e, 0, kopf)));
  const pv = projekt(rotPunkt(m, schaedelPunkt(0, e, kopf)));
  return { refU: Math.hypot(pu.x - p0.x, pu.y - p0.y) / e, refV: Math.hypot(pv.x - p0.x, pv.y - p0.y) / e };
}
// 3D 点直接投影（耳朵、辫子、帽子用）
function punkt3d(x, y, z, ctx3d) {
  const p = projekt(rotPunkt(m0(ctx3d), { x, y, z }));
  return { x: p.x, y: p.y };
}
function m0(c) { return c.m; }

/* ================= DNA：一个 seed 一张脸 ================= */
/* 变体目录与权重取自原作的特征表；nichtMit/nurBei 约束做了简化。 */

const AUGEN_W = [['punkt', 1.4], ['knopf', 1.6], ['ring', 1], ['mandel', 1.2], ['strich', .6], ['zwinker', .7], ['schlaefrig', .9], ['weit', 1.2], ['offen', 2], ['froh', 1], ['kreuz', .35], ['stern', .4], ['kritzel', .5]];
const NASEN_W = [['haken', 1.4], ['komma', 1], ['strich', .8], ['welle', .8], ['knopf', 1], ['lang', 1.2], ['punkte', 1]];
const MUENDER_W = [['strich', 1], ['laecheln', 2], ['klein', 1], ['welle', .8], ['offen', .8], ['lippen', .9], ['grinsen', 1.2], ['zaehne', .8], ['hasenzahn', .7], ['schief', 1], ['zickzack', .6]];
const HAAR_W = [['keine', 1.4], ['flaum', 1.4], ['haube', 1.4], ['pony', 1.2], ['locken', 1], ['stacheln', .8], ['antenne', .6], ['seitenscheitel', 1.4], ['lockenwolke', 1.1], ['igel', 1], ['zoepfe', .8], ['dutt', .8], ['afro', 1.2]];
const DECKUNG_W = [['keine', 9], ['stirnband', 1], ['kappe', 1], ['hut', 1], ['kopfhoerer', .9]];
const BRILLE_W = [['keine', 8], ['rund', 1.4], ['eckig', 1]];
const BART_W = [['keiner', 12], ['stoppeln', 1], ['schnauz', .8], ['stoppelschnauz', .7]];
const BACKE_W = [['keine', 2], ['rosig', 3], ['punkte', 1.6], ['sommersprossen', 1.6]];
const BRAUE_W = [['keine', 2], ['duenn', 2], ['dick', 1.2], ['hoch', 1.2], ['schraeg', 1], ['sorge', .8]];
const KRAGEN_W = [['keiner', 1.5], ['v', 2], ['rund', 2]];
const ZEICHEN_W = [['keine', 6], ['augenringe', 1], ['schraffur', 1], ['stirnfalten', 1], ['wangenbogen', 1.4]];
const ZIERRAT_W = [['keiner', 7], ['ohrring', 1.2], ['pflaster', .8]];
// 这些发型会盖住头顶，发带/便帽/耳机就不出现了
const HOHE_FRISUREN = new Set(['haube', 'pony', 'seitenscheitel', 'lockenwolke', 'igel', 'zoepfe', 'dutt', 'afro']);

const SYLL = ['ri', 'xel', 'sen', 'ni', 'ko', 'du', 'fa', 'ril', 'to', 'ba', 'lu', 'gi', 'sol',
  'wu', 'ze', 'pa', 'mon', 'ris', 'fen', 'ed', 'ok', 'ya', 'chi', 'ne', 'tar', 'vi', 'lo', 'dim', 'sü', 'bek', 'tir', 'law', 'per'];

function makeDNA(seed) {
  const r = strom(seed);
  const lay = strom(seed, 'layout');
  // —— 五官布局（原作 M()）：v 向上为正，眼在鼻上、鼻在嘴上 ——
  const augeU = lay.range(.3, .8);
  const nasenV = lay.range(-.36, -.14);
  const spreiz = lay.range(.62, 1.1);
  const skala = lay.range(.78, 1.3);
  const augeV = clamp(nasenV + .26 * spreiz, -.7, .5);
  const mundV = clamp(nasenV - .36 * spreiz, -.86, .06);
  const braueV = augeV + .1 + .1 * spreiz;
  const abstand = Math.max(.04, augeV - mundV);
  const halbVAuge = .34 * abstand / 2, halbVMund = .5 * abstand / 2;
  const naseOben = augeV + halbVAuge, naseUnten = mundV + halbVMund;
  const p = augeU * .45;
  const halbUAuge = Math.max(.03, Math.min(augeU - p, 1.35 - augeU));
  const layout = {
    augeU, augeV, braueV, nasenV, mundV, skala,
    zonen: {
      augeL: { u: -augeU, v: augeV, halbU: halbUAuge, halbV: halbVAuge },
      augeR: { u: augeU, v: augeV, halbU: halbUAuge, halbV: halbVAuge },
      nase: { u: 0, v: (naseOben + naseUnten) / 2, halbU: p, halbV: (naseOben - naseUnten) / 2 },
      mund: { u: 0, v: mundV, halbU: .62, halbV: halbVMund },
    },
    fuellung: clamp(.68 + (skala - .78) * .62, .68, 1),
    ohrV: augeV * .6 + .02,
    augenSkala: Math.max(.7, skala * clamp(augeU / .36, .62, 1)),
    lage: {
      augenAbstand: augeU < .38 ? 'eng' : augeU > .62 ? 'weit' : 'normal',
      gesichtsGroesse: skala < .92 ? 'klein' : skala > 1.12 ? 'gross' : 'normal',
    },
  };
  const kopf = {
    rx: r.range(.6, .86), ry: r.range(.8, 1.08), rz: r.range(.6, .78),
    kegel: r.range(-.34, .34), scheitelHoch: r.range(-.1, .16),
    beule: r.range(0, .5), beulenPhase: r.range(0, 6.28), kastig: r.range(0, 1),
  };
  const pose = { yaw: r.range(-.2, .2), pitch: r.range(-.1, .1), roll: r.range(-.09, .09) };
  const ansatzV = r.range(.34, .66);
  const lage = layout.lage;
  const gewaehlt = {};
  const waehle = (tabelle, key, filter) => {
    let tab = tabelle;
    if (filter) {
      const gefiltert = tabelle.filter(([id]) => !filter.has(id));
      if (gefiltert.length) tab = gefiltert;
    }
    const id = r.weighted(tab);
    gewaehlt[key] = id;
    return id;
  };
  // 眼睛与眼距的亲和：宽眼/圆眼不适合眼距窄
  let augenTab = AUGEN_W;
  if (lage.augenAbstand === 'eng') {
    augenTab = AUGEN_W.filter(([id]) => !['weit', 'ring', 'offen'].includes(id));
  }
  const auge = waehle(augenTab, 'auge');
  const nase = waehle(NASEN_W, 'nase');
  let mundTab = MUENDER_W;
  if (lage.gesichtsGroesse === 'klein') mundTab = MUENDER_W.filter(([id]) => !['offen', 'grinsen', 'zaehne'].includes(id));
  const mund = waehle(mundTab, 'mund');
  const haar = waehle(HAAR_W, 'haar');
  let deckTab = DECKUNG_W;
  if (HOHE_FRISUREN.has(haar)) deckTab = DECKUNG_W.filter(([id]) => id === 'keine' || id === 'hut');
  if (haar === 'zoepfe' || haar === 'dutt') deckTab = deckTab.filter(([id]) => id !== 'hut');
  const kopfbedeckung = waehle(deckTab, 'kopfbedeckung');
  const brille = waehle(BRILLE_W, 'brille');
  const bart = waehle(BART_W, 'bart');
  const braue = waehle(BRAUE_W, 'braue');
  const backe = waehle(BACKE_W, 'backe');
  const kragen = waehle(KRAGEN_W, 'kragen');
  let zeichenTab = ZEICHEN_W;
  if (backe === 'rosig') zeichenTab = ZEICHEN_W.filter(([id]) => id !== 'augenringe');
  if (!['ring', 'weit', 'offen', 'stern', 'knopf'].includes(auge)) zeichenTab = zeichenTab.filter(([id]) => id !== 'wangenbogen');
  const zeichen = waehle(zeichenTab, 'zeichen');
  const zierrat = waehle(ZIERRAT_W, 'zierrat');
  const hand = strom(seed, 'handschrift');
  // 名字：2~3 个音节的假名
  const namenR = strom(seed, 'name');
  const nSyll = namenR.chance(.6) ? 3 : 2;
  let name = '';
  for (let i = 0; i < nSyll; i++) name += namenR.pick(SYLL);
  return {
    seed, kopf, pose, ansatzV, layout,
    merkmale: { auge, nase, mund, haar, kopfbedeckung, brille, bart, braue, backe, kragen, zeichen, zierrat },
    asym: r.range(-.05, .05),
    palette: { hautT: r.n(), haarT: r.n(), akzentT: r.n(), tinteT: r.n() },
    pupille: r.n(),
    augenJitter: [hand.range(.9, 1.08), hand.range(.9, 1.1)],
    seite: hand.chance(.5) ? -1 : 1,
    taktVersatz: hand.n(),
    bartLage: hand.n(),
    punktMass: hand.range(.85, 1.55),
    name: name.toUpperCase(),
  };
}

// 唇部轮廓（"lippen"嘴型）：唇峰缺口的参数化形状
function lippenForm(kerbe) {
  const xs = [-.38, -.32, -.26, -.19, -.12, -.06, 0, .06, .12, .19, .26, .32, .38];
  const pts = xs.map((x) => {
    const n = Math.min(1, Math.abs(x) / .38);
    let y = -.09 - .24 * Math.pow(1 - n * n, .35);
    const i = Math.abs(x) / .22;
    if (i < 1) y += kerbe * .24 * .5 * (1 + Math.cos(Math.PI * i));
    return [x, y];
  });
  pts.push([.26, .21], [0, .31], [-.26, .21]);
  return pts;
}
const MUND_BASIS = {
  strich: [[-.5, -.04], [0, .06], [.5, -.02]],
  laecheln: [[-.5, -.26], [0, .44], [.5, -.22]],
  klein: [[-.26, -.1], [0, .22], [.26, -.08]],
  welle: [[-.5, .1], [-.16, -.18], [.16, .2], [.5, -.1]],
};

/* ================= Regung：每颗头的活动状态 =================
 * 弹簧转头 + 视线快、头慢 + 眨眼 + 呼吸 + 嘟囔，参数照原作 blick 模块。
 */

const POSE_LIMIT = { yaw: .4, pitch: .26, roll: .14 };
const clampPose = (p) => ({
  yaw: clamp(p.yaw, -POSE_LIMIT.yaw, POSE_LIMIT.yaw),
  pitch: clamp(p.pitch, -POSE_LIMIT.pitch, POSE_LIMIT.pitch),
  roll: clamp(p.roll, -POSE_LIMIT.roll, POSE_LIMIT.roll),
});

class Head {
  constructor(seed) {
    this.dna = makeDNA(seed);
    this.cache = null;            // 壳点云等贵几何，首次绘制时建
    const r = strom(seed, 'feder').n;
    const t0 = 0;
    this.yaw = 0; this.pitch = 0;
    this.vYaw = 0; this.vPitch = 0;
    this.blickX = 0; this.blickY = 0;
    this.wach = 0;
    this.blinzeltBis = 0;
    this.naechsterBlink = t0 + .5 + r() * 5;
    this.steif = 7 + r() * 9;
    this.atemPhase = r() * 6.28;
    this.atemTempo = .5 + r() * .3;
    this.plappertBis = 0;
    this.naechstesPlappern = t0 + 3 + r() * 14;
    this.plapperTempo = 7 + r() * 4;
    this.wuerfel = r;
    this.cx = 0; this.cy = 0; this.mass = 100;
  }

  update(dt, t, pointer) {
    dt = clamp(dt, 0, .05);
    let zYaw = 0, zPitch = 0, zBlickX = 0, zBlickY = 0, zWach = 0;
    if (pointer.active) {
      const reich = 7 * this.mass;
      const ex = (pointer.x - this.cx) / reich, ey = (pointer.y - this.cy) / reich;
      zYaw = clamp(ex, -1, 1) * .4;
      zPitch = clamp(ey, -1, 1) * .4 * .6;
      zBlickX = clamp(ex * 2.1, -1, 1);
      zBlickY = clamp(ey * 2.1, -1, 1);
      zWach = smooth((Math.hypot(pointer.x - this.cx, pointer.y - this.cy) / this.mass - 3.4) / (1.6 - 3.4));
    } else {
      const w = t * .24 + this.atemPhase;
      zYaw = Math.sin(w) * .4 * .35;
      zPitch = Math.sin(w * .61 + 1.7) * .4 * .16;
      zBlickX = Math.sin(w * 1.13) * .5;
      zBlickY = Math.sin(w * .77 + 2.2) * .3;
    }
    // 临界阻尼弹簧：头慢慢甩过去
    const b = 2 * Math.sqrt(this.steif);
    this.vYaw += (this.steif * (zYaw - this.yaw) - b * this.vYaw) * dt;
    this.vPitch += (this.steif * (zPitch - this.pitch) - b * this.vPitch) * dt;
    this.yaw += this.vYaw * dt;
    this.pitch += this.vPitch * dt;
    // 视线快得多
    const gx = 1 - Math.exp(-dt * 12);
    this.blickX += (zBlickX - this.blickX) * gx;
    this.blickY += (zBlickY - this.blickY) * gx;
    this.wach += (zWach - this.wach) * (1 - Math.exp(-dt * 7));
    if (t > this.naechsterBlink) {
      this.blinzeltBis = t + .14;
      this.naechsterBlink = t + (this.wach > .5 ? 1.6 : 3) + this.wuerfel() * 4;
    }
    if (t > this.naechstesPlappern) {
      this.plappertBis = t + 1.2 + this.wuerfel() * 1.8;
      this.naechstesPlappern = this.plappertBis + (this.wach > .5 ? 4 : 10) + this.wuerfel() * 16;
    }
  }

  mundOffen(t) {
    if (t >= this.plappertBis) return 0;
    const rest = this.plappertBis - t;
    const huelle = Math.min(1, rest / .3);
    const a = .5 + .5 * Math.sin(t * this.plapperTempo);
    const b = .6 + .4 * Math.sin(t * this.plapperTempo * .37 + 1);
    return Math.max(0, huelle * a * b);
  }

  // 当前动画帧的全部状态
  zustand(t) {
    const atem = Math.sin(t * this.atemTempo + this.atemPhase);
    let lider = 0;
    if (t < this.blinzeltBis) lider = Math.sin((1 - (this.blinzeltBis - t) / .14) * Math.PI);
    return {
      pose: clampPose({
        yaw: this.yaw + this.dna.pose.yaw * .5,
        pitch: this.pitch + this.dna.pose.pitch * .5 + atem * .012,
        roll: this.dna.pose.roll + atem * .006,
      }),
      blickX: this.blickX, blickY: this.blickY,
      lider, wach: this.wach, mund: this.mundOffen(t), zeit: t,
    };
  }
}

/* ================= 眼睛（13 种） ================= */

const LID_BREITE = .027;   // 五官线宽基准

function drawEye(stift, feld, size, kind, seite, anim, pupille, pal, spur, sternForm) {
  const d = size * (1 + anim.wach * .08);
  const offen = Math.max(.06, 1 - anim.lider * .94);
  const P = (e, n) => feld.to(e * d, -n * d * offen);
  const m = .7 + pupille * .7;
  // 视线目标点：在眼眶半径与瞳孔半径之差内移动
  const blickPkt = (ringR, pupR) => P((ringR - pupR) * anim.blickX * .78, (ringR - pupR) * anim.blickY * .7);
  const augenFeld = { ex: feld.ex, ey: feld.ey, fx: feld.fx, fy: feld.fy * offen };
  const pupillePkt = (p, r) => stift.punkt(p, r, pal.tinte, { spur: `${spur}-p`, feld: augenFeld });
  const glanz = (p, r) => {
    const ox = -.36 * r, oy = .4 * r;
    stift.punkt({
      x: p.x + feld.ex.x * ox * feld.fx + feld.ey.x * oy * augenFeld.fy,
      y: p.y + feld.ex.y * ox * feld.fx + feld.ey.y * oy * augenFeld.fy,
    }, r * .3, pal.haut, { deckung: .95, spur: `${spur}-g`, streck: 1.25, dreh: -.7, ohneSaum: true, feld: augenFeld });
  };
  const basis = { w: LID_BREITE, wackel: .004 };
  const kreis = (r, anz = 22) => bogen(P, 0, 0, r, 0, 6.2832, anz);

  if (anim.lider > .72) {   // 眨眼压倒一切：一条弯线
    stift.zug([P(-.66, .06), P(0, -.26), P(.66, .06)], { spur: `${spur}-zu`, ...basis });
    return;
  }
  const S = Math.max(.35, offen);
  switch (kind) {
    case 'punkt':
      pupillePkt(blickPkt(.12, 0), d * .36 * m * S);
      break;
    case 'knopf': {
      const r = d * .5 * m * S, c = blickPkt(.1, 0);
      pupillePkt(c, r); glanz(c, r);
      break;
    }
    case 'ring':
      stift.zug(kreis(.56), { spur, ...basis, w: LID_BREITE * .9, geschlossen: true });
      pupillePkt(blickPkt(.56, .24), d * .24 * m * S);
      break;
    case 'weit': {
      stift.zug(kreis(.74), { spur, ...basis, w: LID_BREITE * .85, geschlossen: true });
      const r = d * .2 * m * S, c = blickPkt(.74, .3);
      pupillePkt(c, r); glanz(c, r);
      break;
    }
    case 'offen': {
      stift.zug(bogen(P, 0, .02, .7, Math.PI * 1.06, Math.PI * 1.94), { spur: `${spur}-o`, ...basis });
      stift.zug(bogen(P, 0, -.02, .66, Math.PI * .1, Math.PI * .9), { spur: `${spur}-u`, w: LID_BREITE * .6, wackel: .004, deckung: .45, einlagig: true });
      const r = d * .34 * m * S, c = blickPkt(.62, .3);
      pupillePkt(c, r); glanz(c, r);
      break;
    }
    case 'mandel':
      stift.zug([P(-.66, .02), P(0, -.46), P(.66, .02)], { spur: `${spur}-o`, ...basis });
      stift.zug([P(-.66, .02), P(0, .32), P(.66, .02)], { spur: `${spur}-u`, w: LID_BREITE * .7, wackel: .004 });
      pupillePkt(blickPkt(.34, .06), d * .22 * m * S);
      break;
    case 'froh':
      stift.zug(bogen(P, 0, .16, .66, Math.PI * 1.1, Math.PI * 1.9), { spur, ...basis, w: LID_BREITE * 1.15 });
      break;
    case 'strich':
      stift.zug([P(-.6, 0), P(0, .06), P(.6, 0)], { spur, ...basis });
      break;
    case 'zwinker':
      if (seite < 0) {
        stift.zug(bogen(P, 0, .16, .6, Math.PI * 1.1, Math.PI * 1.9), { spur, ...basis, w: LID_BREITE * 1.1 });
      } else {
        const r = d * .4 * m * S, c = blickPkt(.1, 0);
        pupillePkt(c, r); glanz(c, r);
      }
      break;
    case 'schlaefrig':
      stift.zug([P(-.66, -.12), P(.05, -.22), P(.66, -.06)], { spur, ...basis });
      stift.zug([P(-.44, -.08), P(0, .28), P(.44, -.04)], { spur: `${spur}-u`, w: LID_BREITE * .65, wackel: .003 });
      pupillePkt(blickPkt(.26, .06), d * .2 * m);
      break;
    case 'kreuz':
      stift.zug([P(-.42, -.42), P(.42, .42)], { spur: `${spur}-a`, ...basis });
      stift.zug([P(-.42, .42), P(.42, -.42)], { spur: `${spur}-b`, ...basis });
      break;
    case 'stern': {
      stift.zug(kreis(.7), { spur, ...basis, w: LID_BREITE * .85, geschlossen: true });
      const c = blickPkt(.7, .36), r = d * .4 * S;
      const dreh = anim.zeit * .5 + seite;
      const zacken = sternForm.zacken, schritt = Math.PI * 2 / zacken, pts = [];
      for (let i = 0; i < zacken; i++) {
        const a1 = dreh + i * schritt + sternForm.versatz[i];
        const r1 = r * sternForm.laengen[i];
        pts.push({ x: c.x + Math.cos(a1) * r1, y: c.y + Math.sin(a1) * r1 });
        const a2 = dreh + (i + .5) * schritt + (sternForm.versatz[i] + sternForm.versatz[(i + 1) % zacken]) / 2;
        pts.push({ x: c.x + Math.cos(a2) * r * sternForm.innen, y: c.y + Math.sin(a2) * r * sternForm.innen });
      }
      stift.flaeche(pts, { farbe: pal.akzent, eckig: true, deckung: .92, spur: `${spur}-stern`, wackel: .004, trocken: true });
      break;
    }
    case 'kritzel': {
      const kr = [[.06, -.08, .6, .3, 4.2], [-.1, .06, .52, 2.4, 6.9], [.08, .1, .66, 1.1, 5.4], [-.04, -.12, .46, 3.6, 8.2]];
      for (let i = 0; i < 4; i++) {
        const [ox, oy, r, a0, a1] = kr[i];
        stift.zug(bogen(P, ox * seite, oy, r, a0, a1, 8), { spur: `${spur}-k${i}`, w: LID_BREITE * .85, wackel: .005 });
      }
      break;
    }
  }
}

// 圆弧采样（在眼的局部坐标里）
function bogen(P, cx, cy, r, a0, a1, anz = 12) {
  const pts = [];
  for (let i = 0; i <= anz; i++) {
    const a = a0 + (a1 - a0) * i / anz;
    pts.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

/* 脸颊弧（wangenbogen）：ring 类大眼睛被脸颊弧线裁掉下半 */
const WANGEN_AUGEN = { ring: { r: .56, sanft: 1 }, weit: { r: .74, sanft: 1 }, offen: { r: .7, sanft: .62 }, stern: { r: .7, sanft: 1 }, knopf: { r: .5, sanft: 1 } };

function drawEyeMitWange(ctx, stift, feld, size, kind, seite, wange, outline, lider, pal, spur, drawEyeFn) {
  const form = WANGEN_AUGEN[kind];
  if (!form || lider > .72) { drawEyeFn(); return; }
  const r = form.r;
  const P = (e, n) => feld.to(e * size, -n * size);
  const bx = size * wange.weit * .1;
  const oben = r, unten = r - r * wange.hoch;
  const a0 = Math.PI * 1.15, a1 = Math.PI * 1.92;
  const streck = 1 / Math.cos(Math.PI * .15);
  const neig = -size * wange.neig;
  const TP = (e, n) => P(bx + e * Math.cos(neig) - n * Math.sin(neig), oben + e * Math.sin(neig) + n * Math.cos(neig));
  const bogenBei = (rad) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = a0 + (a1 - a0) * i / 14;
      pts.push(TP(-size * Math.cos(a) * rad * streck, Math.sin(a) * unten));
    }
    return pts;
  };
  // 找一条完全落在颅骨轮廓内的脸颊弧
  const skaliert = outline.map((p) => ({ x: p.x * .94, y: p.y * .94 }));
  const drin = (p) => punktInPolygon(p, skaliert);
  let rad = r + wange.weit, gefunden = null;
  for (; rad >= r * .85; rad -= .04) {
    const b = bogenBei(rad);
    if (b.every(drin)) { gefunden = b; break; }
  }
  if (!gefunden) { drawEyeFn(); return; }
  // 弧以下裁掉，眼睛像是从脸颊后面探出来
  ctx.save();
  ctx.beginPath();
  const clip = stiftResample(gefunden, false, true)
    .concat([P(bx - size * (rad + 1), 3), P(bx + size * (rad + 1), 3)]);
  ctx.moveTo(clip[0].x, clip[0].y);
  for (const p of clip.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.clip();
  drawEyeFn();
  ctx.restore();
  stift.zug(gefunden, {
    spur, w: LID_BREITE * wange.dicke * form.sanft, wackel: .004, farbe: pal.tinte,
    spitz: .85, deckung: .9 * (.4 + .6 * form.sanft) * (1 - lider / .72), einlagig: form.sanft < 1,
  });
}
function punktInPolygon(p, poly) {
  let innen = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) innen = !innen;
  }
  return innen;
}

/* ================= 眉毛（6 种） ================= */

function drawBrow(stift, feld, size, kind, seite, wach, pal, spur) {
  if (kind === 'keine') return;
  const lift = -size * .38;
  const P = (e, n) => feld.to(e * size, -(n + lift) * size);
  const w = kind === 'dick' ? LID_BREITE * 1.9 : LID_BREITE * 1.05;
  let pts;
  switch (kind) {
    case 'schraeg': pts = [P(-.7 * seite, .26), P(.7 * seite, -.2)]; break;
    case 'sorge': pts = [P(-.7 * seite, -.24), P(.7 * seite, .16)]; break;
    case 'hoch': pts = [P(-.66, .14), P(0, -.4), P(.66, .1)]; break;
    default: pts = [P(-.7, .04), P(0, -.16), P(.7, .02)];
  }
  stift.zug(pts, { spur, w, wackel: .005, farbe: pal.tinte, spitz: kind === 'dick' ? .5 : .75 });
}

/* ================= 鼻子（7 种） ================= */

function drawNose(stift, feld, size, kind, richtung, yaw, pal) {
  const c = richtung, lean = yaw * .5;
  // 鼻尖随转头偏移，越往下偏得越多
  const P = (e, n) => feld.to((e + lean * (n + .6) * .5) * size, -n * size);
  const opt = { spur: 'nase', w: LID_BREITE * .95, wackel: .004, farbe: pal.tinte };
  switch (kind) {
    case 'haken':
      stift.zug([P(c * .06, -.62), P(c * .32, -.02), P(c * .28, .42), P(-c * .22, .46)], opt);
      break;
    case 'komma':
      stift.zug([P(c * .14, -.26), P(c * .3, .26), P(-c * .1, .4)], opt);
      break;
    case 'strich':
      stift.zug([P(c * .06, -.5), P(c * .14, .42)], opt);
      break;
    case 'welle':
      stift.zug([P(-c * .34, .16), P(0, .42), P(c * .34, .12)], opt);
      break;
    case 'knopf':
      stift.zug(bogen(P, c * .06, .16, .26, 0, 6.2832, 16), { ...opt, geschlossen: true, w: LID_BREITE * .85 });
      break;
    case 'lang':
      stift.zug([P(c * .02, -.74), P(c * .24, .1), P(c * .3, .5), P(-c * .14, .58)], opt);
      break;
    case 'punkte':
      stift.punkt(P(-.26, .34), size * .09, pal.tinte, { deckung: .9, spur: 'nasloch-l', feld });
      stift.punkt(P(.26, .34), size * .09, pal.tinte, { deckung: .9, spur: 'nasloch-r', feld });
      stift.zug(bogen(P, 0, .1, .24, Math.PI * 1.2, Math.PI * 1.8), { ...opt, w: LID_BREITE * .7, deckung: .65 });
      break;
  }
}

/* ================= 嘴（11 种 + 张嘴嘟囔） ================= */

function drawMouth(stift, feld, breite, hoehe, kind, pal, mund, wach, herz) {
  const d = 1 + wach * .22;
  const P = (e, n) => feld.to(e * breite, -n * hoehe * d);
  const basis = { spur: 'mund', w: LID_BREITE * 1.05, wackel: .005, farbe: pal.tinte };
  if (mund > .16) {   // 嘟囔时所有嘴型都让位给一个张开的椭圆
    const t = Math.min(1, (mund - .16) / .84);
    const rx = .28 + t * .08, ry = (.16 + t * .5) * (breite / hoehe) * .5;
    const ell = (cx, cy, ex, ey, anz) => {
      const pts = [];
      for (let i = 0; i < anz; i++) {
        const a = i / anz * 6.2832;
        pts.push(P(cx + Math.cos(a) * ex, cy + Math.sin(a) * ey));
      }
      return pts;
    };
    const o = ell(0, .14, rx, ry, 20);
    stift.flaeche(o, { farbe: pal.tinte, spur: 'mund-o', wackel: .004, deckung: .88, trocken: true });
    if (t > .35) stift.flaeche(ell(0, .14 + ry * .6, rx * .55, ry * .35, 14), { farbe: pal.akzent, spur: 'zunge', wackel: .003, deckung: .85, trocken: true });
    stift.zug(o, { ...basis, spur: 'mund-o-rand', geschlossen: true, w: LID_BREITE * .9 });
    return;
  }
  const basis4 = MUND_BASIS[kind];
  if (basis4) {
    stift.zug(basis4.map(([e, n]) => P(e, n)), basis);
    return;
  }
  switch (kind) {
    case 'grinsen':
      stift.zug([P(-.52, -.26), P(0, .46), P(.52, -.22)], basis);
      stift.zug([P(-.3, .3), P(0, .62), P(.3, .32)], { ...basis, spur: 'unterlippe', w: LID_BREITE * .6, deckung: .45, einlagig: true });
      break;
    case 'zaehne': {
      const oben = (e) => -.18 + e * e * .26, unten = (e) => .36 - e * e * 1.1;
      const pts = [];
      for (const e of [-.55, -.28, 0, .28, .55]) pts.push(P(e, oben(e)));
      for (const e of [.36, 0, -.36]) pts.push(P(e, unten(e)));
      stift.flaeche(pts, { farbe: pal.haut, spur: 'zaehne', wackel: .003, deckung: .95, trocken: true });
      stift.zug(pts, { ...basis, spur: 'zaehne-rand', geschlossen: true });
      [-.3, -.1, .1, .3].forEach((e, i) => {
        stift.zug([P(e, oben(e)), P(e, unten(e))], { ...basis, spur: `zahn${i}`, w: LID_BREITE * .65, deckung: .7, einlagig: true });
      });
      break;
    }
    case 'hasenzahn': {
      const linie = (e) => .16 - e * e * 1.8;
      stift.zug([P(-.42, linie(-.42)), P(0, linie(0)), P(.42, linie(.42))], basis);
      [[-.16, -.02], [.02, .16]].forEach(([a, b], i) => {
        const zahn = [P(a, linie(a)), P(b, linie(b)), P(b, linie(b) + .3), P(a, linie(a) + .3)];
        stift.flaeche(zahn, { farbe: pal.haut, spur: `hasenzahn${i}`, wackel: .002, deckung: .95, eckig: true, trocken: true });
        stift.zug(zahn, { ...basis, spur: `hasenzahn-rand${i}`, geschlossen: true, eckig: true, w: LID_BREITE * .7 });
      });
      break;
    }
    case 'schief':
      stift.zug([P(-.5, .06), P(-.14, .2), P(.24, .02), P(.5, -.34)], basis);
      stift.zug([P(.46, -.3), P(.6, -.5)], { ...basis, spur: 'mund-tick', w: LID_BREITE * .7, deckung: .7, einlagig: true });
      break;
    case 'zickzack': {
      const pts = [];
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        pts.push(P(-.5 + t, (i === 0 || i === 5 ? 0 : i % 2 ? -.16 : .16) + .02));
      }
      stift.zug(pts, { ...basis, eckig: true });
      break;
    }
    case 'offen': {
      const pts = [];
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * 6.2832;
        pts.push(P(Math.cos(a) * .3, Math.sin(a) * .55 + .1));
      }
      stift.flaeche(pts, { farbe: pal.tinte, spur: 'mund-o', wackel: .004, deckung: .88, trocken: true });
      stift.zug(pts, { ...basis, spur: 'mund-o-rand', geschlossen: true, w: LID_BREITE * .85 });
      break;
    }
    case 'lippen': {
      const unterlage = MUND_BASIS[herz.unterlage] ?? MUND_BASIS.strich;
      const o = breite * .55;
      const mitte = -unterlage[Math.floor(unterlage.length / 2)][1] * hoehe * d;
      const lippen = lippenForm(herz.kerbe).map(([e, n]) => feld.to(e * o * herz.breite, mitte - n * o * herz.hoehe));
      stift.flaeche(lippen, { farbe: pal.akzent, spur: 'lippen', wackel: .003, deckung: .88 });
      stift.zug(unterlage.map(([e, n]) => P(e, n)), basis);
      break;
    }
  }
}

/* ================= 脸颊（红晕/斑块/雀斑） ================= */

const ROSIG_STRICHE = [[-.5, .8, .1], [-.2, 1.2, -.12], [.1, 1.05, .16], [.4, .75, -.06], [.66, .5, .18]];

function drawCheeks(stift, ctx3d, layout, kind, pal, wach, mass, punktMass) {
  if (kind === 'keine') return;
  const v = Math.min(layout.augeV * .3 + layout.mundV * .7, layout.augeV - .4);
  for (const seite of [-1, 1]) {
    const u = seite * Math.min(.9, layout.augeU + .22);
    const feld = feldAn(u, v, ctx3d);
    if (feld.nz < .1) continue;
    if (kind === 'rosig') {
      ROSIG_STRICHE.forEach(([x, y, z], i) => {
        const hoch = y * mass, halb = x * mass / 2;
        stift.zug([feld.to(-halb + z * mass, -hoch + mass * .04), feld.to(halb + z * mass, -hoch - mass * .04)], {
          spur: `backe${seite}${i}`, w: LID_BREITE * .9, wackel: .006, farbe: pal.akzent,
          deckung: .7 + wach * .3, spitz: 1, einlagig: true,
        });
      });
    } else if (kind === 'punkte') {
      const r = mass * .4 * punktMass, neig = seite * .35, pts = [];
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * 6.2832;
        const ex = Math.cos(a) * r, ey = Math.sin(a) * r * .88;
        pts.push(feld.to(ex * Math.cos(neig) - ey * Math.sin(neig), ex * Math.sin(neig) + ey * Math.cos(neig)));
      }
      stift.flaeche(pts, { farbe: pal.akzent, spur: `punkt${seite}`, wackel: .005, deckung: .55 + wach * .3 });
    } else if (kind === 'sommersprossen') {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399, r = Math.sqrt((i + .6) / 7);
        stift.punkt(feld.to(Math.cos(a) * r * mass * .62, Math.sin(a) * r * mass * .5), mass * .065, pal.tinte, {
          deckung: .42, spur: `sprosse${seite}${i}`, feld,
        });
      }
    }
  }
}

/* ================= 面部痕迹（眼袋/阴影线/抬头纹） ================= */

function drawZeichen(stift, ctx3d, layout, kind, seite, augenMass, pal) {
  if (kind === 'keine' || kind === 'wangenbogen') return;
  const opt = { w: LID_BREITE * .55, wackel: .003, farbe: pal.tinte, deckung: .4, einlagig: true, ruhig: true };
  if (kind === 'augenringe') {
    for (const s of [-1, 1]) {
      const feld = feldAn(s * layout.augeU, layout.augeV - .02, ctx3d);
      if (feld.nz < .1) continue;
      const P = (e, n) => feld.to(e * augenMass, -n * augenMass);
      for (let i = 0; i < 2; i++) {
        stift.zug(bogen(P, 0, .62 + i * .28, .55 - i * .13, Math.PI * .15, Math.PI * .85, 8), { ...opt, spur: `ring${s}${i}` });
      }
    }
    return;
  }
  if (kind === 'schraffur') {
    for (let i = 0; i < 6; i++) {
      const a = feldAn(seite * (.86 + i * .05), layout.augeV + .34, ctx3d);
      const b = feldAn(seite * (1.02 + i * .05), layout.augeV + .06, ctx3d);
      if (a.nz < .05 || b.nz < .05) continue;
      stift.zug([{ x: a.x, y: a.y }, { x: b.x, y: b.y }], { ...opt, spur: `schraff${i}`, deckung: .36 });
    }
    return;
  }
  // stirnfalten
  const basis = layout.braueV + .22;
  for (let i = 0; i < 2; i++) {
    const v = basis + i * .14, pts = [];
    for (let k = 0; k <= 6; k++) {
      const u = -.42 + k / 6 * .84;
      const feld = feldAn(u, v + Math.sin(k * 1.9 + i) * .02, ctx3d);
      pts.push({ x: feld.x, y: feld.y });
    }
    stift.zug(pts, { ...opt, spur: `falte${i}` });
  }
}

/* ================= 胡子（4 种） ================= */

const NASEN_LEN = { haken: .46, komma: .4, strich: .42, welle: .42, knopf: .42, lang: .58, punkte: .43 };

function drawBeard(stift, ctx3d, layout, kind, pal, mundBreit, naseInfo, mundHoch, lage) {
  if (kind === 'keiner') return;
  const oben = layout.zonen.nase.v - (NASEN_LEN[naseInfo.typ] ?? .42) * naseInfo.gross - .03;
  const unten = layout.zonen.mund.v + .18 * mundHoch;
  const mass = Math.min(mundBreit * .4, Math.max(.05, (oben - unten) / .7));
  const mitte = unten + .28 * mass;
  const deckOben = Math.max(mitte, oben - .42 * mass);
  const feld = feldAn(0, mitte + (deckOben - mitte) * lage, ctx3d);
  const P = (e, n) => feld.to(e * mass, -n * mass);
  if (kind === 'schnauz') {
    for (const s of [-1, 1]) {
      const pts = [[.05, -.24], [.42, -.42], [.85, -.36], [1.3, -.1], [1.78, .28], [1.55, .24], [1.15, .1], [.7, .02], [.3, .06], [.05, .14]]
        .map(([e, n]) => P(s * e, n));
      stift.flaeche(pts, { farbe: pal.haar, spur: `schnauz${s}`, wackel: .004 });
      stift.zug(pts, { spur: `schnauz-rand${s}`, w: LID_BREITE * .7, wackel: .004, farbe: pal.tinte, geschlossen: true, deckung: .7 });
    }
    return;
  }
  if (kind === 'stoppelschnauz') {
    for (let i = 0; i < 9; i++) {
      const t = i / 8 * 2 - 1;
      const x = t * 1.45, y = -.02 - (1 - t * t) * .24;
      const len = .34 + .14 * ((i * 7) % 3) / 2, schub = t * .2;
      stift.zug([P(x, y), P(x + schub, y + len)], {
        spur: `stoppelschnauz${i}`, w: LID_BREITE * .85, wackel: .005, farbe: pal.tinte, deckung: .72, spitz: 1, einlagig: true,
      });
    }
    return;
  }
  // stoppeln：黄金角撒点
  for (let i = 0; i < 30; i++) {
    const a = (i * 2.399) % 6.2832, r = Math.sqrt((i + .5) / 30);
    const u = Math.cos(a) * r * .7;
    const v = layout.mundV - .14 - Math.abs(Math.sin(a)) * r * .36;
    const f = feldAn(u, v, ctx3d);
    if (f.nz < .14) continue;
    stift.punkt({ x: f.x, y: f.y }, mundBreit * .035, pal.tinte, { deckung: .4, spur: `stoppel${i}`, feld: f });
  }
}

/* ================= 眼镜 ================= */

function drawGlasses(stift, ctx3d, feldL, feldR, augenMass, kind, pal, kopf, layout) {
  // 镜圈中心取颅骨上的原始 3D 点（先旋转投影会双重变换），并整体抬离壳面一点
  const roh = (u, v) => {
    const p = schaedelPunkt(u, v, kopf);
    return { x: p.x, y: p.y, z: p.z + kopf.rz * .08 };
  };
  const proj = (p) => punkt3d(p.x, p.y, p.z, ctx3d);
  // 与眼睛相同的"收到朝前壳面"修正，保证转头时镜圈贴着眼睛
  const augenU = (s) => {
    let u = s * layout.augeU;
    for (let i = 0; i < 14 && feldAn(u, layout.augeV, ctx3d).nz < .42; i++) u *= .9;
    return u;
  };
  const a = roh(augenU(-1), layout.augeV + ctx3d.dna.asym);
  const b = roh(augenU(1), layout.augeV - ctx3d.dna.asym);
  const dist = (b.x - a.x) / 2;
  const r = Math.min(augenMass * 1.45, dist * .86, kopf.rx * .36);
  const glas = (zentrum, idx) => {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const w = i / 24 * 6.2832;
      let ex = Math.cos(w), ey = Math.sin(w);
      if (kind === 'eckig') {
        ex = Math.sign(ex) * Math.abs(ex) ** .42;
        ey = Math.sign(ey) * Math.abs(ey) ** .42 * .82;
      }
      pts.push(proj({ x: zentrum.x + ex * r, y: zentrum.y + ey * r, z: zentrum.z }));
    }
    stift.zug(pts, { spur: `glas${idx}`, w: LID_BREITE * .85, wackel: .003, geschlossen: true, farbe: pal.tinte });
  };
  glas(a, 0); glas(b, 1);
  const steg = [
    proj({ x: a.x + r * .96, y: a.y + r * .08, z: a.z }),
    proj({ x: (a.x + b.x) / 2, y: a.y + r * .34, z: a.z }),
    proj({ x: b.x - r * .96, y: b.y + r * .08, z: b.z }),
  ];
  stift.zug(steg, { spur: 'steg', w: LID_BREITE * .75, wackel: .003, farbe: pal.tinte });
  [-1, 1].forEach((s, i) => {
    if (feldAn(s * 1.48, layout.ohrV, ctx3d).nz < -.05) return;
    const c = s < 0 ? a : b;
    // 短镜腿：从镜圈外缘到耳上一点（同为壳面 3D 点，只投影一次）
    stift.zug([
      proj({ x: c.x + s * r * .98, y: c.y + r * .02, z: c.z }),
      proj(schaedelPunkt(s * 1.42, layout.ohrV + .08, kopf)),
    ], { spur: `buegel${i}`, w: LID_BREITE * .65, wackel: .003, farbe: pal.tinte, deckung: .85, einlagig: true });
  });
}

/* ================= 小装饰（耳环/创可贴） ================= */

function drawZierrat(stift, ctx3d, dna, kind, ohrFelder, seite, pal) {
  if (kind === 'ohrring') {
    ohrFelder.forEach((feld, i) => {
      if (feld.nz < -.1) return;
      const basis = feld.to(0, -.11, .02), r = .04, pts = [];
      for (let k = 0; k < 14; k++) {
        const a = k / 14 * 6.2832;
        pts.push({ x: basis.x + Math.cos(a) * r, y: basis.y + r * 1.1 + Math.sin(a) * r });
      }
      stift.zug(pts, { spur: `ohrring${i}`, w: LID_BREITE * .7 * .88, wackel: .003, farbe: pal.akzent, geschlossen: true, deckung: .95 });
      stift.punkt(basis, .012, pal.tinte, { deckung: .7, spur: `zierfuss${i}` });
    });
    return;
  }
  if (kind === 'pflaster') {
    const layout = dna.layout;
    const feld = feldAn(seite * Math.min(.88, layout.augeU + .3), layout.augeV * .2 + layout.mundV * .8, ctx3d);
    if (feld.nz < .15) return;
    const platte = (dreh, idx) => {
      const cos = Math.cos(dreh), sin = Math.sin(dreh);
      const pts = [[-.14, -.14 * .28], [.14, .14 * .28 * -1], [.14, .14 * .28], [-.14, .14 * .28]].map(([e, n], k) => {
        const roh = [[-.14, -.0392], [.14, -.0392], [.14, .0392], [-.14, .0392]][k];
        const x = roh[0] * cos - roh[1] * sin, y = -(roh[0] * sin + roh[1] * cos);
        return feld.to(x, y);
      });
      stift.flaeche(pts, { farbe: pal.pflaster, spur: `pflaster${idx}`, wackel: .003, eckig: true, trocken: true });
      stift.zug(pts, { spur: `pflaster-rand${idx}`, w: LID_BREITE * .6, wackel: .003, farbe: pal.tinte, geschlossen: true, deckung: .6, eckig: true });
    };
    platte(.7, 0); platte(-.75, 1);
  }
}

/* ================= 发际线与发壳 =================
 * 发际线 unten(u)：基底是 ansatzV 附近的余弦弧，可带锯齿（zacken）、
 * 波浪（welle）、侧倾（neigung）与颞部下垂；向下被眉眼区钳住。
 */

function machAnsatzklemme(dna) {
  const r = strom(dna.seed, 'ansatzklemme').n();
  const n = dna.layout.braueV + .15;
  const basis = n - (n - (dna.layout.augeV - dna.layout.zonen.augeL.halbV)) * r;
  return (u) => {
    const t = clamp((Math.abs(u) - .8) / .32, 0, 1);
    return basis - .62 * t * t * (3 - 2 * t);
  };
}

function machHaaransatz(dna, opt = {}) {
  const klemme = machAnsatzklemme(dna);
  const tiefe = opt.tiefe ?? 0;
  const braueV = dna.layout.braueV;
  const fallStufe = [0, .5, 1][strom(dna.seed, 'schlaefenfall').int(0, 2)];
  const schlafe = (u) => {
    if (fallStufe === 0) return 0;
    const t = clamp((Math.abs(u) - .72) / .44, 0, 1);
    return fallStufe * .5 * t * t * (3 - 2 * t);
  };
  const neigung = opt.neigung ?? 0;
  const bogen = (u) => Math.max(
    braueV + .28 - schlafe(u),
    dna.ansatzV + tiefe + Math.cos(u) * -.1 + Math.sin(u * 2) * .025 + neigung * u - schlafe(u)
  );
  if (opt.welle) {
    return (u) => Math.max(klemme(u), bogen(u) - .05 - .05 * Math.sin(u * 5.2 + dna.seed));
  }
  if (!opt.zacken) return (u) => Math.max(klemme(u), bogen(u));
  // 锯齿发际线：2~6 个三角齿，随机一个齿特别长
  const z = strom(dna.seed, 'zacken');
  const zaehne = 2 + Math.floor(z.n() * 5);
  const spitze = Math.max(0, bogen(0) - klemme(0));
  const schnitt = strom(dna.seed, 'ansatzschnitt').n() < .4 ? 1.8 : 1;
  const hoehen = [], breiten = [], spitzen = [];
  let summe = 0;
  for (let i = 0; i < zaehne; i++) {
    hoehen.push((.1 + Math.pow(z.n(), 1.6) * .8) * schnitt);
    const w = .5 + z.n();
    breiten.push(w); summe += w;
    spitzen.push(.25 + z.n() * .5);
  }
  const star = Math.floor(z.n() * zaehne);
  hoehen[star] = Math.max(hoehen[star], (.45 + z.n() * .55) * schnitt);
  if (zaehne >= 3) {
    if (star === 0 || star === zaehne - 1) {
      const ander = 1 + Math.floor(z.n() * (zaehne - 2));
      hoehen[ander] = Math.max(hoehen[ander], hoehen[star]);
    }
    const deckel = spitze > 0 ? Math.min(.5, .24 / spitze) : 0;
    hoehen[0] = Math.min(hoehen[0], deckel);
    hoehen[zaehne - 1] = Math.min(hoehen[zaehne - 1], deckel);
  } else {
    const deckel = spitze > 0 ? Math.min(.5, .22 / spitze) : 0;
    for (let i = 0; i < zaehne; i++) hoehen[i] = Math.min(hoehen[i], deckel);
  }
  const grenzen = [-1.4];
  for (let i = 0; i < zaehne; i++) grenzen.push(grenzen[i] + 2.8 * breiten[i] / summe);
  return (u) => {
    let i = 0;
    while (i < zaehne - 1 && u > grenzen[i + 1]) i++;
    const t = clamp((u - grenzen[i]) / (grenzen[i + 1] - grenzen[i]), 0, 1);
    const sp = spitzen[i];
    const dreieck = t < sp ? t / sp : (1 - t) / (1 - sp);
    return Math.max(klemme(u), bogen(u) - hoehen[i] * spitze * dreieck);
  };
}

// 发壳：颅骨壳沿法向加厚，从发际线到头顶
function haarSchale(dna, dicke, opt = {}) {
  const unten = machHaaransatz(dna, opt);
  return {
    unten, dicke,
    wolke: wolkeErstellen(dna.kopf, 144, 16, unten, () => Math.PI / 2, (u, v) => {
      const t = clamp((v - unten(u)) / .4, 0, 1);
      return dicke * (.28 + .72 * t * t * (3 - 2 * t));
    }),
  };
}

// 发际线可见的 u 范围（法向朝前的部分）
function ansatzSichtbereich(dna, unten, m) {
  const nz = (u) => rotPunkt(m, schaedelNormale(u, unten(u), dna.kopf)).z;
  let best = 0, bestV = -1e9;
  for (let i = 0; i < 96; i++) {
    const u = -Math.PI + i / 96 * Math.PI * 2;
    const v = nz(u);
    if (v > bestV) { bestV = v; best = u; }
  }
  const schritt = Math.PI * 2 / 96;
  const laufe = (dir) => {
    let u = best;
    for (let i = 0; i < 96; i++) {
      const n = u + dir * schritt;
      if (nz(n) <= 0) {
        let a = u, b = n;
        for (let k = 0; k < 14; k++) {
          const mid = (a + b) / 2;
          if (nz(mid) > 0) a = mid; else b = mid;
        }
        return b;
      }
      u = n;
    }
    return u;
  };
  return [laufe(-1), laufe(1)];
}

// 发壳外形：头顶弧剪影 + 发际线弧 → 填充多边形
function haarForm(dna, schale, ctx3d, schaedelUmriss) {
  const aussen = silhouettesAusWolke(schale.wolke, ctx3d.m, { bins: 84, bogenUm: -Math.PI / 2, hinter: schaedelUmriss });
  if (aussen.length < 4) return null;
  const [u0, u1] = ansatzSichtbereich(dna, schale.unten, ctx3d.m);
  const ansatz = [];
  for (let i = 0; i <= 64; i++) {
    const u = u0 + (u1 - u0) * i / 64;
    ansatz.push(punkt3d(...Object.values(schaedelPunkt(u, schale.unten(u), dna.kopf)), ctx3d));
  }
  // ansatz 从左到右；多边形 = 外弧（左→右过顶）+ 发际线（右→左）
  const polygon = aussen.concat([...ansatz].reverse());
  return { aussen, ansatz, polygon };
}

function zeichneHaarSchale(stift, form, pal, spur = 'haar') {
  stift.flaeche(form.polygon, { farbe: pal.haar, spur, wackel: .006 });
  stift.zug(form.aussen, { spur: `${spur}-rand`, w: .024, wackel: .005, farbe: pal.tinte, deckung: .75 });
  stift.zug(form.ansatz, { spur: `${spur}-ansatz`, w: .02, wackel: .004, farbe: pal.tinte, deckung: .7, eckig: true });
}

// 发丝：沿壳面从发际线往头顶走的几条细线
function zeichneStraehnen(stift, dna, schale, ctx3d, pal, us, seed) {
  const r = strom(seed, 'straehnen');
  const sichtbar = (u) => feldAn(u, schale.unten(u) + (1.3 - schale.unten(u)) * .5, ctx3d).nz > .12;
  const strich = (u, von, bis) => {
    const a = schale.unten(u), cosA = Math.max(.25, Math.cos(a)), pts = [];
    for (let i = 0; i <= 5; i++) {
      const t = von + (bis - von) * i / 5;
      const v = a + (1.3 - a) * t;
      pts.push(haarOberflaeche(dna, ctx3d, u + t * .3 * (Math.cos(v) / cosA), v, schale.dicke * .7));
    }
    return pts;
  };
  us.forEach((u, i) => {
    if (!sichtbar(u)) return;
    const hell = r.chance(.4);
    stift.zug(strich(u, 0, 1), {
      spur: `straehne${i}`, w: .018, wackel: .002, farbe: hell ? pal.haut : pal.tinte,
      deckung: hell ? .5 : .28, einlagig: true, ruhig: true,
    });
    if (r.n() > .72) return;
    const du = (r.chance(.5) ? -1 : 1) * r.range(.035, .085);
    if (sichtbar(u + du)) {
      stift.zug(strich(u + du, r.range(.06, .3), r.range(.72, .95)), {
        spur: `straehne-d${i}`, w: .022, wackel: .002, farbe: pal.tinte, deckung: .68, spitz: .85, ruhig: true,
      });
    }
  });
}
// 壳面上 (u,v) 处、沿法向抬高 d 的点
function haarOberflaeche(dna, ctx3d, u, v, d) {
  const p = schaedelPunkt(u, v, dna.kopf);
  if (d) {
    const n = schaedelNormale(u, v, dna.kopf);
    p.x += n.x * d; p.y += n.y * d; p.z += n.z * d;
  }
  return punkt3d(p.x, p.y, p.z, ctx3d);
}

/* 螺旋小卷（lockenwolke / afro 的内部纹理） */
function spirale(zentrum, r, dreh, a0, bogenL) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const a = a0 + dreh * bogenL * t;
    const rr = r * (.45 + .55 * t);
    pts.push({ x: zentrum.x + Math.cos(a) * rr, y: zentrum.y + Math.sin(a) * rr * .85 });
  }
  return pts;
}

/* ================= 头发（13 种 + 后发） ================= */

function afroForm(dna, r) {
  // 6 种爆炸头轮廓参数
  const sorte = r.weighted([['kugel', .26], ['turm', .16], ['wolke', .18], ['kurz', .12], ['dreieck', .14], ['pilz', .14]]);
  switch (sorte) {
    case 'kugel': return { sorte, weite: r.range(1.6, 2), hoch: r.range(.98, 1.08), unrund: r.range(.28, .6), keil: 0, hoeher: r.range(0, .08), tief: r.range(-.86, -.62) };
    case 'turm': return { sorte, weite: r.range(1.15, 1.38), hoch: r.range(1, 1.08), unrund: r.range(.3, .8), keil: 0, hoeher: r.range(.2, .32), tief: r.range(-.55, -.4) };
    case 'wolke': return { sorte, weite: r.range(1.4, 1.62), hoch: r.range(.86, .96), unrund: r.range(.9, 1.35), keil: 0, hoeher: r.range(-.04, .1), tief: r.range(-.46, -.32) };
    case 'dreieck': return { sorte, weite: r.range(1.6, 2), hoch: r.range(1, 1.14), unrund: r.range(.3, .75), keil: r.range(.46, .74), hoeher: r.range(0, .08), tief: r.range(-.9, -.7) };
    case 'pilz': return { sorte, weite: r.range(1.6, 2), hoch: r.range(.94, 1.06), unrund: r.range(.3, .8), keil: r.range(-.7, -.44), hoeher: r.range(.06, .18), tief: r.range(-.72, -.52) };
    default: return { sorte, weite: r.range(1.2, 1.4), hoch: r.range(.9, 1.02), unrund: r.range(.6, 1.1), keil: 0, hoeher: r.range(0, .12), tief: r.range(-.3, -.18) };
  }
}

// 爆炸头壳：以头顶上方的椭球为目标做射线求交，厚度朝发际线渐隐
function afroSchale(dna, form) {
  const unten0 = machHaaransatz(dna, {});
  const k = dna.kopf;
  const basis = Math.min(1.24, Math.max(k.rx, k.rz, k.ry * .86) * form.weite);
  const m = basis * form.hoch, h = basis * form.hoeher;
  const keilFn = (() => {
    if (form.keil === 0) return () => 1;
    const n = Math.max(.5, m);
    return (y) => {
      const i = y / n;
      return form.keil > 0 ? 1 - form.keil * clamp((i - .35) / .6, 0, 1) : 1 + form.keil * clamp((.72 - i) / .95, 0, 1);
    };
  })();
  const ph1 = strom(dna.seed, 'afroBeulen');
  const p1 = ph1.range(0, 6.2832), p2 = ph1.range(0, 6.2832), p3 = ph1.range(0, 6.2832);
  // 侧面比头顶低：从发际线过渡到 tief
  const massen = (u) => {
    const t = smooth((Math.abs(u) - .85) / .5);
    return Math.min(unten0(u), unten0(u) * (1 - t) + form.tief * t);
  };
  const dickeVon = (u, v) => {
    const p = schaedelPunkt(u, v, k), nrm = schaedelNormale(u, v, k);
    const unrund = 1 + form.unrund * (.06 * Math.sin(u * 1.7 + p1) + .045 * Math.sin(v * 2.4 + p2) + .03 * Math.sin(u * 3.1 + v * 2.2 + p3));
    const vert = m * unrund, dy = p.y - h;
    let f = 0;
    for (let it = 0; it < 3; it++) {
      const horiz = basis * unrund * keilFn(p.y + nrm.y * f);
      const a = (nrm.x ** 2 + nrm.z ** 2) / (horiz * horiz) + nrm.y ** 2 / (vert * vert);
      const b = 2 * ((p.x * nrm.x + p.z * nrm.z) / (horiz * horiz) + dy * nrm.y / (vert * vert));
      const c = (p.x ** 2 + p.z ** 2) / (horiz * horiz) + dy * dy / (vert * vert) - 1;
      const disk = b * b - 4 * a * c;
      f = disk > 0 ? (-b + Math.sqrt(disk)) / (2 * a) : 0;
      if (form.keil === 0) break;
    }
    return Math.max(.05, f) * (.55 + .45 * smooth((v - massen(u)) / .3));
  };
  return {
    unten: massen, dickeVon,
    wolke: wolkeErstellen(k, 64, 16, massen, () => Math.PI / 2, dickeVon),
  };
}

// 轮廓粗糙化：三档正弦扰动，像手绘的蓬松边
function rauen(pts, seed, label) {
  const r = strom(seed, label);
  const p1 = r.range(0, 6.2832), p2 = r.range(0, 6.2832), p3 = r.range(0, 6.2832);
  return pts.map((p) => {
    const a = Math.atan2(p.y, p.x);
    const f = 1 + .028 * Math.sin(a * 9 + p1) + .02 * Math.sin(a * 17 + p2) + .013 * Math.sin(a * 29 + p3);
    return { x: p.x * f, y: p.y * f };
  });
}
// 把轮廓点推到颅骨剪影之外（两侧不能被脸吃掉）
function aufSklaeleben(aussen, schaedelUmriss) {
  const n = schaedelUmriss.length;
  if (n < 8) return aussen;
  const schaedelR = (p) => {
    let b = Math.floor((Math.atan2(p.y, p.x) + Math.PI) / 6.283185307 * n);
    b = clamp(b, 0, n - 1);
    return Math.hypot(schaedelUmriss[b].x, schaedelUmriss[b].y);
  };
  return aussen.map((p) => {
    const r = Math.hypot(p.x, p.y), min = schaedelR(p);
    if (r >= min) return p;
    const f = min / (r || 1);
    return { x: p.x * f, y: p.y * f };
  });
}

function drawHairBack(stift, dna, ctx3d, haarInfo, schaedelUmriss, pal) {
  const kind = dna.merkmale.haar;
  if (kind === 'afro' && haarInfo.afro) {
    // 光整的后球，垫在头后面
    const aussen = silhouettesAusWolke(haarInfo.afro.wolke, ctx3d.m, { bins: 84, bogenUm: -Math.PI / 2, hinter: schaedelUmriss });
    if (aussen.length >= 6) {
      stift.flaeche(aussen, { farbe: pal.haar, spur: 'afro-kugel', wackel: .006 });
    }
    return;
  }
  if (kind !== 'zoepfe') return;
  // 两条垂辫：头局部坐标里的一串参数曲线，直接投影
  const { rx, ry, rz } = dna.kopf;
  const q = (t) => clamp(t, 0, 1) ** 2 * (3 - 2 * clamp(t, 0, 1));
  for (const seite of [-1, 1]) {
    const z = -rz * .1;
    const lauf = (t) => ({ x: seite * rx * (.62 + .55 * q(t / .42)), y: ry * (.82 - 1.72 * t) });
    const ende = .84;
    const halb = (t) => rx * (.1 + .03 * Math.sin(Math.PI * Math.min(1, t / ende)) + .022 * Math.abs(Math.sin(Math.PI * 7 * (t / ende))));
    const links = [], rechts = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36 * ende, c = lauf(t), w = halb(t);
      links.push(punkt3d(c.x - w, c.y, z, ctx3d));
      rechts.push(punkt3d(c.x + w, c.y, z, ctx3d));
    }
    const flaeche = links.concat([...rechts].reverse());
    stift.flaeche(flaeche, { farbe: pal.haar, spur: `zopf${seite}`, wackel: .005 });
    stift.zug(links, { spur: `zopf-l${seite}`, w: .024, wackel: .005, farbe: pal.tinte, deckung: .8 });
    stift.zug(rechts, { spur: `zopf-r${seite}`, w: .024, wackel: .005, farbe: pal.tinte, deckung: .8 });
    // 编织纹：左右交替的斜线
    for (let i = 0; i < 7; i++) {
      const t0 = (i + .15) / 7 * ende, t1 = (i + .85) / 7 * ende;
      const c0 = lauf(t0), c1 = lauf(t1), w = halb(t0) * .8;
      const ziel = punkt3d(c1.x, c1.y, z, ctx3d);
      stift.zug([punkt3d(c0.x - w, c0.y, z, ctx3d), ziel], { spur: `flecht${seite}${i}l`, w: .016, wackel: .003, farbe: pal.tinte, deckung: .55, einlagig: true, spitz: .3 });
      stift.zug([punkt3d(c0.x + w, c0.y, z, ctx3d), ziel], { spur: `flecht${seite}${i}r`, w: .016, wackel: .003, farbe: pal.tinte, deckung: .55, einlagig: true, spitz: .3 });
    }
    // 辫梢流苏
    const quaste = [];
    for (let i = 0; i <= 8; i++) {
      const t = ende + i / 8 * .16, s = (t - ende) / .16, c = lauf(t);
      quaste.push(punkt3d(c.x - rx * (.07 + .09 * Math.sin(Math.PI * s * .75)) * (1 - s * s), c.y, z, ctx3d));
    }
    for (let i = 8; i >= 0; i--) {
      const t = ende + i / 8 * .16, s = (t - ende) / .16, c = lauf(t);
      quaste.push(punkt3d(c.x + rx * (.07 + .09 * Math.sin(Math.PI * s * .75)) * (1 - s * s), c.y, z, ctx3d));
    }
    stift.flaeche(quaste, { farbe: pal.haar, spur: `quaste${seite}`, wackel: .005 });
    stift.zug(quaste, { spur: `quaste-rand${seite}`, w: .02, wackel: .005, farbe: pal.tinte, geschlossen: true, deckung: .75 });
    const q0 = lauf(ende), q1 = lauf(1);
    for (const dx of [-.05, 0, .05]) {
      stift.zug([punkt3d(q0.x + dx * rx * .6, q0.y, z, ctx3d), punkt3d(q1.x + dx * rx * 1.6, q1.y + ry * .03, z, ctx3d)], {
        spur: `quaste-s${seite}${dx}`, w: .012, wackel: .003, farbe: pal.tinte, deckung: .45, einlagig: true,
      });
    }
    // 彩色皮筋
    const b0 = lauf(ende);
    stift.zug([punkt3d(b0.x - rx * .13, b0.y + ry * .01, z, ctx3d), punkt3d(b0.x + rx * .13, b0.y - ry * .01, z, ctx3d)], {
      spur: `zopfband${seite}`, w: .04, wackel: .003, farbe: pal.akzent, spitz: .15, einlagig: true,
    });
  }
}

function drawHair(stift, dna, ctx3d, haarInfo, schaedelUmriss, pal) {
  const kind = dna.merkmale.haar;
  const seed = dna.seed;
  switch (kind) {
    case 'keine': break;
    case 'flaum':
      for (let i = 0; i < 5; i++) {
        const u = -.7 + i * .35, v = 1.15 + (i % 2) * .12;
        stift.zug([haarOberflaeche(dna, ctx3d, u, v, .005), haarOberflaeche(dna, ctx3d, u + .1, v, .12 + (i % 3) * .03)], {
          spur: `flaum${i}`, w: .013, wackel: .006, farbe: pal.haar, spitz: 1,
        });
      }
      break;
    case 'locken':
      for (let i = 0; i < 9; i++) {
        const reihe = i % 2;
        const u = -.95 + Math.floor(i / 2) * .46 + reihe * .22;
        const v = Math.max(machAnsatzklemme(dna)(u) + .42, 1.02 - reihe * .2);
        const zentrum = haarOberflaeche(dna, ctx3d, u, v, .055);
        const r = .05 - reihe * .008, pts = [];
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * 6.2832;
          pts.push({ x: zentrum.x + Math.cos(a) * r, y: zentrum.y + Math.sin(a) * r * .88 });
        }
        stift.zug(pts, { spur: `locke${i}`, w: .014, wackel: .004, farbe: pal.haar, geschlossen: true });
      }
      break;
    case 'stacheln':
      for (let i = 0; i < 9; i++) {
        const u = -1.25 + i / 8 * 2.5;
        const v = machAnsatzklemme(dna)(u) + .22;
        stift.zug([haarOberflaeche(dna, ctx3d, u, v, 0), haarOberflaeche(dna, ctx3d, u + .06, v + .12, .13)], {
          spur: `stachel${i}`, w: .016, wackel: .003, farbe: pal.haar, spitz: 1,
        });
      }
      break;
    case 'antenne': {
      // 头顶短苗：长度钳在颅骨半高的 0.15 倍以内
      const len = Math.min(.42, .15 * dna.kopf.ry);
      const a = haarOberflaeche(dna, ctx3d, .06, 1.32, 0);
      const b = haarOberflaeche(dna, ctx3d, .06, 1.5, len);
      stift.zug([a, { x: (a.x + b.x) / 2 - .03, y: (a.y + b.y) / 2 }, b], { spur: 'antenne', w: .013, wackel: .005, farbe: pal.haar, spitz: .4 });
      stift.punkt(b, Math.min(.036, len * .3), pal.haar, { spur: 'antennenknopf' });
      break;
    }
    case 'igel': {
      if (!haarInfo.schale) break;
      const form = haarForm(dna, haarInfo.schale, ctx3d, schaedelUmriss);
      if (!form) break;
      zeichneHaarSchale(stift, form, pal);
      // 沿轮廓法向的短刺
      const winkel = [];
      for (let i = 0; i < 28; i++) winkel.push(-Math.PI + (i + .5) / 28 * Math.PI * 2);
      const nrm = pathNormals(form.aussen);
      form.aussen.forEach((p, i) => {
        const a = Math.atan2(p.y, p.x);
        let naechste = 1e9;
        for (const w of winkel) naechste = Math.min(naechste, Math.abs(Math.atan2(Math.sin(a - w), Math.cos(a - w))));
        if (naechste > .12) return;
        const len = .08 + (i * 7) % 5 * .018;
        stift.zug([p, { x: p.x + nrm[i].x * len, y: p.y + nrm[i].y * len }], {
          spur: `stachel${i}`, w: .02, wackel: .003, farbe: pal.haar, spitz: 1, einlagig: true,
        });
      });
      break;
    }
    case 'haube': case 'pony': case 'zoepfe': case 'dutt': {
      if (!haarInfo.schale) break;
      const form = haarForm(dna, haarInfo.schale, ctx3d, schaedelUmriss);
      if (!form) break;
      zeichneHaarSchale(stift, form, pal);
      zeichneStraehnen(stift, dna, haarInfo.schale, ctx3d, pal, [-.5, .25], seed);
      if (kind === 'dutt') {
        const { r, flach } = haarInfo.dutt;
        const zentrum = haarOberflaeche(dna, ctx3d, 0, 1.42, haarInfo.schale.dicke + r * .85);
        const pts = [];
        for (let i = 0; i < 18; i++) {
          const a = i / 18 * 6.2832;
          pts.push({ x: zentrum.x + Math.cos(a) * r, y: zentrum.y + Math.sin(a) * r * flach });
        }
        stift.flaeche(pts, { farbe: pal.haar, spur: 'dutt', wackel: .005 });
        stift.zug(pts, { spur: 'dutt-rand', w: .022, wackel: .005, farbe: pal.tinte, geschlossen: true, deckung: .75 });
        const kringel = [];
        for (let i = 0; i <= 14; i++) {
          const t = i / 14, a = t * 6.2832 * 1.6;
          kringel.push({ x: zentrum.x + Math.cos(a) * r * .6 * t, y: zentrum.y + Math.sin(a) * r * .55 * t });
        }
        stift.zug(kringel, { spur: 'dutt-kringel', w: .012, wackel: .003, farbe: pal.haut, deckung: .3, einlagig: true });
      }
      break;
    }
    case 'seitenscheitel': {
      if (!haarInfo.schale) break;
      const form = haarForm(dna, haarInfo.schale, ctx3d, schaedelUmriss);
      if (!form) break;
      zeichneHaarSchale(stift, form, pal);
      const seite = seed % 2 === 0 ? 1 : -1;
      const u0 = seite * .42;
      const v0 = haarInfo.schale.unten(u0);
      const cosV = Math.max(.25, Math.cos(v0));
      const scheitel = (startU, von, bis) => {
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const t = von + (bis - von) * i / 6;
          const v = v0 + (1.32 - v0) * t;
          pts.push(haarOberflaeche(dna, ctx3d, startU + t * .08 * seite * (Math.cos(v) / cosV), v, haarInfo.schale.dicke * .75));
        }
        return pts;
      };
      stift.zug(scheitel(u0, 0, 1), { spur: 'scheitel', w: .024, wackel: .002, farbe: pal.haut, deckung: .52, einlagig: true, ruhig: true });
      stift.zug(scheitel(u0 + seite * .055, .12, .88), { spur: 'scheitel-d', w: .022, wackel: .002, farbe: pal.tinte, deckung: .68, spitz: .85, ruhig: true });
      zeichneStraehnen(stift, dna, haarInfo.schale, ctx3d, pal, [u0 - seite * .5, u0 - seite * .95], seed);
      break;
    }
    case 'lockenwolke': {
      if (!haarInfo.schale) break;
      const form = haarForm(dna, haarInfo.schale, ctx3d, schaedelUmriss);
      if (!form || form.polygon.length < 4) break;
      // 外轮廓和发际线各走一条"卷边"：周期抖动的波形
      const r = strom(seed, 'locken');
      const kringelRand = lockenKante(form.aussen, r, 1);
      const kringelAnsatz = lockenKante(form.ansatz, r, -1);
      stift.flaeche(kringelRand.concat([...kringelAnsatz].reverse()), { farbe: pal.haar, spur: 'haar', wackel: .006 });
      stift.zug(kringelRand, { spur: 'haar-rand', w: .022, wackel: .004, farbe: pal.tinte, deckung: .75 });
      stift.zug(kringelAnsatz, { spur: 'haar-ansatz', w: .02, wackel: .003, farbe: pal.tinte, deckung: .7 });
      // 内部撒小螺旋
      const dunkel = pal.haarDunkel;
      const opt = { w: .014, wackel: .002, farbe: dunkel ? pal.haut : pal.tinte, deckung: dunkel ? .38 : .6, einlagig: true, ruhig: true };
      const dreh = r.chance(.5) ? 1 : -1;
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 3; j++) {
          const u = -1.05 + (i + .5 + r.range(-.3, .3)) / 7 * 2.1;
          const a = haarInfo.schale.unten(u);
          const v = a + (1.5 - a) * ((j + .5 + r.range(-.3, .3)) / 3);
          if (v <= a || v >= 1.5) continue;
          if (feldAn(u, v, ctx3d).nz < .12) continue;
          const zentrum = haarOberflaeche(dna, ctx3d, u, v, haarInfo.schale.dicke * .85);
          stift.zug(spirale(zentrum, .042 * r.range(.55, 1.5), dreh, r.range(0, 6.2832), r.range(4.2, 6.6)), { spur: `ringel${i}-${j}`, ...opt });
        }
      }
      break;
    }
    case 'afro': {
      if (!haarInfo.afro) break;
      let aussen = silhouettesAusWolke(haarInfo.afro.wolke, ctx3d.m, { bins: 96, bogenUm: -Math.PI / 2, hinter: schaedelUmriss });
      if (aussen.length < 6) break;
      aussen = aufSklaeleben(rauen(aussen, seed, 'afroRauung'), schaedelUmriss);
      const [u0, u1] = ansatzSichtbereich(dna, haarInfo.afro.unten, ctx3d.m);
      const ansatz = [];
      for (let i = 0; i <= 64; i++) {
        const u = u0 + (u1 - u0) * i / 64;
        ansatz.push(haarOberflaeche(dna, ctx3d, u, haarInfo.afro.unten(u), 0));
      }
      const polygon = aussen.concat([...ansatz].reverse());
      stift.flaeche(polygon, { farbe: pal.haar, spur: 'haar', wackel: .006 });
      stift.zug(aussen, { spur: 'haar-rand', w: .022, wackel: .004, farbe: pal.tinte, deckung: .75 });
      stift.zug(ansatz, { spur: 'haar-ansatz', w: .02, wackel: .004, farbe: pal.tinte, deckung: .7 });
      // 边缘流苏
      const fr = strom(seed, 'afroFransen');
      const winkel = [];
      for (let i = 0; i < 36; i++) winkel.push(-Math.PI + (i + .5) / 36 * Math.PI * 2);
      const wahl = winkel.map(() => ({ len: fr.range(.022, .055), kipp: fr.range(-.6, .6) }));
      const nrm = pathNormals(aussen);
      aussen.forEach((p, i) => {
        const a = Math.atan2(p.y, p.x);
        let idx = -1, best = 1e9;
        winkel.forEach((w, k) => {
          const d = Math.abs(Math.atan2(Math.sin(a - w), Math.cos(a - w)));
          if (d < best) { best = d; idx = k; }
        });
        if (best > .1 || idx < 0) return;
        const { len, kipp } = wahl[idx];
        const cos = Math.cos(kipp), sin = Math.sin(kipp);
        const nx = nrm[i].x * cos - nrm[i].y * sin, ny = nrm[i].x * sin + nrm[i].y * cos;
        stift.zug([p, { x: p.x + nx * len, y: p.y + ny * len }], { spur: `franse${idx}`, w: .012, wackel: .003, farbe: pal.haar, spitz: 1, einlagig: true });
      });
      // 内部小卷
      const kr = strom(seed, 'afroKringel');
      const dreh = kr.chance(.5) ? 1 : -1;
      const dunkel = pal.haarDunkel;
      const opt = { w: .013, wackel: .002, farbe: dunkel ? pal.haut : pal.tinte, deckung: dunkel ? .34 : .5, einlagig: true, ruhig: true };
      for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 5; j++) {
          const u = -Math.PI + (i + .5 + kr.range(-.35, .35)) / 15 * Math.PI * 2;
          const a = haarInfo.afro.unten(u);
          const v = a + (1.46 - a) * ((j + .5 + kr.range(-.3, .3)) / 5);
          if (v <= a || v >= 1.5) continue;
          if (feldAn(u, v, ctx3d).nz < .12) continue;
          const zentrum = haarOberflaeche(dna, ctx3d, u, v, haarInfo.afro.dickeVon(u, v) * .92);
          stift.zug(spirale(zentrum, .032 * kr.range(.6, 1.4), dreh, kr.range(0, 6.2832), kr.range(3.6, 5.4)), { spur: `kringel${i * 5 + j}`, ...opt });
        }
      }
      break;
    }
  }
}

// 把一条折线变成"卷边"：沿线周期性地向外鼓小包
function lockenKante(pts, r, richtung) {
  if (pts.length < 6) return pts;
  const out = [];
  const teilung = 9;
  const nrm = pathNormals(pts);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const schritte = Math.max(1, Math.round(len / .008));
    for (let k = 0; k < schritte; k++) {
      const t = k / schritte;
      const gi = i + t;
      const welle = Math.sin(gi / teilung * Math.PI * 2);
      const hub = .028 * welle * richtung;
      const ni = Math.min(pts.length - 1, Math.round(gi));
      out.push({ x: a.x + (b.x - a.x) * t + nrm[ni].x * hub, y: a.y + (b.y - a.y) * t + nrm[ni].y * hub });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/* ================= 头部覆盖物 ================= */

function drawKopfbedeckungBack(stift, dna, ctx3d, pal) {
  if (dna.merkmale.kopfbedeckung === 'kopfhoerer') drawHoerer(stift, dna, ctx3d, pal, 'hinten');
  if (dna.merkmale.kopfbedeckung !== 'hut') return;
  const hut = hutGeo(dna, ctx3d);
  // 帽檐后部（被头挡住一半的那圈）
  stift.flaeche(hut.krempeHinten.concat([...hut.krempeVorn].reverse()), { farbe: pal.stoff, spur: 'krempe', wackel: .004 });
  stift.flaeche(hut.krempeHinten.concat([...hut.krempeHintenUnten].reverse()), { farbe: pal.stoff, spur: 'krempe-hk', wackel: .004, trocken: true });
  stift.zug(hut.krempeHinten, { spur: 'krempe-h', w: .022, wackel: .004, farbe: pal.tinte, deckung: .7 });
  stift.zug(hut.krempeHintenUnten, { spur: 'krempe-hu', w: .014, wackel: .003, farbe: pal.tinte, deckung: .45, einlagig: true });
}

function drawKopfbedeckung(stift, dna, ctx3d, haarInfo, schaedelUmriss, pal) {
  const kind = dna.merkmale.kopfbedeckung;
  if (kind === 'keine') return;
  if (kind === 'stirnband') {
    const v = Math.max(dna.layout.braueV + .3, dna.ansatzV + .02);
    const [u0, u1] = ansatzSichtbereich(dna, () => v, ctx3d.m);
    const rand = (u1 - u0) * .03;
    const oben = [], unten = [];
    for (let i = 0; i <= 24; i++) {
      const u = u0 + rand + (u1 - u0 - 2 * rand) * i / 24;
      oben.push(haarOberflaeche(dna, ctx3d, u, v + .09, 0));
      unten.push(haarOberflaeche(dna, ctx3d, u, v - .07, 0));
    }
    stift.flaeche(oben.concat([...unten].reverse()), { farbe: pal.stoff, spur: 'band', wackel: .004 });
    stift.zug(oben, { spur: 'band-o', w: .012, wackel: .003, farbe: pal.tinte, deckung: .5 });
    stift.zug(unten, { spur: 'band-u', w: .012, wackel: .003, farbe: pal.tinte, deckung: .5 });
    return;
  }
  if (kind === 'kopfhoerer') { drawHoerer(stift, dna, ctx3d, pal, 'vorn'); return; }
  if (kind === 'hut') {
    const hut = hutGeo(dna, ctx3d);
    const f = hut.form;
    stift.flaeche(hut.kroneHuelle, { farbe: pal.stoff, spur: 'krone', wackel: .005, eckig: true });
    stift.zug(hut.kroneHuelle, { spur: 'krone-rand', w: .024, wackel: .005, farbe: pal.tinte, geschlossen: true, deckung: .8, eckig: true });
    stift.zug(hut.kroneObenVorn, { spur: 'krone-oben', w: .016, wackel: .004, farbe: pal.tinte, deckung: .45, einlagig: true });
    hut.fingerDellen.forEach((delle, i) => {
      stift.zug(delle, { spur: `delle${i}`, w: .013, wackel: .004, farbe: pal.tinte, deckung: .4, spitz: .5, einlagig: true });
    });
    stift.flaeche(hut.krempeVorn.concat([...hut.kroneUntenVorn].reverse()), { farbe: pal.stoff, spur: 'krempe-v', wackel: .004 });
    stift.flaeche(hut.krempeVorn.concat([...hut.krempeVornUnten].reverse()), { farbe: pal.stoff, spur: 'krempe-vk', wackel: .004, trocken: true });
    stift.zug(hut.krempeVorn, { spur: 'krempe-v', w: .026, wackel: .004, farbe: pal.tinte, deckung: .85 });
    stift.zug(hut.krempeVornUnten, { spur: 'krempe-vu', w: .016, wackel: .003, farbe: pal.tinte, deckung: .5, einlagig: true });
    stift.zug(hut.kroneUntenVorn, { spur: 'krempe-ansatz', w: .016, wackel: .003, farbe: pal.tinte, deckung: .5, einlagig: true });
    stift.flaeche(hut.bandOben.concat([...hut.bandUnten].reverse()), { farbe: pal.stoffTief, spur: 'hutband', wackel: .003, trocken: true });
    stift.zug(hut.bandOben, { spur: 'hutband-o', w: .016, wackel: .003, farbe: pal.tinte, deckung: .7, einlagig: true });
    stift.zug(hut.bandUnten, { spur: 'hutband-u', w: .016, wackel: .003, farbe: pal.tinte, deckung: .55, einlagig: true });
    return;
  }
  // kappe：便帽 = 一层贴头的壳 + 卷边
  if (!haarInfo.kappe) return;
  const form = haarForm(dna, haarInfo.kappe, ctx3d, schaedelUmriss);
  if (!form || form.polygon.length < 4) return;
  stift.flaeche(form.polygon, { farbe: pal.stoff, spur: 'kappe', wackel: .005 });
  stift.zug(form.aussen, { spur: 'kappe-rand', w: .02, wackel: .004, farbe: pal.tinte, deckung: .6 });
  const [u0, u1] = ansatzSichtbereich(dna, haarInfo.kappe.unten, ctx3d.m);
  const saum = [];
  for (let i = 0; i <= 24; i++) {
    const u = u0 + (u1 - u0) * i / 24;
    saum.push(haarOberflaeche(dna, ctx3d, u, haarInfo.kappe.unten(u), .045));
  }
  stift.zug(saum, { spur: 'saum', w: .034, wackel: .004, farbe: pal.stoff, spitz: .25 });
  stift.zug(saum, { spur: 'saum-l', w: .011, wackel: .004, farbe: pal.tinte, deckung: .45 });
}

/* 耳机：头梁 + 两个耳罩 */
function drawHoerer(stift, dna, ctx3d, pal, seite) {
  const buegelOpt = { w: .05, wackel: .004, farbe: pal.tinte, spitz: .2, deckung: .9 };
  const bogenH = (t) => .1 + 1.25 * Math.sin(Math.PI * t);
  const pts = [], sichtbar = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, u = -1.42 + t * 2.84;
    pts.push(haarOberflaeche(dna, ctx3d, u, bogenH(t), .09));
    sichtbar.push(feldAn(u, bogenH(t), ctx3d).nz > .05);
  }
  // 后梁只画被头挡住的那几段，前梁画可见段 —— 两遍拼成一条带子，不重墨
  const segZeichnen = (will, prefix) => {
    let lauf = [], n = 0;
    const flush = () => { if (lauf.length >= 2) stift.zug(lauf, { spur: `${prefix}${n++}`, ...buegelOpt }); lauf = []; };
    for (let i = 0; i <= 26; i++) {
      if (sichtbar[i] === will) lauf.push(pts[i]); else flush();
    }
    flush();
  };
  if (seite === 'hinten') {
    segZeichnen(false, 'buegel-h');
  } else {
    segZeichnen(true, 'buegel-v');
  }
  for (const s of [-1, 1]) {
    const feld = feldAn(s * 1.44, dna.layout.ohrV, ctx3d);
    if ((feld.nz >= .05) !== (seite === 'vorn')) continue;
    const ring = (off) => {
      const r = [], l = .2;
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * 6.2832;
        r.push(feld.to(Math.cos(a) * l, Math.sin(a) * l * 1.05, off));
      }
      return r;
    };
    const aussen = ring(.02), innen = ring(.15);
    stift.flaeche(aussen.concat([...innen].reverse()), { farbe: pal.tinte, spur: `muschel-k${s}`, wackel: .004, deckung: .92, trocken: true });
    if (seite !== 'hinten') {
      stift.flaeche(innen, { farbe: pal.tinte, spur: `muschel-d${s}`, wackel: .004, trocken: true });
      stift.zug(innen, { spur: `muschel-r${s}`, w: .014, wackel: .003, farbe: pal.haut, geschlossen: true, deckung: .55, einlagig: true });
      if (feld.nz > .35) {
        const kern = [];
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * 6.2832;
          kern.push(feld.to(Math.cos(a) * .1, Math.sin(a) * .105, .15));
        }
        stift.zug(kern, { spur: `muschel-i${s}`, w: .012, wackel: .003, farbe: pal.haut, geschlossen: true, deckung: .6, einlagig: true });
      }
    }
  }
}

/* 帽子：5 种帽型的参数 + 由壳面点搭出的帽檐/帽冠 */
function hutForm(dna) {
  const r = strom(dna.seed, 'hutform');
  const sorte = r.weighted([['fedora', .3], ['trilby', .2], ['sonne', .18], ['zylinder', .14], ['eimer', .18]]);
  const kippe = r.range(-.01, .05), bandBreite = r.range(.05, .11);
  const sitz = r.chance(.3) ? r.range(.1, .26) : r.range(0, .05);
  switch (sorte) {
    case 'trilby': return { sorte, verjuengung: r.range(.84, .9), hoch: r.range(.34, .44), krempeX: r.range(1.16, 1.3), krempeZ: r.range(1.12, 1.24), schwung: r.range(-.04, 0), kippe, delle: r.range(.05, .09), finger: true, bandBreite, sitz };
    case 'sonne': return { sorte, verjuengung: r.range(.9, .98), hoch: r.range(.26, .34), krempeX: r.range(1.75, 2.05), krempeZ: r.range(1.6, 1.85), schwung: r.range(.04, .12), kippe, delle: r.range(0, .03), finger: false, bandBreite, sitz };
    case 'zylinder': return { sorte, verjuengung: r.range(.98, 1.06), hoch: r.range(.72, .92), krempeX: r.range(1.2, 1.34), krempeZ: r.range(1.16, 1.28), schwung: r.range(-.06, -.02), kippe, delle: 0, finger: false, bandBreite: r.range(.08, .14), sitz };
    case 'eimer': return { sorte, verjuengung: r.range(1.02, 1.12), hoch: r.range(.3, .4), krempeX: r.range(1.3, 1.48), krempeZ: r.range(1.26, 1.42), schwung: r.range(.06, .14), kippe: kippe * .5, delle: 0, finger: false, bandBreite, sitz };
    default: return { sorte, verjuengung: r.range(.8, .88), hoch: r.range(.46, .58), krempeX: r.range(1.42, 1.62), krempeZ: r.range(1.34, 1.5), schwung: r.range(0, .05), kippe: kippe + .02, delle: r.range(.07, .12), finger: true, bandBreite, sitz };
  }
}

function hutGeo(dna, ctx3d) {
  const k = dna.kopf, f = hutForm(dna);
  // 帽圈落点：发际线/眉上的最高处 + 帽子下沉量
  const sitzV = Math.min(Math.max(dna.layout.braueV + .36, dna.ansatzV + .12) + f.sitz, 1.2);
  let bx = 0, bz = 0;
  for (let i = 0; i < 24; i++) {
    const p = schaedelPunkt(i / 24 * 6.2832, sitzV, k);
    bx = Math.max(bx, Math.abs(p.x)); bz = Math.max(bz, Math.abs(p.z));
  }
  const y0 = schaedelPunkt(0, sitzV, k).y;
  const kuppe = k.ry + (HOHE_FRISUREN.has(dna.merkmale.haar) ? .05 : 0);
  bx = bx * 1.1 + .03; bz = bz * 1.1 + .03;
  const l = bx * f.verjuengung, lz = bz * f.verjuengung;
  const hoch = Math.max(k.ry * f.hoch, kuppe + .05 - y0);
  const krempeX = Math.max(bx * f.krempeX, k.rx * 1.14);
  const krempeZ = Math.max(bz * f.krempeZ, k.rz * 1.1);
  const yaw = ctx3d.pose.yaw;
  const bogenWinkel = (x, z) => Math.atan2(x * Math.sin(yaw), z * Math.cos(yaw));
  const ring = (rx, rz, vorn, yFn) => {
    const pts = [], a0 = bogenWinkel(rx, rz);
    for (let i = 0; i <= 32; i++) {
      const a = vorn ? a0 + i / 32 * Math.PI : a0 - i / 32 * Math.PI;
      const p3 = { x: Math.cos(a) * rx, y: yFn(a), z: Math.sin(a) * rz };
      pts.push(punkt3d(p3.x, p3.y, p3.z, ctx3d));
    }
    return pts;
  };
  const krempeY = (a) => y0 - .01 - f.schwung - f.kippe * Math.sin(a);
  const kronenY = (a) => y0 + hoch - f.delle * k.ry * Math.abs(Math.sin(a));
  const krempeHinten = ring(krempeX, krempeZ, false, krempeY);
  const krempeVorn = ring(krempeX, krempeZ, true, krempeY);
  const krempeHintenUnten = ring(krempeX, krempeZ, false, (a) => krempeY(a) - .03);
  const krempeVornUnten = ring(krempeX, krempeZ, true, (a) => krempeY(a) - .03);
  const kroneUntenVorn = ring(bx, bz, true, () => y0);
  const kroneObenVorn = ring(l, lz, true, kronenY);
  const bandUntenV = Math.min(.5, (.035 + hoch * .06) / Math.max(hoch, .001));
  const bandObenV = Math.min(.75, bandUntenV + f.bandBreite / Math.max(hoch, .001));
  const kroneZwischen = (t) => ring(bx + (l - bx) * t, bz + (lz - bz) * t, true, () => y0 + hoch * t);
  const bandUnten = kroneZwischen(bandUntenV), bandOben = kroneZwischen(bandObenV);
  // 帽冠外形：上前弧 + 上后弧 + 下前弧两端，取凸包
  const huellenRoh = kroneObenVorn.concat(ring(l, lz, false, kronenY));
  huellenRoh.push(kroneUntenVorn[0], kroneUntenVorn[32]);
  const huelle = konvexHuelle(huellenRoh);
  // 指压凹痕
  const fingerDellen = [];
  if (f.finger) {
    const basis = bogenWinkel(l, lz);
    for (const s of [-1, 1]) {
      const a = Math.PI / 2 + s * .62;
      if (((a - basis) % 6.2832 + 6.2832) % 6.2832 > Math.PI) continue;
      const t = .42;
      fingerDellen.push([
        punkt3d(Math.cos(a) * l, kronenY(a) - k.ry * .02, Math.sin(a) * lz, ctx3d),
        punkt3d(Math.cos(a) * (l + (bx - l) * t), y0 + hoch * .58, Math.sin(a) * (lz + (bz - lz) * t), ctx3d),
      ]);
    }
  }
  return { krempeHinten, krempeVorn, krempeHintenUnten, krempeVornUnten, kroneHuelle: huelle, kroneUntenVorn, kroneObenVorn, bandUnten, bandOben, fingerDellen, form: f };
}

function konvexHuelle(pts) {
  const sortiert = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const kreuz = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const unten = [];
  for (const p of sortiert) {
    while (unten.length >= 2 && kreuz(unten[unten.length - 2], unten[unten.length - 1], p) <= 0) unten.pop();
    unten.push(p);
  }
  const oben = [];
  for (let i = sortiert.length - 1; i >= 0; i--) {
    const p = sortiert[i];
    while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], p) <= 0) oben.pop();
    oben.push(p);
  }
  unten.pop(); oben.pop();
  return unten.concat(oben);
}

/* ================= 耳朵 / 脖子 / 衣领 ================= */

function umrissXBei(umriss, y, seite, von) {
  let x = von;
  for (const p of umriss) {
    if (Math.abs(p.y - y) > .05) continue;
    if (seite > 0 ? p.x > x : p.x < x) x = p.x;
  }
  return x;
}

function drawEar(stift, feld, pal, seite, umriss) {
  if (feld.nz < -.15) return;
  const s = .13;
  const c = feld.x >= 0 ? 1 : -1;
  const l = Math.max(0, c * (umrissXBei(umriss, feld.y, c, feld.x) - feld.x));
  const u = s, d = l + s * .12;
  const P = (a, n = 0) => feld.to(0, Math.sin(a) * s * .86, Math.cos(a) * (u + d) - d - n);
  const pts = [P(-1.5708, s * .7)];
  for (let i = 0; i <= 24; i++) pts.push(P(-1.5708 + 3.1416 * i / 24));
  pts.push(P(1.5708, s * .7));
  const tuck = [];
  for (let i = 0; i <= 4; i++) tuck.push(feld.to(0, s * .86 * (1 - i / 2), -d - s * .9));
  stift.flaeche(pts.concat(tuck), { farbe: pal.haut, trocken: true });
  // 外轮廓只画没被颅骨挡住的部分
  const h = Math.min(s * .5, l);
  const frei = (p) => c * (umrissXBei(umriss, p.y, c, p.x) - p.x) - h;
  const sichtbar = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], g = frei(p);
    if (g <= 0) sichtbar.push(p);
    const q = pts[i + 1];
    if (!q) break;
    const gq = frei(q);
    if ((g <= 0) === (gq <= 0)) continue;
    const t = g / (g - gq);
    sichtbar.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  }
  if (sichtbar.length >= 3) {
    stift.zug(sichtbar, { spur: `ohr${seite}`, w: .022, wackel: .004, farbe: pal.tinte });
  }
  const v0 = (u - l) / 2, v1 = (u + l) / 2, innen = [];
  for (let i = 0; i <= 5; i++) {
    const a = -1.1 + i / 5 * 2.2;
    innen.push(feld.to(0, Math.sin(a) * s * .46, v0 + Math.cos(a) * v1 * .5));
  }
  stift.zug(innen, { spur: `ohrin${seite}`, w: .014, wackel: .003, farbe: pal.tinte, deckung: .55, einlagig: true });
}

function drawNeck(stift, dna, ctx3d, umriss, kragen, pal) {
  const k = dna.kopf, l = k.ry;
  let tiefste = -1e9;
  for (const p of umriss) if (p.y > tiefste) tiefste = p.y;
  let sumX = 0, cnt = 0;
  for (const p of umriss) {
    if (p.y < tiefste - l * .06) continue;
    sumX += p.x; cnt++;
  }
  const mx = (cnt ? sumX / cnt : 0) * .35;
  const halb = Math.abs(punkt3d(schaedelPunkt(.3, -1.22, k).x, schaedelPunkt(.3, -1.22, k).y, schaedelPunkt(.3, -1.22, k).z, ctx3d).x);
  const yB = punkt3d(0, schaedelPunkt(0, -1.22, k).y, schaedelPunkt(0, -1.22, k).z, ctx3d).y + l * .24;
  const obenY = tiefste - l * .12;
  const untenY = Math.max(yB, tiefste + l * .08);
  const a = { x: mx - halb - .01, y: untenY }, b = { x: mx + halb + .01, y: untenY };
  stift.flaeche([{ x: mx - halb, y: obenY }, { x: mx + halb, y: obenY }, b, a], { farbe: pal.haut, eckig: true, trocken: true });
  const linienOben = tiefste - l * .05;
  stift.zug([{ x: mx - halb, y: linienOben }, a], { spur: 'hals-l', w: .022, wackel: .004, farbe: pal.tinte });
  stift.zug([{ x: mx + halb, y: linienOben }, b], { spur: 'hals-r', w: .022, wackel: .004, farbe: pal.tinte });
  if (kragen === 'v') {
    stift.zug([{ x: a.x - .08, y: a.y + .02 }, { x: mx, y: untenY + l * .16 }, { x: b.x + .08, y: b.y + .02 }],
      { spur: 'kragen', w: .022, wackel: .004, farbe: pal.tinte, eckig: true });
  } else if (kragen === 'rund') {
    stift.zug([{ x: a.x - .1, y: a.y }, { x: mx, y: untenY + l * .12 }, { x: b.x + .1, y: b.y }],
      { spur: 'kragen', w: .022, wackel: .004, farbe: pal.tinte });
  }
}

/* ================= 组装一颗头 ================= */

function headCache(head) {
  if (head.cache) return head.cache;
  const dna = head.dna;
  const c = {
    schaedel: wolkeErstellen(dna.kopf, 72, 84, () => -Math.PI / 2, () => Math.PI / 2, null),
    palette: makePalette(dna.palette),
    ref: feldReferenz(dna.kopf),
    schale: null, kappe: null, afro: null, dutt: null,
    stern: null, herz: null, wange: null,
  };
  const r = strom(dna.seed, 'handschrift');
  const fuelle = strom(dna.seed, 'fuelle').range(.85, 1.45);
  const mitHut = dna.merkmale.kopfbedeckung === 'hut';
  const d = (x) => mitHut ? Math.min(x, .05) : x * fuelle;
  switch (dna.merkmale.haar) {
    case 'haube': c.schale = haarSchale(dna, d(.125), { zacken: true }); break;
    case 'pony': c.schale = haarSchale(dna, d(.12), { tiefe: -.16, zacken: true }); break;
    case 'zoepfe': case 'dutt': c.schale = haarSchale(dna, d(.095), {}); break;
    case 'seitenscheitel': c.schale = haarSchale(dna, d(.115), { neigung: (dna.seed % 2 === 0 ? -1 : 1) * .16, zacken: true }); break;
    case 'lockenwolke': c.schale = haarSchale(dna, d(.17), { welle: true, neigung: (dna.seed % 2 === 0 ? -1 : 1) * .12 }); break;
    case 'igel': c.schale = haarSchale(dna, d(.035), {}); break;
    case 'afro': {
      const form = afroForm(dna, strom(dna.seed, 'afroSorte'));
      c.afroForm = form;
      c.afro = afroSchale(dna, form);
      break;
    }
  }
  if (dna.merkmale.kopfbedeckung === 'kappe') c.kappe = haarSchale(dna, .085, { tiefe: .06 });
  if (dna.merkmale.haar === 'dutt') {
    const dr = strom(dna.seed, 'dutt');
    c.dutt = { r: dr.range(.1, .24), flach: dr.range(.82, 1.02) };
  }
  const sr = strom(dna.seed, 'stern');
  const zacken = sr.n() < .5 ? 4 : 5;
  c.stern = { zacken, laengen: [], versatz: [], innen: sr.range(.34, .48) };
  for (let i = 0; i < zacken; i++) {
    c.stern.laengen.push(sr.range(.8, 1.12));
    c.stern.versatz.push(sr.range(-.14, .14));
  }
  const hr = strom(dna.seed, 'herz');
  c.herz = { unterlage: hr.pick(['strich', 'laecheln', 'klein']), breite: hr.range(.84, 1.26), hoehe: hr.range(.82, 1.22), kerbe: hr.range(.35, .85) };
  const wr = strom(dna.seed, 'wange');
  c.wange = { hoch: wr.range(.36, .72), weit: wr.range(.1, .26), dicke: wr.range(.9, 1.1), neig: wr.range(0, .3), beide: wr.chance(.6) };
  head.cache = c;
  return c;
}

// 五官尺寸的测量：先量壳面上各区的实际像素大小，再钳制
function messeGroessen(ctx3d, layout) {
  const zoneMass = (zone) => {
    const f0 = feldAn(zone.u, zone.v, ctx3d);
    const fv = feldAn(zone.u, zone.v + zone.halbV, ctx3d);
    const fu = feldAn(zone.u + zone.halbU, zone.v, ctx3d);
    const hoehe = Math.hypot(fv.x - f0.x, fv.y - f0.y) / Math.max(.4, f0.fy) * layout.fuellung;
    const breite = Math.hypot(fu.x - f0.x, fu.y - f0.y) / Math.max(.4, f0.fx) * layout.fuellung;
    return { breite, hoehe };
  };
  const auge = zoneMass(layout.zonen.augeL);
  const nase = zoneMass(layout.zonen.nase);
  const mund = zoneMass(layout.zonen.mund);
  return {
    auge: clamp(Math.min(.23 * layout.augenSkala, auge.breite * 1.05, auge.hoehe * 4.5), .13, .27),
    nase: clamp(Math.min(.24 * layout.skala, nase.hoehe * 1.35), .13, .3),
    mundBreit: clamp(Math.min(.46 * layout.skala, mund.breite * 1.15), .26, .52),
    mundHoch: clamp(Math.min(.17 * layout.skala, mund.hoehe * 1.9), .08, .2),
  };
}

function drawHead(ctx, head, t) {
  const dna = head.dna;
  const cache = headCache(head);
  const pal = cache.palette;
  const z = head.zustand(t);
  const pose = z.pose;
  const m = rotMatrix(pose);
  const ctx3d = { kopf: dna.kopf, pose, m, refU: cache.ref.refU, refV: cache.ref.refV, dna };
  const mass = head.mass;
  const umriss = silhouettesAusWolke(cache.schaedel, m, { bins: 108 });
  if (umriss.length < 8) return;
  const tick = Math.floor(z.zeit * 8 + dna.taktVersatz);
  const stift = makeStift(ctx, dna.seed, pal.tinte, stiftSkala(mass), tick);
  const groessen = messeGroessen(ctx3d, dna.layout);
  const haarInfo = { schale: cache.schale, kappe: cache.kappe, afro: cache.afro, dutt: cache.dutt };
  const mk = dna.merkmale;
  const anim = { blickX: z.blickX, blickY: z.blickY, lider: z.lider, wach: z.wach, zeit: z.zeit, x: z.blickX, y: z.blickY };

  ctx.save();
  ctx.translate(head.cx, head.cy - z.wach * .05 * mass);
  ctx.scale(mass, mass);

  // 1. 脖子与衣领
  drawNeck(stift, dna, ctx3d, umriss, mk.kragen, pal);
  // 2. 后发 / 帽子后部 / 耳机后梁
  drawHairBack(stift, dna, ctx3d, haarInfo, umriss, pal);
  drawKopfbedeckungBack(stift, dna, ctx3d, pal);
  // 3. 耳朵（朝向我们的那只后画）
  const ohrL = feldAn(-1.48, dna.layout.ohrV, ctx3d);
  const ohrR = feldAn(1.48, dna.layout.ohrV, ctx3d);
  const ohren = [ohrL, ohrR];
  const fernOhr = ohrL.nz <= ohrR.nz ? 0 : 1;
  const kopfh = mk.kopfbedeckung === 'kopfhoerer';
  if (!kopfh) drawEar(stift, ohren[fernOhr], pal, fernOhr === 0 ? -1 : 1, umriss);
  // 4. 颅骨：肤色 + 背光渐变
  stift.flaeche(umriss, { farbe: pal.haut, spur: 'kopf', wackel: .005 });
  {
    const gcx = -pose.yaw * dna.kopf.rx * .9 - dna.kopf.rx * .25;
    const gcy = -dna.kopf.ry * .35;
    const grad = ctx.createRadialGradient(gcx, gcy, dna.kopf.rx * .2, gcx * .4, gcy * .2, Math.max(dna.kopf.rx, dna.kopf.ry) * 1.55);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(.62, 'rgba(0,0,0,0)');
    grad.addColorStop(1, pal.schatten);
    stift.flaeche(umriss, { farbe: grad, spur: 'kopf', wackel: .005 });
  }
  // 5. 轮廓线
  stift.zug(umriss, { spur: 'kopf', w: .03, wackel: .006, geschlossen: true, farbe: pal.tinte, spitz: .4 });
  // 6. 近侧耳朵
  if (!kopfh) drawEar(stift, ohren[1 - fernOhr], pal, fernOhr === 0 ? 1 : -1, umriss);
  // 7. 脸颊与面部痕迹
  drawCheeks(stift, ctx3d, dna.layout, mk.backe, pal, z.wach, Math.max(.1, groessen.auge * .95), dna.punktMass);
  drawZeichen(stift, ctx3d, dna.layout, mk.zeichen, dna.seite, groessen.auge, pal);
  // 8. 胡子
  drawBeard(stift, ctx3d, dna.layout, mk.bart, pal, groessen.mundBreit, { gross: groessen.nase, typ: mk.nase }, groessen.mundHoch, dna.bartLage);
  // 9. 眼睛（远的先画）+ 眉毛
  const augeFelder = [-1, 1].map((s) => {
    let u = s * dna.layout.augeU;
    // 眼睛往里收，直到落在足够朝前的壳面上
    for (let i = 0; i < 14 && feldAn(u, dna.layout.augeV, ctx3d).nz < .42; i++) u *= .9;
    return { seite: s, feld: feldAn(u, dna.layout.augeV + (s < 0 ? dna.asym : -dna.asym), ctx3d), u };
  });
  const nah = augeFelder[1].feld.z >= augeFelder[0].feld.z ? 1 : -1;
  const wangenAktiv = mk.zeichen === 'wangenbogen';
  // 层序与原作一致：远眼 → 鼻 → 近眼 → 嘴
  const fernEintrag = augeFelder.find((e) => e.seite !== nah);
  const nahEintrag = augeFelder.find((e) => e.seite === nah);
  zeichneAugeKomplett(fernEintrag.seite, fernEintrag.feld, fernEintrag.u);
  drawNose(stift, feldAn(0, dna.layout.zonen.nase.v, ctx3d), groessen.nase, mk.nase, pose.yaw >= 0 ? 1 : -1, pose.yaw, pal);
  zeichneAugeKomplett(nahEintrag.seite, nahEintrag.feld, nahEintrag.u);
  drawMouth(stift, feldAn(0, dna.layout.mundV, ctx3d), groessen.mundBreit, groessen.mundHoch, mk.mund, pal, z.mund, z.wach, cache.herz);
  function zeichneAugeKomplett(seite, feld, u) {
    const size = groessen.auge * dna.augenJitter[seite < 0 ? 0 : 1];
    const zeichnen = () => drawEye(stift, feld, size, mk.auge, seite, anim, dna.pupille, pal, `auge${seite}`, cache.stern);
    if (wangenAktiv && (cache.wange.beide || seite === dna.seite)) {
      drawEyeMitWange(ctx, stift, feld, size, mk.auge, seite, cache.wange, umriss, z.lider, pal, `wange${seite}`, zeichnen);
    } else zeichnen();
    const braueFeld = feldAn(u, dna.layout.braueV, ctx3d);
    drawBrow(stift, braueFeld, size * 1.2, mk.braue, seite, z.wach, pal, `braue${seite}`);
  }
  // 12. 头发与前侧覆盖物
  drawHair(stift, dna, ctx3d, haarInfo, umriss, pal);
  drawKopfbedeckung(stift, dna, ctx3d, haarInfo, umriss, pal);
  // 13. 小装饰与眼镜
  drawZierrat(stift, ctx3d, dna, kopfh && mk.zierrat === 'ohrring' ? 'keiner' : mk.zierrat, ohren, dna.seite, pal);
  if (mk.brille !== 'keine') {
    drawGlasses(stift, ctx3d, null, null, groessen.auge, mk.brille, pal, dna.kopf, dna.layout);
  }

  ctx.restore();

  // 名字：浅灰、等宽、拉开字距
  ctx.save();
  ctx.font = `10px ui-monospace, "SF Mono", Menlo, "Courier New", monospace`;
  try { ctx.letterSpacing = '3px'; } catch (e) { /* 旧浏览器忽略 */ }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8b8894';
  ctx.fillText(dna.name, head.cx, head.cy + mass * 1.62);
  ctx.restore();
}

/* ================= Blatt：纸面、排版与主循环 ================= */

const canvas = document.getElementById('blatt');
const ctx = canvas.getContext('2d');
let heads = [];
let dpr = 1;
let baseSeed = 1000;

/* 纸纹：128px 的噪点 + 短划痕砖，平铺出纸面颗粒 */
let grainPattern = null;
function makeGrain() {
  const g = document.createElement('canvas');
  g.width = Math.round(128 * dpr);
  g.height = Math.round(128 * dpr);
  const gc = g.getContext('2d');
  gc.scale(dpr, dpr);
  const r = mulberry32(2654435769);
  gc.fillStyle = PAPIER_DUNKEL;
  for (let i = 0; i < 900; i++) {
    gc.globalAlpha = .02 + r() * .05;
    gc.fillRect(r() * 128, r() * 128, 1, 1);
  }
  gc.strokeStyle = PAPIER_DUNKEL;
  gc.lineWidth = .6;
  gc.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = r() * 128, y = r() * 128, a = r() * 6.2832, len = 2 + r() * 5;
    gc.globalAlpha = .03 + r() * .04;
    gc.beginPath();
    gc.moveTo(x, y);
    gc.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    gc.stroke();
  }
  grainPattern = ctx.createPattern(g, 'repeat');
}

function papier() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  // 角落微微变暗的印刷 vignette
  const diag = Math.hypot(innerWidth, innerHeight) * .62;
  const grad = ctx.createRadialGradient(innerWidth * .5, innerHeight * .42, diag * .15, innerWidth * .5, innerHeight * .42, diag);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(70,55,30,0.045)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  if (grainPattern) {
    ctx.fillStyle = grainPattern;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }
}

// 每颗头需要的空间（世界单位）：帽子和爆炸头要更高更宽
function raumBedarf(head) {
  const dna = head.dna;
  let oben = 1.3, seite = 1.3;
  if (dna.merkmale.kopfbedeckung === 'hut') {
    const f = hutForm(dna);
    oben = Math.max(oben, 1.2 + dna.kopf.ry * f.hoch * .8 + .1);
    seite = Math.max(seite, dna.kopf.rx * Math.max(f.krempeX, 1.14) * 1.15 + .06);
  }
  if (dna.merkmale.haar === 'afro' && head.cache?.afro) {
    const k = dna.kopf, form = head.cache.afroForm;
    if (form) {
      const basis = Math.min(1.24, Math.max(k.rx, k.rz, k.ry * .86) * form.weite);
      oben = Math.max(oben, basis * form.hoeher + basis * form.hoch * 1.1 + .07);
      seite = Math.max(seite, basis * 1.15 + .07);
    }
  }
  if (dna.merkmale.haar === 'dutt' && head.cache?.dutt) {
    oben = Math.max(oben, (dna.kopf.ry + .1 + head.cache.dutt.r * 1.9) * 1.04);
  }
  return { oben, seite };
}

function layout() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';

  // 大而稀的网格：格子接近方形，头之间留足呼吸感
  const cols = Math.max(2, Math.min(5, Math.round(innerWidth / 320)));
  const rows = Math.max(1, Math.min(3, Math.round(innerHeight / 400)));
  const count = cols * rows;
  while (heads.length < count) heads.push(new Head(baseSeed + heads.length));
  heads.length = count;
  const gw = innerWidth / cols, gh = innerHeight / rows;
  for (let i = 0; i < count; i++) {
    const head = heads[i];
    headCache(head);   // 确保 afro/帽子参数可用于占位计算
    const c = i % cols, r = Math.floor(i / cols);
    const bedarf = raumBedarf(head);
    head.mass = Math.min(gw / (2 * bedarf.seite * 1.06), gh / (bedarf.oben + 2.1));
    head.cx = gw * (c + .5);
    head.cy = gh * r + head.mass * bedarf.oben + gh * .08;
  }
}

function reshuffle() {
  baseSeed = Math.floor(Math.random() * 1e9);
  heads = [];
  layout();
}

const pointer = { x: 0, y: 0, active: false };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
});
addEventListener('pointerleave', () => { pointer.active = false; });
document.addEventListener('mouseleave', () => { pointer.active = false; });
addEventListener('blur', () => { pointer.active = false; });
addEventListener('resize', layout);
document.getElementById('neues').addEventListener('click', reshuffle);

layout();

let prev = performance.now();
function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  const t = now / 1000;

  papier();
  for (const head of heads) {
    head.update(dt, t, pointer);
    drawHead(ctx, head, t);
  }
  requestAnimationFrame(frame);
}
makeGrain();
requestAnimationFrame(frame);
