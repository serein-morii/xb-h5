/** 当面收款（简付）：选店铺与渠道，生成收款二维码，可关联订单并轮询支付结果。 */
import { LoaderCircle, QrCode, RefreshCw, CheckCircle2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { API_PATHS } from "../../../lib/pathConventions";
import { Sheet } from "./ui";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

type PayReadyStore = {
  storeId: number;
  storeCode?: string;
  storeName?: string;
  wxEnabled?: number;
  alipayEnabled?: number;
};

type CollectOrder = {
  id?: number;
  orderCode?: string;
  purchaser?: string;
  customer?: string;
  phone?: string;
  orderNameDesc?: string;
  orderTypeDesc?: string;
  orderNum?: number;
  salePrice?: number;
  payStatus?: number;
  store?: string;
};

type CollectResult = {
  paymentId?: number;
  orderCode?: string;
  merchantOrderNo?: string;
  amountFen?: number;
  payUrl?: string;
  payQrcodeUrl?: string;
  payMethod?: string;
  storeName?: string;
  paid?: boolean;
};

export type CollectPreset = { orderCode?: string; storeName?: string; storeCode?: string };

const PAY_METHODS = [
  { value: "wx", label: "微信收款" },
  { value: "alipay", label: "支付宝收款" },
];

export function CollectQrSheet({
  open,
  preset,
  notify,
  onClose,
  onPaid,
}: {
  open: boolean;
  preset?: CollectPreset | null;
  notify: Notify;
  onClose: () => void;
  onPaid?: () => void;
}) {
  const [stores, setStores] = useState<PayReadyStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState("wx");
  const [amount, setAmount] = useState("");
  const [goodsName, setGoodsName] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CollectResult | null>(null);
  const [payState, setPayState] = useState<"idle" | "pending" | "success">("idle");
  const [orderKeyword, setOrderKeyword] = useState("");
  const [orderResults, setOrderResults] = useState<CollectOrder[]>([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [orderFocus, setOrderFocus] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CollectOrder | null>(null);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingStores(true);
    setResult(null);
    setPayState("idle");
    setOrderKeyword(preset?.orderCode || "");
    setSelectedOrder(null);
    setOrderResults([]);
    setAmount("");
    setGoodsName("");
    apiRequest<{ data?: PayReadyStore[] }>(`${API_PATHS.stores.root}/pay-ready`)
      .then((response) => {
        if (!active) return;
        const list = Array.isArray(response.data) ? response.data : [];
        setStores(list);
        const matched = preset?.storeName
          ? list.find((item) => item.storeName === preset.storeName || item.storeCode === preset.storeCode)
          : null;
        const first = matched || list[0];
        setStoreId(first ? first.storeId : null);
        if (first) {
          if (Number(first.wxEnabled) === 1) setPayMethod("wx");
          else if (Number(first.alipayEnabled) === 1) setPayMethod("alipay");
        }
        if (!list.length) notify("没有店铺开通在线支付，请先到店铺管理配置", "info");
      })
      .catch((error) => { if (active) notify(error instanceof Error ? error.message : "收款店铺加载失败", "error"); })
      .finally(() => { if (active) setLoadingStores(false); });
    return () => { active = false; };
  }, [open, preset, notify]);

  // 轮询支付结果：开着弹层时每 4 秒同步一次，最多 5 分钟。
  useEffect(() => {
    if (payState !== "pending" || !result?.paymentId) return;
    let stopped = false;
    let attempts = 0;
    const tick = async () => {
      if (stopped) return;
      attempts += 1;
      try {
        const response = await apiRequest<{ data?: { status?: string } }>(`${API_PATHS.billing.payments}/${result.paymentId}/sync`, { method: "POST" });
        const status = String(response.data?.status || "");
        if (status === "SUCCESS") {
          setPayState("success");
          notify("已收到付款", "success");
          onPaid?.();
          return;
        }
      } catch { /* 同步失败等下一轮 */ }
      if (attempts < 75) pollTimer.current = window.setTimeout(() => void tick(), 4000);
    };
    pollTimer.current = window.setTimeout(() => void tick(), 4000);
    return () => {
      stopped = true;
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [payState, result, notify, onPaid]);

  const selectedStore = stores.find((item) => item.storeId === storeId) || null;
  const methods = PAY_METHODS.filter((item) => {
    if (!selectedStore) return true;
    return item.value === "wx" ? Number(selectedStore.wxEnabled) !== 0 : Number(selectedStore.alipayEnabled) !== 0;
  });

  // 关联订单搜索：防抖 300ms，按订单号 / 下单人 / 收件人 / 手机号 / 商品名模糊匹配。
  useEffect(() => {
    if (!open || selectedOrder) return;
    const keyword = orderKeyword.trim();
    if (!keyword) {
      setOrderResults([]);
      setOrderSearching(false);
      return;
    }
    setOrderSearching(true);
    const timer = window.setTimeout(() => {
      let active = true;
      apiRequest<{ data?: CollectOrder[] }>(`${API_PATHS.orders.root}/collect-search`, { query: { keyword } })
        .then((response) => { if (active) setOrderResults(Array.isArray(response.data) ? response.data : []); })
        .catch(() => { if (active) setOrderResults([]); })
        .finally(() => { if (active) setOrderSearching(false); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, orderKeyword, selectedOrder]);

  function pickOrder(order: CollectOrder) {
    if ([1, 3].includes(Number(order.payStatus))) {
      notify(`订单 ${order.orderCode} 已是付款状态，无需收款`, "info");
      return;
    }
    setSelectedOrder(order);
    setOrderCode(String(order.orderCode || ""));
    setOrderResults([]);
    const matched = order.store ? stores.find((item) => item.storeName === order.store) : null;
    if (matched) {
      setStoreId(matched.storeId);
      if (Number(matched.wxEnabled) !== 1 && Number(matched.alipayEnabled) === 1) setPayMethod("alipay");
      if (Number(matched.alipayEnabled) !== 1 && Number(matched.wxEnabled) === 1) setPayMethod("wx");
    }
  }

  async function create() {
    if (!storeId) return notify("请选择收款店铺", "info");
    if (!payMethod) return notify("请选择收款方式", "info");
    const trimmedOrder = orderCode.trim();
    if (!trimmedOrder && !(Number(amount) > 0)) return notify("关联订单或填写收款金额至少一项", "info");
    setCreating(true);
    try {
      const response = await apiRequest<{ data?: CollectResult }>(`${API_PATHS.billing.payments}/collect`, {
        method: "POST",
        body: {
          storeId,
          payMethod,
          orderCode: trimmedOrder || null,
          amount: trimmedOrder ? null : Number(amount),
          goodsName: goodsName.trim() || null,
        },
      });
      const data = response.data || {};
      if (data.paid) {
        notify("该订单已是付款状态", "success");
        onPaid?.();
        return;
      }
      if (!data.payQrcodeUrl && !data.payUrl) throw new Error("简付未返回收款码");
      setResult(data);
      setPayState("pending");
      notify("收款码已生成", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "收款码生成失败", "error");
    } finally {
      setCreating(false);
    }
  }

  const yuan = (result?.amountFen || 0) / 100;

  return (
    <Sheet open={open} title={result ? "收款二维码" : "当面收款"} onClose={onClose} wide>
      {loadingStores ? <div className="collect-qr-loading"><LoaderCircle className="spin" size={20} />正在加载收款店铺…</div> : result ? (
        <div className="collect-qr-body">
          <div className="collect-qr-amount">
            <small>{result.storeName || selectedStore?.storeName || "收款"}</small>
            <b>¥{yuan.toFixed(2)}</b>
            {result.orderCode && result.orderCode !== result.merchantOrderNo ? <span>订单 {result.orderCode}</span> : null}
          </div>
          {result.payQrcodeUrl ? <img className="collect-qr-image" src={result.payQrcodeUrl} alt="收款二维码" /> : null}
          <p className="collect-qr-tip">
            {payState === "success" ? <><CheckCircle2 size={14} />已收到付款，订单已自动确认</> : <><QrCode size={14} />让用户用{payMethod === "wx" ? "微信" : "支付宝"}扫码支付，到账后自动确认</>}
          </p>
          <div className="collect-qr-actions">
            {result.payUrl ? <a href={result.payUrl} target="_blank" rel="noreferrer">打开收银台页面</a> : null}
            <button type="button" onClick={() => { setResult(null); setPayState("idle"); }} disabled={creating}>
              <RefreshCw size={14} />重新生成
            </button>
          </div>
        </div>
      ) : (
        <div className="collect-qr-form">
          <label><span>收款店铺</span>
            <select value={storeId == null ? "" : String(storeId)} onChange={(event) => {
              const next = Number(event.target.value);
              setStoreId(next);
              const store = stores.find((item) => item.storeId === next);
              if (store && Number(store.wxEnabled) !== 1 && Number(store.alipayEnabled) === 1) setPayMethod("alipay");
              if (store && Number(store.alipayEnabled) !== 1 && Number(store.wxEnabled) === 1) setPayMethod("wx");
            }}>
              {stores.map((item) => <option key={item.storeId} value={item.storeId}>{item.storeName || item.storeCode}</option>)}
            </select>
          </label>
          <div className="collect-qr-methods" role="radiogroup" aria-label="收款方式">
            {methods.map((item) => (
              <button type="button" key={item.value} className={payMethod === item.value ? "active" : ""} role="radio" aria-checked={payMethod === item.value} onClick={() => setPayMethod(item.value)}>{item.label}</button>
            ))}
          </div>
          <div className="collect-order-search">
            <span className="collect-order-search-label">关联订单（可选，可搜订单号 / 下单人 / 收件人 / 手机号）</span>
            {selectedOrder ? (
              <div className="collect-order-chip">
                <div>
                  <b>{selectedOrder.orderCode}</b>
                  <small>
                    {[selectedOrder.purchaser, selectedOrder.customer, selectedOrder.phone, selectedOrder.store].filter(Boolean).join(" · ")}
                  </small>
                  <small>
                    {selectedOrder.orderNameDesc || "订单"}
                    {selectedOrder.orderNum ? ` × ${selectedOrder.orderNum}` : ""}
                    {selectedOrder.salePrice ? ` · ¥${Number(selectedOrder.salePrice).toFixed(2)}` : ""}
                  </small>
                </div>
                <button type="button" aria-label="取消关联" onClick={() => { setSelectedOrder(null); setOrderCode(""); }}><X size={14} /></button>
              </div>
            ) : (
              <div className="collect-order-search-box">
                <div className="collect-order-search-input">
                  <Search size={15} />
                  <input
                    value={orderKeyword}
                    onChange={(event) => setOrderKeyword(event.target.value)}
                    onFocus={() => setOrderFocus(true)}
                    onBlur={() => window.setTimeout(() => setOrderFocus(false), 150)}
                    placeholder="输入关键词搜索订单"
                    enterKeyHint="search"
                  />
                  {orderSearching ? <LoaderCircle className="spin" size={15} /> : null}
                </div>
                {orderFocus && orderKeyword.trim() ? (
                  <div className="collect-order-results" role="listbox" aria-label="订单搜索结果">
                    {!orderResults.length && !orderSearching ? <p className="collect-order-empty">没有匹配的订单</p> : null}
                    {orderResults.map((order) => (
                      <button type="button" role="option" key={String(order.id || order.orderCode)} className={[1, 3].includes(Number(order.payStatus)) ? "is-paid" : ""} onClick={() => pickOrder(order)}>
                        <b>{order.orderCode}</b>
                        <small>{[order.purchaser, order.customer, order.phone].filter(Boolean).join(" · ") || "无下单信息"}</small>
                        <small>
                          {order.orderNameDesc || "订单"}{order.orderNum ? ` × ${order.orderNum}` : ""}
                          {order.salePrice ? ` · ¥${Number(order.salePrice).toFixed(2)}` : ""}
                          {Number(order.payStatus) === 1 ? " · 已付款" : Number(order.payStatus) === 3 ? " · 待确认" : ""}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          {!orderCode.trim() ? (
            <>
              <label><span>收款金额（元）</span>
                <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
              </label>
              <label><span>商品说明（可选）</span>
                <input value={goodsName} onChange={(event) => setGoodsName(event.target.value)} placeholder="如：炎陵黄桃 10 斤" />
              </label>
            </>
          ) : null}
          <button type="button" className="primary-action collect-qr-submit" disabled={creating || !stores.length} onClick={() => void create()}>
            {creating ? <LoaderCircle className="spin" size={16} /> : <QrCode size={16} />}
            {creating ? "生成中" : "生成收款二维码"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
