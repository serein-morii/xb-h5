import { Check, Eye, LoaderCircle, MonitorUp, Pencil, RefreshCw, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";
import { renderRichText } from "../../lib/richText";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type RoleRow = { roleId?: number; roleName?: string; roleKey?: string; status?: string; delFlag?: string };

type BroadcastGroup = {
  groupKey: string; title: string; category?: string; contentType?: string; popup?: boolean;
  link?: string; content?: string; targetRole?: string | null; createTime?: string; recipientCount?: number;
};

const EMPTY_FORM = { title: "", category: "SYSTEM", contentType: "markdown", content: "", link: "", popup: false, roleKey: "" };

/**
 * 站内信维护：管理员编辑并群发「系统通知 / 升级公告」。
 * 支持按系统模块（角色）定向投递；下方投递记录可再次编辑（可选择重置为未读重新提醒）或删除。
 */
function formatTime(value?: string) {
  if (!value) return "--";
  const time = new Date(String(value).replace(/-/g, "/"));
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MessageBroadcast({ notify }: { notify: Notify }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingGroup, setEditingGroup] = useState<BroadcastGroup | null>(null);
  const [resetRead, setResetRead] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [records, setRecords] = useState<BroadcastGroup[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewHtml = useMemo(() => renderRichText(form.content, form.contentType), [form.content, form.contentType]);

  const loadRecords = useCallback(() => {
    setRecordsLoading(true);
    apiRequest<{ data?: BroadcastGroup[] }>(`${API_PATHS.message.root}/broadcast/list?limit=50`)
      .then((result) => setRecords(Array.isArray(result.data) ? result.data : []))
      .catch(() => setRecords([]))
      .finally(() => setRecordsLoading(false));
  }, []);

  useEffect(() => {
    loadRecords();
    // 角色列表用于「按系统模块定向」：OTP 用户 / 各业务角色等
    apiRequest<{ rows?: RoleRow[]; data?: RoleRow[] }>(`${API_PATHS.identity.roles}?pageNum=1&pageSize=100&status=0`)
      .then((result) => {
        const rows = Array.isArray(result.rows) ? result.rows : Array.isArray(result.data) ? result.data : [];
        setRoles(rows.filter((row) => row.roleKey && String(row.status ?? "0") === "0"));
      })
      .catch(() => setRoles([]));
  }, [loadRecords]);

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEdit(group: BroadcastGroup) {
    setEditingGroup(group);
    setForm({
      title: group.title || "",
      category: group.category || "SYSTEM",
      contentType: group.contentType || "text",
      content: group.content || "",
      link: group.link || "",
      popup: Boolean(group.popup),
      roleKey: group.targetRole || "",
    });
    setPreview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingGroup(null);
    setForm({ ...EMPTY_FORM });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return notify("请填写通知标题", "error");
    if (!form.content.trim()) return notify("请填写通知内容", "error");
    setBusy(true);
    try {
      if (editingGroup) {
        const result = await apiRequest<{ data?: { updated?: number } }>(`${API_PATHS.message.root}/broadcast/${editingGroup.groupKey}`, {
          method: "PUT",
          body: { ...form, roleKey: form.roleKey || undefined, resetRead },
        });
        notify(`已更新 ${Number(result.data?.updated ?? 0)} 条投递${resetRead ? "，并重置为未读提醒" : ""}`, "success");
        cancelEdit();
      } else {
        const result = await apiRequest<{ data?: { sent?: number } }>(`${API_PATHS.message.root}/broadcast`, {
          method: "POST",
          body: { ...form, roleKey: form.roleKey || undefined },
        });
        notify(`通知已投递给 ${Number(result.data?.sent ?? 0)} 位用户`, "success");
        setForm({ ...EMPTY_FORM });
      }
      loadRecords();
    } catch (error) {
      notify(error instanceof Error ? error.message : "发送失败", "error");
    } finally { setBusy(false); }
  }

  async function removeGroup(group: BroadcastGroup) {
    if (confirmDeleteKey !== group.groupKey) { setConfirmDeleteKey(group.groupKey); return; }
    setConfirmDeleteKey(null);
    try {
      const result = await apiRequest<{ data?: { deleted?: number } }>(`${API_PATHS.message.root}/broadcast/${group.groupKey}`, { method: "DELETE" });
      notify(`已删除 ${Number(result.data?.deleted ?? 0)} 条投递`, "success");
      if (editingGroup?.groupKey === group.groupKey) cancelEdit();
      loadRecords();
    } catch (error) { notify(error instanceof Error ? error.message : "删除失败", "error"); }
  }

  return <div className="sysm-center sysbroadcast">
    <div className="module-hero compact-hero">
      <div>
        <span className="eyebrow">NOTIFICATIONS</span>
        <h1>{editingGroup ? "编辑通知" : "站内信维护"}</h1>
        <p>{editingGroup ? `正在编辑「${editingGroup.title}」` : "系统通知与升级公告在此编辑群发，可按系统模块（角色）定向投递"}</p>
      </div>
      <span className="hero-tool-icon"><Send size={27} /></span>
    </div>
    <form className="sysbroadcast-card" onSubmit={submit}>
      <div className="sysbroadcast-grid">
        <label><span>标题 *</span><input value={form.title} onChange={(event) => setField("title", event.target.value)} maxLength={60} placeholder="例如：OTP Vault 新版本上线" /></label>
        <label><span>分类</span><select value={form.category} onChange={(event) => setField("category", event.target.value)}><option value="SYSTEM">系统通知</option><option value="OTP">OTP 安全</option></select></label>
        <label><span>内容格式</span><select value={form.contentType} onChange={(event) => setField("contentType", event.target.value)}><option value="text">纯文本</option><option value="markdown">Markdown</option><option value="html">HTML</option></select></label>
        <label><span>投递范围</span><select value={form.roleKey} onChange={(event) => setField("roleKey", event.target.value)}><option value="">全部有效用户</option>{roles.map((role) => <option key={String(role.roleKey)} value={String(role.roleKey)}>{role.roleName || role.roleKey}（{role.roleKey}）</option>)}</select></label>
      </div>
      <label><span>正文（{form.contentType === "html" ? "HTML 源码" : form.contentType === "markdown" ? "Markdown" : "纯文本"}）*</span><textarea rows={8} value={form.content} onChange={(event) => setField("content", event.target.value)} placeholder={form.contentType === "text" ? "通知正文…" : "支持标题、**加粗**、列表、链接等格式…"} /></label>
      <label className="sysbroadcast-popup"><input type="checkbox" checked={form.popup} onChange={(event) => setField("popup", event.target.checked)} /><i /><span><MonitorUp size={14} />打开页面时弹窗展示</span><small>用户点击「确认」后不再弹出；直接关闭或忽略则下次打开仍会弹。</small></label>
      {editingGroup ? <label className="sysbroadcast-popup"><input type="checkbox" checked={resetRead} onChange={(event) => setResetRead(event.target.checked)} /><i /><span>保存后重置为未读</span><small>让已收到旧版本的用户重新收到提醒；关闭则只改内容不打扰。</small></label> : null}
      <div className="sysbroadcast-actions">
        <div className="sysbroadcast-actions-left">
          <button type="button" className={`sysbroadcast-preview-toggle${preview ? " is-active" : ""}`} onClick={() => setPreview((value) => !value)}><Eye size={15} />{preview ? "收起预览" : "预览效果"}</button>
          {editingGroup ? <button type="button" className="sysbroadcast-preview-toggle" onClick={cancelEdit}>取消编辑</button> : null}
        </div>
        <button className="sysbroadcast-send" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : editingGroup ? <Check size={15} /> : <Send size={15} />}{busy ? "正在处理" : editingGroup ? "保存修改" : "投递给选定用户"}</button>
      </div>
      {preview ? <div className="sysbroadcast-preview"><b>预览</b><div className="notif-item-content" dangerouslySetInnerHTML={{ __html: previewHtml }} /></div> : null}
    </form>

    <section className="sysbroadcast-records">
      <header className="sysbroadcast-records-head">
        <div><b>投递记录</b><small>共 {records.length} 次群发 · 点击「编辑」可修改内容或重新提醒</small></div>
        <button type="button" className="sysbroadcast-preview-toggle" onClick={loadRecords}><RefreshCw size={14} />刷新</button>
      </header>
      {recordsLoading ? <p className="sysbroadcast-empty">正在加载投递记录…</p>
        : !records.length ? <p className="sysbroadcast-empty">还没有群发过通知，填写上方表单发出第一条。</p>
        : <div className="sysbroadcast-list">
          <div className="sysbroadcast-row sysbroadcast-row-head" aria-hidden="true">
            <span>通知</span><span>投递范围</span><span>发送时间</span><span>人数</span><span className="sysbroadcast-cell-actions">操作</span>
          </div>
          {records.map((group) => (
            <article className={`sysbroadcast-row${editingGroup?.groupKey === group.groupKey ? " is-editing" : ""}`} key={group.groupKey}>
              <div className="sysbroadcast-cell sysbroadcast-cell-title" data-label="通知">
                <b>{group.title}</b>
                <span className="sysbroadcast-cell-tags">
                  <small className={`notif-chip notif-chip-${(group.category || "SYSTEM").toLowerCase()}`}>{group.category === "OTP" ? "OTP" : "系统"}</small>
                  {group.popup ? <small className="notif-chip notif-chip-popup">弹窗</small> : null}
                  <small className="sysbroadcast-format">{group.contentType === "html" ? "HTML" : group.contentType === "markdown" ? "MD" : "文本"}</small>
                </span>
              </div>
              <div className="sysbroadcast-cell" data-label="投递范围">{group.targetRole ? <code>{group.targetRole}</code> : "全部用户"}</div>
              <div className="sysbroadcast-cell" data-label="发送时间">{formatTime(group.createTime)}</div>
              <div className="sysbroadcast-cell sysbroadcast-cell-count" data-label="人数">{Number(group.recipientCount || 0)}</div>
              <div className="sysbroadcast-cell sysbroadcast-cell-actions">
                <button type="button" className="sysbroadcast-op" onClick={() => startEdit(group)}><Pencil size={13} />编辑</button>
                <button type="button" className={`sysbroadcast-op is-danger${confirmDeleteKey === group.groupKey ? " is-confirm" : ""}`} onClick={() => void removeGroup(group)}><Trash2 size={13} />{confirmDeleteKey === group.groupKey ? "确认删除" : "删除"}</button>
              </div>
              <div className="sysbroadcast-cell sysbroadcast-cell-meta">
                <span>范围 <b>{group.targetRole ? group.targetRole : "全部用户"}</b></span>
                <span>时间 <b>{formatTime(group.createTime)}</b></span>
                <span>人数 <b>{Number(group.recipientCount || 0)}</b></span>
              </div>
            </article>
          ))}
        </div>}
    </section>
  </div>;
}
