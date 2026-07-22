import Link from "next/link";
import { House, LogIn } from "lucide-react";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-tools-shell">
    <header className="public-tools-header"><Link className="public-tools-brand" href="/tools"><span className="brand-mark"><span /></span><div><b>喜八工具箱</b><small>PUBLIC TOOLS</small></div></Link><nav><Link href="/tools"><House size={16} />工具菜单</Link><Link href="/"><LogIn size={16} />管理登录</Link></nav></header>
    <main className="public-tools-main">{children}</main>
    <footer className="public-tools-footer"><span>喜八移动工具箱</span><a href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></footer>
  </div>;
}
