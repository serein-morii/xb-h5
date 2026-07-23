import { ArrowRight, Link2, Search, ShieldCheck, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

function extractOrderId(value: string) {
  const raw = value.trim();
  if (/^[a-zA-Z0-9_-]{4,80}$/.test(raw)) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    const rawHash = url.hash.replace(/^#/, "").trim();
    const hashId = rawHash.startsWith("id=") ? new URLSearchParams(rawHash).get("id") : rawHash;
    const queryId = url.searchParams.get("id");
    return (hashId || queryId || "").trim();
  } catch {
    const matched = raw.match(/(?:^|[?#&])id=([^&#\s]+)/i);
    if (!matched) return "";
    try { return decodeURIComponent(matched[1]).trim(); } catch { return matched[1].trim(); }
  }
}

export default function LinkQueryCard() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.classList.add("sheet-open");
    window.addEventListener("keydown", close);
    return () => { document.body.classList.remove("sheet-open"); window.removeEventListener("keydown", close); };
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const id = extractOrderId(value);
    if (!id || !/^[a-zA-Z0-9_-]{4,80}$/.test(id)) {
      setError("没有识别到有效的加密 ID，请检查链接后重试");
      return;
    }
    window.location.assign(`/tools/order#${encodeURIComponent(id)}`);
  }

  function show() { setValue(""); setError(""); setOpen(true); }

  return <>
    <button type="button" className="tools-menu-card tools-link-query-card tool-tone-peach" onClick={show}>
      <span><Link2 size={23} /></span><div><h2>链接查询</h2><p>通过加密链接查看订单详情</p></div><ArrowRight size={17} />
    </button>
    {open ? <div className="link-query-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="link-query-dialog" role="dialog" aria-modal="true" aria-labelledby="link-query-title">
        <header><span><ShieldCheck size={22} /></span><div><small>SECURE ORDER LINK</small><h2 id="link-query-title">链接查询</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="关闭"><X size={19} /></button></header>
        <p>粘贴系统生成的完整订单链接，或者直接输入链接中加密后的 ID。</p>
        <form onSubmit={submit}>
          <label><span>订单链接或加密 ID</span><div className="link-query-input"><Link2 size={17} /><input autoFocus value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} placeholder="例如：https://…/tools/order#2te8x5cy" /></div></label>
          <div className="link-query-example"><b>也可以只输入</b><code>2te8x5cy</code></div>
          {error ? <p className="tool-error">{error}</p> : null}
          <button className="tool-primary" type="submit"><Search size={18} />查看订单详情</button>
        </form>
      </section>
    </div> : null}
  </>;
}
