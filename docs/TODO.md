# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS。2026-09-19 复核（b27a6fa 后）：六页 <style> 共 316 行、逐字重复 193 行（61%）——#titel×6、.sprung×6、focus-visible×6、719 核心 5 行×6、720-759×6、#leiste×5（md5 全核）；净删估计 ~185-190 行。JS 壳现状：TINTE×3 与 saat-IIFE×2、resize×2 仍逐字同；neuesKopf（clip/avatar）代码同注释漂移、rahmen（photo 有 __freezeT 钩子）为同构壳——手动会话按「逐字搬走 + 同构参数化」两档处理（建议攒一次手动会话专门做）
2. avatar 增强：舞台内偏 3.5px 双线印框（证件照卡纸语言）；舞台下档案号小注 № {saat%10000}（拍立得日期角标同族，顺手补 __avatar.blick 调试钩子）；后台恢复后 blinzPlan 过期项清理由逐条 shift 改 filter
3. 引擎议题：动作位移 pose.dx/dy 对身体施加两次（drawHead translate + drawBody Y() 各一次）、对头只一次——单人页跳跃的脖颈错位 ≤dy（下蹲顶约 7px，被颅骨/领口盖住），改单次会全体动作动感减半，需单独设计（如 Y() 用半量）
4. HTML/CSS 层瑕疵（剩余）：photo 导航「拍合影」vs title「班级合影」文案变体待定夺
5. 角色配方语义瑕疵：sprout/bolt/flower 在 doodleDims 全落「无」桶（头上顶花按什么都没长计分且被封顶）——修法需评估对 无 桶占比（64.7%→约 45%）与 MANGEL 压制力的联动
6. 机会：放大视图四角印刷裁切线+日期小注（「从墙上剪下来细看」）；clip 印章「油墨不匀」第二遍错位描边（~4 行）；clip 双栏假文压排 67% 可截 16 字（设计取舍）；app.js afro 0.4% 入场券太狠（六套轮廓参数几乎抽不到）
