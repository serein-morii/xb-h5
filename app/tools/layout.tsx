import { ArrowLeft, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const showBackToTools = window.location.pathname !== "/tools";
  const isDedicatedOrderLink = /^\/tools\/order\/[2-9a-hj-km-np-z]{6}\/?$/.test(window.location.pathname);

  return <div className="public-tools-shell">
    <main className="public-tools-main">{children}</main>
    {!isDedicatedOrderLink ? <aside className={`tools-login-float${actionsOpen ? " is-open" : ""}`}>
      {actionsOpen ? <div className="tools-float-actions">
        {showBackToTools ? <a className="tools-back-trigger" href="/tools" aria-label="返回工具箱" title="返回工具箱"><ArrowLeft size={17} /></a> : null}
        <a className="tools-login-action" href="/" aria-label="登录管理后台" title="登录管理后台"><LogIn size={17} /></a>
      </div> : null}
      <button className="tools-login-trigger" type="button" onClick={() => setActionsOpen((open) => !open)} aria-expanded={actionsOpen} aria-label={actionsOpen ? "收起工具操作" : "展开工具操作"}>
        {actionsOpen ? <X size={17} /> : <Menu size={17} />}
      </button>
    </aside> : null}
    <footer className="public-tools-footer"><span>喜八Tools</span><a href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></footer>
  </div>;
}
