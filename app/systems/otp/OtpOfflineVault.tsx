import { Copy, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { decryptVaultBackup, generateOfflineCode, readOfflineVault } from "./vaultCrypto";
import type { VaultTransferItem } from "./vaultApi";

export default function OtpOfflineVault({ onExit }: { onExit: () => void }) {
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<VaultTransferItem[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!items.length) return;
    let active = true;
    const refresh = () => void Promise.all(items.map((item) => generateOfflineCode(item))).then((values) => { if (active) setCodes(values); });
    refresh(); const timer = window.setInterval(refresh, 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [items]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try { setItems((await decryptVaultBackup(readOfflineVault(), password)).items); setPassword(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "无法解锁离线保险库"); }
  };

  return <main className="vault-page vault-offline-page">
    <section className="vault-head"><div className="vault-brand"><span className="vault-brand-mark"><KeyRound size={20} /></span><div><span className="vault-kicker">OFFLINE EMERGENCY</span><h1>OTP Vault</h1><p>本机离线应急模式</p></div></div><button type="button" className="vault-ghost" onClick={onExit}>返回登录</button></section>
    {!items.length ? <form className="vault-offline-unlock" onSubmit={unlock}><span><LockKeyhole size={23} /></span><small>LOCAL ENCRYPTED COPY</small><h2>解锁本机副本</h2><p>恢复密码只在当前浏览器中用于解密，不会发送到服务器。</p><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入恢复密码" autoComplete="off" />{error ? <em>{error}</em> : null}<button className="vault-primary" disabled={password.length < 8}><ShieldCheck size={15} />进入离线保险库</button></form> : <section className="vault-panel"><header className="vault-panel-head"><div><h2>离线验证码</h2><p>只读模式 · {items.length} 项 · 数据仅存在当前页面内存</p></div></header><div className="vault-grid">{items.map((item, index) => <article className="vault-card is-compact" key={`${item.issuer}-${item.accountName}-${index}`}><div className="vault-card-top"><span className="vault-service-mark">{item.issuer.slice(0,2).toUpperCase()}</span><div><b>{item.issuer}</b><small>{item.accountName}</small></div></div>{codes[index] ? <button type="button" className="vault-code" onClick={() => void navigator.clipboard.writeText(codes[index])}><span>{codes[index].replace(/(.{3})/, "$1 ")}</span><Copy size={14} /></button> : <div className="vault-no-code">未配置 OTP</div>}<div className="vault-card-foot"><span>{item.otpType || "TOTP"}</span><span>离线只读</span></div></article>)}</div></section>}
  </main>;
}
