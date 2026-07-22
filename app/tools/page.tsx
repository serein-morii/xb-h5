import { ArrowRight, Calculator, PackageSearch, Scale, ShieldCheck, Sparkles } from "lucide-react";
import LinkQueryCard from "./LinkQueryCard";

const orderTools = [
  { href: "/tools/order-search", title: "订单查询", desc: "使用手机号和验证码查询订单及物流", icon: PackageSearch, tone: "green", badge: "免登录" },
];

const freightTools = [
  { href: "/tools/freight-compare", title: "运费对比", desc: "快速对比不同快递公司的计价结果", icon: Scale, tone: "blue", badge: "一键导出" },
  { href: "/tools/freight-calculator", title: "运费计算", desc: "批量计算京东、顺丰和邮政寄递费用", icon: Calculator, tone: "amber", badge: "支持 Excel" },
];

function ToolCard({ item }: { item: (typeof orderTools)[number] }) {
  const Icon = item.icon;
  return <a href={item.href} className={`tools-menu-card tool-tone-${item.tone}`}><span><Icon size={24} /></span><div><em>{item.badge}</em><h2>{item.title}</h2><p>{item.desc}</p></div><ArrowRight size={18} /></a>;
}

export default function ToolsPage() {
  return <div className="tools-menu-page"><section className="tools-menu-hero"><span><Sparkles size={23} /></span><div><small>MOBILE TOOLBOX</small><h1>常用工具，一站直达</h1><p>订单查询与运费工具已经统一适配手机端。</p></div></section><section className="tools-menu-grid">{orderTools.map((item) => <ToolCard item={item} key={item.href} />)}<LinkQueryCard />{freightTools.map((item) => <ToolCard item={item} key={item.href} />)}</section><div className="tools-menu-tip"><ShieldCheck size={18} /><div><b>访问说明</b><p>订单查询、链接查询与运费工具均可免登录使用。</p></div></div></div>;
}
