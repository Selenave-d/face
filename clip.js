/* 纸上的小人 · 报纸剪报 —— 寻人启事/头版双肖像生成器
 * 一张竖版剪报，版式由种子分派：寻人启事（居中一帧胸像）或头版（通栏大标题 + 并排两帧）。
 * 报头 + 日期栏 + 通栏标题 + 手绘胸像（app.js 引擎，带肩块的胸像裁切）
 * + 双栏铅字假文 + 悬赏行 + 朱红印章 + 折痕 + 撕纸边。
 * ?seed=N 同种子同剪报；「存图片」导出 PNG（纯 canvas，零依赖）。
 * 角色由 app.js 的 Head/drawHead 提供；纸面/纸纹用 papier()；线条全程 8fps 沸腾。
 */
'use strict';

const TINTE = makePalette({ hautT: .5, haarT: .1, akzentT: .5, tinteT: .5 }).tinte;
const STEMPEL_ROT = '#b0654a';   // 与合影页选中圈同源的暖橘红，全页唯一一点颜色

let saat = (() => {
  const s = parseInt(new URLSearchParams(location.search).get('seed'), 10);
  return Number.isFinite(s) && s > 0 ? s : (Math.random() * 1e9) | 0;
})();

let kopf = null, kopf2 = null;
function neuesKopf(seed) {
  saat = seed;
  const h = new Head(seed);
  headCache(h);
  h.zeigeName = false;   // 名字写进标题与图注，不在脚下重复
  return h;
}
// 第二张脸（头版双肖像用）：neuesKopf 会顺手改全局种子，这里必须是纯函数
const TOTER_ZEIGER = { x: 0, y: 0, active: false };   // 头版第二人不追鼠标，安静待着
function zweitKopf(seed) {
  const h = new Head(seed);
  headCache(h);
  h.zeigeName = false;
  return h;
}
kopf = neuesKopf(saat);
kopf2 = zweitKopf(saat + 1013);

/* ================= 文案池（一个 seed 一套说辞） ================= */

const BLATT_NAME = ['纸面新闻', '小人日报', '街角晚报', '铅笔快报', '朋友时报'];
const TITEL_FORM = [
  (name) => `全城寻找${name}`,
  (name) => `${name}，你在哪里？`,
  (name) => `有人见过${name}吗`,
  (name) => `寻找爱笑的${name}`,
];
const SATZ_ANFANG = ['本报讯', '通讯员称', '消息人士称', '居民称'];
const SATZ_MITTE = [
  '昨日午后连续挥手三次', '在斑马线上跳舞', '把橡皮屑堆成小山', '对着复印机看了很久',
  '画了一条很直的线', '踩着影子一路小跑', '在玻璃上写了名字', '安静看完一张报纸',
];
const SATZ_ENDE = ['，引发围观。', '，场面一度十分可爱。', '，本报将持续关注。', '，目前纸面平静。'];
const LOHN = ['悬赏：水果糖叁颗', '悬赏：橡皮半块', '悬赏：贴纸两张', '酬谢：瓜子一把'];
const STEMPEL = ['已核实', '独家', '寻人', '加急'];
// 头版（双肖像）专用文案
const DUO_TITEL_FORM = [
  (a, b) => `${a}与${b}同时现身`,
  (a, b) => `喜讯：${a}找到了${b}`,
  (a, b) => `${a}和${b}，谁先笑了？`,
  (a, b) => `本报确认：${a}认识${b}`,
  (a, b) => `${a}为${b}画了顶帽子`,
  (a, b) => `${a}与${b}平分一块橡皮`,
  (a, b) => `${a}${b}街头二重奏`,
  (a, b) => `${a}牵手${b} 全城祝福`,
];
const DUO_NOTIZ = [
  '编者按：确为朋友', '本版编辑仍在找笔', '据称二人从不吵架', '消息来源请求匿名',
  '下期预告：仍是朋友', '校对：另一位朋友', '印刷厂表示满意', '读者来电：很像',
  '中缝启事：勿投喂', '转载请注明出处',
];
const DUO_LOHN = ['悬赏：水果糖陆颗', '悬赏：橡皮一整块', '酬谢：贴纸肆张', '悬赏：瓜子两把'];
const DUO_STEMPEL = ['已核实', '独家', '号外', '首发'];

