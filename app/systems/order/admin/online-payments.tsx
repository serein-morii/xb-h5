/**
 * 在线支付账单（简付 JianPay）
 *
 * 管理端查看实付流水：待支付 / 支付成功 / 退款中 / 已退款 / 已关闭。
 * 支付成功的单可发起全额退款；退款结果由平台回调推进，
 * 「同步退款状态」会对退款中的单主动查单补偿丢失的回调。
 */
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Wallet,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { API_PATHS } from "../../../lib/pathConventions";
import { useAccess } from "./access";
import { ConfirmDialog, EmptyState, MobileBackButton } from "./ui";

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
  refundAmount?: number;
  refundReason?: string;
  refundTime?: string;
  storeName?: string;
  purchaserName?: string;
  orderNameDesc?: string;
  orderNum?: number;
  paidTime?: string;
  createTime?: string;
};

type PaymentFilters = { paymentNo: string; orderCode: string; status: string; payMethod: string };
type PageResult = { rows: OnlinePayment[]; total: number };

const EMPTY_FILTERS: PaymentFilters = { paymentNo: "", orderCode: "", status: "", payMethod: "" };
const PAGE_SIZE = 20;

const STATUS_META: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "待支付", tone: "pending" },
  SUCCESS: { label: "支付成功", tone: "success" },
  REFUNDING: { label: "退款中", tone: "refunding" },
  REFUNDED: { label: "已退款", tone: "refunded" },
  CLOSED: { label: "已关闭", tone: "closed" },
};

function statusMeta(status: unknown) {
  return STATUS_META[String(status || "")] || { label: String(status || "未知"), tone: "closed" };
}

function payMethodLabel(value: unknown) {
  const method = String(value || "");
  return method === "wx" ? "微信" : method === "alipay" ? "支付宝" : method || "—";
}

function money(value: unknown) {
  const num = Number(value || 0);
  return `¥${num.toFixed(2)}`;
}

