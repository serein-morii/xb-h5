import { ArrowRight, Boxes, FileSearch, Link2, MonitorCog, ShoppingBag, Store } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import "../system-home.css";

const entries = [
  { href: APP_ROUTES.toolPlaceOrder, title: "专属下单", desc: "买家短链下单与订单列表。", icon: ShoppingBag },
  { href: APP_ROUTES.toolOrderSearch, title: "订单查询", desc: "手机号验证后查询订单。", icon: FileSearch },
  { href: APP_ROUTES.toolStoreQuery, title: "专属查询", desc: "按店铺隔离查询订单。", icon: Store },
  { href: APP_ROUTES.toolOrderLink, title: "短链生成", desc: "生成买家专属下单链接。", icon: Link2 },
  { href: APP_ROUTES.tools, title: "公开工具", desc: "运费计算、运费对比等工具。", icon: Boxes },
  { href: APP_ROUTES.manage, title: "管理后台", desc: "订单、店铺、账单和系统配置。", icon: MonitorCog },
];

export default function OrderSystemHome() {
  return <main className="system-home system-order-home">
    <section className="system-hero">
      <span><ShoppingBag size={14} />ORDER SYSTEM</span>
      <h1>订单系统</h1>
      <p>订单相关能力都从这里进。公开工具、买家页面和管理后台保留原路径，入口更清楚。</p>
    </section>
    <section className="system-grid compact" aria-label="订单系统功能入口">
      {entries.map((item) => {
        const Icon = item.icon;
        return <a className="system-card is-order" href={item.href} key={item.href}>
          <div className="system-card-top"><span><Icon size={22} /></span></div>
          <div><h2>{item.title}</h2><p>{item.desc}</p></div>
          <b>打开 <ArrowRight size={15} /></b>
        </a>;
      })}
    </section>
    <footer className="system-footer"><a href={APP_ROUTES.home}>返回系统入口</a></footer>
  </main>;
}
