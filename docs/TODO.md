# 待办候选

> 自动维护任务的选题池：做完一条删一条；也欢迎手动补。

1. 去重：doodle.js / app.js 两套 RNG 与笔引擎、三页复制的标题 CSS。2026-09-19 复核（b27a6fa 后）：六页 <style> 共 316 行、逐字重复 193 行（61%）——#titel×6、.sprung×6、focus-visible×6、719 核心 5 行×6、720-759×6、#leiste×5（md5 全核）；净删估计 ~185-190 行。JS 壳现状：TINTE×3 与 saat-IIFE×2、resize×2 仍逐字同；neuesKopf（clip/avatar）代码同注释漂移、rahmen（photo 有 __freezeT 钩子）为同构壳——手动会话按「逐字搬走 + 同构参数化」两档处理（建议攒一次手动会话专门做）
2. 性能：photo 页 10 个 doodle 孩子直绘无精灵（量小优先级低，卡顿时照 crowd kopfSprite 同法收敛）；clip 嘟囔/眨眼 16fps 窗口内是整页重烘，可改双层记忆（静态纸面一张 + 胸像框 dirty-rect 单独重采，低配移动端受益）
3. 引擎议题：动作位移 pose.dx/dy 对身体施加两次、对头只一次——单人页跳跃的脖颈错位 ≤dy（下蹲顶约 7px，被颅骨/领口盖住），改单次会全体动作动感减半，需单独设计（如 Y() 用半量）
4. 画面观察项（剩余）：鼻长只跟 skala 不跟颅骨 ry 联动；镜圈/knopf 鼻 wackel .003 偏硬可提 .005；镜框贴眉/镜梁横鼻梁——实拍判定「写实可接受」留观；「换一个」按钮无键帽与提示；avatar 导出的 grain 颗粒在 retina 屏显与 1x PNG 粗细差一倍（pattern 无 setTransform）；heads 放大态矮横屏下胸像底可钻进按钮带；photo raus→rein 途中 resize 新面孔 ox0 按旧窗宽滑入；crowd 庆祝中 resize 在飞火箭按绝对像素错位最长 1.3s（宜存分数坐标）；photo 玩偶中段幻影（[3,2] 满堂红被注入成 [3,3] 跌三条——根治需每维双算取高，改动面大暂守卫顶层）。已修（2026-10-27）：doodle 介质三件（marker 浅肤 .25 与贴纸一致、dot 软耦合介质 alpha、marker 深肤排线 .6 收细纹理回来）；photo 顶层幻影（全员互异不注入，彩虹班与旗帜联动救活）；GPU 上下文恢复自愈（app/crowd/clip 三层缓存置空）；clip 存图 saat 竞态（导出前校验重采）
4b. a11y 小会话候选：六页 .sprung 包 <nav aria-label>（读屏地标）；.ak/.filter/#gesichte 的激活态同步 aria-pressed（三处仅 class 表状态）；六页补 <meta name="color-scheme" content="light">（防 UA 暗色渲染表单控件）；favicon（内联 SVG 纸+墨点，可搭去重会话）；prefers-reduced-motion（tick 恒定冻结静帧）
5. 交叉残留：erfasseBlatt 用 min(canvas.width-bx,…) 截断 memo——<~475px 视口纸右缘被裁，命中帧缺右缘/miss 帧完整的闪烁（导出已改读 memo 不受影响，显示层待修：memo 尺寸不足时强制走全画）；photo 墨渍 y 公式手工复制 platzieren 的 k 公式（236 vs 854，宜抽共享）
6. 角色配方语义瑕疵：sprout/bolt/flower 在 doodleDims 全落「无」桶（头上顶花按什么都没长计分且被封顶）——修法需评估对 无 桶占比（64.7%→约 45%）与 MANGEL 压制力的联动；afro/lockenwolke 权重 0.4% 入场券太狠（六套轮廓参数几乎抽不到）
7. 机会：photo 道具加一次性「借出」机制（拍照时消耗换当场大倍率——顺带补上道具用完出列路径；现生效语义不一致：灯笼按件叠、旗帜/喇叭只生效一次，宜统一）；调色板收编（#b0654a 朱红跨 clip/avatar/photo 三处硬编码、UI 灰阶 #a89f93/#8b8894 跨 3-4 文件——app.js 导出 UI_ROT/常量防漂移；顺手消灭 app.js mulberry32 浮点乘低位量化，统一到 doodle 的 Math.imul 版）；墨渍墙按介质分家（水彩晕渍/marker 渗透印）；crowd 烟花取寿星自己的 pal.akzent；分享按钮（index/clip 已有 ?seed= 写回却无入口，走 navigator.share/剪贴板）；放大视图四角裁切角标；photo 班级种子进 crowd URL；crowd 500 烟花进 clip「号外」；heads 认脸考试；图鉴页；clip 读者来信第三脸；heads 对视模式；crowd 混物种；clip 表情连拍；avatar 正面锁按钮
