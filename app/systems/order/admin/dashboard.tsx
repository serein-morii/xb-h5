import {
  ChevronDown,
  ChevronRight,
  Copy,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import { API_PATHS } from "../../../lib/pathConventions";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, copyToClipboard } from "../../../lib/api";
import { buildOrderLink, formatOrderLinkCopy } from "../tools/order-link/format";
import type { DataRow, MenuKey } from "./core";
import { shortDate } from "./core";
import { useCountUp } from "./ui";
import { StatusBadge } from "./logistics";
import { useAccess } from "./access";
import { canOpenMenu } from "./access";
import {
  fetchDashboardShortcuts,
  getDashboardShortcuts,
  resolveDashboardShortcuts,
  type DashboardShortcutsConfig,
  type ResolvedDashboardShortcut,
} from "./dashboardShortcuts.config";
import {
  fetchDashboardFocus,
  getDashboardFocus,
  resolveDashboardFocus,
  type DashboardFocusConfig,
} from "./dashboardFocus.config";

export type DashboardData = {
  orderTotal: number;
  todayOrders: number;
  pending: number;
  waiting: number;
  sent: number;
  completed: number;
  billTotal: number;
  storeTotal: number;
  purchaserTotal: number;
  boundPurchaserTotal: number;
  attentionTotal: number;
  trend: Array<{ day: string; count: number }>;
  recentOrders: DataRow[];
  recentExpress: DataRow[];
  recentPurchasers: DataRow[];
};

export type OrderStatusView = "pending" | "shipping" | "transit" | "completed";

export const ORDER_STATUS_VIEW_KEY = "xb-h5-order-status-view";
export const ORDER_STATUS_CODES: Record<OrderStatusView, string> = {
  pending: "DSH",
  shipping: "DFH",
  transit: "YFH",
  completed: "YWC",
};

export function saveOrderStatusView(status: OrderStatusView) {
  try {
    window.sessionStorage.setItem(ORDER_STATUS_VIEW_KEY, status);
  } catch {
    // Session storage may be unavailable in privacy mode. The orders page still opens normally.
  }
}

export function readOrderStatusView(): OrderStatusView | null {
  try {
    const status = window.sessionStorage.getItem(ORDER_STATUS_VIEW_KEY);
    return status === "pending" || status === "shipping" || status === "transit" || status === "completed" ? status : null;
  } catch {
    return null;
  }
}

export function clearOrderStatusView() {
  try {
    window.sessionStorage.removeItem(ORDER_STATUS_VIEW_KEY);
  } catch {
    // Nothing to clear.
  }
}

export const EMPTY_DASHBOARD: DashboardData = {
  orderTotal: 0, todayOrders: 0, pending: 0, waiting: 0, sent: 0, completed: 0, billTotal: 0, storeTotal: 0, purchaserTotal: 0, boundPurchaserTotal: 0, attentionTotal: 0, trend: [], recentOrders: [], recentExpress: [], recentPurchasers: [],
};

// 工作台随机鸡汤（按当前时间/待办/完成数取不同池子）
export const CHICKEN_SOUP_BUSY = [
  "还有 {n} 笔待处理，先挑简单的？",
  "{n} 单排队中，加把劲",
  "今日还有 {n} 单没完，加油",
  "{n} 单待处理，从最重要的开始",
  "还有 {n} 单，挑一个下手吧",
  "今日 {n} 单待办，节奏走起",
  "积压 {n} 单，先啃硬骨头",
  "还有 {n} 单排队，越早处理越轻松",
];
export const CHICKEN_SOUP_DONE = [
  "今日已搞定 {n} 笔，厉害",
  "{n} 单完成，效率不错",
  "已经处理 {n} 单，保持节奏",
  "{n} 笔订单完成，可以喘口气",
  "今日 {n} 单已结，奈斯",
  "{n} 单交付，成就感拉满",
  "今日 {n} 单搞定，手感在线",
];
export const CHICKEN_SOUP_IDLE = [
  "新的一天，从一杯水开始",
  "一日之计在于晨",
  "先把最棘手的那笔处理掉",
  "别急，一件件来",
  "忙了一上午，先去吃饭",
  "中午了，热饭吃了吗",
  "下午专注力最强",
  "今天的辛苦，明天的底气",
  "晚上好，记得按时回家",
  "今天已经够拼了",
  "事情一件件来，不慌",
  "难得清闲，喝杯茶吧",
  "夜深了，早点睡",
  "还在加班？记得喝水",
  "明天的活明天再说",
  "专注当下，效率翻倍",
  "你已经很努力了",
  "忙里偷闲，笑一下",
  "保持节奏，别急",
  "持续改进比完美更重要",
  "小步快跑，比完美更重要",
  "深呼吸，再继续",
  "今天也是好的一天",
];
export const pickChicken = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
export const greetByHour = (h: number) => {
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 13) return "中午好";
  if (h < 18) return "下午好";
  if (h < 22) return "晚上好";
  return "夜深了";
};

