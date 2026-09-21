import { Check, Clock3, Copy, FileText, KeyRound, LoaderCircle, LockKeyhole, Moon, ShieldCheck, Sun, SunMoon, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { applyOpenGraph } from "../../lib/openGraph";
import { renderRichText } from "../../lib/richText";
import { readThemePreference, setThemePreference, type ThemePreference } from "../../lib/theme";
import { copyAndScheduleClear } from "./otpDailyUse";
import { normalizeTextShareFormat, textShareFormatHint, textShareFormatLabel, textShareRenderType, type TextShareFormat } from "./otpVaultShare";
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
  if (days) return `${days} 天 ${hours} 时 ${minutes} 分`;
  if (hours) return `${hours} 时 ${minutes} 分 ${secs} 秒`;
  return `${minutes} 分 ${secs} 秒`;
}

export default function VaultTextSharePage({ token }: { token: string }) {
  const sessionKey = `otp-vault-text-share:${token}`;
  const initialCode = location.hash.match(/^#k=([A-Za-z0-9]{4,12})$/)?.[1]?.toUpperCase() || "";
  const [accessCode, setAccessCode] = useState(initialCode);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(sessionKey) || "");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<TextShareFormat>("TEXT");
  const [allowCopy, setAllowCopy] = useState(false);
  const [expireTime, setExpireTime] = useState("");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemePreference>(() => readThemePreference());
  const serverOffset = useRef(0);
  const expiryTotal = useRef(0);

  const loadContent = useCallback(async (session: string) => {
    try {
      const requestedAt = Date.now();
      const result = await getSharedContent(token, session);
      const receivedAt = Date.now();
      serverOffset.current = result.data.serverTime + Math.round((receivedAt - requestedAt) / 2) - receivedAt;
      if (result.data.shareType !== "TEXT") throw new Error("该链接不是笔记分享");
      expiryTotal.current ||= Math.max(1, Math.ceil((new Date(normalizeDateTime(result.data.expireTime)).getTime() - (receivedAt + serverOffset.current)) / 1000));
      setContent(result.data.textContent || "");
      setFormat(normalizeTextShareFormat(result.data.textFormat));
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
      if (result.data.shareType !== "TEXT") throw new Error("该链接不是笔记分享");
      setStatus(result.data);
      if (result.data.status !== "ACTIVE") return;
      if (sessionToken && await loadContent(sessionToken)) return;
      if (!result.data.accessCodeRequired || initialCode) await open(initialCode);
    }).catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "分享链接不存在"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (status?.name) applyOpenGraph(`${status.name}｜OTP Vault`, "安全查看限时分享的普通文本、Markdown、代码或 HTML。", "otp"); }, [status?.name]);

  const expiresIn = expireTime ? Math.max(0, Math.ceil((new Date(normalizeDateTime(expireTime)).getTime() - (now + serverOffset.current)) / 1000)) : 0;
  const expiryProgress = expiryTotal.current ? Math.max(0, Math.min(100, expiresIn / expiryTotal.current * 100)) : 100;
  const secondsProgress = expiresIn ? ((expiresIn - 1) % 60 + 1) / 60 * 100 : 0;
  const accessExpiresIn = status?.expireTime ? Math.max(0, Math.ceil((new Date(normalizeDateTime(status.expireTime)).getTime() - now) / 1000)) : 0;
  const toggleTheme = () => {
    const next = themeMode === "system" ? "dark" : themeMode === "dark" ? "light" : "system";
    setThemePreference(next); setThemeMode(next);
  };
  const copyContent = async () => {
    await copyAndScheduleClear(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (loading) return <main className="text-share-page"><section className="share-loading"><LoaderCircle className="spin" size={20} /><p>正在打开笔记…</p></section></main>;
  if ((!status && error) || (status && status.status !== "ACTIVE")) return <main className="text-share-page"><section className="share-expired"><TriangleAlert size={20} /><span>OTP VAULT</span><h1>无法打开分享</h1><p>{error || "笔记分享已过期、撤销或达到访问次数限制。"}</p></section></main>;

  const gateVisible = !sessionToken || !content;
  const formatLabel = textShareFormatLabel(format);
  return <main className={`text-share-page ${gateVisible ? "is-gate" : "is-open"}`}>
    <header className="text-share-header">
      <span className="text-share-brand"><i>OTP</i><div><b>OTP Vault</b><small>临时笔记</small></div></span>
      <button type="button" className="text-share-theme" onClick={toggleTheme} aria-label={`切换显示模式，当前${themeMode === "system" ? "跟随系统" : themeMode === "dark" ? "暗黑" : "亮色"}`}>{themeMode === "system" ? <SunMoon size={16} /> : themeMode === "dark" ? <Moon size={16} /> : <Sun size={16} />}<span>{themeMode === "system" ? "系统" : themeMode === "dark" ? "暗黑" : "亮色"}</span></button>
    </header>

    {gateVisible ? <section className="text-share-gate">
      <div className="text-share-gate-intro"><span className="text-share-medallion"><LockKeyhole size={23} /></span><div><small>受保护的临时分享</small><h1>{status?.name || "临时笔记"}</h1><p>验证前不会传输正文，内容只在授权有效期内开放。</p></div></div>
      <div className="text-share-meta">
        <span><small>内容格式</small><b><FileText size={13} />{textShareFormatLabel(status?.textFormat)}</b></span>
        <span><small>剩余时间</small><b><Clock3 size={13} />{formatDuration(accessExpiresIn)}</b></span>
      </div>
      {status?.accessCodeRequired ? <form className="text-share-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void open(accessCode); }}>
        <label>
          <span>输入访问码</span>
          <div className="text-share-code"><KeyRound size={17} /><input autoFocus inputMode="text" enterKeyHint="go" spellCheck={false} aria-label="访问码" value={accessCode} onChange={(event) => { setAccessCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); if (error) setError(""); }} minLength={4} maxLength={12} autoComplete="one-time-code" placeholder="粘贴或输入访问码" /></div>
        </label>
        <p className="text-share-access-help">支持直接粘贴，输入完成后按回车</p>
        <button disabled={busy || accessCode.length < 4}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy ? "正在验证" : "查看笔记"}</button>
      </form> : <button className="text-share-open" disabled={busy} onClick={() => void open("")}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy ? "正在打开" : "打开笔记"}</button>}
      {error ? <p className="text-share-error"><TriangleAlert size={14} />{error}</p> : null}
      <footer><ShieldCheck size={13} />访问会话不会超过原分享有效期</footer>
    </section> : <section className="text-share-paper-wrap">
      <header className="text-share-titlebar">
        <div className="text-share-title">
          <em>笔记已验证</em>
          <h1>{status?.name || "临时笔记"}</h1>
          <p>{formatLabel} · {allowCopy ? "允许复制" : "仅允许查看"}</p>
        </div>
        <div className="text-share-countdown" role="timer"><span className="text-share-expiry-ring"><svg viewBox="0 0 44 44" aria-hidden="true"><circle className="text-share-expiry-track is-total" cx="22" cy="22" r="19" pathLength="100" /><circle className="text-share-expiry-total" cx="22" cy="22" r="19" pathLength="100" style={{ strokeDashoffset: 100 - expiryProgress }} /><circle className="text-share-expiry-track is-seconds" cx="22" cy="22" r="15" pathLength="100" /><circle className="text-share-expiry-seconds" cx="22" cy="22" r="15" pathLength="100" style={{ strokeDashoffset: 100 - secondsProgress }} /></svg><Clock3 size={14} /></span><span><small>分享剩余时间</small><b>{formatDuration(expiresIn)}</b></span></div>
      </header>
      <div className="text-share-reading-layout">
        <article className={`text-share-paper${format === "CODE" ? " is-code" : ""}`} dangerouslySetInnerHTML={{ __html: renderRichText(content, textShareRenderType(format)) }} />
        <aside className="text-share-aside">
          <section><span className="text-share-aside-icon"><FileText size={16} /></span><div><small>阅读格式</small><b>{formatLabel}</b><p>{textShareFormatHint(format)}</p></div></section>
          <section><span className="text-share-aside-icon"><ShieldCheck size={16} /></span><div><small>访问权限</small><b>{allowCopy ? "允许复制全文" : "仅限在线查看"}</b><p>分享失效或被撤销后，当前阅读会话也会立即结束。</p></div></section>
          {allowCopy ? <button type="button" className={`text-share-copy${copied ? " is-done" : ""}`} onClick={() => void copyContent()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "已复制，稍后清理剪贴板" : "复制全文"}</button> : null}
        </aside>
      </div>
      <footer className="text-share-foot"><ShieldCheck size={14} />加密存储 · 限时开放 · 页面关闭后需重新验证</footer>
    </section>}
  </main>;
}
