import { CheckCircle2, ChevronDown, Clock3, Copy, CreditCard, Edit3, Eye, Inbox, MapPin, RefreshCw, Search, Store, Trash2, Truck, User, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { copyToClipboard } from "../lib/api";

export type TrackingItem = {
  id?: number;
  expCode?: string;
  expTime?: string;
  expDesc?: string;
  desc?: string;
  expStatus?: string;
  expStatusDesc?: string;
  createTime?: string;
};

export type PublicOrderRecord = Record<string, unknown> & {
  id: number;
  orderCode?: string;
  orderNameDesc?: string;
  orderTypeDesc?: string;
  orderNum?: number;
  customer?: string;
  phone?: string;
  address?: string;
  expComDesc?: string;
  expCode?: string;
  orderStatus?: string;
  orderStatusDesc?: string;
  payStatus?: number;
  paidTime?: string;
  paidAmount?: number;
  orderTime?: string;
  orderDesc?: string;
  store?: string;
  storeName?: string;
  purchaser?: string;
  createBy?: string;
  signId?: string;
  expInfoList?: TrackingItem[];
  linkNameAndPhone?: string;
  expNewDesc?: string;
  // 成本价（仅买家通过成本价密码查看时返回，否则 undefined）
  goodsPrice?: number;
  packagePrice?: number;
  expPrice?: number;
  totalPrice?: number;
  salePrice?: number;
};

function statusTone(code?: string) {
  if (code === "YWC") return "success";
  if (/YFH|YSJ|YSZ|YSD/.test(code || "")) return "info";
  if (/YC|YQX/.test(code || "")) return "danger";
  return "warning";
}

function formatCost(value?: number) {
  if (value === null || value === undefined) return "--";
  return Number(value).toFixed(2);
}

export default function OrderList({ orders, contact, onEdit, onDelete, onView, onRefresh }: { orders: PublicOrderRecord[]; contact?: string; onEdit?: (order: PublicOrderRecord) => void; onDelete?: (order: PublicOrderRecord) => void; onView?: (order: PublicOrderRecord) => void; onRefresh?: () => Promise<unknown> | void }) {
  const [active, setActive] = useState("ALL");
  const [activePay, setActivePay] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { if (!onRefresh || refreshing) return; setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }

  const statuses = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    orders.forEach((order) => { const key = order.orderStatus || "UNKNOWN"; const old = map.get(key); map.set(key, { label: order.orderStatusDesc || key, count: (old?.count || 0) + 1 }); });
    return Array.from(map.entries());
  }, [orders]);
  const payBuckets = useMemo(() => {
    let paid = 0, unpaid = 0;
    orders.forEach((o) => { if (Number(o.payStatus) === 1) paid += 1; else unpaid += 1; });
    return { paid, unpaid };
  }, [orders]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const visible = orders.filter((order) => {
    if (active !== "ALL" && order.orderStatus !== active) return false;
    if (activePay === "PAID" && Number(order.payStatus) !== 1) return false;
    if (activePay === "UNPAID" && Number(order.payStatus) === 1) return false;
    if (!normalizedKeyword) return true;
    return [order.orderCode, order.customer, order.phone, order.address, order.expCode, order.store, order.storeName, order.purchaser, order.createBy].some((value) => String(value || "").toLowerCase().includes(normalizedKeyword));
  });

  function toggleTracking(id: number) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function copyOrder(order: PublicOrderRecord) {
    const detailLink = order.signId ? `${window.location.origin}/tools/order#${encodeURIComponent(order.signId)}` : "";
    const storeLabel = order.storeName || order.store;
    const lines = ["【订单信息】", `订单号: ${order.orderCode || ""}`, `下单时间: ${String(order.orderTime || "").slice(0, 10)}`, `商品: ${order.orderNameDesc || ""} ${order.orderTypeDesc || ""} × ${order.orderNum || 1}`, `收件人: ${order.customer || ""}`, `手机号: ${order.phone || ""}`, `快递: ${order.expComDesc || ""} ${order.expCode && order.expCode !== "无" ? order.expCode : ""}`, storeLabel ? `店铺: ${storeLabel}` : "", detailLink ? `查看更多: ${detailLink}` : ""].filter(Boolean);
    const detail = (order.address || "").trim();
    const final = detail ? [...lines, "", "【订单详情】", detail] : lines;
    const ok = await copyToClipboard(final.join("\n"));
    if (!ok) return; // 复制失败时不点亮"已复制"按钮，避免误导
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return <>
    <section className="tool-result-head"><div><h2>订单列表</h2><p>共 {orders.length} 个订单{contact ? ` · 联系 ${contact}` : ""}</p></div><div className="tool-result-head-right"><div className="tool-inline-search"><Search size={15} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="订单号、姓名或地址" /></div>{onRefresh ? <button type="button" className="tool-result-refresh" onClick={handleRefresh} disabled={refreshing} aria-label="刷新订单列表"><RefreshCw className={refreshing ? "spin" : ""} size={16} /></button> : null}</div></section>
    <div className="tool-filter-panel"><div className="tool-filter-row"><span className="tool-filter-label">订单状态</span><div className="tool-filter-chips" role="listbox" aria-label="订单状态筛选"><button type="button" className={active === "ALL" ? "active" : ""} onClick={() => setActive("ALL")}>全部 {orders.length}</button>{statuses.map(([key, item]) => <button type="button" className={active === key ? "active" : ""} onClick={() => setActive(key)} key={key}>{item.label} {item.count}</button>)}</div></div>
    <div className="tool-filter-row"><span className="tool-filter-label">付款状态</span><div className="tool-filter-chips" role="listbox" aria-label="付款状态筛选"><button type="button" className={activePay === "ALL" ? "active" : ""} onClick={() => setActivePay("ALL")}>全部</button><button type="button" className={activePay === "PAID" ? "active" : ""} onClick={() => setActivePay("PAID")}><CreditCard size={13} />已付款 {payBuckets.paid}</button><button type="button" className={activePay === "UNPAID" ? "active" : ""} onClick={() => setActivePay("UNPAID")}>未付款 {payBuckets.unpaid}</button></div></div></div>
    <section className="tool-order-results soft-list">{visible.map((order) => {
      const isOpen = expanded.has(order.id);
      const tracking = order.expInfoList || [];
      const tone = statusTone(order.orderStatus);
      const isPending = order.orderStatus === "DSH";
      return <article key={order.id} className="soft-card">
        <header><div className="tool-order-header-left"><div><small>订单编号</small><span className="tool-order-num-line"><b>{order.orderCode || "--"}</b><button type="button" className="tool-copy-icon" onClick={() => copyOrder(order)} aria-label="复制订单"><Copy size={14} /></button></span></div></div><div className="tool-order-pills"><span className={`pill tool-order-status-${tone}`}>{order.orderStatusDesc || order.orderStatus || "未知"}</span><span className={`pill tool-order-pay-${Number(order.payStatus) === 1 ? "paid" : Number(order.payStatus) === 2 ? "refunded" : "unpaid"}`}><CreditCard size={11} />{Number(order.payStatus) === 1 ? "已付款" : Number(order.payStatus) === 2 ? "已退款" : "未付款"}</span></div></header>
        <div className="tool-order-product"><b>{order.orderNameDesc || "未命名商品"}</b><span>{order.orderTypeDesc || "--"} × {order.orderNum || 1}</span><time>{String(order.orderTime || "").replace("T", " ").slice(0, 19) || "--"}</time></div>
        <div className="tool-order-address"><p><User size={14} />{order.customer || "--"} · {order.phone || "--"}</p><p><MapPin size={14} />{order.address || "暂无地址"}</p></div>
        <div className="tool-order-exp"><Truck size={14} /><span><b>{order.expComDesc || "暂无快递"}</b><small>{order.expCode && order.expCode !== "无" ? order.expCode : "暂无快递单号"}</small></span></div>
        {Number(order.payStatus) === 1 && order.paidTime ? <div className="tool-order-pay-row"><CreditCard size={13} />付款时间：{String(order.paidTime).replace("T", " ").slice(0, 16)}{order.paidAmount ? <b> · 实付 ¥{Number(order.paidAmount).toFixed(2)}</b> : null}</div> : null}
        {order.totalPrice !== undefined && order.totalPrice !== null ? <div className="tool-order-cost-row"><Wallet size={13} />成本：<b>¥{formatCost(order.totalPrice)}</b>{order.salePrice !== undefined && order.salePrice !== null ? <em> · 售价 ¥{formatCost(order.salePrice)}</em> : null}{order.goodsPrice !== undefined && order.goodsPrice !== null ? <em> · 商品 ¥{formatCost(order.goodsPrice)}</em> : null}</div> : null}
        {(order.storeName || order.store || order.purchaser || order.createBy) ? <div className="tool-order-meta-row">{(order.storeName || order.store) ? <span><Store size={13} />店铺：{order.storeName || order.store}</span> : null}{order.purchaser || order.createBy ? <span><User size={13} />下单人：{order.purchaser || order.createBy}</span> : null}</div> : null}
        {order.orderDesc ? <p className="tool-order-note">备注：{order.orderDesc}</p> : null}
        <button type="button" className={`tool-tracking-toggle ${isOpen ? "open" : ""}`} onClick={() => toggleTracking(order.id)}><Clock3 size={15} /><span><b>物流信息详情</b><small>{order.expNewDesc || tracking[0]?.expDesc || "暂无物流更新"} · 共 {tracking.length} 条</small></span><ChevronDown size={17} /></button>
        {isOpen ? <div className="tool-mini-timeline tool-full-timeline">{tracking.length ? tracking.map((item, index) => <div className={index === 0 ? "latest" : ""} key={String(item.id || `${item.expTime}-${index}`)}><i /><span><b>{item.expStatusDesc || item.expDesc || "物流更新"}</b><p>{item.expDesc || item.desc || "状态已更新"}</p>{item.expCode ? <em>快递单号：{item.expCode}</em> : null}<small>{item.expTime || item.createTime || ""}</small></span></div>) : <p className="tool-no-tracking">暂无物流轨迹</p>}</div> : null}
        {(isPending && (onEdit || onDelete)) || onView ? <div className="tool-order-actions">{onView ? <button type="button" className="tool-view" onClick={() => onView(order)}><Eye size={12} /><span>详情</span></button> : null}{isPending && onEdit ? <button type="button" className="tool-edit" onClick={() => onEdit(order)}><Edit3 size={12} /><span>编辑</span></button> : null}{isPending && onDelete ? <button type="button" className="tool-delete" onClick={() => onDelete(order)}><Trash2 size={12} /><span>删除</span></button> : null}</div> : null}
      </article>;
    })}</section>
    {!visible.length ? <div className="tool-list-empty"><Inbox size={32} /><h3>没有符合当前筛选条件的订单</h3><p>试着切换状态、清除搜索词，或者刷新一下数据。</p></div> : null}
    {copied ? <div className="public-copy-toast"><CheckCircle2 size={16} />订单信息已复制</div> : null}
  </>;
}