export function DashboardPage({ username, userInfo, onNavigate, notify, bellSlot }: { username: string; userInfo: DataRow | null; onNavigate: (key: MenuKey) => void; notify: (message: string, type?: "success" | "error" | "info") => void; bellSlot?: ReactNode }) {
  const access = useAccess();
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<{ orders: boolean; buyers: boolean }>({ orders: false, buyers: false });
  const [shortcutsConfig, setShortcutsConfig] = useState<DashboardShortcutsConfig>(getDashboardShortcuts);
  const [focusConfig, setFocusConfig] = useState<DashboardFocusConfig>(getDashboardFocus);
  useEffect(() => {
    let mounted = true;
    fetchDashboardShortcuts(apiRequest).then((config) => { if (mounted) setShortcutsConfig(config); }).catch(() => { /* 本地默认兜底 */ });
    const reload = () => { fetchDashboardShortcuts(apiRequest).then((config) => { if (mounted) setShortcutsConfig(config); }).catch(() => { /* */ }); };
    window.addEventListener("xb-dashboard-shortcuts-changed", reload);
    return () => { mounted = false; window.removeEventListener("xb-dashboard-shortcuts-changed", reload); };
  }, []);
  useEffect(() => {
    let mounted = true;
    fetchDashboardFocus(apiRequest).then((config) => { if (mounted) setFocusConfig(config); }).catch(() => { /* */ });
    const reload = () => { fetchDashboardFocus(apiRequest).then((config) => { if (mounted) setFocusConfig(config); }).catch(() => { /* */ }); };
    window.addEventListener("xb-dashboard-focus-changed", reload);
    return () => { mounted = false; window.removeEventListener("xb-dashboard-focus-changed", reload); };
  }, []);
  const HOME_LIST_PREVIEW = 3;
  const toggleExpanded = (key: "orders" | "buyers") => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const today = useMemo(() => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date()), []);
  const displayName = String(userInfo?.nickName || userInfo?.userName || username);
  const deptName = String(userInfo?.dept?.deptName || "");
  const primaryRole = Array.isArray(userInfo?.roles) && userInfo.roles.length ? String(userInfo.roles[0]?.roleName || "") : "";
  const greeting = useMemo(() => greetByHour(new Date().getHours()), []);
  const subtitle = useMemo(() => {
    const pending = data.pending + data.waiting;
    if (pending > 0) {
      return pickChicken(CHICKEN_SOUP_BUSY).replace("{n}", String(pending));
    }
    if (data.completed > 0) {
      return pickChicken(CHICKEN_SOUP_DONE).replace("{n}", String(data.completed));
    }
    return pickChicken(CHICKEN_SOUP_IDLE);
  }, [data]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 后端聚合接口：一次返回订单按状态分组计数、账单/店铺/买家总数、最近 10/8/8 列表
      // 替代原先的 8 个并发分页请求（其中 4 个 pageSize=1 只为拿 total）
      const stats = await apiRequest<{ data?: DataRow }>(`${API_PATHS.orders.root}/dashboard`);
      const payload = (stats.data && typeof stats.data === "object" ? stats.data : {}) as DataRow;
      setData({
        orderTotal: Number(payload.orderTotal || 0),
        todayOrders: Number(payload.todayOrders || 0),
        pending: Number(payload.pending || 0),
        waiting: Number(payload.waiting || 0),
        sent: Number(payload.sent || 0),
        completed: Number(payload.completed || 0),
        billTotal: Number(payload.billTotal || 0),
        storeTotal: Number(payload.storeTotal || 0),
        purchaserTotal: Number(payload.purchaserTotal || 0),
        boundPurchaserTotal: Number(payload.boundPurchaserTotal || 0),
        attentionTotal: Number(payload.attentionTotal || 0),
        trend: Array.isArray(payload.trend) ? payload.trend.map((item) => ({ day: String(item.day || ""), count: Number(item.count || 0) })) : [],
        recentOrders: Array.isArray(payload.recentOrders) ? payload.recentOrders : [],
        recentExpress: Array.isArray(payload.recentExpress) ? payload.recentExpress : [],
        recentPurchasers: Array.isArray(payload.recentPurchasers) ? payload.recentPurchasers : [],
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "工作台数据加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  async function copyPurchaserLink(purchaser: DataRow) {
    if (!purchaser.shortId || !purchaser.storeId) {
      notify("该买家尚未绑定店铺，请先完成绑定", "info");
      onNavigate("purchasers");
      return;
    }
    try {
      const text = formatOrderLinkCopy(purchaser.name, buildOrderLink(purchaser.shortId));
      const ok = await copyToClipboard(text);
      if (!ok) throw new Error("复制失败");
      notify(`${purchaser.name || "买家"}的下单链接已复制`, "success");
    } catch {
      notify("复制失败，请在买家管理中重试", "error");
    }
  }

  const shortcuts: ResolvedDashboardShortcut[] = useMemo(
    () => resolveDashboardShortcuts(shortcutsConfig, data as unknown as Record<string, unknown>)
      .filter((entry) => canOpenMenu(access, entry.key)),
    [shortcutsConfig, data, access],
  );

  const attentionTotal = data.pending + data.waiting;
  const { focus: focusItem, strip: stripItems } = useMemo(() => resolveDashboardFocus(focusConfig), [focusConfig]);
  const focusDataKey = (focusItem?.key || "pending") as keyof DashboardData;
  const focusCount = focusItem ? Number(data[focusDataKey] || 0) : 0;
  const animatedFocusCount = useCountUp(focusCount, 500);
  const attentionRatio = data.orderTotal > 0 ? Math.min(100, Math.round((focusCount / data.orderTotal) * 100)) : 0;
  const focusSummary = attentionTotal ? `${data.pending} 笔待处理 · ${data.waiting} 笔待发货` : "今天暂无待处理订单";
  const openStatusOrders = (status: OrderStatusView) => {
    saveOrderStatusView(status);
    onNavigate("orders");
  };
  const openFocusCard = () => {
    if (!focusItem) return;
    if (focusItem.filterStatus) {
      openStatusOrders(focusItem.filterStatus);
    } else if (focusItem.onClickKey) {
      onNavigate(focusItem.onClickKey);
    }
  };

  return <div className="home-space">
    <header className="home-intro">
      <div>
        <span>{today}{deptName ? ` · ${deptName}` : ""}{primaryRole ? ` · ${primaryRole}` : ""}</span>
        <h1>{greeting}，{displayName}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="home-intro-actions">
        <button className="home-create-order" type="button" onClick={() => onNavigate("orderEntry")}><Plus size={18} />快速录单</button>
        {bellSlot}
        <button className="home-refresh" type="button" onClick={load} aria-label="刷新首页"><RefreshCw className={loading ? "spin" : ""} size={18} /></button>
      </div>
    </header>

    <section className="home-glance" aria-label="今日订单概况">
      <div className="home-focus-deck">
        {focusItem ? (
          <button
            className="home-focus-card home-focus-single is-front"
            type="button"
            onClick={openFocusCard}
            aria-label={`查看${focusItem.label}订单，共 ${focusCount} 笔`}
          >
            <span className="home-focus-card-tab">
              <b>今日重点</b>
              <em>{focusItem.label}</em>
            </span>
            <span className="home-focus-card-body">
              <span className="home-focus-copy">
                <strong>{focusSummary}</strong>
                <span className="home-focus-meter" aria-label={`${focusItem.label}订单占全部订单 ${attentionRatio}%`}><i style={{ width: `${attentionRatio}%` }} /></span>
                <em>查看{focusItem.label}订单<ChevronRight size={15} /></em>
              </span>
              <span className="home-focus-number">
                <b>{animatedFocusCount}</b>
                <small>{focusItem.label}</small>
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </section>

    <div className="home-stat-strip">
      {stripItems.map((item) => {
        const Icon = item.icon;
        const value = Number(data[item.key as keyof DashboardData] || 0);
        return (
          <button
            type="button"
            key={item.key}
            onClick={() => item.onClickKey && onNavigate(item.onClickKey)}
            disabled={!item.onClickKey}
          >
            <small>{item.label}</small>
            <b>{value}</b>
            <span><Icon size={16} />{item.sub}</span>
          </button>
        );
      })}
    </div>

    <section className="home-trend-card" aria-label="近七日订单趋势">
      <div className="home-section-heading"><div><h2>近 7 日订单趋势</h2><p>今日新增 {data.todayOrders} 单 · 待处理 {data.attentionTotal} 单</p></div><button type="button" onClick={() => onNavigate("orders")}>查看订单<ChevronRight size={15} /></button></div>
      <div className="home-trend-bars">{data.trend.map((point) => { const max = Math.max(...data.trend.map((item) => item.count), 1); return <div className="home-trend-bar" key={point.day}><small>{point.count}</small><span><i style={{ height: `${Math.max(8, point.count / max * 100)}%` }} /></span><label>{point.day.slice(5)}</label></div>; })}</div>
    </section>

    <section className="home-actions">
      <div className="home-section-heading"><div><h2>常用操作</h2><p>{data.storeTotal} 个店铺正在使用</p></div></div>
      <div className="home-action-rail">{shortcuts.map((item) => { const Icon = item.icon; return <button type="button" onClick={() => onNavigate(item.key)} key={item.key}><span><Icon size={19} /></span><b>{item.label}</b><small>{item.desc}</small></button>; })}</div>
    </section>

    <div className="home-content-grid">
      <section className="home-feed home-order-feed">
        <div className="home-section-heading"><div><h2>最近订单</h2><p>最新 {data.recentOrders.length} 笔订单</p></div><button type="button" onClick={() => onNavigate("orders")}>全部订单<ChevronRight size={15} /></button></div>
        <div className="home-order-list">{loading && !data.recentOrders.length ? <div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载</div> : data.recentOrders.length ? (expanded.orders ? data.recentOrders : data.recentOrders.slice(0, HOME_LIST_PREVIEW)).map((row) => <button type="button" key={String(row.id)} onClick={() => onNavigate("orders")}><span className="home-order-mark">{String(row.orderNameDesc || "果").slice(-1)}</span><div><b>{row.orderNameDesc || row.orderName || "未命名商品"} · {row.orderTypeDesc || row.orderType || "--"}</b><small>{row.customer || "--"} · {shortDate(row.orderTime)}</small></div><StatusBadge row={row} /></button>) : <div className="home-empty"><ShoppingBag size={22} />暂无订单</div>}</div>
        {data.recentOrders.length > HOME_LIST_PREVIEW ? <button className="home-list-toggle" type="button" onClick={() => toggleExpanded("orders")}>{expanded.orders ? "收起" : "展开更多"}<ChevronDown size={15} className={expanded.orders ? "rotated" : ""} /></button> : null}
      </section>

      <section className="home-feed home-buyer-feed">
        <div className="home-section-heading"><div><h2>最近买家</h2><p>{data.boundPurchaserTotal}/{data.purchaserTotal} 已绑定店铺</p></div><button type="button" onClick={() => onNavigate("purchasers")}>管理买家<ChevronRight size={15} /></button></div>
        <div className="home-buyer-list">{loading && !data.recentPurchasers.length ? <div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载</div> : data.recentPurchasers.length ? (expanded.buyers ? data.recentPurchasers : data.recentPurchasers.slice(0, HOME_LIST_PREVIEW)).map((purchaser) => <article key={String(purchaser.id || purchaser.shortId)}><span>{String(purchaser.name || "买").slice(0, 1)}</span><div><b>{purchaser.name || "未命名买家"}</b><p>{purchaser.storeName || "尚未绑定店铺"}</p></div><button className={purchaser.storeId ? "" : "unbound"} type="button" onClick={() => copyPurchaserLink(purchaser)}>{purchaser.storeId ? <Copy size={15} /> : <ChevronRight size={15} />}</button></article>) : <div className="home-empty"><User size={22} />暂无买家</div>}</div>
        {data.recentPurchasers.length > HOME_LIST_PREVIEW ? <button className="home-list-toggle" type="button" onClick={() => toggleExpanded("buyers")}>{expanded.buyers ? "收起" : "展开更多"}<ChevronDown size={15} className={expanded.buyers ? "rotated" : ""} /></button> : null}
      </section>
    </div>

    <section className="home-logistics">
      <div className="home-section-heading"><div><h2>物流动态</h2><p>{data.sent} 个订单已发货</p></div><button type="button" onClick={() => onNavigate("express")}>快递管理<ChevronRight size={15} /></button></div>
      {data.recentExpress.length ? <div className="home-logistics-row">{data.recentExpress.map((row, index) => <article key={String(row.id)} className={index === 0 ? "latest" : ""}><i /><div><div><b>{row.expStatusDesc || row.expStatus || "物流更新"}</b><time>{shortDate(row.expTime, true)}</time></div><p>{row.expDesc || "暂无物流描述"}</p><small>订单 {row.orderCode || "--"}</small></div></article>)}</div> : <div className="home-empty"><Truck size={22} />暂无物流动态</div>}
    </section>
  </div>;
}
