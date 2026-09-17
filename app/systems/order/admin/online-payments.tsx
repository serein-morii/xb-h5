/** 支付订单（简付 JianPay）：查询、对账、状态同步、导出与全额退款。 */
import {
  BadgeDollarSign,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  LoaderCircle,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, copyToClipboard, downloadFile } from "../../../lib/api";
import { API_PATHS } from "../../../lib/pathConventions";
import { useAccess } from "./access";
import { ConfirmDialog, EmptyState, Sheet } from "./ui";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type OnlinePayment = {
  id: number;
  paymentNo: string;
  orderCode: string;
  amount: number;
  status: string;
  payMethod: string;
  tradeOrderId?: string;
  refundNo?: string;
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  refundTime?: string;
  storeName?: string;
  purchaserName?: string;
  orderNameDesc?: string;
  orderTypeDesc?: string;
  orderNum?: number;
  customer?: string;
  phone?: string;
  address?: string;
  orderStatus?: string;
  payStatus?: number;
  paidTime?: string;
  createTime?: string;
  updateTime?: string;
};

type PaymentFilters = {
  paymentNo: string;
  orderCode: string;
  tradeOrderId: string;
  refundNo: string;
  status: string;
  payMethod: string;
  storeName: string;
  purchaserName: string;
  customer: string;
  createFrom: string;
  createTo: string;
  paidFrom: string;
  paidTo: string;
};

type PaymentSummary = {
  totalCount: number;
  pendingCount: number;
  paidCount: number;
  refundingCount: number;
  refundedCount: number;
  paidAmount: number;
  refundedAmount: number;
  netAmount: number;
};

type PageResult = { rows: OnlinePayment[]; total: number };
type SummaryResult = { data?: PaymentSummary };

const EMPTY_FILTERS: PaymentFilters = {
  paymentNo: "",
  orderCode: "",
  tradeOrderId: "",
  refundNo: "",
  status: "",
  payMethod: "",
  storeName: "",
  purchaserName: "",
  customer: "",
  createFrom: "",
  createTo: "",
  paidFrom: "",
  paidTo: "",
};

const EMPTY_SUMMARY: PaymentSummary = {
  totalCount: 0,
  pendingCount: 0,
  paidCount: 0,
  refundingCount: 0,
  refundedCount: 0,
  paidAmount: 0,
  refundedAmount: 0,
  netAmount: 0,
};

const PAGE_SIZE = 20;

const STATUS_META: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "待支付", tone: "pending" },
  SUCCESS: { label: "支付成功", tone: "success" },
  REFUNDING: { label: "退款中", tone: "refunding" },
  REFUNDED: { label: "已退款", tone: "refunded" },
  CLOSED: { label: "已关闭", tone: "closed" },
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  DSH: "待处理",
  DFH: "待发货",
  YFH: "已发货",
  YWC: "已完成",
  YQX: "已取消",
  YC: "异常",
};

function statusMeta(status: unknown) {
  return STATUS_META[String(status || "")] || { label: String(status || "未知"), tone: "closed" };
}

function payMethodLabel(value: unknown) {
  const method = String(value || "");
  return method === "wx" ? "微信" : method === "alipay" ? "支付宝" : method || "—";
}

function money(value: unknown) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function orderStatusLabel(code?: string) {
  return ORDER_STATUS_LABEL[String(code || "")] || code || "—";
}

function payStatusLabel(status: unknown) {
  if (status === null || status === undefined || status === "") return "—";
  const value = Number(status);
  if (value === 1) return "已付款";
  if (value === 2) return "已退款";
  if (value === 3) return "待确认";
  if (value === 0) return "待支付";
  return "—";
}

function orderGoods(row: OnlinePayment) {
  return [row.orderNameDesc, row.orderTypeDesc, row.orderNum ? `${row.orderNum}件` : ""].filter(Boolean).join("/") || "—";
}

function orderRecipient(row: OnlinePayment) {
  return [row.customer, row.phone].filter(Boolean).join(" · ") || "—";
}

