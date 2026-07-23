import { House, LogIn } from "lucide-react";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-tools-shell">
    <header className="public-tools-header">
      <a className="public-tools-brand" href="/tools"><span className="brand-mark"><span /></span><div><b>喜八</b><small>实用工具箱</small></div></a>
      <nav><a href="/tools"><House size={16} />全部工具</a><a href="/"><LogIn size={16} />登录</a></nav>
    </header>
    <main className="public-tools-main">{children}</main>
    <footer className="public-tools-footer"><span>喜八实用工具箱</span><a href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></footer>
  </div>;
}
