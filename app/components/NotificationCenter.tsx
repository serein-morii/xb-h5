import { ArrowLeft, Bell, Check, CheckCheck, Inbox, LoaderCircle, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_PATHS } from "../lib/pathConventions";
import { renderRichText } from "../lib/richText";
import "./notification-center.css";

/**
 * 通知中心共享组件：订单管理工作台与 OTP Vault 共用。
 *
 * 通过 `request` 注入不同系统的请求封装（apiRequest / otpApiRequest），
 * 通过 `categories` 声明分类 Tab；消息正文按后端 contentType 渲染
 * （text / markdown / html，均经过 XSS 过滤）。
 *
 * 交互：缩略列表 → 点开进入详情；列表项右下角提供小图标「已读 / 删除」；
 * 弹窗公告（popup）由 MessagePopupHost 在页面打开时弹出，确认后不再弹。
 */

type RequestOptions = Parameters<typeof import("../lib/api").apiRequest>[1];
export type MessageRequest = <T = Record<string, unknown>>(path: string, options?: RequestOptions) => Promise<T>;

export type UserMessage = {
  id: number; category: string; type?: string; title: string; content?: string;
  contentType?: string; link?: string; popup?: boolean; isRead: boolean; createTime: string; readTime?: string;
};

export type MessageCategory = { key: string; label: string };

export const DEFAULT_MESSAGE_CATEGORIES: MessageCategory[] = [
  { key: "", label: "全部" },
  { key: "OTP", label: "OTP 安全" },
  { key: "SYSTEM", label: "系统" },
];

const POPUP_ACK_KEY = "xb-msg-popup-acked";

function readAckedPopups(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(POPUP_ACK_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(Number).filter((value) => Number.isFinite(value)) : [];
  } catch { return []; }
}

function ackPopup(id: number) {
  const acked = readAckedPopups();
  const next = [...new Set([id, ...acked])].slice(0, 200);
  try { localStorage.setItem(POPUP_ACK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

async function fetchMessages(request: MessageRequest, category: string): Promise<UserMessage[]> {
  const query = category ? `?category=${encodeURIComponent(category)}&limit=100` : "?limit=100";
  const result = await request<ListResult>(`${API_PATHS.message.root}${query}`);
  return Array.isArray(result.data) ? result.data : [];
}

type ListResult = { data?: UserMessage[] };

/** 已读/删除/新消息后派发：铃铛角标立即重新查询，不必等轮询。 */
export const MESSAGE_CHANGED_EVENT = "xb-messages-changed";

/** 轮询未读数（60s）+ 变更事件即时刷新，供铃铛角标使用。 */
export function useMessageUnread(request: MessageRequest, category = "") {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      request<{ data?: { count?: number } }>(`${API_PATHS.message.unreadCount}?category=${encodeURIComponent(category)}`)
        .then((result) => { if (mounted) setCount(Number(result.data?.count || 0)); })
        .catch(() => { /* 静默：角标拉取失败不打扰用户 */ });
    };
    load();
    window.addEventListener(MESSAGE_CHANGED_EVENT, load);
    const timer = window.setInterval(load, 60_000);
    return () => {
      mounted = false;
      window.removeEventListener(MESSAGE_CHANGED_EVENT, load);
      window.clearInterval(timer);
    };
  }, [request, category]);
  const decrement = useCallback(() => setCount((value) => Math.max(0, value - 1)), []);
  const clear = useCallback(() => setCount(0), []);
  return { count, decrement, clear };
}

export function NotificationBellButton({ count, onClick, floating, label = "通知中心" }: {
  count: number; onClick: () => void; floating?: boolean; label?: string;
}) {
  return <button type="button" className={`notif-bell${floating ? " notif-bell-floating" : ""}`} onClick={onClick} aria-label={`${label}${count ? `（${count} 条未读）` : ""}`}>
    <Bell size={18} />
    {count > 0 ? <i className="notif-bell-badge">{count > 99 ? "99+" : count}</i> : null}
  </button>;
}

