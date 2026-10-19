# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS。2026-09-19 复核（b27a6fa 后）：六页 <style> 共 316 行、逐字重复 193 行（61%）——#titel×6、.sprung×6、focus-visible×6、719 核心 5 行×6、720-759×6、#leiste×5（md5 全核）；净删估计 ~185-190 行。JS 壳现状：TINTE×3 与 saat-IIFE×2、resize×2 仍逐字同；neuesKopf（clip/avatar）代码同注释漂移、rahmen（photo 有 __freezeT 钩子）为同构壳——手动会话按「逐字搬走 + 同构参数化」两档处理（建议攒一次手动会话专门做）
2. 性能：photo 页 10 个 doodle 孩子直绘无精灵（量小优先级低，卡顿时照 crowd kopfSprite 同法收敛）；clip 嘟囔/眨眼 16fps 窗口内是整页重烘，可改双层记忆（静态纸面一张 + 胸像框 dirty-rect 单独重采，低配移动端受益）
3. 引擎议题：动作位移 pose.dx/dy 对身体施加两次、对头只一次——单人页跳跃的脖颈错位 ≤dy（下蹲顶约 7px，被颅骨/领口盖住），改单次会全体动作动感减半，需单独设计（如 Y() 用半量）
4. 画面观察项（剩余）：鼻长只跟 skala 不跟颅骨 ry 联动；镜圈/knopf 鼻 wackel .003 偏硬可提 .005；镜框贴眉/镜梁横鼻梁——实拍判定「写实可接受」留观；「换一个」按钮无键帽与提示、.ak 激活态可同步 aria-pressed；avatar 导出的 grain 颗粒在 retina 屏显与 1x PNG 粗细差一倍（pattern 无 setTransform）；heads 放大态矮横屏下胸像底可钻进按钮带（nameY 封了 62 但 bust 底没同尺约束）；photo raus→rein 途中 resize 新面孔 ox0 按旧窗宽滑入（geht 的 oy 是稳的，仅 ox0 漏网）；crowd 庆祝中 resize 在飞火箭按绝对像素错位最长 1.3s（宜存分数坐标）。已修（2026-10-25）：doodle 表情三件（睡觉 z 外移出耳角区、戴镜怒/怕眉抬到镜片上、吻部物种泪滴外移避吻瓣）；heads 画布 touch-action、photo 拍照按钮过场即禁、crowd 残留烟花清弹
5. 交叉残留：erfasseBlatt 用 min(canvas.width-bx,…) 截断 memo——<~475px 视口纸右缘被裁，命中帧缺右缘/miss 帧完整的闪烁（导出已改读 memo 不受影响，显示层待修：memo 尺寸不足时强制走全画）；photo 墨渍 y 公式手工复制 platzieren 的 k 公式（236 vs 854，宜抽共享）
6. 角色配方语义瑕疵：sprout/bolt/flower 在 doodleDims 全落「无」桶（头上顶花按什么都没长计分且被封顶）——修法需评估对 无 桶占比（64.7%→约 45%）与 MANGEL 压制力的联动；afro/lockenwolke 权重 0.4% 入场券太狠（六套轮廓参数几乎抽不到）
7. 机会：photo 给 jahrbuch/gesamt/besitz 加 localStorage 存档（现全在内存、刷新即清——毕业集邮跨会话追进度，零依赖不破，顺手可做毕业相册页）；放大视图四角印刷裁切线+日期小注；photo 凑齐征集令后班级种子写进 crowd URL；crowd 滑满 500 烟花定格送进 clip 生成「号外」；crowd 烟花拆多档里程碑（100/250 小串）或拉满先全员转身面向镜头半秒再起跳；photo 累计分兑「墨水」解锁 crowd 稀有物种；heads 认脸考试（口令限时点中）；heads 放大态加手写提示行+当前头 ?seed 可复制分享（seed 体系已存在只差入口）；图鉴页（六物种×四介质集邮墙）；clip 头版加「读者来信」第三张小脸；crowd 12/48/500 档位吸附时里程碑合影；heads 点两颗头进「对视模式」并排互看；crowd 混入 doodle 六物种让群像有物种剪影差；clip「表情专栏」贴纸连拍（复用 photo 六表情循环）；avatar「正面证件照」锁做成显式按钮
