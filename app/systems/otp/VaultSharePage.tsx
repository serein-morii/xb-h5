import { Check, ChevronDown, Clock3, Copy, ExternalLink, Eye, EyeOff, KeyRound, Layers3, LayoutGrid, LoaderCircle, LockKeyhole, Moon, Search, ShieldCheck, Sun, SunMoon, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getSharedContent, getShareStatus, openVaultShare, type SharedItem, type ShareStatus } from "./vaultApi";
import { issuerStyle } from "./issuerStyle";
import { readThemePreference, setThemePreference, type ThemePreference } from "../../lib/theme";
import VaultToastMessage from "./VaultToastMessage";
import "./otp-vault.css";

export default function VaultSharePage({ token }: { token: string }) {
  const sessionKey = `otp-vault-share:${token}`;
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [accessCode, setAccessCode] = useState(() => {
    const match = location.hash.match(/^#k=([A-Za-z0-9]{4,12})$/);
    return match ? decodeURIComponent(match[1]).toUpperCase() : "";
  });
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(sessionKey) || "");
  const [items, setItems] = useState<SharedItem[]>([]);
  const [allowCopy, setAllowCopy] = useState(false);
  const [expireTime, setExpireTime] = useState("");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [toast, setToast] = useState("");
  const [detailItem, setDetailItem] = useState<SharedItem | null>(null);
  const [detailPasswordVisible, setDetailPasswordVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [displayPrefs, setDisplayPrefs] = useState(() => {
    try { return { compact: true, grouped: true, ...JSON.parse(localStorage.getItem("otp-vault-share-prefs") || "{}") }; }
    catch { return { compact: true, grouped: true }; }
  });
  const [themeMode, setThemeMode] = useState<ThemePreference>(() => readThemePreference());
  const toggleHeaderTheme = () => {
    const next = themeMode === "system" ? "dark" : themeMode === "dark" ? "light" : "system";
    setThemePreference(next);
    setThemeMode(next);
  };
  const otpRefreshAt = useRef(0);
  const expiryTotal = useRef(0);
  const serverTimeOffset = useRef(0);
  const syncedNow = now + serverTimeOffset.current;

  const loadContent = useCallback(async (session: string) => {
    try {
      const requestedAt = Date.now();
      const result = await getSharedContent(token, session);
      const receivedAt = Date.now();
      const serverNow = result.data.serverTime + Math.round((receivedAt - requestedAt) / 2);
      serverTimeOffset.current = serverNow - receivedAt;
      expiryTotal.current ||= Math.max(1, Math.ceil((new Date(normalizeDateTime(result.data.expireTime)).getTime() - serverNow) / 1000));
      setItems(result.data.items || []); setAllowCopy(Boolean(result.data.allowCopy)); setExpireTime(result.data.expireTime); setError("");
      if (result.data.name) setStatus((current) => current ? { ...current, name: result.data.name } : current);
    } catch (contentError) {
      sessionStorage.removeItem(sessionKey); setSessionToken(""); setItems([]);
      setError(contentError instanceof Error ? contentError.message : "临时访问会话已失效");
    }
  }, [sessionKey, token]);

  const open = useCallback(async (code: string) => {
    setBusy(true); setError("");
    try {
      const result = await openVaultShare(token, code);
      const session = result.data.sessionToken;
      sessionStorage.setItem(sessionKey, session); setSessionToken(session);
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      await loadContent(session);
    } catch (openError) { setError(openError instanceof Error ? openError.message : "访问验证失败"); }
    finally { setBusy(false); }
  }, [loadContent, sessionKey, token]);

  useEffect(() => {
    getShareStatus(token).then((result) => {
      setStatus(result.data);
      if (result.data.status !== "ACTIVE") return;
      if (sessionToken) void loadContent(sessionToken);
      else if (!result.data.accessCodeRequired || accessCode) void open(accessCode);
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "授权链接不存在"));
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!sessionToken) return; const timer = window.setInterval(() => void loadContent(sessionToken), 10_000); return () => window.clearInterval(timer); }, [loadContent, sessionToken]);
  useEffect(() => {
    if (!sessionToken || !items.some((item) => item.otpValidUntil && item.otpValidUntil <= syncedNow) || syncedNow - otpRefreshAt.current < 1000) return;
    otpRefreshAt.current = syncedNow;
    void loadContent(sessionToken);
  }, [items, loadContent, sessionToken, syncedNow]);
  useEffect(() => { localStorage.setItem("otp-vault-share-prefs", JSON.stringify(displayPrefs)); }, [displayPrefs]);
  useEffect(() => {
    if (!status?.name) return;
    document.title = `${status.name}｜OTP Vault`;
  }, [status?.name]);

  const copy = async (value: string, key: string, message = "已复制") => {
    if (!allowCopy) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setToast(message);
    window.setTimeout(() => setCopied(""), 1600);
  };
  const liveShareDetail = detailItem ? items.find((item) => item.issuer === detailItem.issuer && item.accountName === detailItem.accountName) || detailItem : null;
  const shareDetailLeft = liveShareDetail?.otpValidUntil ? Math.max(0, Math.ceil((liveShareDetail.otpValidUntil - syncedNow) / 1000)) : 0;
  const shareDetailProgress = liveShareDetail?.otpPeriodSeconds ? Math.max(0, Math.min(100, shareDetailLeft / liveShareDetail.otpPeriodSeconds * 100)) : 0;
  const expiresIn = expireTime ? Math.max(0, Math.ceil((new Date(normalizeDateTime(expireTime)).getTime() - syncedNow) / 1000)) : 0;
  const expiryProgress = expiryTotal.current ? Math.max(0, Math.min(100, expiresIn / expiryTotal.current * 100)) : 100;
  const secondsProgress = expiresIn ? ((expiresIn - 1) % 60 + 1) / 60 * 100 : 0;
  const accessExpiresIn = status?.expireTime ? Math.max(0, Math.ceil((new Date(normalizeDateTime(status.expireTime)).getTime() - now) / 1000)) : 0;
  const statusMessage = status?.status === "EXPIRED" ? "授权已经过期" : status?.status === "REVOKED" ? "授权已被撤销" : status?.status === "LIMIT_REACHED" ? "授权访问次数已用完" : "授权链接不可用";
  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? items.filter((item) => `${item.issuer} ${item.accountName || ""}`.toLowerCase().includes(value)) : items;
  }, [items, query]);
  const groups = useMemo(() => displayPrefs.grouped ? [...new Set(filteredItems.map((item) => item.issuer))].map((name) => [name, filteredItems.filter((item) => item.issuer === name)] as const) : [["", filteredItems] as const], [displayPrefs.grouped, filteredItems]);

  if (!status && !error) return <main className="share-page"><section className="share-loading"><span className="share-vault-mark">OTP</span><LoaderCircle className="spin" size={20} /><p>正在检查临时授权…</p></section></main>;
  if (!status && error) return <main className="share-page"><section className="share-expired"><TriangleAlert size={32} /><span>OTP VAULT</span><h1>无法打开授权</h1><p>{error}</p></section></main>;
  if (status && status.status !== "ACTIVE") return <main className="share-page"><section className="share-expired"><TriangleAlert size={32} /><span>OTP VAULT</span><h1>{statusMessage}</h1><p>请联系授权人重新创建一份临时授权。</p></section></main>;

  const gateVisible = !sessionToken || !items.length;
  return <main className={`share-page ${gateVisible ? "is-gate" : "is-open"}`}>
    <header className="share-brand"><span className="share-vault-mark">OTP</span><div><b>OTP Vault</b><small>{status?.name || "临时凭据授权"}</small></div><button type="button" className="vault-ghost vault-theme-action" onClick={toggleHeaderTheme} aria-label={`切换显示模式，当前${themeMode === "system" ? "跟随系统" : themeMode === "dark" ? "暗黑" : "亮色"}`}>{themeMode === "system" ? <SunMoon size={18} /> : themeMode === "dark" ? <Moon size={18} /> : <Sun size={18} />}<span>{themeMode === "system" ? "系统" : themeMode === "dark" ? "暗黑" : "亮色"}</span></button></header>
    {gateVisible ? <section className="share-access-card">
      <div className="share-access-intro"><span className="share-lock"><LockKeyhole size={24} /></span><div><small>受保护的临时分享</small><h1>{status?.name || (status?.accessCodeRequired ? "验证后查看" : "查看临时授权")}</h1><p>授权人已为你临时开放凭据，验证前不会传输任何敏感内容。</p></div></div>
      <div className="share-access-summary"><span><small>授权内容</small><b>{status?.itemCount || 0} 项</b></span><span><small>剩余时间</small><b>{formatDuration(accessExpiresIn)}</b></span></div>
      {status?.accessCodeRequired ? <form onSubmit={(event: FormEvent) => { event.preventDefault(); void open(accessCode); }}><label><span>输入访问码</span><div className="share-code-input"><KeyRound size={17} /><input autoFocus inputMode="text" enterKeyHint="go" spellCheck={false} aria-label="访问码" value={accessCode} onChange={(event) => { setAccessCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); if (error) setError(""); }} minLength={4} maxLength={12} autoComplete="one-time-code" placeholder="粘贴或输入访问码" /></div></label><p className="share-access-help">支持直接粘贴，输入完成后按回车</p><button disabled={busy || accessCode.length < 4}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy ? "正在验证" : "继续查看"}</button></form> : <button className="share-open-button" disabled={busy} onClick={() => void open("")}>{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}{busy ? "正在建立安全会话" : "打开授权内容"}</button>}
      <footer><ShieldCheck size={13} />访问会话不会超过原授权有效期</footer>
    </section> : <section className="share-content">
      <header><div><span>临时授权已验证</span><h1>{status?.name || "凭据内容"}</h1><p>{items.length} 项内容 · {allowCopy ? "允许复制" : "仅允许查看"}</p></div><div className="share-expiry"><span className="share-expiry-ring"><svg className="share-expiry-progress" viewBox="0 0 44 44" aria-hidden="true"><circle className="share-expiry-track is-total" cx="22" cy="22" r="19" pathLength="100" /><circle className="share-expiry-total" cx="22" cy="22" r="19" pathLength="100" style={{ strokeDashoffset: 100 - expiryProgress }} /><circle className="share-expiry-track is-seconds" cx="22" cy="22" r="15" pathLength="100" /><circle className="share-expiry-seconds" cx="22" cy="22" r="15" pathLength="100" style={{ strokeDashoffset: 100 - secondsProgress }} /></svg><Clock3 className="share-expiry-clock" size={15} /></span><span className="share-expiry-copy"><small>授权剩余时间</small><b>{formatDuration(expiresIn)}</b></span></div></header>
      <div className="share-toolbar vault-panel-tools"><label className={`vault-view-toggle${displayPrefs.grouped ? " is-active" : ""}`}><Layers3 size={14} /><span>分组</span><input type="checkbox" checked={displayPrefs.grouped} onChange={(event) => setDisplayPrefs({ ...displayPrefs, grouped: event.target.checked })} /><i /></label><label className={`vault-view-toggle${displayPrefs.compact ? " is-active" : ""}`}><LayoutGrid size={14} /><span>紧凑</span><input type="checkbox" checked={displayPrefs.compact} onChange={(event) => setDisplayPrefs({ ...displayPrefs, compact: event.target.checked })} /><i /></label><div className="vault-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务或账号" aria-label="搜索分享凭据" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="清空搜索"><X size={14} /></button> : null}</div></div>
      <div className="share-groups">{groups.map(([name, groupItems]) => <section className="share-group" key={name || "all"}>{name ? <header><b>{name}</b><span>{groupItems.length}</span></header> : null}<div className={`share-item-list${displayPrefs.compact ? " is-compact" : ""}`}>{groupItems.map((item, index) => <SharedItemCard key={`${item.issuer}-${item.accountName || ""}-${index}`} item={item} index={index} groupName={name} compact={displayPrefs.compact} allowCopy={allowCopy} copied={copied} now={syncedNow} onCopy={copy} onOpenDetail={() => { setDetailPasswordVisible(false); setDetailItem(item); }} />)}</div></section>)}{!filteredItems.length ? <p className="share-empty">没有匹配的凭据</p> : null}</div>
      <footer><ShieldCheck size={13} />本页禁止缓存；授权过期或撤销后会话立即失效</footer>
      {liveShareDetail ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailItem(null); }}><section className="vault-modal share vault-share-form vault-detail">
        <header><div><small>CREDENTIAL DETAIL</small><h2>凭据详情</h2><p>查看账号、密码和动态验证码</p></div><button type="button" onClick={() => setDetailItem(null)} aria-label="关闭"><X size={18} /></button></header>
        <div className="vault-share-scroll">
          <section className="vault-detail-overview"><span className="vault-service-mark" style={{ background: issuerStyle(liveShareDetail.issuer, liveShareDetail.loginUrl).background }}>{issuerStyle(liveShareDetail.issuer, liveShareDetail.loginUrl).letters}</span><div><small>SHARED CREDENTIAL</small><b>{liveShareDetail.issuer}</b><p>{liveShareDetail.accountName}</p></div><em>共享</em></section>
          <section className="vault-share-section vault-detail-section"><div className="vault-section-title"><div><span>01</span><h3>登录信息</h3></div><small>授权内容仅在有效期内可查看</small></div><div className="vault-detail-values">
            {liveShareDetail.accountName ? <section><span>账号</span><div><b>{liveShareDetail.accountName}</b>{allowCopy ? <button type="button" onClick={() => void copy(liveShareDetail.accountName || "", "detail-account", "账号已复制")} aria-label="复制账号"><Copy size={15} /></button> : null}</div></section> : null}
            {liveShareDetail.password ? <section><span>密码</span><div><b className={detailPasswordVisible ? "" : "is-secret"}>{detailPasswordVisible ? liveShareDetail.password : "••••••••••••"}</b><button type="button" onClick={() => setDetailPasswordVisible(!detailPasswordVisible)} aria-label={detailPasswordVisible ? "隐藏密码" : "显示密码"}>{detailPasswordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button>{allowCopy ? <button type="button" onClick={() => void copy(liveShareDetail.password || "", "detail-password", "密码已复制")} aria-label="复制密码"><Copy size={15} /></button> : null}</div></section> : null}
            {liveShareDetail.otp ? <section className="is-otp"><span className="vault-otp-label">动态验证码{liveShareDetail.otpValidUntil ? <em>{shareDetailLeft}s</em> : null}</span><div><b>{liveShareDetail.otp.replace(/(.{3})/, "$1 ")}</b>{allowCopy ? <button type="button" onClick={() => void copy(liveShareDetail.otp || "", "detail-otp", "验证码已复制")} aria-label="复制验证码"><Copy size={15} /></button> : null}</div>{liveShareDetail.otpValidUntil ? <div className="vault-progress"><i style={{ width: `${shareDetailProgress}%` }} /></div> : null}</section> : null}
          </div></section>
          {liveShareDetail.loginUrl || liveShareDetail.note ? <section className="vault-share-section vault-detail-section"><div className="vault-section-title"><div><span>02</span><h3>补充信息</h3></div></div>{liveShareDetail.loginUrl ? <a className="vault-detail-link" href={liveShareDetail.loginUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /><span>{liveShareDetail.loginUrl}</span></a> : null}{liveShareDetail.note ? <p className="vault-detail-note">{liveShareDetail.note}</p> : null}</section> : null}
        </div>
        <footer><span>共享凭据只允许查看</span><div><button type="button" className="vault-primary" onClick={() => setDetailItem(null)}>完成</button></div></footer>
      </section></div> : null}
    </section>}
    <VaultToastMessage message={toast || error} onDismiss={() => { setToast(""); setError(""); }} />
  </main>;
}

