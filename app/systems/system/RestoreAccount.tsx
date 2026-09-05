import { LoaderCircle, RefreshCw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type DeletedAccount = {
  userId: number; userName: string; nickName?: string; email?: string; deleteTime?: string;
};

/**
 * 账号恢复：先列出用户自助注销的账号（del_flag='2'），管理员逐个恢复。
 * 恢复 = 解除软删除 + 重新绑定 otp_user 角色；注销时已硬删除的保险库数据无法还原。
 */
export default function RestoreAccount({ notify }: { notify: Notify }) {
  const [accounts, setAccounts] = useState<DeletedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [restored, setRestored] = useState<number[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    apiRequest<{ data?: DeletedAccount[] }>(`${API_PATHS.otp.vaultAccount}/admin/deleted`)
      .then((result) => setAccounts(Array.isArray(result.data) ? result.data : []))
      .catch((error) => notify(error instanceof Error ? error.message : "注销账号列表加载失败", "error"))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => { void load(); }, [load]);

  async function restore(account: DeletedAccount) {
    if (confirmId !== account.userId) { setConfirmId(account.userId); return; }
    setConfirmId(null);
    setRestoringId(account.userId);
    try {
      await apiRequest(`${API_PATHS.otp.vaultAccount}/admin/restore`, {
        method: "POST",
        body: { username: account.userName },
      });
      setRestored((ids) => [...ids, account.userId]);
      notify(`账号 ${account.userName} 已恢复，可以重新登录`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "恢复失败", "error");
    } finally { setRestoringId(null); }
  }

  const keywordLower = keyword.trim().toLowerCase();
  const visible = accounts.filter((account) => !keywordLower
    || String(account.userName || "").toLowerCase().includes(keywordLower)
    || String(account.nickName || "").toLowerCase().includes(keywordLower)
    || String(account.email || "").toLowerCase().includes(keywordLower));
  const pending = visible.filter((account) => !restored.includes(account.userId));

  return <div className="sysm-center sysrestore">
    <div className="module-hero compact-hero">
      <div>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h1>账号恢复</h1>
        <p>恢复用户自助注销的账号，重新开放登录；保险库数据无法找回</p>
      </div>
      <span className="hero-tool-icon"><UserCheck size={25} /></span>
    </div>

    <section className="sysrestore-list-card">
      <header className="sysrestore-list-head">
        <div><b>已注销账号</b><small>共 {pending.length} 个待恢复</small></div>
        <div className="sysrestore-tools">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索账号 / 邮箱" aria-label="搜索注销账号" />
          <button type="button" className="sysbroadcast-preview-toggle" onClick={load}><RefreshCw size={14} className={loading ? "spin" : ""} />刷新</button>
        </div>
      </header>

      {loading ? <p className="sysbroadcast-empty"><LoaderCircle className="spin" size={15} /> 正在加载注销账号…</p>
        : !pending.length ? <div className="sysrestore-empty"><UserX size={24} /><b>{accounts.length ? "没有匹配的账号" : "当前没有已注销的账号"}</b><small>用户在「我的 → 注销账号」操作后会出现在这里</small></div>
        : <div className="sysrestore-list">
          {pending.map((account) => (
            <article className="sysrestore-row" key={account.userId}>
              <span className="sc-avatar sysrestore-avatar">{String(account.userName || "?").slice(0, 1).toUpperCase()}</span>
              <div className="sysrestore-row-main">
                <b>{account.userName}</b>
                <small>
                  {account.nickName && account.nickName !== account.userName ? `${account.nickName} · ` : ""}
                  {account.email || "未绑定邮箱"}
                  {account.deleteTime ? ` · 注销于 ${formatDeleteTime(account.deleteTime)}` : ""}
                </small>
              </div>
              <div className="sysrestore-row-actions">
                <button type="button"
                  className={`sysbroadcast-op${confirmId === account.userId ? " is-danger is-confirm" : ""}`}
                  disabled={restoringId === account.userId}
                  onClick={() => void restore(account)}>
                  {restoringId === account.userId ? <LoaderCircle className="spin" size={13} /> : <ShieldCheck size={13} />}
                  {restoringId === account.userId ? "恢复中" : confirmId === account.userId ? "确认恢复" : "恢复"}
                </button>
              </div>
            </article>
          ))}
          {restored.length ? <p className="sysrestore-restored-note">本次已恢复 {restored.length} 个账号，恢复成功会向账号邮箱发送通知。</p> : null}
        </div>}
    </section>
  </div>;
}

function formatDeleteTime(value?: string) {
  if (!value) return "未知";
  const time = new Date(String(value).replace(/-/g, "/"));
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
