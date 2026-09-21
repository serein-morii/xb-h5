import { AlertCircle, Box, ChevronRight, Clock3, LoaderCircle, MapPin, PackageCheck, RefreshCw, ShieldCheck, Truck, User, Wallet, X } from "lucide-react";
import { API_PATHS } from "../../../lib/pathConventions";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, publicApiRequest } from "../../../lib/api";
import OrderList, { type PublicOrderRecord, type TrackingItem } from "../tools/OrderList";
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

function payStatusLabel(status: unknown) {
  const value = Number(status);
  if (value === 1) return "已付款";
  if (value === 2) return "已退款";
  if (value === 3) return "待确认";
  return "未付款";
}

function orderStatusLabel(code?: string, fallback?: string) {
  if (code === "DSH") return "待处理";
  if (code === "DFH") return "待发货";
  if (code === "YFH") return "已发货";
  if (code === "YWC") return "已完成";
  if (code === "YQX") return "已取消";
  if (code === "YC") return "异常";
  return fallback || code || "未知";
}

export default function PublicOrder({ embedded = false }: { embedded?: boolean }) {
  const [order, setOrder] = useState<PublicOrderRecord | null>(null);
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [listMode, setListMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [onlinePayBusy, setOnlinePayBusy] = useState(false);
  const [onlinePayError, setOnlinePayError] = useState("");
  const [payToast, setPayToast] = useState("");
  const [trackingOpen, setTrackingOpen] = useState(false);

  const load = useCallback(async () => {
    const id = readLinkId();
    if (!id || !/^[a-zA-Z0-9_@\-\s]{4,80}$/.test(id)) {
      setOrder(null); setOrders([]); setListMode(false); setError("订单链接无效，请使用订单管理系统生成的确认支付链接"); setLoading(false); return;
    }
    setLoading(true); setError("");
    try {
      const result = await publicApiRequest<{ data?: PublicOrderRecord[] }>(`${API_PATHS.content.search}/by`, { id });
      const data = Array.isArray(result.data) ? result.data : [];
      const isListLink = id.startsWith("v-") || id.includes(" @");
      if (isListLink) {
        setListMode(true);
        setOrders(data);
        setOrder(null);
        if (!data.length) setError("没有查询到订单，请检查链接是否正确");
        return;
      }
      setListMode(false);
      setOrders([]);
      const matched = data.find((item) => String(item.signId || "") === id) || (data.length === 1 ? data[0] : null);
      setOrder(matched);
      if (!matched) setError("没有查询到这一单，请检查链接是否正确");
    } catch (cause) { setOrder(null); setOrders([]); setListMode(false); setError(cause instanceof Error ? cause.message : "订单查询失败，请稍后重试"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); window.addEventListener("hashchange", load); return () => window.removeEventListener("hashchange", load); }, [load]);

  async function startOnlinePay(payMethod: "wx" | "alipay") {
    const signId = readLinkId();
    const orderCode = String(order?.orderCode || "");
    if (!orderCode || !signId || onlinePayBusy) return;
    setOnlinePayBusy(true); setOnlinePayError("");
    try {
      const result = await apiRequest<{ data?: { payUrl?: string; paid?: boolean } }>(`${API_PATHS.content.search}/purchaser/pay/public`, {
        auth: false,
        method: "POST",
        body: { signId, orderCode, payMethod },
      });
      if (result.data?.paid) {
        setPayOpen(false);
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

  const amount = order ? payableAmount(order) : undefined;
  const unpaid = order ? ![1, 2, 3].includes(Number(order.payStatus)) : false;
  const wxEnabled = order?.payWxEnabled !== false;
  const alipayEnabled = order?.payAlipayEnabled !== false;
  const canPay = Boolean(order?.payEnabled) && unpaid && (wxEnabled || alipayEnabled);
  const tracking: TrackingItem[] = order?.expInfoList || [];

  return <div className="tool-page signed-order-tool">
    <section className="tool-hero"><span><PackageCheck size={25} /></span><div><small>SECURE ORDER LINK</small><h1>确认订单</h1><p>{canPay ? "核对这一单后即可选择微信或支付宝付款" : "查看这一单与最新物流信息"}</p></div></section>
    <PeachTip />
    {loading ? <section className="public-state signed-order-state"><LoaderCircle className="spin" size={32} /><h1>正在查询订单</h1><p>请稍候，正在同步这一单的最新信息</p></section> : error ? <section className="public-state public-state-error signed-order-state"><Box size={34} /><h1>暂时无法查看</h1><p>{error}</p><button type="button" onClick={load}><RefreshCw size={17} />重新查询</button></section> : listMode ? <OrderList orders={orders} contact={orders[0]?.linkNameAndPhone?.trim()} onRefresh={load} /> : order ? <article className="confirm-order-card">
      <header className="confirm-order-head">
        <div><small>订单编号</small><b>{order.orderCode || "--"}</b></div>
        <div className="confirm-order-pills"><span>{orderStatusLabel(order.orderStatus, order.orderStatusDesc)}</span><span>{payStatusLabel(order.payStatus)}</span></div>
      </header>
      <section className="confirm-order-product">
        <b>{order.orderNameDesc || "未命名商品"}</b>
        <span>{order.orderTypeDesc || "--"} × {order.orderNum || 1}</span>
        {amount ? <em>应付 ¥{amount.toFixed(2)}</em> : null}
      </section>
      <section className="confirm-order-block"><p><User size={15} />{order.customer || "--"} · {order.phone || "--"}</p><p><MapPin size={15} />{order.address || "暂无地址"}</p></section>
      <section className="confirm-order-block"><p><Truck size={15} />{order.expComDesc || "暂无快递"}{order.expCode && order.expCode !== "无" ? ` · ${order.expCode}` : ""}</p></section>
      {order.orderDesc ? <p className="confirm-order-note">备注：{order.orderDesc}</p> : null}
      <button type="button" className={`tool-tracking-toggle ${trackingOpen ? "open" : ""}`} onClick={() => setTrackingOpen((open) => !open)}><Clock3 size={15} /><span><b>物流信息</b><small>{order.expNewDesc || tracking[0]?.expDesc || "暂无物流更新"}</small></span></button>
      {trackingOpen ? <div className="tool-mini-timeline tool-full-timeline">{tracking.length ? tracking.map((item, index) => <div className={index === 0 ? "latest" : ""} key={String(item.id || `${item.expTime}-${index}`)}><i /><span><b>{item.expStatusDesc || item.expDesc || "物流更新"}</b><p>{item.expDesc || item.desc || "状态已更新"}</p><small>{item.expTime || item.createTime || ""}</small></span></div>) : <p className="tool-no-tracking">暂无物流轨迹</p>}</div> : null}
      {canPay ? <button type="button" className="confirm-order-pay" onClick={() => { setOnlinePayError(""); setPayOpen(true); }}><Wallet size={16} />去支付这一单</button> : <p className="confirm-order-paid">{Number(order.payStatus) === 1 ? "这一单已支付" : Number(order.payStatus) === 3 ? "这一单已提交，等待确认" : Number(order.payStatus) === 2 ? "这一单已退款" : "当前店铺暂未开通在线支付"}</p>}
      <button type="button" className="confirm-order-refresh" onClick={load}><RefreshCw size={14} />刷新这一单</button>
    </article> : null}
    {payOpen && order ? <div className="purchaser-help-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPayOpen(false)}>
      <section className="purchaser-sheet purchaser-online-pay-sheet">
        <div className="purchaser-online-pay-head">
          <small>ONLINE PAY</small>
          <button className="purchaser-help-close" type="button" onClick={() => setPayOpen(false)} aria-label="关闭"><X size={19} /></button>
        </div>
        <h2>确认并支付</h2>
        <div className="purchaser-online-pay-order">
          <span>订单</span>
          <b>{order.orderCode}</b>
          {amount ? <em>¥{amount.toFixed(2)}</em> : null}
        </div>
        <div className="purchaser-online-pay-channels" role="radiogroup" aria-label="支付方式">
          {wxEnabled ? <button type="button" className="pay-channel is-wx" disabled={onlinePayBusy} onClick={() => void startOnlinePay("wx")}>
            <span className="pay-channel-icon">{onlinePayBusy ? <LoaderCircle className="spin" size={20} /> : <Wallet size={21} />}</span>
            <span className="pay-channel-copy"><b>微信支付</b><small>确认这一单后拉起微信付款</small></span>
            <ChevronRight size={17} />
          </button> : null}
          {alipayEnabled ? <button type="button" className="pay-channel is-alipay" disabled={onlinePayBusy} onClick={() => void startOnlinePay("alipay")}>
            <span className="pay-channel-icon">{onlinePayBusy ? <LoaderCircle className="spin" size={20} /> : <ShieldCheck size={21} />}</span>
            <span className="pay-channel-copy"><b>支付宝</b><small>确认这一单后跳转支付宝付款</small></span>
            <ChevronRight size={17} />
          </button> : null}
        </div>
        <p className="purchaser-online-pay-tip"><ShieldCheck size={13} />无需登录。只支付这一单，支付成功后订单自动确认。</p>
        {onlinePayError ? <p className="purchaser-online-pay-error"><AlertCircle size={14} />{onlinePayError}</p> : null}
      </section>
    </div> : null}
    {payToast ? <div className="public-copy-toast">{payToast}</div> : null}
    {!embedded ? <footer className="signed-order-footer"><span>喜八订单确认 · 信息以系统最新记录为准</span><a href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></footer> : null}
  </div>;
}
