# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS（建议攒一次手动会话专门做；clip/avatar/photo 间逐字重复的 TINTE/saat-IIFE/neuesKopf/resize/rahmen 壳清单已在 2026-09-10 维护轮审查中枚举）
2. photo 墨渍 resize 后悬空/入地：mauernFlecken 存绝对坐标（photo.js:410），架子线随窗口变——改存 (x 分数, reihe) 绘制时重投影（clip.js:139 同款解法）
3. crowd 名字错行不链式（crowd.js:112-121 break）：320 窄屏前 12 名三连撞，改成逐级试 17/34/51
4. crowd 滑块末端被「换一群」按钮盖住（760-835px 宽带内，恰盖住满 500 触发区）：按钮 display 阈值 759 提到 ~840，或滑块改 min(520, calc(100vw - 220px))
5. photo 二选一期间点换班/过滤器吞道具奖励：neueKlasse 开头 draftPick(0) 自动收左卡（photo.js:383）；顺手换班全员走 'kommen' 入场
6. 性能：crowd 精灵 12fps 同步尖峰（全部同帧失效，每 83ms 连做 48 次 drawHead——随机相位摊平）+ resize 全量重建（mass 量化到 2%）；photo 的 papier() 与拍立得可离屏 memo（两页共享，约省一半每帧开销）
7. 机会：crowd 点击逗人挥手（~5 行，引擎 setAktion 现成）；photo 水彩孩子离场留淡彩痕（mauernFlecken 加 watercolour 分支）