export function OnlinePaymentsPage({
  notify,
  onBack,
  backLabel = "工作台",
}: {
  notify: Notify;
  onBack?: () => void;
  backLabel?: string;
}) {
  const access = useAccess();
  const [rows, setRows] = useState<OnlinePayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [paymentNo, setPaymentNo] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [status, setStatus] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [activeFilters, setActiveFilters] = useState<PaymentFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const canRefund = access.has("biz:bill.edit");
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (nextPage: number, filters: PaymentFilters, sync = false) => {
    if (sync) setSyncing(true);
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<PageResult>(API_PATHS.billing.payments, {
        query: { pageNum: nextPage, pageSize: PAGE_SIZE, ...filters, ...(sync ? { sync: true } : {}) },
      });
      setRows(result.rows || []);
      setTotal(result.total || 0);
      setPage(nextPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "在线支付账单加载失败");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void load(1, EMPTY_FILTERS);
  }, [load]);

  const stats = useMemo(() => {
    const successRows = rows.filter((row) => row.status === "SUCCESS");
    const refundedRows = rows.filter((row) => row.status === "REFUNDED");
    const income = successRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      - refundedRows.reduce((sum, row) => sum + Number(row.refundAmount || row.amount || 0), 0);
    return {
      pending: rows.filter((row) => row.status === "PENDING").length,
      success: successRows.length,
      refunding: rows.filter((row) => row.status === "REFUNDING").length,
      refunded: refundedRows.length,
      income,
    };
  }, [rows]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const filters = { paymentNo: paymentNo.trim(), orderCode: orderCode.trim(), status, payMethod };
    setActiveFilters(filters);
    void load(1, filters);
  };

  const refund = async (row: OnlinePayment) => {
    setBusyId(row.id);
    try {
      await apiRequest(`${API_PATHS.billing.payments}/${row.id}/refund`, {
        method: "POST",
        body: { reason: "后台退款" },
      });
      notify(`已发起退款：${row.paymentNo}`, "success");
      await load(page, activeFilters);
    } catch (refundError) {
      notify(refundError instanceof Error ? refundError.message : "退款发起失败", "error");
    } finally {
      setBusyId(null);
    }
  };

  const askRefund = (row: OnlinePayment) => {
    setConfirm({
      title: "确认全额退款",
      message: `支付单 ${row.paymentNo} · ${money(row.amount)} 将原路退回买家（${payMethodLabel(row.payMethod)}），订单付款状态会同步变为「已退款」。此操作不可撤销。`,
      danger: true,
      action: () => refund(row),
    });
  };

  return (
    <div className="module-page risk-ip-mobile-page online-payments-page">
      <div className="module-hero compact-hero risk-ip-mobile-hero">
        <div>
          {onBack ? <MobileBackButton label={backLabel} onClick={onBack} /> : null}
          <h1>在线支付账单</h1>
          <p>简付实付流水 · 退款原路退回</p>
        </div>
        <span className="hero-tool-icon"><CreditCard size={25} /></span>
      </div>

      <section className="risk-ip-current-panel online-payments-stats" aria-label="本页统计">
        <div><small>待支付</small><strong>{stats.pending}</strong></div>
        <div><small>支付成功</small><strong>{stats.success}</strong></div>
        <div><small>退款中</small><strong>{stats.refunding}</strong></div>
        <div><small>已退款</small><strong>{stats.refunded}</strong></div>
        <div className="online-payments-income"><small>本页净收入</small><strong>{money(stats.income)}</strong></div>
        <button type="button" onClick={() => void load(page, activeFilters, true)} aria-label="同步退款状态" title="对退款中的单主动查单补偿回调">
          {syncing ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
        </button>
      </section>

      <form className="risk-ip-mobile-filter online-payments-filter" onSubmit={submit}>
        <label>
          <span>支付单号</span>
          <input
            value={paymentNo}
            onChange={(event) => setPaymentNo(event.target.value)}
            placeholder="商户支付单号"
            enterKeyHint="search"
          />
        </label>
        <label>
          <span>订单号</span>
          <input
            value={orderCode}
            onChange={(event) => setOrderCode(event.target.value)}
            placeholder="业务订单号"
            enterKeyHint="search"
          />
        </label>
        <label>
          <span>支付状态</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">全部状态</option>
            <option value="PENDING">待支付</option>
            <option value="SUCCESS">支付成功</option>
            <option value="REFUNDING">退款中</option>
            <option value="REFUNDED">已退款</option>
            <option value="CLOSED">已关闭</option>
          </select>
        </label>
        <label>
          <span>支付渠道</span>
          <select value={payMethod} onChange={(event) => setPayMethod(event.target.value)}>
            <option value="">全部渠道</option>
            <option value="wx">微信</option>
            <option value="alipay">支付宝</option>
          </select>
        </label>
        <button className="button button-primary" type="submit"><Search size={16} />查询</button>
      </form>

      {error ? (
        <section className="risk-ip-mobile-error" role="alert">
          <b>无法读取在线支付账单</b>
          <p>{error}</p>
          <button className="button button-ghost" type="button" onClick={() => void load(page, activeFilters)}>重新加载</button>
        </section>
      ) : (
        <>
          <div className="list-heading">
            <div><h2>支付流水</h2><span>共 {total} 条</span></div>
          </div>
          <div className="mobile-card-list risk-ip-mobile-list" aria-busy={loading}>
            {!rows.length ? <EmptyState loading={loading} label="支付单" /> : null}
            {rows.map((row) => {
              const meta = statusMeta(row.status);
              const refundable = row.status === "SUCCESS" && canRefund;
              return (
                <article className="data-card online-payment-card" key={row.id}>
                  <div className="data-card-head">
                    <span className="data-icon"><Wallet size={19} /></span>
                    <div>
                      <b className="risk-ip-mono">{row.paymentNo}</b>
                      <small>{row.orderCode || "—"} · {payMethodLabel(row.payMethod)}</small>
                    </div>
                    <span className={`online-payment-pill is-${meta.tone}`}>{meta.label}</span>
                  </div>
                  <div className="online-payment-amount">
                    <b>{money(row.amount)}</b>
                    {row.status === "REFUNDED" && row.refundAmount ? <small>已退 {money(row.refundAmount)}</small> : null}
                  </div>
                  <div className="risk-ip-mobile-details">
                    <div><span>商品</span><b>{row.orderNameDesc || "—"}{row.orderNum ? ` × ${row.orderNum}` : ""}</b></div>
                    <div><span>店铺 / 买家</span><b>{row.storeName || "—"} · {row.purchaserName || "—"}</b></div>
                    <div><span>支付时间</span><b>{row.paidTime || row.createTime || "—"}</b></div>
                    <div className="is-wide"><span>平台单号</span><b>{row.tradeOrderId || "—"}</b></div>
                    {row.status === "REFUNDED" || row.status === "REFUNDING" ? (
                      <div className="is-wide"><span>退款信息</span><b>{row.refundNo || "—"}{row.refundTime ? ` · ${row.refundTime}` : ""}{row.refundReason ? ` · ${row.refundReason}` : ""}</b></div>
                    ) : null}
                  </div>
                  {refundable ? (
                    <div className="online-payment-actions">
                      <button
                        type="button"
                        className="button button-ghost online-payment-refund"
                        disabled={loading || busyId === row.id}
                        onClick={() => askRefund(row)}
                      >
                        {busyId === row.id ? <LoaderCircle className="spin" size={15} /> : <RotateCcw size={15} />}
                        全额退款
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="sysm-pager">
            <button className="button button-ghost" type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1, activeFilters)}><ChevronLeft size={17} />上一页</button>
            <span>{page} / {pageCount}</span>
            <button className="button button-ghost" type="button" disabled={page >= pageCount || loading} onClick={() => void load(page + 1, activeFilters)}>下一页<ChevronRight size={17} /></button>
          </div>
        </>
      )}

      <p className="risk-ip-mobile-note">退款原路退回买家；「同步退款状态」会对退款中的单主动向简付查单补偿回调。</p>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export default OnlinePaymentsPage;
