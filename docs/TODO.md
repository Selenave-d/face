# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS。2026-09-19 复核（b27a6fa 后）：六页 <style> 共 316 行、逐字重复 193 行（61%）——#titel×6、.sprung×6、focus-visible×6、719 核心 5 行×6、720-759×6、#leiste×5（md5 全核）；净删估计 ~185-190 行。JS 壳现状：TINTE×3 与 saat-IIFE×2、resize×2 仍逐字同；neuesKopf（clip/avatar）代码同注释漂移、rahmen（photo 有 __freezeT 钩子）为同构壳——手动会话按「逐字搬走 + 同构参数化」两档处理（建议攒一次手动会话专门做）
2. 性能：photo 页 10 个 doodle 孩子直绘无精灵（量小优先级低，卡顿时照 crowd kopfSprite 同法收敛）；clip 嘟囔/眨眼 16fps 窗口内是整页重烘，可改双层记忆（静态纸面一张 + 胸像框 dirty-rect 单独重采，低配移动端受益）
3. 引擎议题：动作位移 pose.dx/dy 对身体施加两次、对头只一次——单人页跳跃的脖颈错位 ≤dy（下蹲顶约 7px，被颅骨/领口盖住），改单次会全体动作动感减半，需单独设计（如 Y() 用半量）
4. 画面观察项（app.js 未审角落）：近侧耳朵整片平涂画在颅骨明暗渐变之后，塞进颅内的 tuck 会盖掉侧脸阴影（~2201）；耳环遮挡白名单缺 zoepfe（双辫垂耳侧，辫上浮耳环）；hutGeo.kuppe 只覆盖 igel/antenne，dutt/zoepfe/lockenwolke 戴帽时帽冠可能切进发包（~2107）；远侧耳环 nz∈(-.1,0) 边缘区画最顶层浮在脸颊上（~1372）；鼻长只跟 skala 不跟颅骨 ry 联动；镜圈/knopf 鼻 wackel .003 偏硬可提 .005；镜框贴眉/镜梁横鼻梁——实拍判定「写实可接受」留观
5. 交叉残留：erfasseBlatt 用 min(canvas.width-bx,…) 截断 memo——<~475px 视口纸右缘被裁，命中帧缺右缘/miss 帧完整的闪烁（导出已改读 memo 不受影响，显示层待修：memo 尺寸不足时强制走全画）；photo 墨渍 y 公式手工复制 platzieren 的 k 公式（236 vs 854，宜抽共享）
6. 角色配方语义瑕疵：sprout/bolt/flower 在 doodleDims 全落「无」桶（头上顶花按什么都没长计分且被封顶）——修法需评估对 无 桶占比（64.7%→约 45%）与 MANGEL 压制力的联动；afro/lockenwolke 权重 0.4% 入场券太狠（六套轮廓参数几乎抽不到）
7. 机会：放大视图四角印刷裁切线+日期小注；photo 凑齐征集令后班级种子写进 crowd URL；crowd 滑满 500 烟花定格送进 clip 生成「号外」；photo 累计分兑「墨水」解锁 crowd 稀有物种；heads 认脸考试（口令限时点中）；图鉴页（六物种×四介质集邮墙）；clip 头版加「读者来信」第三张小脸（saat+2026 纯函数零状态）；crowd 12/48/500 档位吸附时里程碑合影（全员面向镜头+拍立得白带）；heads 点两颗头进「对视模式」并排互看
