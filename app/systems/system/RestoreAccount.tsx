import { LoaderCircle, ShieldCheck, UserCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type RestoredAccount = { userId: number; userName: string; email: string };

/**
 * 账号恢复：超管按账号名恢复「已注销」的账号（解除软删除 + 重新绑定 otp_user 角色）。
 * 注销时已硬删除的保险库数据无法还原，恢复只代表该账号可以重新登录。
 */
export default function RestoreAccount({ notify }: { notify: Notify }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState<RestoredAccount | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = username.trim();
    if (!value) return notify("请输入要恢复的账号", "error");
    setBusy(true); setRestored(null);
    try {
      const result = await apiRequest<{ data?: RestoredAccount }>(`${API_PATHS.otp.vaultAccount}/admin/restore`, {
        method: "POST",
        body: { username: value },
      });
      setRestored(result.data || null);
      notify("账号已恢复", "success");
      setUsername("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "恢复失败", "error");
    } finally { setBusy(false); }
  }

  return <form className="sysm-center sysrestore" onSubmit={submit}>
    <div className="module-hero compact-hero">
      <div>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h1>账号恢复</h1>
        <p>恢复用户自助注销的账号，重新开放登录</p>
      </div>
      <span className="hero-tool-icon"><UserCheck size={27} /></span>
    </div>
    <section className="sysbroadcast-card sysrestore-card">
      <label><span>要恢复的账号名 *</span><input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={20} placeholder="例如：user8261（用户注销前的登录账号）" /></label>
      <p className="sysrestore-note">恢复会解除注销状态并重新绑定 OTP 用户角色；用户注销时已删除的保险库数据（凭据、分享、Passkey）无法找回。恢复成功会向该账号邮箱发送通知。</p>
      <div className="sysbroadcast-actions">
        <button className="sysbroadcast-send" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}{busy ? "正在恢复" : "恢复该账号"}</button>
      </div>
      {restored ? <div className="sysrestore-result"><b>{restored.userName}</b><small>已恢复可登录{restored.email ? ` · 通知已发送至 ${restored.email}` : ""}</small></div> : null}
    </section>
  </form>;
}