/**
 * 弹窗公告宿主：页面打开时拉取未读弹窗公告并逐条弹出。
 * 点「确认」→ 标记已读 + 本机记录，之后不再弹；点关闭或不操作 → 下次打开还会弹。
 */
export function MessagePopupHost({ request }: { request: MessageRequest }) {
  const [queue, setQueue] = useState<UserMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    request<ListResult>(`${API_PATHS.message.root}/popup`)
      .then((result) => {
        if (!mounted) return;
        const acked = new Set(readAckedPopups());
        const pending = (Array.isArray(result.data) ? result.data : []).filter((item) => !acked.has(item.id));
        setQueue(pending);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { mounted = false; };
  }, [request]);

  const current = queue[0];
  const confirm = useCallback(async () => {
    if (!current) return;
    ackPopup(current.id);
    try { await request(`${API_PATHS.message.root}/${current.id}/read`, { method: "PUT" }); } catch { /* 已读同步失败不影响关闭 */ }
    window.dispatchEvent(new Event(MESSAGE_CHANGED_EVENT));
    setQueue((rows) => rows.slice(1));
  }, [current, request]);

  const dismiss = useCallback(() => {
    // 直接关闭：不记录确认，下次打开页面继续弹
    setQueue((rows) => rows.slice(1));
  }, []);

  if (!loaded || !current) return null;
  return <div className="notif-popup-mask" role="alertdialog" aria-modal="true" aria-labelledby="notif-popup-title">
    <section className="notif-popup">
      <header><small>NOTICE</small><h2 id="notif-popup-title">{current.title}</h2></header>
      <div className="notif-popup-body"><div className="notif-item-content" dangerouslySetInnerHTML={{ __html: renderRichText(current.content, current.contentType) }} /></div>
      <footer>
        <button type="button" className="notif-popup-dismiss" onClick={dismiss}>下次再说</button>
        <button type="button" className="notif-popup-confirm" onClick={() => void confirm()}>确认</button>
      </footer>
    </section>
  </div>;
}

