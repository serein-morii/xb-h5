import { ArrowRight, Sparkles } from "lucide-react";
import { APP_ROUTES } from "../../lib/pathConventions";
import "./video-extract.css";

function BeadMark() {
  return <span className="lab-mark lab-mark-bead" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function ExtractMark() {
  return <span className="lab-mark lab-mark-extract" aria-hidden="true">解</span>;
}

const experiments = [
  {
    href: "/bead-studio",
    title: "拼豆工作台",
    description: "把图片转成可编辑的拼豆图纸，支持色号、分板、用量清单与高清导出。",
    eyebrow: "IMAGE · CRAFT",
    mark: BeadMark,
    index: "001",
  },
  {
    href: APP_ROUTES.labVideoExtract,
    title: "短视频提取",
    description: "粘贴抖音、小红书、B 站分享链接，解析封面、直链并下载。登录后台可留下记录。",
    eyebrow: "VIDEO · EXTRACT",
    mark: ExtractMark,
    index: "002",
  },
];

export default function LabHome() {
  return <div className="utility-home">
    <section className="utility-hero">
      <div className="utility-hero-copy">
        <span><Sparkles size={13} />A SMALL COLLECTION</span>
        <h1>把突然冒出的想法，<br />做成真的。</h1>
        <p>一间独立的小实验室。每个作品都保持简单、专注，打开就能用。</p>
      </div>
      <div className="utility-hero-art" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i /><i />
      </div>
    </section>

    <section className="utility-library" aria-labelledby="utility-library-title">
      <header>
        <div><span>EXPERIMENTS</span><h2 id="utility-library-title">实验作品</h2></div>
        <small>{experiments.length.toString().padStart(2, "0")} / 持续生长</small>
      </header>
      <div className="utility-grid">
        {experiments.map((item) => {
          const Mark = item.mark;
          return <a className="utility-card utility-card-featured" href={item.href} key={item.href}>
            <div className="utility-card-top"><span className="utility-card-icon"><Mark /></span><em>{item.index}</em></div>
            <div className="utility-card-copy"><small>{item.eyebrow}</small><h3>{item.title}</h3><p>{item.description}</p></div>
            <span className="utility-card-open">进入实验 <ArrowRight size={15} /></span>
          </a>;
        })}
        <div className="utility-card utility-card-soon" aria-label="下一件实验作品">
          <span className="utility-card-sequence">003</span>
          <div><small>NEXT EXPERIMENT</small><h3>等待下一个想法</h3><p>第三件作品暂未开放。</p></div>
        </div>
      </div>
    </section>
  </div>;
}
