import { ArrowRight, CalendarDays, ClipboardCheck, HandHeart, HeartHandshake, ShieldCheck, Users } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import "./volunteer.css";

const values = [
  { icon: HeartHandshake, title: "真诚服务", text: "从身边的小事出发，把帮助送到真正需要的人身边。" },
  { icon: Users, title: "彼此协作", text: "按特长与时间合理分工，让每位伙伴都能轻松参与。" },
  { icon: ClipboardCheck, title: "认真记录", text: "保存报名、签到和服务经历，让付出清晰可见。" },
];

export default function VolunteerHome() {
  return <main className="yv-page">
    <header className="yv-header">
      <a className="yv-brand" href={APP_ROUTES.volunteer}><span><HandHeart size={19} /></span><b>鱼片志愿</b></a>
      <nav><a href={APP_ROUTES.home}>系统入口</a><a href={APP_ROUTES.volunteerManage}>管理后台</a></nav>
    </header>
    <section className="yv-hero">
      <div className="yv-hero-copy">
        <span className="yv-eyebrow"><i />YUPIAN VOLUNTEER</span>
        <h1>让热心有去处，<br /><em>让每次行动都有回响。</em></h1>
        <p>连接志愿者、公益活动与真实的服务记录。找到适合自己的参与方式，一起把善意落到日常。</p>
        <div className="yv-hero-actions"><a className="primary" href={APP_ROUTES.volunteerJoin}>加入鱼片志愿 <ArrowRight size={16} /></a><a href="#about">了解我们</a></div>
      </div>
      <div className="yv-hero-art" aria-hidden="true">
        <span className="yv-heart"><HandHeart size={52} /></span>
        <div><b>一起行动</b><small>每一份时间都值得被认真对待</small></div>
        <i className="dot-one" /><i className="dot-two" />
      </div>
    </section>
    <section className="yv-values" id="about">
      <div className="yv-section-title"><small>我们如何同行</small><h2>简单加入，踏实服务</h2></div>
      <div className="yv-value-grid">{values.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={21} /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
    <section className="yv-steps">
      <div><span><ShieldCheck size={18} /></span><b>提交登记</b><small>填写真实资料与可服务时间</small></div><i />
      <div><span><ClipboardCheck size={18} /></span><b>资料审核</b><small>负责人核对并建立会员档案</small></div><i />
      <div><span><CalendarDays size={18} /></span><b>参与活动</b><small>后续可在线报名与记录服务</small></div>
    </section>
    <section className="yv-join-banner"><div><small>READY TO HELP</small><h2>愿意抽出一点时间，和我们一起吗？</h2></div><a href={APP_ROUTES.volunteerJoin}>填写登记信息 <ArrowRight size={16} /></a></section>
    <footer className="yv-footer"><span>鱼片志愿</span><a href={APP_ROUTES.home}>返回 XB Workspace</a></footer>
  </main>;
}
