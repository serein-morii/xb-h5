import { Check, Eye, LoaderCircle, MonitorUp, Pencil, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { apiRequest } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";
import { renderRichText } from "../../lib/richText";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type BroadcastGroup = {
  groupKey: string; title: string; category?: string; contentType?: string; popup?: boolean;
  link?: string; content?: string; targetRole?: string | null; createTime?: string; recipientCount?: number;
  readCount?: number; unreadCount?: number; offline?: boolean; offlineTime?: string; online?: boolean;
};

const TARGETS = [
  { value: "ALL", label: "全部用户" },
  { value: "ORDER", label: "订单系统" },
  { value: "OTP", label: "OTP 系统" },
  { value: "ADMIN", label: "仅管理员" },
] as const;

function targetLabel(value?: string | null) {
  return TARGETS.find((item) => item.value === value)?.label || "全部用户";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const fallback = new Date(String(value).replace(/-/g, "/").replace("T", " "));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toLocalInput(value?: Date | string | null) {
  const time = parseDate(value) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

function emptyForm() {
  return {
    title: "", category: "SYSTEM", contentType: "markdown", content: "", link: "",
    popup: false, target: "ALL", offline: false, offlineTime: toLocalInput(null),
  };
}

function formatTime(value?: string) {
  const time = parseDate(value);
  if (!time) return value || "--";
  return time.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isOnline(group: BroadcastGroup) {
  if (group.offline || group.online === false) return false;
  const deadline = parseDate(group.offlineTime);
  return !(deadline && deadline.getTime() <= Date.now());
}

/**
 * 站内信维护：管理员编辑并群发「系统通知 / 升级公告」。
 * 支持按系统模块（角色）定向投递；下方投递记录可再次编辑（可选择重置为未读重新提醒）或删除。
 */
export default function MessageBroadcast({ notify }: { notify: Notify }) {
  const [form, setForm] = useState(emptyForm);
  const [editingGroup, setEditingGroup] = useState<BroadcastGroup | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [resetRead, setResetRead] = useState(false);
  const [records, setRecords] = useState<BroadcastGroup[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [deleteGroup, setDeleteGroup] = useState<BroadcastGroup | null>(null);
  const [offlineGroup, setOfflineGroup] = useState<BroadcastGroup | null>(null);
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

  useEffect(() => { loadRecords(); }, [loadRecords]);

  function setField<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingGroup(null);
    setForm(emptyForm());
    setResetRead(false);
    setPreview(false);
    setComposerOpen(true);
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
      offline: !isOnline(group),
      offlineTime: toLocalInput(group.offlineTime || null),
    });
    setResetRead(false);
    setPreview(false);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditingGroup(null);
    setForm(emptyForm());
    setPreview(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return notify("请填写通知标题", "error");
    if (!form.content.trim()) return notify("请填写通知内容", "error");
    if (!form.offlineTime) return notify("请设置下线时间", "error");
    setBusy(true);
    try {
      const payload = { ...form, resetRead };
      if (editingGroup) {
        const result = await apiRequest<{ data?: { updated?: number } }>(`${API_PATHS.message.root}/broadcast/${editingGroup.groupKey}`, {
          method: "PUT",
          body: payload,
        });
        notify(`已更新 ${Number(result.data?.updated ?? 0)} 条投递${resetRead ? "，并重置为未读提醒" : ""}`, "success");
      } else {
        const result = await apiRequest<{ data?: { sent?: number } }>(`${API_PATHS.message.root}/broadcast`, {
          method: "POST",
          body: payload,
        });
        notify(`通知已投递给 ${Number(result.data?.sent ?? 0)} 位用户`, "success");
      }
      closeComposer();
      loadRecords();
    } catch (error) {
      notify(error instanceof Error ? error.message : "发送失败", "error");
    } finally { setBusy(false); }
  }

  async function removeGroup() {
    if (!deleteGroup) return;
    setBusy(true);
    try {
      const result = await apiRequest<{ data?: { deleted?: number } }>(`${API_PATHS.message.root}/broadcast/${deleteGroup.groupKey}`, { method: "DELETE" });
      notify(`已删除 ${Number(result.data?.deleted ?? 0)} 条投递`, "success");
      if (editingGroup?.groupKey === deleteGroup.groupKey) closeComposer();
      if (readersGroup?.groupKey === deleteGroup.groupKey) setReadersGroup(null);
      setDeleteGroup(null);
      loadRecords();
    } catch (error) {
      notify(error instanceof Error ? error.message : "删除失败", "error");
    } finally { setBusy(false); }
  }

  async function applyOffline(group: BroadcastGroup, nextOffline: boolean) {
    setBusy(true);
    try {
      await apiRequest(`${API_PATHS.message.root}/broadcast/${group.groupKey}`, {
        method: "PUT",
        body: {
          title: group.title,
          category: group.category || "SYSTEM",
          contentType: group.contentType || "text",
          content: group.content || "",
          link: group.link || "",
          popup: Boolean(group.popup),
          target: group.targetRole || "ALL",
          offline: nextOffline,
          offlineTime: nextOffline ? group.offlineTime || toLocalInput(null) : toLocalInput(null),
          resetRead: false,
        },
      });
      notify(nextOffline ? "已下线，用户收件箱不再展示" : "已重新上线，7 天后自动下线", "success");
      setOfflineGroup(null);
      loadRecords();
    } catch (error) {
      notify(error instanceof Error ? error.message : "状态更新失败", "error");
    } finally { setBusy(false); }
  }

  function toggleOffline(group: BroadcastGroup) {
    if (isOnline(group)) {
      setOfflineGroup(group);
      return;
    }
    void applyOffline(group, false);
  }

  const onlineCount = records.filter(isOnline).length;

  return <div className="sysm-center sysbroadcast">
    <div className="module-hero compact-hero">
      <div>
        <span className="eyebrow">NOTIFICATIONS</span>
        <h1>站内信维护</h1>
        <p>群发系统通知与升级公告。未读不会一直挂着，到期或手动下线后用户侧自动消失。</p>
      </div>
      <button type="button" className="sysbroadcast-send" onClick={openCreate}><Plus size={16} />新建通知</button>
    </div>

    <section className="sysbroadcast-records">
      <header className="sysbroadcast-records-head">
        <div>
          <b>投递记录</b>
          <small>{recordsLoading ? "正在加载…" : `共 ${records.length} 次群发 · ${onlineCount} 条在线`}</small>
        </div>
        <button type="button" className="sysbroadcast-preview-toggle" onClick={loadRecords}><RefreshCw size={14} />刷新</button>
      </header>
      {recordsLoading ? <p className="sysbroadcast-empty">正在加载投递记录…</p>
        : !records.length ? <p className="sysbroadcast-empty">还没有群发过通知，点右上角「新建通知」发出第一条。</p>
        : <div className="sysbroadcast-cards">
          {records.map((group) => {
            const online = isOnline(group);
            return <article className={`sysbroadcast-card-item${online ? "" : " is-offline"}`} key={group.groupKey}>
              <div className="sysbroadcast-card-main">
                <div className="sysbroadcast-card-title">
                  <b>{group.title}</b>
                  <span className="sysbroadcast-cell-tags">
                    <small className={online ? "sysbroadcast-status is-on" : "sysbroadcast-status is-off"}>{online ? "在线" : "已下线"}</small>
                    <small className={`notif-chip notif-chip-${(group.category || "SYSTEM").toLowerCase()}`}>{group.category === "OTP" ? "OTP" : "系统"}</small>
                    {group.popup ? <small className="notif-chip notif-chip-popup">弹窗</small> : null}
                    <small className="sysbroadcast-format">{group.contentType === "html" ? "HTML" : group.contentType === "markdown" ? "MD" : "文本"}</small>
                  </span>
                </div>
                <p className="sysbroadcast-card-meta">
                  <span>{targetLabel(group.targetRole)}</span>
                  <span>发送 {formatTime(group.createTime)}</span>
                  <span>下线 {formatTime(group.offlineTime)}</span>
                  <span>已读 {Number(group.readCount || 0)} / {Number(group.recipientCount || 0)}</span>
                </p>
              </div>
              <div className="sysbroadcast-card-actions">
                <button type="button" className="sysbroadcast-op" onClick={() => setReadersGroup(group)}><Eye size={13} />阅读</button>
                <button type="button" className="sysbroadcast-op" onClick={() => startEdit(group)}><Pencil size={13} />编辑</button>
                <button type="button" className="sysbroadcast-op" disabled={busy} onClick={() => void toggleOffline(group)}>{online ? "下线" : "上线"}</button>
                <button type="button" className="sysbroadcast-op is-danger" onClick={() => setDeleteGroup(group)}><Trash2 size={13} />删除</button>
              </div>
            </article>;
          })}
        </div>}
    </section>

    {composerOpen ? <Sheet title={editingGroup ? "编辑通知" : "新建通知"} onClose={closeComposer}>
      <form className="sysbroadcast-sheet-form" onSubmit={submit}>
        <div className="sysbroadcast-grid">
          <label><span>标题 *</span><input value={form.title} onChange={(event) => setField("title", event.target.value)} maxLength={60} placeholder="例如：OTP Vault 新版本上线" /></label>
          <label><span>分类</span><select value={form.category} onChange={(event) => setField("category", event.target.value)}><option value="SYSTEM">系统通知</option><option value="OTP">OTP 安全</option></select></label>
          <label><span>内容格式</span><select value={form.contentType} onChange={(event) => setField("contentType", event.target.value)}><option value="text">纯文本</option><option value="markdown">Markdown</option><option value="html">HTML</option></select></label>
          <label><span>投递范围</span><select value={form.target} onChange={(event) => setField("target", event.target.value)}>{TARGETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span>下线时间 *</span><input type="datetime-local" value={form.offlineTime} onChange={(event) => setField("offlineTime", event.target.value)} /></label>
        </div>
        <label><span>正文（{form.contentType === "html" ? "HTML 源码" : form.contentType === "markdown" ? "Markdown" : "纯文本"}）*</span><textarea rows={7} value={form.content} onChange={(event) => setField("content", event.target.value)} placeholder={form.contentType === "text" ? "通知正文…" : "支持标题、**加粗**、列表、链接等格式…"} /></label>
        <label className="sysbroadcast-popup"><input type="checkbox" checked={form.popup} onChange={(event) => setField("popup", event.target.checked)} /><i /><span><MonitorUp size={14} />打开页面时弹窗展示</span><small>用户点「确认」后不再弹出；点「下次再说」则下次打开仍会弹，直到下线。</small></label>
        <label className="sysbroadcast-popup"><input type="checkbox" checked={form.offline} onChange={(event) => setField("offline", event.target.checked)} /><i /><span>立即下线</span><small>勾选后用户收件箱立刻看不到这条，即使还没到下线时间、即使未读。</small></label>
        {editingGroup ? <label className="sysbroadcast-popup"><input type="checkbox" checked={resetRead} onChange={(event) => setResetRead(event.target.checked)} /><i /><span>保存后重置为未读</span><small>让已收到旧版本的用户重新收到提醒；关闭则只改内容不打扰。</small></label> : null}
        {preview ? <div className="sysbroadcast-preview"><b>预览</b><div className="notif-item-content" dangerouslySetInnerHTML={{ __html: previewHtml }} /></div> : null}
        <div className="sysbroadcast-sheet-actions">
          <button type="button" className={`sysbroadcast-preview-toggle${preview ? " is-active" : ""}`} onClick={() => setPreview((value) => !value)}><Eye size={15} />{preview ? "收起预览" : "预览效果"}</button>
          <button type="button" className="sysbroadcast-preview-toggle" onClick={closeComposer}>取消</button>
          <button className="sysbroadcast-send" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : editingGroup ? <Check size={15} /> : <Send size={15} />}{busy ? "正在处理" : editingGroup ? "保存修改" : "投递给选定用户"}</button>
        </div>
      </form>
    </Sheet> : null}

    {readersGroup ? <Sheet title="阅读记录" onClose={() => setReadersGroup(null)}>
      <ReadReceipts group={readersGroup} />
    </Sheet> : null}

    {offlineGroup ? <Sheet title="确认下线" onClose={() => setOfflineGroup(null)}>
      <div className="sysbroadcast-confirm">
        <p>确定下线「{offlineGroup.title}」？用户收件箱和弹窗会立刻看不到这条，即使还没读。后台记录和阅读记录仍会保留。</p>
        <div className="sysbroadcast-sheet-actions">
          <button type="button" className="sysbroadcast-preview-toggle" onClick={() => setOfflineGroup(null)}>取消</button>
          <button type="button" className="sysbroadcast-send is-danger" disabled={busy} onClick={() => void applyOffline(offlineGroup, true)}>确认下线</button>
        </div>
      </div>
    </Sheet> : null}

    {deleteGroup ? <Sheet title="删除通知" onClose={() => setDeleteGroup(null)}>
      <div className="sysbroadcast-confirm">
        <p>确定删除「{deleteGroup.title}」的全部投递？阅读记录也会一起删掉，此操作不可恢复。</p>
        <div className="sysbroadcast-sheet-actions">
          <button type="button" className="sysbroadcast-preview-toggle" onClick={() => setDeleteGroup(null)}>取消</button>
          <button type="button" className="sysbroadcast-send is-danger" disabled={busy} onClick={() => void removeGroup()}><Trash2 size={15} />确认删除</button>
        </div>
      </div>
    </Sheet> : null}
  </div>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return <div className="sc-sheet-mask" onClick={onClose} role="presentation">
    <section className="sc-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
      <header className="sc-sheet-head">
        <b>{title}</b>
        <button type="button" className="sysbroadcast-op" onClick={onClose} aria-label="关闭"><X size={16} /></button>
      </header>
      <div className="sc-sheet-body">{children}</div>
    </section>
  </div>;
}

type Reader = { userId: number; username: string; nickname?: string; isRead: boolean | number; readTime?: string; firstReadTime?: string; userDeleted?: boolean | number };

function truthy(value: boolean | number | undefined) {
  return value === true || value === 1;
}

function ReadReceipts({ group }: { group: BroadcastGroup }) {
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
  return <div className="message-readers is-sheet" aria-label="通知阅读记录">
    <p className="sysbroadcast-empty" style={{ paddingTop: 0 }}>{group.title} · 已读 {Number(group.readCount || 0)} / {Number(group.recipientCount || 0)}</p>
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
  </div>;
}
