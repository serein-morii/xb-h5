import { ArrowRight, Calculator, PackageSearch, Scale } from "lucide-react";
import LinkQueryCard from "./LinkQueryCard";
import PrivacyPolicySheet from "./PrivacyPolicySheet";

const orderTools = [
  { href: "/tools/order-search", title: "订单查询", desc: "手机号验证后查看订单物流", icon: PackageSearch },
];

const freightTools = [
  { href: "/tools/freight-compare", title: "运费对比", desc: "比较不同快递的计价结果", icon: Scale },
  { href: "/tools/freight-calculator", title: "运费计算", desc: "批量计算常用快递费用", icon: Calculator },
];

function ToolCard({ item }: { item: (typeof orderTools)[number] }) {
  const Icon = item.icon;
  return <a href={item.href} className="tools-menu-card"><span><Icon size={23} /></span><div><h2>{item.title}</h2><p>{item.desc}</p></div><ArrowRight size={17} /></a>;
}

export default function ToolsPage() {
  return <div className="tools-home">
    <header className="tools-home-intro">
      <h1>工具箱</h1>
      <p>查询订单、处理运费，常用功能都在这里。</p>
    </header>
    <section className="tools-service-section" aria-labelledby="tools-service-title">
      <header>
        <h2 id="tools-service-title">常用服务</h2>
        <span>无需登录</span>
      </header>
      <div className="tools-service-group">
        <div className="tools-home-grid">
          {orderTools.map((item) => <ToolCard item={item} key={item.href} />)}
          <LinkQueryCard />
          {freightTools.map((item) => <ToolCard item={item} key={item.href} />)}
        </div>
      </div>
    </section>
    <PrivacyPolicySheet />
  </div>;
}
