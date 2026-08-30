"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Section = { title: string; body: string };

const SECTIONS: Section[] = [
  {
    title: "我们收集的信息",
    body: "仅收集完成当前查询与计算所必需的信息，例如手机号、订单号、收件地址、运单号、运费参数等。这些信息由你主动填写或粘贴，不会被静默获取。",
  },
  {
    title: "我们如何使用这些信息",
    body: "只为响应你当前的操作：查询订单物流、计算运费、生成链接。任何信息不会被用于广告投放、画像分析或转售给第三方。",
  },
  {
    title: "数据保存期限",
    body: "查询与计算结果默认仅保存在浏览器本次会话（sessionStorage）。关闭页面或超过 30 分钟无操作后，本地缓存会自动清除；服务器侧仅保留与查询相关的最近 24 小时访问日志，用于排障。",
  },
  {
    title: "你的权利",
    body: "你可以随时清除浏览器缓存来删除本地残留数据；如需删除服务器侧与本人相关的访问记录，可通过页面底部“意见反馈”联系我们，我们会在 7 个工作日内处理。",
  },
  {
    title: "Cookie 与本地存储",
    body: "本站不使用第三方追踪 Cookie，仅在本地存储少量会话级偏好（如上次选择的店铺、计算器输入草稿）。你可以在浏览器中随时禁用本地存储，这不会影响页面浏览，但部分工具的自动填充会失效。",
  },
  {
    title: "未成年人保护",
    body: "本站为业务工具，不面向未满 14 周岁的未成年人提供独立服务。如发现未成年人误填信息，请通过站内反馈告知，我们会立即删除。",
  },
  {
    title: "政策更新",
    body: "我们可能根据业务调整更新本政策，重大变更会通过站内弹窗或公告提示。继续使用即视为接受最新版政策；如有异议，请停止使用并联系我们。",
  },
];

const UPDATED = "2026-07-15";

export default function PrivacyPolicySheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", handler);
    document.body.classList.add("sheet-open");
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.classList.remove("sheet-open");
    };
  }, [open]);

  return (
    <>
      <button className="tools-home-note" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <div>
          <b>隐私保护</b>
          <p>点击查看完整隐私条款 · 更新于 {UPDATED}</p>
        </div>
        <span className="tools-home-note-arrow" aria-hidden="true">›</span>
      </button>
      {open ? (
        <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="sheet sheet-wide" role="dialog" aria-modal="true" aria-label="隐私保护">
            <div className="sheet-grabber" />
            <header className="sheet-header">
              <div><span className="eyebrow">PRIVACY</span><h2>隐私保护</h2></div>
              <div className="sheet-header-actions">
                <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="关闭"><X size={20} /></button>
              </div>
            </header>
            <div className="sheet-content">
              <div className="privacy-intro">
                <p>我们非常重视你的隐私。本页说明工具箱在你不登录时如何处理你提交的信息。</p>
                <small>最后更新：{UPDATED}</small>
              </div>
              <div className="privacy-sections">
                {SECTIONS.map((section) => (
                  <article key={section.title} className="privacy-section">
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </article>
                ))}
              </div>
              <div className="privacy-foot">
                <small>如对本政策有任何疑问，欢迎随时通过站内反馈与我们联系。</small>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