function SharedItemCard({ item, index, groupName, compact, allowCopy, copied, now, onCopy, onOpenDetail }: { item: SharedItem; index: number; groupName: string; compact: boolean; allowCopy: boolean; copied: string; now: number; onCopy: (value: string, key: string, message?: string) => void; onOpenDetail: () => void }) {
  const [open, setOpen] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const left = item.otpValidUntil ? Math.max(0, Math.ceil((item.otpValidUntil - now) / 1000)) : 0;
  const progress = item.otpPeriodSeconds ? Math.max(0, Math.min(100, left / item.otpPeriodSeconds * 100)) : 0;
  const mark = issuerStyle(item.issuer, item.loginUrl);
  const otpKey = `${groupName}-${index}-otp`;
  const accountKey = `${groupName}-${index}-account`;
  const passwordKey = `${groupName}-${index}-password`;
  const hasDetails = Boolean(item.accountName || item.password || item.loginUrl || item.note);
  return <article className={`vault-card${compact ? " is-compact" : ""}`}>
    <div className="vault-card-top share-item-title"><span className="vault-service-mark" style={{ background: mark.background }}>{mark.letters}</span><div><b>{item.issuer}</b>{item.accountName ? <small>{item.accountName}</small> : null}</div></div>
    {item.otp ? allowCopy ? <button type="button" className="vault-code" onClick={() => void onCopy(item.otp || "", otpKey, "验证码已复制")}><span>{item.otp.replace(/(.{3})/, "$1 ")}</span>{copied === otpKey ? <Check size={15} /> : <Copy size={15} />}</button> : <div className="vault-code is-readonly"><span>{item.otp.replace(/(.{3})/, "$1 ")}</span></div> : <div className="vault-no-code"><KeyRound size={16} />共享账号密码</div>}
    <div className="vault-progress"><i style={{ width: `${item.otp ? progress : 0}%` }} /></div>
    <div className="vault-card-foot"><span>{item.otp ? "动态验证码" : "账号密码"}</span><span>{item.otp ? `${left}s` : ""}</span></div>
    <div className="vault-card-actions"><button type="button" onClick={onOpenDetail} aria-label="查看"><Eye size={13} /><span>查看</span></button>{hasDetails ? <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "收起" : "展开"} className={open ? "is-expanded" : ""}><ChevronDown size={13} /><span>{open ? "收起" : "展开"}</span></button> : null}</div>
    {open ? <div className="share-card-detail">
      {item.accountName ? <section><span>账号</span><div><b>{item.accountName}</b>{allowCopy ? <button type="button" onClick={() => void onCopy(item.accountName || "", accountKey, "账号已复制")}>{copied === accountKey ? <Check size={15} /> : <Copy size={15} />}</button> : null}</div></section> : null}
      {item.password ? <section><span>密码</span><div><b className={passwordVisible ? "" : "is-secret"}>{passwordVisible ? item.password : "••••••••••"}</b><button type="button" onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? "隐藏" : "显示"}</button>{allowCopy ? <button type="button" onClick={() => void onCopy(item.password || "", passwordKey, "密码已复制")}>{copied === passwordKey ? <Check size={15} /> : <Copy size={15} />}</button> : null}</div></section> : null}
      {item.loginUrl ? <a className="share-login-link" href={item.loginUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />打开登录地址</a> : null}
      {item.note ? <p className="share-note">{item.note}</p> : null}
    </div> : null}
  </article>;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "已到期";
  if (seconds >= 10 * 365 * 86400) return "长期有效";
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
  return days ? `${days}天 ${hours}时 ${minutes}分` : hours ? `${hours}时 ${minutes}分` : minutes ? `${minutes}分 ${rest}秒` : `${rest}秒`;
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : value.replace(" ", "T");
}