function texte(seed) {
  const r = strom(seed, 'text');
  const name = chinesischerName(strom(seed, 'name'));
  // 头版字段全部走独立 label 流且追加在末尾：不动上面 'text' 流的消费顺序，同种子寻人版文案一字不变
  const name2 = chinesischerName(strom(seed, 'name2'));
  return {
    blatt: r.pick(BLATT_NAME),
    datum: `19${40 + Math.floor(r.n() * 59)} 年 ${1 + Math.floor(r.n() * 12)} 月 ${1 + Math.floor(r.n() * 28)} 日`,
    ausgabe: `第 ${1 + Math.floor(r.n() * 998)} 期`,
    titel: r.pick(TITEL_FORM)(name),
    zeilen: Array.from({ length: 9 }, () =>
      `${r.pick(SATZ_ANFANG)}，${r.pick(SATZ_MITTE)}${r.pick(SATZ_ENDE)}`),
    lohn: r.pick(LOHN),
    stempel: r.pick(STEMPEL),
    name,
    name2,
    duoTitel: strom(seed, 'duoTitel').pick(DUO_TITEL_FORM)(name, name2),
    duoNote: strom(seed, 'duoNote').pick(DUO_NOTIZ),
    duoLohn: strom(seed, 'duoLohn').pick(DUO_LOHN),
    duoStempel: strom(seed, 'duoStempel').pick(DUO_STEMPEL),
  };
}

/* ================= 版面 ================= */

// 竖版剪报：宽高比 0.74，居中，四周留边
function blattGeometrie() {
  const rand = 26;
  const w = Math.min(innerWidth - rand * 2, (innerHeight - rand * 2 - 40) * .74, 600);
  const h = w / .74;
  // 手机端纸面顶端让开标题下的导航行（底部 89）；
  // 桌面窄窗时右上导航只会压到纸角的撕边空白，可读内容从报头起，不算叠
  const oben = innerWidth < 720 ? 100 : rand;
  return { x: (innerWidth - w) / 2, y: Math.max(oben, (innerHeight - 40 - h) / 2), w, h };
}

let uiStift = null, uiTick = -1;
let txMemo = { seed: -1, tx: null };          // 文案按种子记忆：不每帧重掷
let rissMemo = { key: '', pts: null };        // 撕纸边多边形同理（只随种子与尺寸变）

