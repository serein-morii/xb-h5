import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

/**
 * 黄桃储存/食用提示
 *
 * 设计：默认折叠为一个小的"📌 黄桃储存小贴士"徽章（只占约 44px 高），
 * 不会与下单/查单主流程抢视觉；点击展开看完整三步说明。
 * 复用到：专属下单页、订单查询页（public 工具页 / signed 详情页）。
 */
export default function PeachTip() {
  const [open, setOpen] = useState(false);
  return (
    <section className={`peach-tip ${open ? "open" : ""}`} aria-label="黄桃储存和食用方式">
      <button type="button" className="peach-tip-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="peach-tip-badge"><Sparkles size={14} />黄桃储存小贴士</span>
        <span className="peach-tip-state">{open ? "收起" : "查看"}</span>
        <ChevronDown size={15} className="peach-tip-chevron" />
      </button>
      {open ? <div className="peach-tip-body">
        <h3>🍑 黄桃储存和食用方式</h3>
        <ol>
          <li><b>到手先散开</b>：收到桃后第一时间把桃子都拿出来<b>平铺</b>，去掉网袋，<b>不要堆砌</b>，放在<b>通风阴凉干燥</b>的地方。我们的桃都是 7-8 分熟摘果，喜欢吃软的就放几天，桃儿 🍑 会变得更香甜。</li>
          <li><b>常温约一周</b>：先挑黄的吃。如果想延长几天储存期，可放冰箱<b>冷藏</b>，但口感会略差。记得<b>不要清洗后再放冰箱</b>，否则黄桃容易坏。</li>
          <li><b>食用前用淡盐水洗绒毛</b>：可削皮切片 / 切条，也可以简单粗暴直接啃～</li>
        </ol>
      </div> : null}
    </section>
  );
}
