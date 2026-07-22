"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import { CheckCircle2, History, LoaderCircle, MapPin, Minus, PackageCheck, Plus, RefreshCw, ScanText, ShieldCheck, ShoppingBag, Store, Truck, User, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import OrderList, { PublicOrderRecord } from "../OrderList";

type Row = Record<string, unknown>;
type Option = { value: string; label: string };
type LinkContext = { purchaserShortId?: string; purchaserName?: string; purchaserPhone?: string; storeCode?: string; storeName?: string; storeNotice?: string };
type OrderForm = { orderName: string; orderNameDesc: string; orderType: string; orderTypeDesc: string; orderNum: number; customer: string; phone: string; address: string; orderDesc: string };
const EMPTY_FORM: OrderForm = { orderName: "", orderNameDesc: "", orderType: "", orderTypeDesc: "", orderNum: 1, customer: "", phone: "", address: "", orderDesc: "" };

function parseHash() {
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
  return { purchaserId: raw };
}

export default function PurchaserOrderPage() {
  const [linkContext, setLinkContext] = useState<LinkContext | null>(null);
  const [linkKey, setLinkKey] = useState({ purchaserId: "" });
  const [products, setProducts] = useState<Option[]>([]);
  const [sizes, setSizes] = useState<Option[]>([]);
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [tab, setTab] = useState<"create" | "orders">("create");
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Row | null>(null);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [uuid, setUuid] = useState("");
  const [code, setCode] = useState("");

  const loadOrders = useCallback(async (purchaserId: string) => {
    const result = await apiRequest<{ data?: PublicOrderRecord[] }>("/search/purchaser/orders", { auth: false, query: { id: purchaserId } });
    setOrders(Array.isArray(result.data) ? result.data : []);
  }, []);

  const initialize = useCallback(async () => {
    const parsed = parseHash(); setLinkKey(parsed); setError(""); setLoading(true); setLinkContext(null);
    if (!parsed.purchaserId || !/^[2-9a-hj-km-np-z]{6}$/.test(parsed.purchaserId)) {
      setError("下单链接无效，请向店铺重新索取专属链接"); setLoading(false); return;
    }
    try {
      const [contextResult, optionsResult] = await Promise.all([
        apiRequest<{ data?: LinkContext }>("/search/order-link", { auth: false, query: parsed }),
        apiRequest<{ data?: { products?: Option[]; sizes?: Option[] } }>("/search/order-options", { auth: false }),
      ]);
      if (!contextResult.data) throw new Error("链接信息不存在");
      setLinkContext(contextResult.data);
      const productRows = optionsResult.data?.products || []; const sizeRows = optionsResult.data?.sizes || [];
      setProducts(productRows); setSizes(sizeRows);
      setForm((current) => ({ ...current, orderName: productRows[0]?.value || "", orderType: sizeRows[0]?.value || "" }));
      await loadOrders(parsed.purchaserId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下单链接无效"); }
    finally { setLoading(false); }
  }, [loadOrders]);

  useEffect(() => { initialize(); window.addEventListener("hashchange", initialize); return () => window.removeEventListener("hashchange", initialize); }, [initialize]);

  const selectedProduct = useMemo(() => products.find((item) => item.value === form.orderName), [products, form.orderName]);
  const selectedSize = useMemo(() => sizes.find((item) => item.value === form.orderType), [sizes, form.orderType]);

  function setField<K extends keyof OrderForm>(key: K, value: OrderForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

  async function parseAddress() {
    if (!pasteText.trim()) return setError("请先粘贴收件人、手机号和地址");
    setParsing(true); setError("");
    try {
      const result = await apiRequest<{ data?: Row[] }>("/search/addr", { auth: false, query: { addr: pasteText.trim() } });
      const parsed = Array.isArray(result.data) ? result.data[0] : null;
      if (!parsed) throw new Error("没有识别到有效地址，请手动填写");
      const fullAddress = String(parsed.allAddress || [parsed.province, parsed.city, parsed.area, parsed.detail, parsed.address].filter(Boolean).join(""));
      setForm((current) => ({ ...current, customer: String(parsed.name || current.customer), phone: String(parsed.mobile || parsed.phone || current.phone), address: fullAddress || current.address }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "地址识别失败"); }
    finally { setParsing(false); }
  }

  async function loadCaptcha() {
    setError("");
    try {
      const result = await apiRequest<Row>("/captchaImage", { auth: false });
      setUuid(String(result.uuid || "")); setCaptcha(result.img ? `data:image/png;base64,${result.img}` : ""); setCode(""); setCaptchaOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "验证码加载失败"); }
  }

  function requestSubmit(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess(null);
    if (!form.orderName || !form.orderType || !form.customer.trim() || !/^1\d{10}$/.test(form.phone.trim()) || !form.address.trim()) return setError("请完整填写商品、规格、收件人、11位手机号和收货地址");
    if (form.orderName === "other" && !form.orderNameDesc.trim()) return setError("请输入自定义商品名称");
    if (form.orderType === "other" && !form.orderTypeDesc.trim()) return setError("请输入自定义商品规格");
    loadCaptcha();
  }

  async function submitOrder() {
    if (!code.trim()) return setError("请输入验证码");
    setSubmitting(true); setError("");
    try {
      const body = { ...form, orderNameDesc: form.orderName === "other" ? form.orderNameDesc.trim() : selectedProduct?.label, orderTypeDesc: form.orderType === "other" ? form.orderTypeDesc.trim() : selectedSize?.label, purchaserShortId: linkKey.purchaserId, code: code.trim(), uuid };
      const result = await apiRequest<{ data?: Row }>("/search/order", { auth: false, method: "POST", body });
      setSuccess(result.data || {}); setCaptchaOpen(false); setForm((current) => ({ ...EMPTY_FORM, orderName: current.orderName, orderType: current.orderType })); setPasteText("");
      await loadOrders(linkKey.purchaserId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下单失败，请重试"); await loadCaptcha(); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="tool-page purchaser-order-page"><div className="purchaser-link-loading"><LoaderCircle className="spin" size={28} /><b>正在验证专属下单链接</b><small>同时加载店铺、商品和历史订单</small></div></div>;
  if (!linkContext) return <div className="tool-page purchaser-order-page"><section className="invalid-link-card"><X size={28} /><h1>链接无效</h1><p>{error || "无法识别该下单链接"}</p><small>专属链接只包含6位下单人短ID，修改短码、解绑店铺或关闭店铺后将无法下单。</small></section></div>;

  return <div className="tool-page purchaser-order-page">
    <section className="purchaser-order-hero"><div><small>XB EXPRESS ORDER</small><h1>你好，{linkContext.purchaserName}</h1><p><Store size={14} />{linkContext.storeName}<span>·</span>专属下单人 ID {linkContext.purchaserShortId}</p></div><span><ShoppingBag size={26} /></span></section>
    {linkContext.storeNotice ? <div className="purchaser-store-notice"><ShieldCheck size={16} /><p>{linkContext.storeNotice}</p></div> : null}
    <nav className="purchaser-order-tabs"><button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><ShoppingBag size={17} />我要下单</button><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><History size={17} />我的订单<span>{orders.length}</span></button></nav>

    {tab === "create" ? <>
      {success ? <section className="order-success-card"><CheckCircle2 size={27} /><div><small>ORDER CREATED</small><h2>订单提交成功</h2><p>订单号：{String(success.orderCode || "已生成")}</p></div><button type="button" onClick={() => setTab("orders")}>查看订单</button></section> : null}
      <form className="purchaser-order-form" onSubmit={requestSubmit}>
        <section><header><span>1</span><div><h2>选择商品</h2><p>商品与规格来自后台实时字典</p></div></header><div className="purchaser-choice-grid">{products.map((item) => <button type="button" className={form.orderName === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderName", item.value)}>{item.label}</button>)}</div>{form.orderName === "other" ? <input value={form.orderNameDesc} onChange={(event) => setField("orderNameDesc", event.target.value)} placeholder="请输入商品名称" /> : null}<div className="purchaser-choice-grid compact">{sizes.map((item) => <button type="button" className={form.orderType === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderType", item.value)}>{item.label}</button>)}</div>{form.orderType === "other" ? <input value={form.orderTypeDesc} onChange={(event) => setField("orderTypeDesc", event.target.value)} placeholder="请输入规格" /> : null}<div className="purchaser-quantity"><span>购买数量</span><div><button type="button" onClick={() => setField("orderNum", Math.max(1, form.orderNum - 1))}><Minus size={16} /></button><b>{form.orderNum}</b><button type="button" onClick={() => setField("orderNum", Math.min(99, form.orderNum + 1))}><Plus size={16} /></button></div></div></section>
        <section><header><span>2</span><div><h2>收货信息</h2><p>可粘贴整段信息后智能识别</p></div></header><div className="purchaser-paste"><textarea rows={3} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="例如：张三 13800138000 上海市青浦区……" /><button type="button" disabled={parsing} onClick={parseAddress}>{parsing ? <LoaderCircle className="spin" size={16} /> : <ScanText size={16} />}智能识别</button></div><label><span><User size={15} />收件人</span><input value={form.customer} onChange={(event) => setField("customer", event.target.value)} placeholder="请输入收件人姓名" /></label><label><span><Truck size={15} />手机号</span><input inputMode="tel" maxLength={11} value={form.phone} onChange={(event) => setField("phone", event.target.value.replace(/\D/g, ""))} placeholder="请输入11位手机号" /></label><label><span><MapPin size={15} />详细地址</span><textarea rows={3} value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="省市区 + 街道门牌号" /></label></section>
        <section><header><span>3</span><div><h2>订单备注</h2><p>选填，告诉店铺需要特别注意的内容</p></div></header><textarea rows={3} value={form.orderDesc} onChange={(event) => setField("orderDesc", event.target.value)} placeholder="如：送货前电话联系" /></section>
        {error && !captchaOpen ? <p className="tool-error purchaser-order-error">{error}</p> : null}<button className="purchaser-submit" type="submit"><PackageCheck size={19} />确认商品并提交订单</button><p className="purchaser-submit-tip"><ShieldCheck size={13} />点击提交后才会弹出验证码，验证成功即创建订单</p>
      </form>
    </> : <section className="purchaser-history-section">{orders.length ? <OrderList orders={orders} contact={linkContext.purchaserPhone} /> : <div className="purchaser-no-orders"><History size={27} /><h2>还没有关联订单</h2><p>使用当前专属链接下单后，订单会自动显示在这里。</p></div>}</section>}

    {captchaOpen ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCaptchaOpen(false)}><section className="purchaser-captcha-modal"><button className="purchaser-captcha-close" type="button" onClick={() => setCaptchaOpen(false)}><X size={19} /></button><small>FINAL VERIFICATION</small><h2>完成验证后提交</h2><p>验证码仅在提交订单时加载，点击图片可刷新。</p><div className="purchaser-captcha-row"><button className="purchaser-captcha-image" type="button" onClick={loadCaptcha}>{captcha ? <img src={captcha} alt="验证码" /> : <RefreshCw size={20} />}</button><input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入图中验证码" /></div>{error ? <p className="tool-error">{error}</p> : null}<button className="purchaser-captcha-submit" type="button" disabled={submitting} onClick={submitOrder}>{submitting ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{submitting ? "正在创建订单" : "验证并提交订单"}</button></section></div> : null}
  </div>;
}
