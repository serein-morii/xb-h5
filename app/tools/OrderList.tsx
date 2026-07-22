"use client";

import { CheckCircle2, ChevronDown, Clock3, Copy, MapPin, Search, Store, Truck, User } from "lucide-react";
import { useMemo, useState } from "react";

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
  orderTime?: string;
  orderDesc?: string;
  store?: string;
  purchaser?: string;
  createBy?: string;
  signId?: string;
  expInfoList?: TrackingItem[];
  linkNameAndPhone?: string;
  expNewDesc?: string;
};

function statusTone(code?: string) {
  if (code === "YWC") return "success";
  if (/YFH|YSJ|YSZ|YSD/.test(code || "")) return "info";
  if (/YC|YQX/.test(code || "")) return "danger";
  return "warning";
}

export default function OrderList({ orders, contact }: { orders: PublicOrderRecord[]; contact?: string }) {
  const [active, setActive] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const statuses = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    orders.forEach((order) => { const key = order.orderStatus || "UNKNOWN"; const old = map.get(key); map.set(key, { label: order.orderStatusDesc || key, count: (old?.count || 0) + 1 }); });
    return Array.from(map.entries());
  }, [orders]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const visible = orders.filter((order) => (active === "ALL" || order.orderStatus === active) && (!normalizedKeyword || [order.orderCode, order.customer, order.phone, order.address, order.expCode, order.store, order.purchaser, order.createBy].some((value) => String(value || "").toLowerCase().includes(normalizedKeyword))));

  function toggleTracking(id: number) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function copyOrder(order: PublicOrderRecord) {
    const detailLink = order.signId ? `${window.location.origin}/tools/order#${encodeURIComponent(order.signId)}` : "";
    const lines = ["【订单详情】", `订单号: ${order.orderCode || ""}`, `下单时间: ${String(order.orderTime || "").slice(0, 10)}`, `商品: ${order.orderNameDesc || ""} ${order.orderTypeDesc || ""} × ${order.orderNum || 1}`, `收件人: ${order.customer || ""}`, `手机号: ${order.phone || ""}`, `地址: ${order.address || ""}`, `快递: ${order.expComDesc || ""} ${order.expCode && order.expCode !== "无" ? order.expCode : ""}`, order.store ? `店铺: ${order.store}` : "", detailLink ? `查看更多: ${detailLink}` : ""].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return <>
    <section className="tool-result-head"><div><h2>订单列表</h2><p>共 {orders.length} 个订单{contact ? ` · 联系 ${contact}` : ""}</p></div><div className="tool-inline-search"><Search size={15} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="订单号、姓名或地址" /></div></section>
    <nav className="tool-status-tabs" aria-label="订单状态筛选"><button type="button" className={active === "ALL" ? "active" : ""} onClick={() => setActive("ALL")}>全部 {orders.length}</button>{statuses.map(([key, item]) => <button type="button" className={active === key ? "active" : ""} onClick={() => setActive(key)} key={key}>{item.label} {item.count}</button>)}</nav>
    <section className="tool-order-results">{visible.map((order) => {
      const isOpen = expanded.has(order.id);
      const tracking = order.expInfoList || [];
      return <article key={order.id}>
        <header><div><small>订单编号</small><b>{order.orderCode || "--"}</b></div><span className={`tool-order-status-${statusTone(order.orderStatus)}`}>{order.orderStatusDesc || order.orderStatus || "未知"}</span></header>
        <div className="tool-order-product"><b>{order.orderNameDesc || "未命名商品"}</b><span>{order.orderTypeDesc || "--"} × {order.orderNum || 1}</span><time>{String(order.orderTime || "").replace("T", " ").slice(0, 19) || "--"}</time></div>
        <div className="tool-order-address"><p><User size={14} />{order.customer || "--"} · {order.phone || "--"}</p><p><MapPin size={14} />{order.address || "暂无地址"}</p></div>
        <div className="tool-order-exp"><Truck size={14} /><span><b>{order.expComDesc || "暂无快递"}</b><small>{order.expCode && order.expCode !== "无" ? order.expCode : "暂无快递单号"}</small></span></div>
        {(order.store || order.purchaser || order.createBy) ? <div className="tool-order-meta-row">{order.store ? <span><Store size={13} />店铺：{order.store}</span> : null}{order.purchaser || order.createBy ? <span><User size={13} />下单人：{order.purchaser || order.createBy}</span> : null}</div> : null}
        {order.orderDesc ? <p className="tool-order-note">备注：{order.orderDesc}</p> : null}
        <button type="button" className={`tool-tracking-toggle ${isOpen ? "open" : ""}`} onClick={() => toggleTracking(order.id)}><Clock3 size={15} /><span><b>物流信息详情</b><small>{order.expNewDesc || tracking[0]?.expDesc || "暂无物流更新"} · 共 {tracking.length} 条</small></span><ChevronDown size={17} /></button>
        {isOpen ? <div className="tool-mini-timeline tool-full-timeline">{tracking.length ? tracking.map((item, index) => <div className={index === 0 ? "latest" : ""} key={String(item.id || `${item.expTime}-${index}`)}><i /><span><b>{item.expStatusDesc || item.expDesc || "物流更新"}</b><p>{item.expDesc || item.desc || "状态已更新"}</p>{item.expCode ? <em>快递单号：{item.expCode}</em> : null}<small>{item.expTime || item.createTime || ""}</small></span></div>) : <p className="tool-no-tracking">暂无物流轨迹</p>}</div> : null}
        <button type="button" className="tool-copy" onClick={() => copyOrder(order)}><Copy size={15} />复制订单</button>
      </article>;
    })}</section>
    {!visible.length ? <div className="tool-list-empty">没有符合当前筛选条件的订单</div> : null}
    {copied ? <div className="public-copy-toast"><CheckCircle2 size={16} />订单信息已复制</div> : null}
  </>;
}
