import { ArrowLeft } from "lucide-react";
import "./video-extract.css";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  const onHome = window.location.pathname === "/lab";

  return <div className="utility-shell">
    <header className="utility-site-header">
      <a className="utility-brand" href="/lab" aria-label="Handy Lab 主页">
        <span className="lab-brand-mark" aria-hidden="true">HL</span>
        <div><b>Handy Lab</b><small>灵感实验室</small></div>
      </a>
      {!onHome ? <a className="utility-back" href="/lab"><ArrowLeft size={15} />返回 Lab</a> : null}
    </header>
    <main className="utility-main">{children}</main>
    <footer className="utility-footer"><span>轻量、独立、打开即用</span></footer>
  </div>;
}