function zeichneBlatt(t) {
  const g = blattGeometrie();
  const tick = Math.floor(t * 8);
  if (uiTick !== tick) { uiStift = makeStift(ctx, saat * 3 + 1, TINTE, 1, tick); uiTick = tick; }
  const s = uiStift;
  if (txMemo.seed !== saat) txMemo = { seed: saat, tx: texte(saat) };
  const tx = txMemo.tx;
  const P = g.x, Q = g.y, W = g.w, H = g.h;
  const p = W * .07;   // 版心边距

  // 撕纸边：外缘锯齿的多边形，填一层比纸面略亮的纸色，剪报是从报纸上撕下来的
  const rissKey = `${saat}|${Math.round(W)}|${Math.round(H)}|${Math.round(P)}|${Math.round(Q)}`;
  if (rissMemo.key !== rissKey) {
    const rand = strom(saat, 'riss');
    const esa = 3.2, es = W * .022;
    const pts = [];
    for (let i = 0; i <= Math.ceil(W / esa); i++) pts.push([P + i * esa, Q + rand.range(-es, es)]);
    for (let i = 0; i <= Math.ceil(H / esa); i++) pts.push([P + W + rand.range(-es, es), Q + i * esa]);
    for (let i = Math.ceil(W / esa); i >= 0; i--) pts.push([P + i * esa, Q + H + rand.range(-es, es)]);
    for (let i = Math.ceil(H / esa); i >= 0; i--) pts.push([P + rand.range(-es, es), Q + i * esa]);
    rissMemo = { key: rissKey, pts };
  }
  ctx.beginPath();
  rissMemo.pts.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
  ctx.closePath();
  ctx.fillStyle = '#fbf8f1';
  ctx.fill();
  // 纸纹回到纸片上：不透明纸色会把整页 grain 盖掉，趁路径还在补一层
  ctx.fillStyle = grainPattern;
  ctx.fill();
  // 右下一点点投影线，纸片浮在桌面的暗示
  s.zug([
    { x: P + W + 3, y: Q + 6 }, { x: P + W + 3, y: Q + H + 3 }, { x: P + 6, y: Q + H + 3 },
  ], { spur: 'schatten', w: 1.4, deckung: .12, eckig: true });

  // 报头 + 日期栏
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2e2839';
  ctx.font = `bold ${Math.round(W * .088)}px "Courier New", ui-monospace, monospace`;
  try { ctx.letterSpacing = `${Math.round(W * .012)}px`; } catch (e) { /* 旧浏览器忽略 */ }
  ctx.fillText(tx.blatt, P + W / 2, Q + p + W * .05);
  ctx.font = `${Math.round(W * .03)}px "Courier New", monospace`;
  ctx.fillStyle = '#7a7268';
  try { ctx.letterSpacing = '1px'; } catch (e) { /* 旧浏览器忽略 */ }
  ctx.fillText(`${tx.datum} · ${tx.ausgabe} · 本报通讯员 手绘`, P + W / 2, Q + p + W * .105);
  ctx.restore();
  // 报头下的双细线
  s.zug([{ x: P + p, y: Q + p + W * .14 }, { x: P + W - p, y: Q + p + W * .14 }], { spur: 'linie-a', w: 1.3, deckung: .8, eckig: true });
  s.zug([{ x: P + p, y: Q + p + W * .155 }, { x: P + W - p, y: Q + p + W * .155 }], { spur: 'linie-b', w: .8, deckung: .5, eckig: true });

  // 版式由种子分派：寻人启事（单肖像）或头版（双肖像），同种子永远是同一版
  if (strom(saat, 'layout').n() < .5) zeichneFront(t, s, tx, P, Q, W, H, p);
  else zeichneSucht(t, s, tx, P, Q, W, H, p);
}

/* —— 两种版式共用的三件套：双栏铅字 / 折痕 / 印章，只是落点不同 —— */

function spalten(s, tx, P, Q, W, H, p, spaltenY) {
  // 双栏铅字：栏间一道细线，行距松，铅灰色
  const spaltenH = Q + H - p * 1.2 - spaltenY;
  const gut = W * .05;
  const spW = (W - p * 2 - gut) / 2;
  const zeilenH = W * .05;
  const passt = Math.max(2, Math.floor(spaltenH / zeilenH));
  ctx.save();
  ctx.font = `${Math.round(W * .024)}px "Courier New", monospace`;
  ctx.fillStyle = '#6f6a63';
  ctx.textBaseline = 'top';
  for (let i = 0; i < passt; i++) {
    const spalte = i % 2, zeile = Math.floor(i / 2);
    ctx.fillText(tx.zeilen[i % tx.zeilen.length], P + p + spalte * (spW + gut), spaltenY + zeile * zeilenH, spW);
  }
  ctx.restore();
  s.zug([
    { x: P + W / 2, y: spaltenY - zeilenH * .35 }, { x: P + W / 2, y: spaltenY + Math.ceil(passt / 2) * zeilenH - zeilenH * .2 },
  ], { spur: 'spalte', w: .8, deckung: .45, eckig: true });
}

function falte(s, P, W, fy) {
  // 一道折痕：横贯纸面的压痕与错位高光，纸片被折过又摊平（正好压过肖像）
  s.zug([{ x: P + 4, y: fy }, { x: P + W * .5, y: fy + 4 }, { x: P + W - 4, y: fy + 1 }],
    { spur: 'falte', w: 1.1, deckung: .14, eckig: true });
  s.zug([{ x: P + 4, y: fy + 2.5 }, { x: P + W - 4, y: fy + 3.5 }],
    { spur: 'falteLicht', w: .8, deckung: .09, eckig: true, farbe: '#fffdf6' });
}

