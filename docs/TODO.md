# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS。2026-09-16 HTML/CSS 盘点：六页 <style> 约 310 行中 ~190 行（61%）纯重复——#titel 块×6、.sprung 块×6、#leiste 块×5、html/body×6 逐字相同（md5 已核），去重净删 ~180 行；719 媒体查询核心 7 行同但各页注释/特有规则混排需参数化；crowd 的 #andere 是 #leiste button 手抄变体。clip/avatar/photo 间逐字重复的 TINTE/saat-IIFE/neuesKopf/resize/rahmen 壳清单已在 2026-09-10 轮枚举（建议攒一次手动会话专门做）
2. 毕业年鉴（合影玩法第三件，diff 已在 2026-09-16 审查备好）：Set 记达成牌型首达 +200、贴纸白带盖「首」字小印章（静态内容不进拍立得 memo 键）、集齐 7 种全班错峰齐跳毕业照
3. photo 水彩孩子离场留淡彩痕：mauernFlecken 加 watercolour 分支（WASH_POOL 淡彩圆，结构与马克笔划痕平行），把「墙上的记忆」补全到全部介质
4. avatar 增强：舞台内偏 3.5px 双线印框（证件照卡纸语言）；舞台下档案号小注 № {saat%10000}（拍立得日期角标同族，顺手补 __avatar.blick 调试钩子）；后台恢复后 blinzPlan 过期项清理由逐条 shift 改 filter
5. doodle 已知小尾巴（2026-09-14 轮范围外）：haut() 的 flach 暗色仍是灰平涂——深色 wash 角色的头身在贴纸照片里不显介质；配方眼型 closed 仍是 ∪，与新的 ∩ 眨眼弧形状不同
6. 引擎议题：动作位移 pose.dx/dy 对身体施加两次（drawHead translate + drawBody Y() 各一次）、对头只一次——单人页跳跃的脖颈错位 ≤dy（下蹲顶约 7px，被颅骨/领口盖住），改单次会全体动作动感减半，需单独设计（如 Y() 用半量）
7. HTML/CSS 层瑕疵（2026-09-16 盘点）：index.html:58 导航乱序（crowd 排在 heads 前，六页中唯一违反全局顺序）；≤360px crowd 标题 4 行必叠导航且 #zaehler 被盖；六页按钮均无 :focus-visible（crowd 滑块的 1.5px dashed #c9c1b5 值得推广）；六页 canvas 均无 role="img"/aria-label（全站唯一 a11y 空白，crowd 滑块反而是全项目 ARIA 标杆）；photo 导航「拍合影」vs title「班级合影」文案变体待定夺
8. 机会：放大视图四角印刷裁切线+日期小注（「从墙上剪下来细看」，zoom 分支 frame 里画）
