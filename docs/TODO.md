# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS。2026-09-19 复核（b27a6fa 后）：六页 <style> 共 316 行、逐字重复 193 行（61%）——#titel×6、.sprung×6、focus-visible×6、719 核心 5 行×6、720-759×6、#leiste×5（md5 全核）；净删估计 ~185-190 行。JS 壳现状：TINTE×3 与 saat-IIFE×2、resize×2 仍逐字同；neuesKopf（clip/avatar）代码同注释漂移、rahmen（photo 有 __freezeT 钩子）为同构壳——手动会话按「逐字搬走 + 同构参数化」两档处理（建议攒一次手动会话专门做）
2. 手绘感补墨（剩余）：photo 计分牌/征集令 Courier 文字按 clip 同法加行墨抖动（druckZeile 在 clip.js，photo 可复制参数思路）——clip 三版式已于 2026-09-22 落地（行墨压 + 标题套印重影）
3. 性能：heads 整墙精灵缓存——方案已核实（2026-09-22）：照 crowd.js kopfSprite 骨架加 kopfSpriteWand(head,t)，键 `${floor((t+phase)*12*schnell)}|${round(mass*10)}|${sdpr}`（sdpr=min(dpr,1.5)，crowd 键漏 dpr 是隐患别照抄），名字不进精灵；layout WAND 分支须给 mass 做 2% 的 2 的幂量化（否则 resize 击穿 12 张）；放大态 vergroessert≥0 直接绕过精灵保留 drawHead 直绘；预估头部绘制成本降 70-80%；clip 整页按 Math.floor(t*8) 量化离屏（四页中唯一零缓存）
4. 引擎议题：动作位移 pose.dx/dy 对身体施加两次、对头只一次——单人页跳跃的脖颈错位 ≤dy（下蹲顶约 7px，被颅骨/领口盖住），改单次会全体动作动感减半，需单独设计（如 Y() 用半量）
5. 画面观察项：鼻长只跟特征缩放 skala 不跟颅骨 ry 联动（长脸短鼻/圆脸长鼻，messeGroessen nase 项）；镜圈/knopf 鼻 wackel .003 偏硬可提 .005；镜框上缘贴眉、镜梁横鼻梁——2026-09-21 实拍判定为「写实可接受」不修，留观
6. HTML/CSS 层瑕疵（剩余）：photo 导航「拍合影」vs title「班级合影」文案变体待定夺（crowd 窄屏计数带贴边已于 2026-09-22 以 TITEL_RAUM 150 收口）
7. 角色配方语义瑕疵：sprout/bolt/flower 在 doodleDims 全落「无」桶（头上顶花按什么都没长计分且被封顶）——修法需评估对 无 桶占比（64.7%→约 45%）与 MANGEL 压制力的联动；afro/lockenwolke 权重 0.4% 入场券太狠（六套轮廓参数几乎抽不到）
8. 机会：放大视图四角印刷裁切线+日期小注（「从墙上剪下来细看」）；photo 凑齐征集令后班级种子写进 crowd URL（一班孩子直接站上「一群朋友」页）；crowd 拉满 500 的烟花定格送进 clip 生成「号外」；photo 累计分兑「墨水」解锁 crowd 稀有物种出现率
