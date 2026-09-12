# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS（建议攒一次手动会话专门做；clip/avatar/photo 间逐字重复的 TINTE/saat-IIFE/neuesKopf/resize/rahmen 壳清单已在 2026-09-10 维护轮审查中枚举）
2. 性能（方案已于 2026-09-12 维护轮设计并论证）：crowd 精灵 key 加每人随机相位摊平 83ms 同步尖峰（48×drawHead/帧→~10）+ resize 时 mass0 量化 2% 防全量重建（配套 sp.topY 每帧校正）；photo/crowd 的 papier() 改「先画再拓」离屏 memo（共享函数签名不动，约省 2-10ms/帧）；photo 拍立得按 (tick8,qt12) memo（重绘 60→12 次/s）
3. photo 水彩孩子离场留淡彩痕：mauernFlecken 加 watercolour 分支（WASH_POOL 淡彩圆，结构与马克笔划痕平行），把「墙上的记忆」补全到全部介质
4. avatar 增强：舞台内偏 3.5px 双线印框（证件照卡纸语言）；舞台下档案号小注 № {saat%10000}（拍立得日期角标同族，顺手补 __avatar.blick 调试钩子）；后台恢复后 blinzPlan 过期项清理由逐条 shift 改 filter
