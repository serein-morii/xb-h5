import { AlertCircle, Box, ChevronDown, ChevronRight, Clock3, LoaderCircle, PackageCheck, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";
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

/** 简付不支持微信外浏览器拉起微信 App：微信内跳收银台自动唤起，微信外改为展示收款码。 */
const isWeChatBrowser = typeof navigator !== "undefined" && /micromessenger/i.test(navigator.userAgent);

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
  return "待支付";
}

function flagOn(value: unknown) {
  return value === true || value === 1 || value === "1";
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
  const [payQr, setPayQr] = useState<{ url: string; payUrl: string } | null>(null);
  const [lastPayMethod, setLastPayMethod] = useState<"wx" | "alipay" | null>(null);

  const load = useCallback(async () => {
    const id = readLinkId();
    if (!id || !/^[a-zA-Z0-9_@\-\s]{4,80}$/.test(id)) {
      setOrder(null); setOrders([]); setListMode(false); setError("订单链接无效，请使用订单管理系统生成的支付链接"); setLoading(false); return;
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
      if (!matched) setError("没有查询到订单，请检查链接是否正确");
    } catch (cause) { setOrder(null); setOrders([]); setListMode(false); setError(cause instanceof Error ? cause.message : "订单查询失败，请稍后重试"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); window.addEventListener("hashchange", load); return () => window.removeEventListener("hashchange", load); }, [load]);

  async function startOnlinePay(payMethod: "wx" | "alipay", refresh = false) {
    const signId = readLinkId();
    const orderCode = String(order?.orderCode || "");
    if (!orderCode || !signId || onlinePayBusy) return;
    setLastPayMethod(payMethod);
    setOnlinePayBusy(true); setOnlinePayError(""); setPayQr(null);
    try {
      const result = await apiRequest<{ data?: { payUrl?: string; payQrcodeUrl?: string; paid?: boolean } }>(`${API_PATHS.content.search}/purchaser/pay/public`, {
        auth: false,
        method: "POST",
        body: { signId, orderCode, payMethod, refresh },
      });
      if (result.data?.paid) {
        setPayOpen(false);
        setPayToast("订单已支付");
        window.setTimeout(() => setPayToast(""), 1800);
        await load();
        return;
      }
      const payUrl = result.data?.payUrl || "";
      const qrcodeUrl = result.data?.payQrcodeUrl || "";
      if (payMethod === "wx" && !isWeChatBrowser) {
        if (qrcodeUrl) { setPayQr({ url: qrcodeUrl, payUrl }); return; }
        if (payUrl) { window.location.assign(payUrl); return; }
        throw new Error("未获取到收款码");
      }
      if (!payUrl) throw new Error("未获取到收银台地址");
      window.location.assign(payUrl);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "发起支付失败，请稍后重试";
      if (!refresh && /过期|已关闭|已失效/.test(message)) {
        // 网关把旧收银台关了：自动重新生成一次再试
        setOnlinePayBusy(false);
        await startOnlinePay(payMethod, true);
        return;
      }
      setOnlinePayError(message);
    } finally {
      setOnlinePayBusy(false);
    }
  }

  const amount = order ? payableAmount(order) : undefined;
  const unpaid = order ? ![1, 2, 3].includes(Number(order.payStatus)) : false;
  const payEnabled = flagOn(order?.payEnabled);
  const wxEnabled = order?.payWxEnabled !== false && order?.payWxEnabled !== 0 && order?.payWxEnabled !== "0";
  const alipayEnabled = order?.payAlipayEnabled !== false && order?.payAlipayEnabled !== 0 && order?.payAlipayEnabled !== "0";
  const canPay = payEnabled && unpaid && (wxEnabled || alipayEnabled);
  const payHint = Number(order?.payStatus) === 1 ? "订单已支付"
    : Number(order?.payStatus) === 3 ? "已提交，等待确认"
    : Number(order?.payStatus) === 2 ? "订单已退款"
    : payEnabled ? "当前店铺未开通微信或支付宝收款"
    : "当前店铺暂未开通在线支付";
  const tracking: TrackingItem[] = order?.expInfoList || [];

  return <div className="tool-page signed-order-tool">
    {loading ? <section className="public-state signed-order-state"><LoaderCircle className="spin" size={32} /><h1>正在打开订单</h1><p>请稍候，正在同步最新信息</p></section> : error ? <section className="public-state public-state-error signed-order-state"><Box size={34} /><h1>暂时无法查看</h1><p>{error}</p><button type="button" onClick={load}><RefreshCw size={17} />重新查询</button></section> : listMode ? <>
      <section className="tool-hero"><span><PackageCheck size={25} /></span><div><small>ORDER LINK</small><h1>订单查询</h1><p>查看关联订单与物流信息</p></div></section>
      <PeachTip />
      <OrderList orders={orders} contact={orders[0]?.linkNameAndPhone?.trim()} onRefresh={load} />
    </> : order ? <article className="pay-order-page">
      <section className="pay-order-hero">
        <small>{order.storeName || "在线支付"}</small>
        <div className="pay-order-amount">
          <i>¥</i><b>{amount !== undefined ? amount.toFixed(2) : "--"}</b>
        </div>
        <div className="pay-order-status">
          <span className={`pay-pill is-pay-${Number(order.payStatus) === 1 ? "paid" : Number(order.payStatus) === 3 ? "confirming" : Number(order.payStatus) === 2 ? "refunded" : "unpaid"}`}>{payStatusLabel(order.payStatus)}</span>
          <span className="pay-pill">{orderStatusLabel(order.orderStatus, order.orderStatusDesc)}</span>
        </div>
        <p>{canPay ? "核对商品与收件信息后，选择微信或支付宝付款" : "查看订单详情与最新物流"}</p>
      </section>
      <section className="pay-order-card">
        <div className="pay-order-product">
          <b>{order.orderNameDesc || "未命名商品"}</b>
          <span>{order.orderTypeDesc || "--"} × {order.orderNum || 1}</span>
        </div>
        <dl className="pay-order-rows">
          <div><dt>订单号</dt><dd>{order.orderCode || "--"}</dd></div>
          <div><dt>收件人</dt><dd>{order.customer || "--"}{order.phone ? ` · ${order.phone}` : ""}</dd></div>
          <div><dt>快递</dt><dd>{order.expComDesc || "暂无快递"}{order.expCode && order.expCode !== "无" ? ` · ${order.expCode}` : ""}</dd></div>
          <div><dt>地址</dt><dd>{order.address || "暂无地址"}</dd></div>
          {order.orderDesc ? <div><dt>备注</dt><dd>{order.orderDesc}</dd></div> : null}
        </dl>
        <button type="button" className={`pay-order-track ${trackingOpen ? "is-open" : ""}`} onClick={() => setTrackingOpen((open) => !open)}>
          <Clock3 size={15} />
          <span><b>物流信息</b><small>{order.expNewDesc || tracking[0]?.expDesc || "暂无物流更新"}</small></span>
          <ChevronDown size={16} />
        </button>
        {trackingOpen ? <div className="pay-order-timeline">{tracking.length ? tracking.map((item, index) => {
          const label = item.expStatusDesc || item.expDesc || "物流更新";
          const detail = [item.expDesc, item.desc].find((text) => text && text !== label);
          return <div className={index === 0 ? "latest" : ""} key={String(item.id || `${item.expTime}-${index}`)}><i /><span><b>{label}</b>{detail ? <p>{detail}</p> : null}<small>{item.expTime || item.createTime || ""}</small></span></div>;
        }) : <p className="pay-order-timeline-empty">暂无物流轨迹</p>}</div> : null}
      </section>
      <div className="pay-order-dock">
        {canPay ? <button type="button" className="pay-order-cta" onClick={() => { setOnlinePayError(""); setPayOpen(true); }}><Wallet size={17} />去支付</button> : <p className="pay-order-hint">{payHint}</p>}
        <button type="button" className="pay-order-refresh" onClick={load}><RefreshCw size={14} />刷新</button>
      </div>
    </article> : null}
    {payOpen && order ? <div className="purchaser-help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPayOpen(false); setPayQr(null); } }}>
      <section className="purchaser-sheet purchaser-online-pay-sheet">
        <div className="purchaser-online-pay-head">
          <small>选择支付方式</small>
          <button className="purchaser-help-close" type="button" onClick={() => { setPayOpen(false); setPayQr(null); }} aria-label="关闭"><X size={19} /></button>
        </div>
        <h2>去支付</h2>
        <div className="purchaser-online-pay-order">
          <span>订单</span>
          <b>{order.orderCode}</b>
          {amount ? <em>¥{amount.toFixed(2)}</em> : null}
        </div>
        {payQr ? <div className="pay-order-qr">
          <img src={payQr.url} alt="微信收款码" />
          <p>当前浏览器无法直接拉起微信。<br />请截图保存二维码，在微信「扫一扫」右下角选择相册识别；<br />或直接用微信扫描屏幕上的码。</p>
          {payQr.payUrl ? <a className="pay-order-qr-link" href={payQr.payUrl} target="_blank" rel="noreferrer">打开收银台页面</a> : null}
          <button type="button" className="pay-order-qr-retry" disabled={onlinePayBusy} onClick={() => void startOnlinePay("wx", true)}><RefreshCw size={13} />重新生成收款码</button>
        </div> : <div className="purchaser-online-pay-channels" role="radiogroup" aria-label="支付方式">
          {wxEnabled ? <button type="button" className="pay-channel is-wx" disabled={onlinePayBusy} onClick={() => void startOnlinePay("wx")}>
            <span className="pay-channel-icon">{onlinePayBusy ? <LoaderCircle className="spin" size={20} /> : <Wallet size={21} />}</span>
            <span className="pay-channel-copy"><b>微信支付</b><small>{isWeChatBrowser ? "打开微信完成付款" : "生成收款码后扫码付款"}</small></span>
            <ChevronRight size={17} />
          </button> : null}
          {alipayEnabled ? <button type="button" className="pay-channel is-alipay" disabled={onlinePayBusy} onClick={() => void startOnlinePay("alipay")}>
            <span className="pay-channel-icon">{onlinePayBusy ? <LoaderCircle className="spin" size={20} /> : <ShieldCheck size={21} />}</span>
            <span className="pay-channel-copy"><b>支付宝</b><small>跳转支付宝完成付款</small></span>
            <ChevronRight size={17} />
          </button> : null}
        </div>}
        <p className="purchaser-online-pay-tip"><ShieldCheck size={13} />无需登录，支付成功后订单自动确认。</p>
        {onlinePayError ? <p className="purchaser-online-pay-error"><AlertCircle size={14} />{onlinePayError}</p> : null}
        {onlinePayError && lastPayMethod ? <button type="button" className="pay-order-qr-retry" disabled={onlinePayBusy} onClick={() => void startOnlinePay(lastPayMethod, true)}><RefreshCw size={13} />重新发起支付</button> : null}
      </section>
    </div> : null}
    {payToast ? <div className="public-copy-toast">{payToast}</div> : null}
    {!embedded ? <footer className="signed-order-footer"><span>喜八订单 · 信息以系统最新记录为准</span><a href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></footer> : null}
  </div>;
}
