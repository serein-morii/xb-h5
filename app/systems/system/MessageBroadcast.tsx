import { Check, Eye, LoaderCircle, MonitorUp, Pencil, RefreshCw, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";
import { renderRichText } from "../../lib/richText";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type BroadcastGroup = {
  groupKey: string; title: string; category?: string; contentType?: string; popup?: boolean;
  link?: string; content?: string; targetRole?: string | null; createTime?: string; recipientCount?: number;
  readCount?: number; unreadCount?: number;
};

const EMPTY_FORM = { title: "", category: "SYSTEM", contentType: "markdown", content: "", link: "", popup: false, target: "ALL" };

/** 投递目标：按业务系统模块。 */
const TARGETS = [
  { value: "ALL", label: "全部用户" },
  { value: "ORDER", label: "订单系统" },
  { value: "OTP", label: "OTP 系统" },
  { value: "ADMIN", label: "仅管理员" },
] as const;

function targetLabel(value?: string | null) {
  return TARGETS.find((item) => item.value === value)?.label || "全部用户";
}

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
  const [records, setRecords] = useState<BroadcastGroup[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [readersGroup, setReadersGroup] = useState<BroadcastGroup | null>(null);
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
      target: group.targetRole || "ALL",
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
          body: { ...form, resetRead },
        });
        notify(`已更新 ${Number(result.data?.updated ?? 0)} 条投递${resetRead ? "，并重置为未读提醒" : ""}`, "success");
        cancelEdit();
      } else {
        const result = await apiRequest<{ data?: { sent?: number } }>(`${API_PATHS.message.root}/broadcast`, {
          method: "POST",
          body: { ...form },
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
      if (readersGroup?.groupKey === group.groupKey) setReadersGroup(null);
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
        <label><span>投递范围</span><select value={form.target} onChange={(event) => setField("target", event.target.value)}>{TARGETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
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
            <span>通知</span><span>投递范围</span><span>发送时间</span><span>已读 / 投递</span><span className="sysbroadcast-cell-actions">操作</span>
          </div>
          {records.map((group) => (
            <article className={`sysbroadcast-row${editingGroup?.groupKey === group.groupKey ? " is-editing" : ""}${readersGroup?.groupKey === group.groupKey ? " is-reading" : ""}`} key={group.groupKey}>
              <div className="sysbroadcast-cell sysbroadcast-cell-title" data-label="通知">
                <b>{group.title}</b>
                <span className="sysbroadcast-cell-tags">
                  <small className={`notif-chip notif-chip-${(group.category || "SYSTEM").toLowerCase()}`}>{group.category === "OTP" ? "OTP" : "系统"}</small>
                  {group.popup ? <small className="notif-chip notif-chip-popup">弹窗</small> : null}
                  <small className="sysbroadcast-format">{group.contentType === "html" ? "HTML" : group.contentType === "markdown" ? "MD" : "文本"}</small>
                </span>
              </div>
              <div className="sysbroadcast-cell" data-label="投递范围"><b>{targetLabel(group.targetRole)}</b></div>
              <div className="sysbroadcast-cell" data-label="发送时间">{formatTime(group.createTime)}</div>
              <div className="sysbroadcast-cell sysbroadcast-cell-count" data-label="已读 / 投递">{Number(group.readCount || 0)} / {Number(group.recipientCount || 0)}</div>
              <div className="sysbroadcast-cell sysbroadcast-cell-actions">
                <button type="button" className="sysbroadcast-op" onClick={() => setReadersGroup(group)}><Eye size={13} />阅读记录</button>
                <button type="button" className="sysbroadcast-op" onClick={() => startEdit(group)}><Pencil size={13} />编辑</button>
                <button type="button" className={`sysbroadcast-op is-danger${confirmDeleteKey === group.groupKey ? " is-confirm" : ""}`} onClick={() => void removeGroup(group)}><Trash2 size={13} />{confirmDeleteKey === group.groupKey ? "确认删除" : "删除"}</button>
              </div>
              <div className="sysbroadcast-cell sysbroadcast-cell-meta">
                <span>范围 <b>{targetLabel(group.targetRole)}</b></span>
                <span>时间 <b>{formatTime(group.createTime)}</b></span>
                <span>已读 <b>{Number(group.readCount || 0)} / {Number(group.recipientCount || 0)}</b></span>
              </div>
            </article>
          ))}
        </div>}
    </section>
    {readersGroup ? <ReadReceipts key={readersGroup.groupKey} group={readersGroup} onClose={() => setReadersGroup(null)} /> : null}
  </div>;
}

type Reader = { userId: number; username: string; nickname?: string; isRead: boolean | number; readTime?: string; firstReadTime?: string; userDeleted?: boolean | number };

function truthy(value: boolean | number | undefined) {
  return value === true || value === 1;
}

function ReadReceipts({ group, onClose }: { group: BroadcastGroup; onClose: () => void }) {
  const [state, setState] = useState("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Reader[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    apiRequest<{ data: { rows: Reader[]; total: number } }>(`${API_PATHS.message.root}/broadcast/${encodeURIComponent(group.groupKey)}/readers?state=${state}&page=${page}&size=20`)
      .then(({ data }) => { if (active) { setRows(data?.rows || []); setTotal(Number(data?.total || 0)); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "阅读记录加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.groupKey, page, state, refresh]);
  useEffect(() => { document.getElementById("message-readers")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  return <section className="sysbroadcast-records message-readers" id="message-readers" aria-label="通知阅读记录">
    <header className="sysbroadcast-records-head">
      <div><b>阅读记录</b><small>{group.title} · 已读 {Number(group.readCount || 0)} / {Number(group.recipientCount || 0)}</small></div>
      <button className="sysbroadcast-op" type="button" onClick={onClose}>收起</button>
    </header>
    <div className="message-readers-tools">
      <div role="group" aria-label="阅读状态筛选">
        {([["all", "全部"], ["read", "已读"], ["unread", "未读"]] as const).map(([key, label]) =>
          <button type="button" key={key} className={state === key ? "is-active" : undefined} aria-pressed={state === key} onClick={() => { setState(key); setPage(1); }}>{label}</button>)}
      </div>
      <button type="button" className="sysbroadcast-op" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={13} />刷新</button>
    </div>
    {loading ? <p className="sysbroadcast-empty" role="status">正在加载阅读记录…</p>
      : error ? <p className="sysbroadcast-empty" role="alert">{error}</p>
      : !rows.length ? <p className="sysbroadcast-empty">暂无符合条件的记录</p>
      : <div className="message-readers-list">{rows.map((row) => {
        const read = truthy(row.isRead);
        const status = read ? "已读" : row.firstReadTime ? "待重读" : "未读";
        return <article key={row.userId}>
          <div>
            <b>{row.nickname || row.username}</b>
            <small>{row.username} · ID {row.userId}{truthy(row.userDeleted) ? " · 已移出收件箱" : ""}</small>
          </div>
          <div>
            <span className={read ? "is-read" : row.firstReadTime ? "is-reread" : "is-unread"}>{status}</span>
            <small>{row.readTime ? `阅读于 ${formatTime(row.readTime)}` : row.firstReadTime ? `首次阅读 ${formatTime(row.firstReadTime)}` : "尚未标记已读"}</small>
          </div>
        </article>;
      })}</div>}
    <footer className="message-readers-tools">
      <small>共 {total} 人 · 已读包含点开详情、确认弹窗和标记已读</small>
      <div>
        <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
        <span>{page}</span>
        <button type="button" disabled={loading || page * 20 >= total} onClick={() => setPage((value) => value + 1)}>下一页</button>
      </div>
    </footer>
  </section>;
}