function stempel(tx, W, p, ax, ay, text) {
  // 朱红印章：压在标题右端，双框 + 楷体，微微歪
  ctx.save();
  const stW = W * .14, stH = W * .1;
  ctx.translate(ax, ay);
  ctx.rotate(-.12);
  ctx.strokeStyle = STEMPEL_ROT;
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = .8;
  ctx.strokeRect(-stW / 2, -stH / 2, stW, stH);
  ctx.lineWidth = 1;
  ctx.strokeRect(-stW / 2 + 3, -stH / 2 + 3, stW - 6, stH - 6);
  ctx.fillStyle = STEMPEL_ROT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(W * .034)}px "Kaiti", "STKaiti", "楷体", serif`;
  ctx.fillText(text || tx.stempel, 0, 1);
  ctx.restore();
}

/* —— 版式一 · 寻人启事：居中一帧大肖像（原版式原样搬入） —— */

function zeichneSucht(t, s, tx, P, Q, W, H, p) {
  // 通栏标题
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2e2839';
  ctx.font = `bold ${Math.round(W * .062)}px "Courier New", ui-monospace, monospace`;
  ctx.fillText(tx.titel, P + W / 2, Q + p + W * .21);
  ctx.restore();

  // 肖像框：胸像居中（同一套 Head，带肩块），框是手绘细线
  const boxW = W * .5, boxH = W * .58;
  const boxX = P + (W - boxW) / 2, boxY = Q + p + W * .27;
  s.zug([
    { x: boxX, y: boxY }, { x: boxX + boxW, y: boxY },
    { x: boxX + boxW, y: boxY + boxH }, { x: boxX, y: boxY + boxH },
  ], { spur: 'portrait', geschlossen: true, w: 1.2, deckung: .8 });
  const bedarf = raumBedarf(kopf);
  kopf.mass = Math.min(boxW / (2 * bedarf.seite * 1.12), boxH / (bedarf.oben + 2.15));
  kopf.cx = boxX + boxW / 2;
  kopf.cy = boxY + bedarf.oben * kopf.mass + boxH * .07;
  ctx.save();
  ctx.beginPath();
  ctx.rect(boxX, boxY, boxW, boxH);
  ctx.clip();
  drawHead(ctx, kopf, t);
  ctx.restore();

  // 图注 + 悬赏行
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(W * .03)}px "Kaiti", "STKaiti", "楷体", serif`;
  ctx.fillStyle = '#7a7268';
  ctx.fillText(`图：${tx.name}（本报通讯员手绘）`, P + W / 2, boxY + boxH + W * .035);
  ctx.fillStyle = '#2e2839';
  ctx.font = `bold ${Math.round(W * .038)}px "Courier New", monospace`;
  ctx.fillText(tx.lohn, P + W / 2, boxY + boxH + W * .09);
  ctx.restore();

  spalten(s, tx, P, Q, W, H, p, boxY + boxH + W * .13);
  falte(s, P, W, Q + H * .58);
  stempel(tx, W, p, P + W - p - W * .077, Q + p + W * .21);
}

/* —— 版式二 · 头版：通栏大标题 + 并排两帧小肖像（第二张脸 saat+1013） —— */

