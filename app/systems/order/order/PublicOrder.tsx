import { AlertCircle, Box, ChevronRight, LoaderCircle, PackageCheck, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";
import { API_PATHS } from "../../../lib/pathConventions";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, publicApiRequest } from "../../../lib/api";
import OrderList, { PublicOrderRecord } from "../tools/OrderList";
import PeachTip from "../../../components/PeachTip";

function readLinkId() {
  const rawHash = window.location.hash.replace(/^#/, "").trim();
  const hashId = rawHash.startsWith("id=") ? new URLSearchParams(rawHash).get("id") : rawHash;
  const queryId = new URLSearchParams(window.location.search).get("id");
  return (hashId || queryId || "").trim();
}

function payableAmount(order: PublicOrderRecord) {
  const unit = Number(order.salePrice);
  const count = Number(order.orderNum || 1);
  if (unit > 0 && count > 0) return unit * count;
  const paid = Number(order.paidAmount || order.paymentAmount);
  return paid > 0 ? paid : undefined;
}

export default function PublicOrder({ embedded = false }: { embedded?: boolean }) {
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlinePayTarget, setOnlinePayTarget] = useState<{ orderCode: string; amount?: number } | null>(null);
  const [onlinePayBusy, setOnlinePayBusy] = useState(false);
  const [onlinePayError, setOnlinePayError] = useState("");
  const [payToast, setPayToast] = useState("");

  const load = useCallback(async () => {
    const id = readLinkId();
    if (!id || !/^[a-zA-Z0-9_-]{4,80}$/.test(id)) {
      setOrders([]); setError("订单链接无效，请使用订单管理系统生成的查询链接"); setLoading(false); return;
    }
    setLoading(true); setError("");
    try {
      const result = await publicApiRequest<{ data?: PublicOrderRecord[] }>(`${API_PATHS.content.search}/by`, { id });
      const data = Array.isArray(result.data) ? result.data : [];
      setOrders(data);
      if (!data.length) setError("没有查询到订单，请检查链接是否正确");
    } catch (cause) { setOrders([]); setError(cause instanceof Error ? cause.message : "订单查询失败，请稍后重试"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); window.addEventListener("hashchange", load); return () => window.removeEventListener("hashchange", load); }, [load]);

  async function startOnlinePay(orderCode: string, payMethod: "wx" | "alipay") {
    const signId = readLinkId();
    if (!orderCode || !signId || onlinePayBusy) return;
    setOnlinePayBusy(true); setOnlinePayError("");
    try {
      const result = await apiRequest<{ data?: { payUrl?: string; paid?: boolean } }>(`${API_PATHS.content.search}/purchaser/pay/public`, {
        auth: false,
        method: "POST",
        body: { signId, orderCode, payMethod },
      });
      if (result.data?.paid) {
        setOnlinePayTarget(null);
        setPayToast("订单已支付");
        window.setTimeout(() => setPayToast(""), 1800);
        await load();
        return;
      }
      const payUrl = result.data?.payUrl;
      if (!payUrl) throw new Error("未获取到收银台地址");
      window.location.assign(payUrl);
    } catch (cause) {
      setOnlinePayError(cause instanceof Error ? cause.message : "发起支付失败，请稍后重试");
    } finally {
      setOnlinePayBusy(false);
    }
  }

  const canPay = orders.some((order) => Boolean(order.payEnabled) && ![1, 2, 3].includes(Number(order.payStatus)));

  return <div className="tool-page signed-order-tool">
    <section className="tool-hero"><span><PackageCheck size={25} /></span><div><small>SECURE ORDER LINK</small><h1>确认订单</h1><p>{canPay ? "核对订单后即可免登录在线支付" : "查看订单与最新物流信息"}</p></div></section>
    <PeachTip />
    {loading ? <section className="public-state signed-order-state"><LoaderCircle className="spin" size={32} /><h1>正在查询订单</h1><p>请稍候，正在同步最新订单与物流信息</p></section> : error ? <section className="public-state public-state-error signed-order-state"><Box size={34} /><h1>暂时无法查看</h1><p>{error}</p><button type="button" onClick={load}><RefreshCw size={17} />重新查询</button></section> : <OrderList
      orders={orders}
      contact={orders[0]?.linkNameAndPhone?.trim()}
      onRefresh={load}
      onPay={canPay ? (order) => {
        if (!order.payEnabled) return;
        setOnlinePayError("");
        setOnlinePayTarget({ orderCode: String(order.orderCode || ""), amount: payableAmount(order) });
      } : undefined}
    />}
    {onlinePayTarget ? <div className="purchaser-help-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOnlinePayTarget(null)}>
      <section className="purchaser-sheet purchaser-online-pay-sheet">
        <div className="purchaser-online-pay-head">
          <small>ONLINE PAY</small>
          <button className="purchaser-help-close" type="button" onClick={() => setOnlinePayTarget(null)} aria-label="关闭"><X size={19} /></button>
        </div>
        <h2>确认并支付</h2>
        <div className="purchaser-online-pay-order">
          <span>订单</span>
          <b>{onlinePayTarget.orderCode}</b>
          {onlinePayTarget.amount ? <em>¥{onlinePayTarget.amount.toFixed(2)}</em> : null}
        </div>
        <div className="purchaser-online-pay-channels" role="radiogroup" aria-label="支付方式">
          <button type="button" className="pay-channel is-wx" disabled={onlinePayBusy} onClick={() => void startOnlinePay(onlinePayTarget.orderCode, "wx")}>
            <span className="pay-channel-icon">{onlinePayBusy ? <LoaderCircle className="spin" size={20} /> : <Wallet size={21} />}</span>
            <span className="pay-channel-copy"><b>微信支付</b><small>确认订单后拉起微信付款</small></span>
            <ChevronRight size={17} />
          </button>
          <button type="button" className="pay-channel is-alipay" disabled={onlinePayBusy} onClick={() => void startOnlinePay(onlinePayTarget.orderCode, "alipay")}>
            <span className="pay-channel-icon">{onlinePayBusy ? <LoaderCircle className="spin" size={20} /> : <ShieldCheck size={21} />}</span>
            <span className="pay-channel-copy"><b>支付宝</b><small>确认订单后跳转支付宝付款</small></span>
            <ChevronRight size={17} />
          </button>
        </div>
        <p className="purchaser-online-pay-tip"><ShieldCheck size={13} />无需登录。支付成功后订单自动确认。</p>
        {onlinePayError ? <p className="purchaser-online-pay-error"><AlertCircle size={14} />{onlinePayError}</p> : null}
      </section>
    </div> : null}
    {payToast ? <div className="public-copy-toast">{payToast}</div> : null}
    {!embedded ? <footer className="signed-order-footer"><span>喜八订单确认 · 信息以系统最新记录为准</span><a href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></footer> : null}
  </div>;
}