function filterQuery(filters: PaymentFilters) {
  const { createFrom, createTo, paidFrom, paidTo, ...plain } = filters;
  return {
    ...plain,
    createStart: createFrom ? `${createFrom} 00:00:00` : "",
    createEnd: createTo ? `${createTo} 23:59:59` : "",
    paidStart: paidFrom ? `${paidFrom} 00:00:00` : "",
    paidEnd: paidTo ? `${paidTo} 23:59:59` : "",
  };
}

function refundReview(row: OnlinePayment) {
  const lines = [
    `支付单 ${row.paymentNo} · ${money(row.amount)} 将原路退回（${payMethodLabel(row.payMethod)}）。`,
    `关联订单 ${row.orderCode || "未关联"}`,
    `商品 ${orderGoods(row)}`,
    `收件人 ${orderRecipient(row)}`,
  ];
  if (row.address) lines.push(`地址 ${row.address}`);
  lines.push(`订单状态 ${orderStatusLabel(row.orderStatus)} · ${payStatusLabel(row.payStatus)}`);
  return lines.join("\n");
}

export function OnlinePaymentsPage({
  notify,
}: {
  notify: Notify;
}) {
  const access = useAccess();
  const [rows, setRows] = useState<OnlinePayment[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<PaymentSummary>(EMPTY_SUMMARY);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pageKeyword, setPageKeyword] = useState("");
  const [filters, setFilters] = useState<PaymentFilters>(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState<PaymentFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadAllState, setLoadAllState] = useState({ loading: false, current: 0, total: 0 });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [error, setError] = useState("");
  const [refundTarget, setRefundTarget] = useState<OnlinePayment | null>(null);
  const [refundReason, setRefundReason] = useState("后台退款");
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const canManage = access.has("bills.edit");
  const canExport = access.has("bills.export");

  const load = useCallback(async (nextFilters: PaymentFilters, nextPageSize = PAGE_SIZE) => {
    setLoading(true);
    setError("");
    try {
      const query = filterQuery(nextFilters);
      const [listResult, summaryResult] = await Promise.all([
        apiRequest<PageResult>(API_PATHS.billing.payments, { query: { pageNum: 1, pageSize: nextPageSize, ...query } }),
        apiRequest<SummaryResult>(`${API_PATHS.billing.payments}/summary`, { query }),
      ]);
      setRows(listResult.rows || []);
      setTotal(Number(listResult.total || 0));
      setSummary({ ...EMPTY_SUMMARY, ...(summaryResult.data || {}) });
      setPageSize(nextPageSize);
      setExpanded(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "支付订单加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(EMPTY_FILTERS); }, [load]);

  const visibleRows = useMemo(() => {
    const keyword = pageKeyword.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => [
      row.paymentNo,
      row.orderCode,
      row.tradeOrderId,
      row.refundNo,
      row.refundId,
      row.storeName,
      row.purchaserName,
      row.customer,
      row.phone,
      orderGoods(row),
      statusMeta(row.status).label,
    ].some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [pageKeyword, rows]);

  const activeFilterCount = useMemo(() => Object.values(activeFilters).filter((value) => String(value).trim()).length, [activeFilters]);
  const syncableRows = visibleRows.filter((row) => row.status === "PENDING" || row.status === "REFUNDING");

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const next = Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value.trim()])) as PaymentFilters;
    setActiveFilters(next);
    setFilterOpen(false);
    void load(next);
  };

  const copyValue = async (label: string, value?: string) => {
    if (!value) return;
    const copied = await copyToClipboard(value);
    notify(copied ? `${label}已复制` : "复制失败，请手动复制", copied ? "success" : "error");
  };

  const syncRow = async (row: OnlinePayment) => {
    setBusyId(row.id);
    try {
      const result = await apiRequest<{ data?: OnlinePayment }>(`${API_PATHS.billing.payments}/${row.id}/sync`, { method: "POST" });
      notify(`状态已同步：${statusMeta(result.data?.status || row.status).label}`, "success");
      await load(activeFilters, pageSize);
    } catch (syncError) {
      notify(syncError instanceof Error ? syncError.message : "状态同步失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  const syncVisible = async () => {
    setBulkSyncing(true);
    let success = 0;
    let failed = 0;
    for (const row of syncableRows) {
      try {
        await apiRequest(`${API_PATHS.billing.payments}/${row.id}/sync`, { method: "POST" });
        success += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkSyncing(false);
    notify(`状态核对完成：成功 ${success} 条${failed ? `，失败 ${failed} 条` : ""}`, failed ? "info" : "success");
    await load(activeFilters, pageSize);
  };

  const loadMore = () => {
    if (loading || rows.length >= total) return;
    void load(activeFilters, pageSize + PAGE_SIZE);
  };

  const loadAllRows = async () => {
    if (loadAllState.loading) return;
    setLoadAllState({ loading: true, current: 0, total: 0 });
    const accumulated: OnlinePayment[] = [];
    let serverTotal = 0;
    let pageNum = 1;
    try {
      while (pageNum <= 200) {
        const result = await apiRequest<PageResult>(API_PATHS.billing.payments, {
          query: { pageNum, pageSize: PAGE_SIZE, ...filterQuery(activeFilters) },
        });
        const pageRows = result.rows || [];
        serverTotal = Number(result.total || 0);
        accumulated.push(...pageRows);
        setLoadAllState({ loading: true, current: accumulated.length, total: serverTotal });
        if (!pageRows.length || accumulated.length >= serverTotal) break;
        pageNum += 1;
      }
      setRows(accumulated);
      setTotal(serverTotal);
      setPageSize(Math.max(PAGE_SIZE, accumulated.length));
      notify(`已加载全部 ${accumulated.length} 条支付订单`, "success");
    } catch (loadError) {
      notify(loadError instanceof Error ? loadError.message : "加载所有支付订单失败", "error");
      if (accumulated.length) {
        setRows(accumulated);
        setTotal(serverTotal);
        setPageSize(Math.max(PAGE_SIZE, accumulated.length));
      }
    } finally {
      setLoadAllState({ loading: false, current: 0, total: 0 });
    }
  };

  const submitRefund = async (event: FormEvent) => {
    event.preventDefault();
    if (!refundTarget || !refundReason.trim()) return;
    setBusyId(refundTarget.id);
    try {
      await apiRequest(`${API_PATHS.billing.payments}/${refundTarget.id}/refund`, {
        method: "POST",
        body: { reason: refundReason.trim() },
      });
      notify(`已发起退款：${refundTarget.paymentNo}`, "success");
      setRefundTarget(null);
      await load(activeFilters, pageSize);
    } catch (refundError) {
      notify(refundError instanceof Error ? refundError.message : "退款发起失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  const exportRows = async () => {
    try {
      await downloadFile(`${API_PATHS.billing.payments.slice(1)}/export`, filterQuery(activeFilters), `支付订单_${Date.now()}.xlsx`);
      notify("支付订单已导出", "success");
    } catch (exportError) {
      notify(exportError instanceof Error ? exportError.message : "导出失败", "error");
    }
  };

  const toggleExpanded = (id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="module-page order-page crud-page crud-page-online-payments finance-page">
      <div className="module-hero">
        <div>
          <span className="eyebrow">订单管理模块</span>
          <h1>支付订单</h1>
          <p>交易状态、入账与退款进度集中核对</p>
        </div>
      </div>

      <section className="finance-status-grid" aria-label="支付汇总">
        <article><span className="metric-icon blue"><ReceiptText size={15} /></span><p>全部</p><b>{summary.totalCount}</b><small>支付订单</small></article>
        <article className="is-positive"><span className="metric-icon green"><BadgeDollarSign size={15} /></span><p>支付成功</p><b>{summary.paidCount}</b><small>{money(summary.paidAmount)}</small></article>
        <article><span className="metric-icon peach"><RefreshCw size={15} /></span><p>待支付</p><b>{summary.pendingCount}</b><small>等待付款</small></article>
        <article><span className="metric-icon amber"><RotateCcw size={15} /></span><p>退款</p><b>{summary.refundingCount + summary.refundedCount}</b><small>{summary.refundingCount} 处理中 · {summary.refundedCount} 完成</small></article>
      </section>

      <div className="toolbar-card search-toolbar">
        <label className="quick-search">
          <Search size={15} strokeWidth={2.2} />
          <input value={pageKeyword} onChange={(event) => setPageKeyword(event.target.value)} placeholder="检索本页支付单、订单、店铺或收件人" aria-label="检索本页支付订单" enterKeyHint="search" />
          {pageKeyword ? <button className="search-clear" type="button" aria-label="清空本页检索" onClick={() => setPageKeyword("")}><X size={14} /></button> : null}
        </label>
        <button className={`filter-chip${activeFilterCount ? " active" : ""}`} type="button" onClick={() => { setFilters(activeFilters); setFilterOpen(true); }}>
          <SlidersHorizontal size={14} strokeWidth={2.2} />筛选{activeFilterCount ? ` ${activeFilterCount}` : ""}
        </button>
        <button className="toolbar-icon" type="button" onClick={() => void load(activeFilters, pageSize)} aria-label="刷新"><RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} /></button>
      </div>

      <div className="secondary-actions">
        {canExport ? <button type="button" onClick={() => void exportRows()}><Download size={16} />导出</button> : null}
        <button type="button" onClick={() => void loadAllRows()} disabled={loadAllState.loading || (total > 0 && rows.length >= total)} className={loadAllState.loading ? "is-loading" : ""}>
          {loadAllState.loading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
          {loadAllState.loading ? (loadAllState.total ? `加载中 ${loadAllState.current}/${loadAllState.total}` : "加载中…") : "加载所有"}
        </button>
        {canManage ? <button type="button" disabled={!syncableRows.length || bulkSyncing} className={bulkSyncing ? "is-loading" : ""} onClick={() => setConfirm({
          title: "核对本页待处理状态",
          message: `将向简付逐条查询本页 ${syncableRows.length} 笔待支付或退款中的交易，并以平台结果更新本地状态。是否继续？`,
          action: syncVisible,
        })}>{bulkSyncing ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{bulkSyncing ? "核对中" : `同步本页${syncableRows.length ? ` · ${syncableRows.length}` : ""}`}</button> : null}
      </div>

      {error ? (
        <section className="risk-ip-mobile-error" role="alert">
          <b>无法读取支付订单</b>
          <p>{error}</p>
          <button className="button button-ghost" type="button" onClick={() => void load(activeFilters, pageSize)}>重新加载</button>
        </section>
      ) : <>
        <div className="list-heading"><div><h2>支付订单列表</h2><span>共 {total} 条{pageKeyword.trim() ? ` · 本页匹配 ${visibleRows.length} 条` : ""}</span></div></div>
        <div className="mobile-card-list online-payment-list" aria-busy={loading}>
          {!visibleRows.length ? <EmptyState loading={loading} label={pageKeyword.trim() ? "本页匹配结果" : "支付订单"} /> : null}
          {visibleRows.map((row) => {
            const meta = statusMeta(row.status);
            const isOpen = expanded.has(row.id);
            const refundable = row.status === "SUCCESS" && canManage;
            const syncable = (row.status === "PENDING" || row.status === "REFUNDING") && canManage;
            return <article className="order-card finance-card payment-card" key={row.id}>
              <div className="card-topline">
                <button className="order-number" type="button" onClick={() => void copyValue("支付单号", row.paymentNo)}>{row.paymentNo}<Copy size={13} /></button>
                <div className="card-topline-badges"><span className="finance-channel-badge"><CreditCard size={11} />{payMethodLabel(row.payMethod)}</span><span className={`status ${meta.tone === "success" ? "status-success" : meta.tone === "pending" || meta.tone === "refunding" ? "status-warning" : meta.tone === "refunded" ? "status-danger" : "status-neutral"}`}><span />{meta.label}</span></div>
              </div>

              <button className="card-main" type="button" onClick={() => toggleExpanded(row.id)}>
                <span className="product-avatar">{payMethodLabel(row.payMethod).slice(0, 1)}</span>
                <span className="product-copy"><b>{orderGoods(row)}</b><small>{row.storeName || "未关联店铺"}{row.purchaserName ? ` · ${row.purchaserName}` : ""}</small></span>
                <span className="order-price"><small>{row.status === "REFUNDED" ? "退款金额" : "支付金额"}</small><b className={row.status === "REFUNDED" ? "is-refunded" : ""}>{money(row.status === "REFUNDED" ? row.refundAmount || row.amount : row.amount)}</b></span>
              </button>

              <div className="recipient-block"><div><User size={16} /><b>{row.customer || "--"}</b>{row.phone ? <a href={`tel:${row.phone}`}><Phone size={14} />{row.phone}</a> : null}</div><p><MapPin size={15} />{row.address || "暂无收货地址"}</p></div>
              <div className="shipping-line payment-reference-line"><span><ReceiptText size={15} />{row.orderCode || "未关联业务订单"}{row.orderCode ? <button type="button" onClick={() => void copyValue("订单号", row.orderCode)} aria-label="复制订单号"><Copy size={12} /></button> : null}</span><span>{row.paidTime || row.createTime || "—"}</span></div>

              <div className={`expand-wrapper ${isOpen ? "open" : ""}`}><div className="expand-inner">
                <div className="data-metrics data-metrics-expand">
                  <div><span>订单状态</span><b>{orderStatusLabel(row.orderStatus)}</b></div>
                  <div><span>订单付款状态</span><b>{payStatusLabel(row.payStatus)}</b></div>
                  <div className="full-width"><span>平台支付单号</span><span className="online-payment-copy-line"><b>{row.tradeOrderId || "—"}</b>{row.tradeOrderId ? <button type="button" onClick={() => void copyValue("平台支付单号", row.tradeOrderId)} aria-label="复制平台支付单号"><Copy size={13} /></button> : null}</span></div>
                  <div><span>创建时间</span><b>{row.createTime || "—"}</b></div>
                  <div><span>更新时间</span><b>{row.updateTime || "—"}</b></div>
                  {row.refundNo || row.refundId ? <>
                    <div className="full-width"><span>退款单号</span><span className="online-payment-copy-line"><b>{row.refundId || row.refundNo}</b><button type="button" onClick={() => void copyValue("退款单号", row.refundId || row.refundNo)} aria-label="复制退款单号"><Copy size={13} /></button></span></div>
                    <div><span>退款时间</span><b>{row.refundTime || "—"}</b></div>
                    <div><span>退款原因</span><b>{row.refundReason || "—"}</b></div>
                  </> : null}
                </div>
              </div></div>
              <button type="button" className={`data-more-toggle ${isOpen ? "open" : ""}`} onClick={() => toggleExpanded(row.id)} aria-expanded={isOpen}><span>{isOpen ? "收起交易明细" : "查看交易明细"}</span><ChevronDown size={15} /></button>

              {syncable || refundable ? <div className="card-actions">
                {syncable ? <button type="button" className="primary-action" disabled={busyId === row.id || bulkSyncing} onClick={() => void syncRow(row)}>{busyId === row.id ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}同步状态</button> : null}
                {refundable ? <button type="button" className="danger-text" disabled={busyId === row.id} onClick={() => { setRefundReason("后台退款"); setRefundTarget(row); }}><RotateCcw size={15} />全额退款</button> : null}
              </div> : null}
            </article>;
          })}
        </div>
        {rows.length < total ? <button className="load-more" type="button" onClick={loadMore}><ChevronRight size={17} />加载更多</button> : null}
      </>}

      <Sheet open={filterOpen} title="筛选支付订单" onClose={() => setFilterOpen(false)}>
        <form className="filter-sheet" onSubmit={applyFilters}>
          <div className="filter-sheet-body online-payment-filter-body">
            <section className="filter-section">
              <header><h3>订单与交易</h3></header>
              <div className="filter-field-stack">
                <label><span>支付单号</span><input value={filters.paymentNo} onChange={(event) => setFilters({ ...filters, paymentNo: event.target.value })} placeholder="商户支付单号" /></label>
                <label><span>业务订单号</span><input value={filters.orderCode} onChange={(event) => setFilters({ ...filters, orderCode: event.target.value })} placeholder="订单系统订单号" /></label>
                <label><span>平台支付单号</span><input value={filters.tradeOrderId} onChange={(event) => setFilters({ ...filters, tradeOrderId: event.target.value })} placeholder="JianPay 平台订单号" /></label>
                <label><span>退款单号</span><input value={filters.refundNo} onChange={(event) => setFilters({ ...filters, refundNo: event.target.value })} placeholder="商户或平台退款单号" /></label>
                <label><span>支付状态</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">全部状态</option>{Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></label>
                <label><span>支付渠道</span><select value={filters.payMethod} onChange={(event) => setFilters({ ...filters, payMethod: event.target.value })}><option value="">全部渠道</option><option value="wx">微信</option><option value="alipay">支付宝</option></select></label>
              </div>
            </section>
            <section className="filter-section">
              <header><h3>业务信息</h3></header>
              <div className="filter-field-stack">
                <label><span>店铺</span><input value={filters.storeName} onChange={(event) => setFilters({ ...filters, storeName: event.target.value })} placeholder="店铺名称" /></label>
                <label><span>下单人</span><input value={filters.purchaserName} onChange={(event) => setFilters({ ...filters, purchaserName: event.target.value })} placeholder="下单人名称" /></label>
                <label><span>收件人 / 手机号</span><input value={filters.customer} onChange={(event) => setFilters({ ...filters, customer: event.target.value })} placeholder="收件人或手机号" /></label>
              </div>
            </section>
            <section className="filter-section">
              <header><h3>时间范围</h3></header>
              <div className="online-payment-date-grid">
                <label><span>创建开始</span><input type="date" value={filters.createFrom} onChange={(event) => setFilters({ ...filters, createFrom: event.target.value })} /></label>
                <label><span>创建结束</span><input type="date" value={filters.createTo} onChange={(event) => setFilters({ ...filters, createTo: event.target.value })} /></label>
                <label><span>支付开始</span><input type="date" value={filters.paidFrom} onChange={(event) => setFilters({ ...filters, paidFrom: event.target.value })} /></label>
                <label><span>支付结束</span><input type="date" value={filters.paidTo} onChange={(event) => setFilters({ ...filters, paidTo: event.target.value })} /></label>
              </div>
            </section>
          </div>
          <div className="filter-sheet-footer"><button type="button" className="filter-reset" onClick={() => setFilters(EMPTY_FILTERS)}>重置</button><button className="filter-apply" type="submit">查看结果</button></div>
        </form>
      </Sheet>

      <Sheet open={refundTarget !== null} title="确认全额退款" onClose={() => setRefundTarget(null)}>
        {refundTarget ? <form className="filter-sheet online-payment-refund-sheet" onSubmit={submitRefund}>
          <div className="filter-sheet-body">
            <section className="filter-section"><header><h3>退款核对</h3></header><p className="online-payment-refund-review">{refundReview(refundTarget)}</p><label><span>退款原因</span><textarea value={refundReason} maxLength={128} required onChange={(event) => setRefundReason(event.target.value)} placeholder="请输入退款原因" /></label><p className="online-payment-refund-warning">退款将原路退回买家，成功后不可撤销。</p></section>
          </div>
          <div className="filter-sheet-footer"><button type="button" className="filter-reset" onClick={() => setRefundTarget(null)}>取消</button><button className="filter-apply is-danger" type="submit" disabled={busyId === refundTarget.id || !refundReason.trim()}>{busyId === refundTarget.id ? "退款处理中" : "确认退款"}</button></div>
        </form> : null}
      </Sheet>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export default OnlinePaymentsPage;
