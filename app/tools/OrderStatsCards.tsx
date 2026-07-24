import { PublicOrderRecord } from "./OrderList";

export type StatusFilter = "all" | "pending" | "shipped" | "done" | "month";

export type OrderStats = { total: number; pending: number; shipped: number; done: number; monthCount: number };

export const STATUS_CARDS: { key: StatusFilter; label: string; stat: keyof OrderStats }[] = [
  { key: "all", label: "全部订单", stat: "total" },
  { key: "pending", label: "待发货", stat: "pending" },
  { key: "shipped", label: "运输中", stat: "shipped" },
  { key: "done", label: "已完成", stat: "done" },
  { key: "month", label: "本月", stat: "monthCount" },
];

// 顶部看板统计：基于已加载的全量 orders，纯客户端聚合
export function computeOrderStats(orders: PublicOrderRecord[]): OrderStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let pending = 0, shipped = 0, done = 0, monthCount = 0;
  for (const o of orders) {
    const s = String(o.orderStatus || "");
    if (s === "DSH" || s === "DFH") pending++;
    else if (s === "YFH" || s === "YSJ" || s === "YSZ" || s === "YSD") shipped++;
    else if (s === "YWC") done++;
    const t = o.orderTime ? new Date(String(o.orderTime).replace(/-/g, "/")) : null;
    if (t && t >= monthStart) monthCount++;
  }
  return { total: orders.length, pending, shipped, done, monthCount };
}

// 按顶部看板筛选：纯客户端，零网络请求。`filter === null` 等同于不过滤（初始未选）
export function filterOrdersByStatus(orders: PublicOrderRecord[], filter: StatusFilter | null): PublicOrderRecord[] {
  if (!filter || filter === "all") return orders;
  if (filter === "month") {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return orders.filter((o) => {
      const t = o.orderTime ? new Date(String(o.orderTime).replace(/-/g, "/")) : null;
      return t ? t >= monthStart : false;
    });
  }
  return orders.filter((o) => {
    const s = String(o.orderStatus || "");
    if (filter === "pending") return s === "DSH" || s === "DFH";
    if (filter === "shipped") return s === "YFH" || s === "YSJ" || s === "YSZ" || s === "YSD";
    if (filter === "done") return s === "YWC";
    return true;
  });
}

export function OrderStatsCards({ stats, filter, onSelect, label = "订单概览" }: { stats: OrderStats; filter: StatusFilter | null; onSelect: (key: StatusFilter) => void; label?: string }) {
  return <section className="purchaser-stats" aria-label={label}>
    {STATUS_CARDS.map((card) => (
      <button
        key={card.key}
        type="button"
        className={`purchaser-stat${filter === card.key ? " active" : ""}`}
        aria-pressed={filter === card.key}
        onClick={() => onSelect(card.key)}
      >
        <b>{stats[card.stat]}</b>
        <small>{card.label}</small>
      </button>
    ))}
  </section>;
}
