# MAINTENANCE.md —— 自动维护日志

> 由每天 21:00 的自动维护任务（以及手动试运行）持续维护：记录每轮做了什么、对标调研发现、留给下一轮的想法。

## 2026-08-27（手动试运行）

### 预览
GitHub Pages 已开启，在线预览：https://selenave-d.github.io/face/ （子页：heads.html / photo.html / crowd.html，均为相对路径，随 main 分支自动更新）。夜间维护做视觉检查时直接开这个地址。

### 本轮改动
- **fix(foto) doodle.js —— 按真实头宽落位**：垂耳/熊耳/猫耳/兔耳/角的耳根横向定位、眼镜镜腿终点、耳侧墨斑中心，此前用不含头宽系数 `wf`（和宽脸加成）的 `R`，窄头（wf<1）时全部悬空或飘出轮廓；现在统一用真实半宽 `RX`。镜片随两眼间距收放（窄脸不再叠在鼻梁上），镜桥保底长度，睡着的吻部角色画闭小嘴（不再吐舌睡），怒眼斜向改为内低外高与怒眉同向。
- **fix(foto) photo.js —— 道具卡与兼容性**：入场过冲曲线改为中途过冲约 8% 后**回落到原尺寸**（此前永久停在 1.19 倍，可见卡片比点击命中框大一圈）；`ctx.roundRect` 加 `arcTo` 兜底（旧 Safari 抛 TypeError 会把整个 rAF 循环冻死在纸底）。
- **清理**：删除 `musterVon`（零调用）、`ART_KURZ`（与 doodle.js 的 `ART_NAME` 重复，改引用后者）、`zeichneNase` 冗余分支、`torso.dark` 的 `&& false` 死表达式、拍照齐跳错峰的 `[...gewaehlt].indexOf` 改计数器。

### 对标调研
- avatar-presse 原体的公开技术资料很少；同赛道可借鉴：
  - [DiceBear](https://www.dicebear.com/)：61 种风格、**种子即 URL**，分享/复现任意头像——本项目换头像纯随机不写 URL，正好缺这个。
  - [Line Wobbler](https://github.com/cadin/line-wobbler)（顶点位移抖线）：本项目排线（doodle.js `hatch`）中段仍是纯直线，可用同手法加中间抖动点。

### 下一步想法（按优先级）
1. **app.js `drawHead` 层序**：眼镜画在头发/帽子之上（约 2779 行），镜圈上缘该被刘海/帽檐盖住——把 `drawGlasses` 移到 `drawHair` 之前。〔画面·高〕
2. **WAND 一墙脸悬空领口**：画了脖子方块和 V 领却不画身体（约 2720 行），约七成墙脸挂着悬空领口——传 `'keiner'` 或补肩部三角收边成正式胸像。〔画面·高〕
3. **?seed= 分享**：index/heads 的换头像写入 URL（`history.replaceState`），DiceBear 同款体验。〔体验·中〕
4. **crowd 性能**：48 人逐帧全量重算几何（颅骨点云投影 6205 点/人/帧），按 8fps tick 缓存离屏 canvas，或后排降采样。〔性能·中〕
5. **排线手绘感**：`hatch` 中段加 1–2 个抖动点、按部件给 ±0.15rad 角度差；`dot` 改 wobbly 多边形（app.js `punkt` 已有现成画法）。〔画面·中〕
6. **zwinker 永远眨左眼**（app.js 约 917 行）：按 `dna.seite` 换边并接入眨眼周期。〔画面·低〕
7. 小尾巴：兔耳外侧根部在窄头上仍有约 .07R 的横向出挑（读作耳厚，可再收）；眉骨墨斑在宽距猫眼（sx>1.3）下可能贴到轮廓边。〔画面·低〕
8. **去重**：doodle.js/app.js 两套 RNG 与笔引擎、三页复制的标题 CSS，抽公共文件。〔代码·低〕
9. **新玩法候选**（保持版画基调）：报纸剪报/通缉令生成器（撕纸边+朱红印章）、拍照后"冲洗合影"贴纸角标、墨水孩子离场留渍。