function zeichneFront(t, s, tx, P, Q, W, H, p) {
  // 通栏大标题：字号比寻人版大一档，位置不动
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2e2839';
  ctx.font = `bold ${Math.round(W * .07)}px "Courier New", ui-monospace, monospace`;
  ctx.fillText(tx.duoTitel, P + W / 2, Q + p + W * .21);
  ctx.restore();

  // 并排两帧肖像：两框加一道中缝严格居中
  const boxW = W * .4, boxH = W * .46, gut = W * .05;
  const rahmenY = Q + p + W * .27;
  const x1 = P + (W - boxW * 2 - gut) / 2, x2 = x1 + boxW + gut;
  [[x1, 'portraitA'], [x2, 'portraitB']].forEach(([bx, spur]) => {
    s.zug([
      { x: bx, y: rahmenY }, { x: bx + boxW, y: rahmenY },
      { x: bx + boxW, y: rahmenY + boxH }, { x: bx, y: rahmenY + boxH },
    ], { spur, geschlossen: true, w: 1.2, deckung: .8 });
  });
  const brust = (h, bx) => {
    const bedarf = raumBedarf(h);
    h.mass = Math.min(boxW / (2 * bedarf.seite * 1.12), boxH / (bedarf.oben + 2.15));
    h.cx = bx + boxW / 2;
    h.cy = rahmenY + bedarf.oben * h.mass + boxH * .07;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, rahmenY, boxW, boxH);
    ctx.clip();
    drawHead(ctx, h, t);
    ctx.restore();
  };
  brust(kopf, x1);
  brust(kopf2, x2);

  // 中缝竖排编者按（canvas 没有竖排，逐字下落）
  ctx.save();
  ctx.font = `${Math.round(W * .024)}px "Kaiti", "STKaiti", "楷体", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7a7268';
  [...tx.duoNote].forEach((zi, i) => ctx.fillText(zi, x1 + boxW + gut / 2, rahmenY + W * .045 + i * W * .034));
  ctx.restore();

  // 图注两行：各报一人 + 通栏结论行
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(W * .03)}px "Kaiti", "STKaiti", "楷体", serif`;
  ctx.fillStyle = '#7a7268';
  ctx.fillText(`图左：${tx.name}（本报摹绘）`, x1 + boxW / 2, rahmenY + boxH + W * .033);
  ctx.fillText(`图右：${tx.name2}（读者供图）`, x2 + boxW / 2, rahmenY + boxH + W * .033);
  ctx.fillStyle = '#2e2839';
  ctx.font = `bold ${Math.round(W * .038)}px "Courier New", monospace`;
  ctx.fillText(tx.duoLohn, P + W / 2, rahmenY + boxH + W * .075);
  ctx.restore();

  spalten(s, tx, P, Q, W, H, p, rahmenY + boxH + W * .115);
  falte(s, P, W, Q + H * .47);   // 头版折痕压在两帧肖像的胸口带（避开框底的肩块裁切线）
  stempel(tx, W, p, P + W - p - W * .077, Q + p + W * .215, tx.duoStempel);
}

/* ================= 主循环与按钮 ================= */

let vorige = 0;
function rahmen(now) {
  const t = now / 1000;
  const dt = vorige ? Math.min(t - vorige, .05) : .016;
  vorige = t;
  // 胸像也轻轻呼吸/眨眼：update 驱动状态，drawHead 读它；
  // 头版第二张脸用死指针——只呼吸眨眼，不跟着鼠标转头
  kopf.update(dt, t, pointer);
  kopf2.update(dt, t, TOTER_ZEIGER);
  papier();
  zeichneBlatt(t);
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

document.getElementById('neues').addEventListener('click', () => {
  kopf = neuesKopf((Math.random() * 1e9) | 0);
  kopf2 = zweitKopf(saat + 1013);   // 头版第二张脸跟着换，别让脸和文案对不上
  try { history.replaceState(null, '', '?seed=' + saat); } catch (e) { /* file:// 可能拒绝 */ }
});

// 存图片：把剪报区域从主画布裁出导出 PNG（零依赖）；四周外扩一点，撕纸边完整入图
document.getElementById('speicher').addEventListener('click', () => {
  const g = blattGeometrie();
  const ex = Math.max(0, g.x - g.w * .03), ey = Math.max(0, g.y - g.w * .03);
  const ew = Math.min(innerWidth - ex, g.w * 1.06), eh = Math.min(innerHeight - ey, g.h + g.w * .06);
  const out = document.createElement('canvas');
  out.width = Math.round(ew * 2);
  out.height = Math.round(eh * 2);
  const oc = out.getContext('2d');
  oc.drawImage(canvas, ex * dpr, ey * dpr, ew * dpr, eh * dpr, 0, 0, out.width, out.height);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `papiere-zeitung-${saat}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
});
