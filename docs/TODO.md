# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS。2026-09-19 复核（b27a6fa 后）：六页 <style> 共 316 行、逐字重复 193 行（61%）——#titel×6、.sprung×6、focus-visible×6、719 核心 5 行×6、720-759×6、#leiste×5（md5 全核）；净删估计 ~185-190 行。JS 壳现状：TINTE×3 与 saat-IIFE×2、resize×2 仍逐字同；neuesKopf（clip/avatar）代码同注释漂移、rahmen（photo 有 __freezeT 钩子）为同构壳——手动会话按「逐字搬走 + 同构参数化」两档处理（建议攒一次手动会话专门做）
2. 性能：photo 页 10 个 doodle 孩子直绘无精灵（量小优先级低）；photo 道具卡（拥有栏 6 张+二选一 2 张）与 crowd 影子（500×3 笔画/帧）每帧全量重绘可烘离屏；avatar 胸像整页 60fps 直绘是六页唯一没套整页记忆的热点（clip 有整套 blattMemo 方案可照抄）；clip 嘟囔/眨眼 16fps 窗口内是整页重烘，可改双层记忆
3. 引擎议题：动作位移 pose.dx/dy 对身体施加两次、对头只一次——单人页跳跃的脖颈错位 ≤dy（下蹲顶约 7px，被颅骨/领口盖住），改单次会全体动作动感减半，需单独设计（如 Y() 用半量）
4. 画面观察项（剩余）：鼻长只跟 skala 不跟颅骨 ry 联动；镜圈/knopf 鼻 wackel .003 偏硬可提 .005；镜框贴眉/镜梁横鼻梁——实拍判定「写实可接受」留观；「换一个」按钮无键帽与提示；avatar 导出的 grain 颗粒在 retina 屏显与 1x PNG 粗细差一倍（pattern 无 setTransform）；heads 放大态矮横屏下胸像底可钻进按钮带；photo raus→rein 途中 resize 新面孔 ox0 按旧窗宽滑入；crowd 庆祝中 resize 在飞火箭按绝对像素错位最长 1.3s（宜存分数坐标）；photo 玩偶中段幻影（[3,2] 满堂红被注入成 [3,3] 跌三条——根治需每维双算取高）；app.js walk/dance 身体起伏没做踝补偿（支撑脚浮空 3-5px，jump 有完整 fy 补偿可照抄）；rock 裙配 jump 矮个收腿鞋悬裙面读作穿模；橡皮升级后 banner 细节串还是升级前的一对措辞。已修（2026-10-28）：wave 休息臂偏移乘 si 向身体收；六页 nav 地标 + color-scheme + 三处 aria-pressed；存档 params 家族字段校验（denglong 缺 r 会 NaN 总分归零）
4b. a11y 小会话候选（剩余）：favicon（内联 SVG 纸+墨点，可搭去重会话）；prefers-reduced-motion（tick 恒定冻结静帧）
5. 交叉残留：erfasseBlatt 用 min(canvas.width-bx,…) 截断 memo——<~475px 视口纸右缘被裁，命中帧缺右缘/miss 帧完整的闪烁（导出已改读 memo 不受影响，显示层待修：memo 尺寸不足时强制走全画）；photo 墨渍 y 公式手工复制 platzieren 的 k 公式（236 vs 854，宜抽共享）
6. 角色配方语义瑕疵：sprout/bolt/flower 在 doodleDims 全落「无」桶（头上顶花按什么都没长计分且被封顶）——修法需评估对 无 桶占比（64.7%→约 45%）与 MANGEL 压制力的联动；afro/lockenwolke 权重 0.4% 入场券太狠（六套轮廓参数几乎抽不到）
7. 机会：玩偶补「魇」款第六种（roll 加 alp+画小角，补齐猎牌物种洞）；征集令连击（连两班命中第三班目标自动换未集齐高难牌型×2，复用跨班记忆零新字段）；快门吐片过场（贴纸从右上相机口滑落右下，与白闪齐跳同族演出）；photo 道具「借出」机制（顺带统一灯笼按件叠/旗帜喇叭只生效一次）；调色板收编（#b0654a/#a89f93/#8b8894 跨文件硬编码常量化；顺手消灭 mulberry32 浮点乘低位量化统一到 Math.imul 版）；墨渍墙按介质分家；crowd 烟花取寿星 pal.akzent；分享按钮（?seed= 已有写回无入口）；放大视图裁切角标；photo 班级种子进 crowd URL；crowd 500 烟花进 clip「号外」；heads 认脸考试；图鉴页；clip 读者来信第三脸；heads 对视模式；crowd 混物种；clip 表情连拍；avatar 正面锁按钮
