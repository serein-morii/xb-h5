import { Check, Clock3, Copy, FileText, KeyRound, LoaderCircle, LockKeyhole, Moon, ShieldCheck, Sun, SunMoon, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { renderRichText } from "../../lib/richText";
import { readThemePreference, setThemePreference, type ThemePreference } from "../../lib/theme";
import { copyAndScheduleClear } from "./otpDailyUse";
import { getSharedContent, getShareStatus, openVaultShare, type ShareStatus } from "./vaultApi";

function normalizeDateTime(value: string) {
  return value?.includes("T") ? value : value?.replace(" ", "T");
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "已结束";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days) return `${days}天 ${hours}时 ${minutes}分`;
  if (hours) return `${hours}时 ${minutes}分 ${secs}秒`;
  return `${minutes}分 ${secs}秒`;
}

export default function VaultTextSharePage({ token }: { token: string }) {
  const sessionKey = `otp-vault-text-share:${token}`;
  const initialCode = location.hash.match(/^#k=([A-Za-z0-9]{4,12})$/)?.[1]?.toUpperCase() || "";
  const [accessCode, setAccessCode] = useState(initialCode);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(sessionKey) || "");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"TEXT" | "MARKDOWN">("TEXT");
  const [allowCopy, setAllowCopy] = useState(false);
  const [expireTime, setExpireTime] = useState("");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemePreference>(() => readThemePreference());
  const serverOffset = useRef(0);

  const loadContent = useCallback(async (session: string) => {
    try {
      const requestedAt = Date.now();
      const result = await getSharedContent(token, session);
      const receivedAt = Date.now();
      serverOffset.current = result.data.serverTime + Math.round((receivedAt - requestedAt) / 2) - receivedAt;
      if (result.data.shareType !== "TEXT") throw new Error("该链接不是文本分享");
      setContent(result.data.textContent || "");
      setFormat(result.data.textFormat === "MARKDOWN" ? "MARKDOWN" : "TEXT");
      setAllowCopy(Boolean(result.data.allowCopy));
      setExpireTime(result.data.expireTime);
      setError("");
      return true;
    } catch (loadError) {
      sessionStorage.removeItem(sessionKey);
      setSessionToken("");
      setError(loadError instanceof Error ? loadError.message : "临时访问会话已失效");
      return false;
    }
  }, [sessionKey, token]);

  const open = useCallback(async (code: string) => {
    setBusy(true); setError("");
    try {
      const result = await openVaultShare(token, code);
      sessionStorage.setItem(sessionKey, result.data.sessionToken);
      setSessionToken(result.data.sessionToken);
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      await loadContent(result.data.sessionToken);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "访问验证失败");
    } finally { setBusy(false); }
  }, [loadContent, sessionKey, token]);

  useEffect(() => {
    let cancelled = false;
    getShareStatus(token).then(async (result) => {
      if (cancelled) return;
      if (result.data.shareType !== "TEXT") throw new Error("该链接不是文本分享");
      setStatus(result.data);
      if (result.data.status !== "ACTIVE") return;
      if (sessionToken && await loadContent(sessionToken)) return;
      if (!result.data.accessCodeRequired || initialCode) await open(initialCode);
    }).catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "分享链接不存在"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (status?.name) document.title = `${status.name}｜OTP Vault`; }, [status?.name]);

  const expiresIn = expireTime ? Math.max(0, Math.ceil((new Date(normalizeDateTime(expireTime)).getTime() - (now + serverOffset.current)) / 1000)) : 0;
  const toggleTheme = () => {
    const next = themeMode === "system" ? "dark" : themeMode === "dark" ? "light" : "system";
    setThemePreference(next); setThemeMode(next);
  };
  const copyContent = async () => {
    await copyAndScheduleClear(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (loading && !status && !error) return <main className="text-share-page"><section className="share-loading"><LoaderCircle className="spin" size={20} /><p>正在检查临时文本…</p></section></main>;
  if ((!status && error) || (status && status.status !== "ACTIVE")) return <main className="text-share-page"><section className="share-expired"><TriangleAlert size={20} /><span>OTP VAULT</span><h1>无法打开分享</h1><p>{error || "文本分享已过期、撤销或达到访问次数限制。"}</p></section></main>;

  const gateVisible = !sessionToken || !content;
  return <main className={`text-share-page ${gateVisible ? "is-gate" : "is-open"}`}>
    <header className="share-brand"><span className="share-vault-mark">OTP</span><div><b>OTP Vault</b><small>临时文本分享</small></div><button type="button" className="vault-ghost vault-theme-action" onClick={toggleTheme} aria-label="切换显示模式">{themeMode === "system" ? <SunMoon size={18} /> : themeMode === "dark" ? <Moon size={18} /> : <Sun size={18} />}<span>{themeMode === "system" ? "系统" : themeMode === "dark" ? "暗黑" : "亮色"}</span></button></header>
    {gateVisible ? <section className="share-access-card text-share-gate">
      <div className="share-access-intro"><span className="share-lock"><LockKeyhole size={24} /></span><div><small>受保护的临时分享</small><h1>{status?.name || "临时文本分享"}</h1><p>验证通过后才会传输正文，内容只在有效期内开放。</p></div></div>
      <div className="share-access-summary"><span><small>内容格式</small><b>{status?.textFormat === "MARKDOWN" ? "Markdown" : "普通文本"}</b></span><span><small>剩余时间</small><b>{formatDuration(Math.max(0, Math.ceil((new Date(normalizeDateTime(status?.expireTime || "")).getTime() - Date.now()) / 1000)))}</b></span></div>
      {status?.accessCodeRequired ? <form onSubmit={(event: FormEvent) => { event.preventDefault(); void open(accessCode); }}><label><span>输入访问码</span><div className="share-code-input"><KeyRound size={17} /><input autoFocus value={accessCode} onChange={(event) => setAccessCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} minLength={4} maxLength={12} autoComplete="one-time-code" /></div></label><button disabled={busy || accessCode.length < 4}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy ? "正在验证" : "查看文本"}</button></form> : <button className="share-open-button" disabled={busy} onClick={() => void open("")}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy ? "正在打开" : "打开文本"}</button>}
      {error ? <p className="share-error">{error}</p> : null}
    </section> : <section className="text-share-content">
      <header><div><span><FileText size={14} />临时文本</span><h1>{status?.name || "临时文本分享"}</h1><p>{format === "MARKDOWN" ? "Markdown" : "普通文本"} · {allowCopy ? "允许复制" : "仅允许查看"}</p></div><div className="text-share-expiry"><Clock3 size={17} /><span><small>剩余时间</small><b>{formatDuration(expiresIn)}</b></span></div></header>
      <article className={`text-share-document ${format === "MARKDOWN" ? "is-markdown" : "is-text"}`} dangerouslySetInnerHTML={{ __html: renderRichText(content, format === "MARKDOWN" ? "markdown" : "text") }} />
      {allowCopy ? <button type="button" className="text-share-copy" onClick={() => void copyContent()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "已复制" : "复制全文"}</button> : null}
      <footer><ShieldCheck size={14} />页面关闭或授权失效后，请重新验证访问</footer>
    </section>}
  </main>;
}