export default function NotificationCenter({ request, open, onClose, categories = DEFAULT_MESSAGE_CATEGORIES, defaultCategory = "" }: {
  request: MessageRequest; open: boolean; onClose: () => void; categories?: MessageCategory[]; defaultCategory?: string;
}) {
  const [activeCategory, setActiveCategory] = useState(defaultCategory);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UserMessage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setActiveCategory(defaultCategory); setSelected(null); } }, [open, defaultCategory]);
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true); setError("");
    fetchMessages(request, activeCategory)
      .then((rows) => { if (mounted) setMessages(rows); })
      .catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : "通知加载失败"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [request, open, activeCategory]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { if (selected) setSelected(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, selected]);

  const unreadTotal = useMemo(() => messages.filter((item) => !item.isRead).length, [messages]);

  const markRead = useCallback(async (id: number, silent = true) => {
    try {
      await request(`${API_PATHS.message.root}/${id}/read`, { method: "PUT" });
      setMessages((rows) => rows.map((row) => (row.id === id ? { ...row, isRead: true } : row)));
      setSelected((current) => (current && current.id === id ? { ...current, isRead: true } : current));
      window.dispatchEvent(new Event(MESSAGE_CHANGED_EVENT));
    } catch { if (!silent) setError("已读状态同步失败"); }
  }, [request]);

  const openDetail = (message: UserMessage) => {
    setSelected(message);
    if (!message.isRead) void markRead(message.id);
  };

  const markAllRead = async () => {
    const query = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : "";
    try {
      await request(`${API_PATHS.message.readAll}${query}`, { method: "PUT" });
      setMessages((rows) => rows.map((row) => ({ ...row, isRead: true })));
      setSelected((current) => (current ? { ...current, isRead: true } : current));
      window.dispatchEvent(new Event(MESSAGE_CHANGED_EVENT));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
  };

  const removeMessage = async (id: number) => {
    try {
      await request(`${API_PATHS.message.root}/${id}`, { method: "DELETE" });
      setMessages((rows) => rows.filter((row) => row.id !== id));
      setSelected((current) => (current && current.id === id ? null : current));
      window.dispatchEvent(new Event(MESSAGE_CHANGED_EVENT));
    } catch { /* 删除失败保留条目 */ }
  };

  if (!open) return null;
  return <div className="notif-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="notif-panel" role="dialog" aria-modal="true" aria-label="通知中心">
      {selected ? <header className="notif-header">
        <div className="notif-header-actions">
          <button type="button" className="notif-back" onClick={() => setSelected(null)}><ArrowLeft size={15} />返回列表</button>
        </div>
        <div className="notif-header-actions">
          {!selected.isRead ? <button type="button" className="notif-icon-action" title="标记已读" onClick={() => void markRead(selected.id)}><Check size={15} /></button> : null}
          <button type="button" className="notif-icon-action notif-danger" title="删除" onClick={() => void removeMessage(selected.id)}><Trash2 size={15} /></button>
        </div>
      </header>
      : <header className="notif-header">
        <div><small>NOTIFICATIONS</small><h2>通知中心{unreadTotal ? <em>{unreadTotal} 未读</em> : null}</h2></div>
        <div className="notif-header-actions">
          <button type="button" className="notif-icon-action" title="全部已读" disabled={!unreadTotal} onClick={() => void markAllRead()}><CheckCheck size={15} /></button>
          <button type="button" className="notif-icon-action" title="关闭" onClick={onClose}><X size={15} /></button>
        </div>
      </header>}

      {selected ? <div className="notif-detail">
        <span className="notif-detail-top">
          <small className={`notif-chip notif-chip-${(selected.category || "SYSTEM").toLowerCase()}`}>{selected.category === "OTP" ? "OTP 安全" : "系统"}</small>
          <small className="notif-detail-time">{formatTime(selected.createTime)}</small>
        </span>
        <h3>{selected.title}</h3>
        {selected.content ? <div className="notif-item-content" dangerouslySetInnerHTML={{ __html: renderRichText(selected.content, selected.contentType) }} /> : <p className="notif-detail-empty">没有正文内容</p>}
      </div>
      : <>
        <div className="notif-tabs" role="tablist">
          {categories.map((item) => (
            <button type="button" key={item.key || "all"} role="tab" aria-selected={activeCategory === item.key}
              className={activeCategory === item.key ? "is-active" : ""} onClick={() => setActiveCategory(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="notif-list">
          {loading ? <div className="notif-state"><LoaderCircle className="spin" size={18} />正在加载</div>
            : error ? <div className="notif-state notif-error">{error}</div>
            : !messages.length ? <div className="notif-state"><Inbox size={24} /><b>暂无通知</b><small>安全提醒和系统通知会出现在这里</small></div>
            : messages.map((message) => (
              <article key={message.id} className={`notif-item${message.isRead ? "" : " is-unread"}`}>
                <button type="button" className="notif-item-main" onClick={() => openDetail(message)}>
                  <span className="notif-item-top">
                    {!message.isRead ? <i className="notif-item-dot" aria-hidden="true" /> : null}
                    <b>{message.title}</b>
                    <small className={`notif-chip notif-chip-${(message.category || "SYSTEM").toLowerCase()}`}>{message.category === "OTP" ? "OTP" : "系统"}</small>
                  </span>
                  <small className="notif-item-time">{formatTime(message.createTime)}</small>
                </button>
                <span className="notif-item-actions">
                  {!message.isRead ? <button type="button" className="notif-icon-action" title="标记已读" onClick={(event) => { event.stopPropagation(); void markRead(message.id); }}><Check size={13} /></button> : null}
                  <button type="button" className="notif-icon-action notif-danger" title="删除" onClick={(event) => { event.stopPropagation(); void removeMessage(message.id); }}><Trash2 size={13} /></button>
                </span>
              </article>
            ))}
        </div>
      </>}
    </section>
  </div>;
}

function formatTime(value: string) {
  const time = new Date(value.replace(/-/g, "/"));
  if (Number.isNaN(time.getTime())) return value;
  const diff = Date.now() - time.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return time.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
