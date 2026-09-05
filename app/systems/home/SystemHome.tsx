import { ArrowRight, ArrowUpRight, Beaker, KeyRound, PackageCheck, Settings2, ShieldCheck } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import "../system-home.css";

const systems = [
  {
    href: APP_ROUTES.orderSystem,
    name: "订单系统",
    desc: "录单、查单、买家、店铺与账单，日常业务的主战场。",
    icon: PackageCheck,
    tone: "order",
    meta: "BUSINESS",
  },
  {
    href: APP_ROUTES.otp,
    name: "OTP Vault",
    desc: "动态验证码、账号密码与临时授权，端到端加密的私人保险库。",
    icon: KeyRound,
    tone: "otp",
    meta: "VAULT",
  },
  {
    href: APP_ROUTES.lab,
    name: "Handy Lab",
    desc: "和订单无关的小工具、实验作品与灵感原型。",
    icon: Beaker,
    tone: "lab",
    meta: "LAB",
  },
  {
    href: APP_ROUTES.systemCenter,
    name: "系统中心",
    desc: "成员权限、运行监控、站内信与账号恢复的统一控制台。",
    icon: Settings2,
    tone: "console",
    meta: "ADMIN",
  },
];

const quickLinks = [
  { href: APP_ROUTES.manage, label: "订单管理后台" },
  { href: APP_ROUTES.peach, label: "炎陵黄桃主页" },
  { href: APP_ROUTES.beadStudio, label: "拼豆工作台" },
];

export default function SystemHome() {
  return <main className="system-home">
    <header className="system-topbar">
      <span className="system-logo"><ShieldCheck size={15} />XB Workspace</span>
      <nav className="system-topnav" aria-label="快捷入口">
        {quickLinks.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
      </nav>
    </header>

    <section className="system-hero">
      <span className="system-status"><i aria-hidden="true" />全部系统运行正常</span>
      <h1>一个入口，<em>管好所有业务</em>。</h1>
      <p>订单、OTP、LAB 各自独立运行，共享一套账号与权限；平台级的系统管理收敛到系统中心，界面、权限与审计保持一致。</p>
    </section>

    <section className="system-grid" aria-label="系统入口">
      {systems.map((item) => {
        const Icon = item.icon;
        return <a className={`system-card is-${item.tone}`} href={item.href} key={item.href}>
          <div className="system-card-top"><span><Icon size={22} /></span><em>{item.meta}</em></div>
          <div className="system-card-body">
            <h2>{item.name}</h2>
            <p>{item.desc}</p>
          </div>
          <b>进入系统 <ArrowRight size={14} /></b>
        </a>;
      })}
    </section>

    <footer className="system-footer">
      <span className="system-footer-note"><ArrowUpRight size={13} />更多入口</span>
      {quickLinks.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
    </footer>
  </main>;
}
