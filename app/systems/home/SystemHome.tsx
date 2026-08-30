import { ArrowRight, Beaker, KeyRound, PackageCheck, ShieldCheck } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import "../system-home.css";

const systems = [
  {
    href: APP_ROUTES.orderSystem,
    name: "订单系统",
    desc: "下单、查单、买家、店铺与后台管理集中在这里。",
    icon: PackageCheck,
    tone: "order",
    meta: "ORDER",
  },
  {
    href: APP_ROUTES.otp,
    name: "OTP Vault",
    desc: "独立管理动态验证码、账号密码与临时授权。",
    icon: KeyRound,
    tone: "otp",
    meta: "VAULT",
  },
  {
    href: APP_ROUTES.lab,
    name: "Handy Lab",
    desc: "放一些和订单无关的小工具、实验作品和灵感原型。",
    icon: Beaker,
    tone: "lab",
    meta: "LAB",
  },
];

export default function SystemHome() {
  return <main className="system-home">
    <section className="system-hero">
      <span><ShieldCheck size={14} />XB Workspace</span>
      <h1>选择一个系统开始。</h1>
      <p>订单、OTP、LAB 分开运行，共用一个入口；每个系统保持自己的页面、权限和设计语言。</p>
    </section>
    <section className="system-grid" aria-label="系统入口">
      {systems.map((item) => {
        const Icon = item.icon;
        return <a className={`system-card is-${item.tone}`} href={item.href} key={item.href}>
          <div className="system-card-top"><span><Icon size={24} /></span><em>{item.meta}</em></div>
          <div><h2>{item.name}</h2><p>{item.desc}</p></div>
          <b>进入系统 <ArrowRight size={15} /></b>
        </a>;
      })}
    </section>
    <footer className="system-footer">
      <a href={APP_ROUTES.peach}>炎陵黄桃主页</a>
      <a href={APP_ROUTES.manage}>订单管理后台</a>
      <a href={APP_ROUTES.beadStudio}>拼豆工作台</a>
    </footer>
  </main>;
}
