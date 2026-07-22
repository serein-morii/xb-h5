"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Camera,
  CheckCircle2,
  ClipboardPaste,
  LoaderCircle,
  MapPin,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  ScanText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  User,
  UserPlus,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "./lib/api";

type Option = { value: string; label: string };
type StoreRow = { id?: number; code?: string; name?: string; text?: string; value?: string; isDelete?: number };
type Purchaser = { id: number; name?: string; phone?: string; shortId?: string; storeId?: number; storeCode?: string; storeName?: string };
type Row = Record<string, any>;
type OrderForm = {
  orderName: string;
  orderNameDesc: string;
  orderType: string;
  orderTypeDesc: string;
  orderNum: number;
  customer: string;
  phone: string;
  address: string;
  expCom: string;
  expCode: string;
  orderDesc: string;
};

const EMPTY_FORM: OrderForm = {
  orderName: "", orderNameDesc: "", orderType: "", orderTypeDesc: "", orderNum: 1,
  customer: "", phone: "", address: "", expCom: "", expCode: "", orderDesc: "",
};

export default function AdminOrderEntry({ username, notify }: { username: string; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const [purchasers, setPurchasers] = useState<Purchaser[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [sizes, setSizes] = useState<Option[]>([]);
  const [expressCompanies, setExpressCompanies] = useState<Option[]>([]);
  const [selectedPurchaser, setSelectedPurchaser] = useState<Purchaser | null>(null);
  const [buyerKeyword, setBuyerKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", storeCode: "" });
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Row | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<{ data?: Purchaser[] }>("/biz/purchaser/list"),
      apiRequest<{ data?: StoreRow[] }>("/search/store", { auth: false, query: { createBy: "", name: "" } }),
      apiRequest<{ data?: { products?: Option[]; sizes?: Option[] } }>("/search/order-options", { auth: false }),
      apiRequest<{ data?: Row[] }>("/biz/exp/getAllCom"),
    ]).then(([purchaserResult, storeResult, optionResult, expressResult]) => {
      if (!mounted) return;
      const storeRows = Array.isArray(storeResult.data) ? storeResult.data.filter((item) => Number(item.isDelete ?? 1) === 1) : [];
      const productRows = optionResult.data?.products || [];
      const sizeRows = optionResult.data?.sizes || [];
      const expressRows = Array.isArray(expressResult.data) ? expressResult.data.map((item) => ({ value: String(item.value || item.code || ""), label: String(item.text || item.label || item.name || item.value || "") })).filter((item) => item.value) : [];
      setPurchasers(Array.isArray(purchaserResult.data) ? purchaserResult.data : []);
      setStores(storeRows); setProducts(productRows); setSizes(sizeRows); setExpressCompanies(expressRows);
      setCreateForm((current) => ({ ...current, storeCode: current.storeCode || String(storeRows[0]?.code || "") }));
      setForm((current) => ({ ...current, orderName: current.orderName || productRows[0]?.value || "", orderType: current.orderType || sizeRows[0]?.value || "" }));
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "录单基础数据加载失败"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const visiblePurchasers = useMemo(() => {
    const keyword = buyerKeyword.trim().toLowerCase();
    const rows = keyword ? purchasers.filter((item) => [item.name, item.phone, item.shortId, item.storeName].some((value) => String(value || "").toLowerCase().includes(keyword))) : purchasers;
    return rows.slice(0, 8);
  }, [buyerKeyword, purchasers]);
  const selectedProduct = products.find((item) => item.value === form.orderName);
  const selectedSize = sizes.find((item) => item.value === form.orderType);

  function setField<K extends keyof OrderForm>(key: K, value: OrderForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

  function choosePurchaser(item: Purchaser) {
    if (!item.storeId || !item.storeName) return setError("该买家尚未绑定店铺，请先到买家管理中绑定");
    setSelectedPurchaser(item); setBuyerKeyword(""); setCreateOpen(false); setError(""); setCreatedOrder(null);
  }

  async function createPurchaser() {
    if (!createForm.name.trim() || !/^1\d{10}$/.test(createForm.phone) || !createForm.storeCode) return setError("请填写买家姓名、11位手机号并选择绑定店铺");
    setCreating(true); setError("");
    try {
      const result = await apiRequest<{ data?: Purchaser }>("/biz/purchaser", { method: "POST", body: { name: createForm.name.trim(), phone: createForm.phone, storeCode: createForm.storeCode } });
      if (!result.data) throw new Error("创建买家后未返回档案信息");
      setPurchasers((current) => [result.data!, ...current.filter((item) => item.id !== result.data!.id)]);
      choosePurchaser(result.data); setCreateForm({ name: "", phone: "", storeCode: String(stores[0]?.code || "") });
      notify("买家已创建并选中", "success");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建买家失败"); }
    finally { setCreating(false); }
  }

  async function parseAddress(text = pasteText) {
    if (!text.trim()) return setError("请先粘贴收件人、手机号和地址");
    setParsing(true); setError("");
    try {
      const result = await apiRequest<{ data?: Row[] }>("/search/addr", { auth: false, query: { addr: text.trim() } });
      const parsed = Array.isArray(result.data) ? result.data[0] : null;
      if (!parsed) throw new Error("没有识别到有效地址，请手动填写");
      const address = String(parsed.allAddress || [parsed.province, parsed.city, parsed.area, parsed.detail, parsed.address].filter(Boolean).join(""));
      setPasteText(text); setForm((current) => ({ ...current, customer: String(parsed.name || current.customer), phone: String(parsed.mobile || parsed.phone || current.phone), address: address || current.address }));
      notify("收货信息识别成功", "success");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "地址识别失败"); }
    finally { setParsing(false); }
  }

  async function pasteAndParse() {
    try { const text = await navigator.clipboard.readText(); if (!text.trim()) throw new Error("剪贴板为空"); await parseAddress(text); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取剪贴板，请手动粘贴"); }
  }

  async function detectExpress(expCode = form.expCode) {
    if (!expCode.trim()) return setError("请先输入快递单号");
    try {
      const result = await apiRequest<{ data?: Row }>("/biz/exp/getCom", { query: { expCode: expCode.trim() } });
      const code = String(result.data?.expCom || "");
      if (code) setField("expCom", code);
      notify(code ? `已识别为${result.data?.expComDesc || code}` : "暂未识别快递公司，请手动选择", code ? "success" : "info");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "快递公司识别失败"); }
  }

  async function scanBarcode(file?: File) {
    if (!file) return;
    setScanning(true); setError("");
    try {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) throw new Error("当前浏览器不支持图片扫码，请手动输入快递单号");
      const bitmap = await createImageBitmap(file);
      const results = await new Detector({ formats: ["code_128", "code_39", "ean_13", "qr_code"] }).detect(bitmap);
      bitmap.close();
      const value = String(results[0]?.rawValue || "");
      if (!value) throw new Error("图片中没有识别到条码");
      setField("expCode", value); await detectExpress(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "扫码失败"); }
    finally { setScanning(false); if (scanInput.current) scanInput.current.value = ""; }
  }

  function resetOrder(keepPurchaser = true) {
    setForm({ ...EMPTY_FORM, orderName: products[0]?.value || "", orderType: sizes[0]?.value || "" });
    setPasteText(""); setCreatedOrder(null); setError("");
    if (!keepPurchaser) setSelectedPurchaser(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setCreatedOrder(null);
    if (!selectedPurchaser?.shortId || !selectedPurchaser.storeName) return setError("请先选择已绑定店铺的买家");
    if (!form.orderName || !form.orderType || !form.customer.trim() || !/^1\d{10}$/.test(form.phone.trim()) || !form.address.trim()) return setError("请完整填写商品、规格、收件人、11位手机号和收货地址");
    if (form.orderName === "other" && !form.orderNameDesc.trim()) return setError("请输入自定义商品名称");
    if (form.orderType === "other" && !form.orderTypeDesc.trim()) return setError("请输入自定义商品规格");
    setSubmitting(true);
    try {
      const body = {
        ...form,
        orderNameDesc: form.orderName === "other" ? form.orderNameDesc.trim() : selectedProduct?.label,
        orderTypeDesc: form.orderType === "other" ? form.orderTypeDesc.trim() : selectedSize?.label,
        orderNum: Number(form.orderNum || 1), purchaser: selectedPurchaser.name || username,
        purchaserShortId: selectedPurchaser.shortId, store: selectedPurchaser.storeName,
        expComDesc: expressCompanies.find((item) => item.value === form.expCom)?.label || "",
        orderStatus: "DSH",
      };
      await apiRequest("/biz/order", { method: "POST", body });
      let latest: Row = { purchaser: selectedPurchaser.name, store: selectedPurchaser.storeName };
      try {
        const result = await apiRequest<{ data?: Row[] }>("/search/purchaser/orders", { auth: false, query: { id: selectedPurchaser.shortId } });
        latest = Array.isArray(result.data) && result.data[0] ? result.data[0] : latest;
      } catch { /* 订单已创建，查询回显失败不影响结果 */ }
      setCreatedOrder(latest); notify("订单录入成功", "success");
      setForm((current) => ({ ...EMPTY_FORM, orderName: current.orderName, orderType: current.orderType })); setPasteText("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "订单录入失败"); }
    finally { setSubmitting(false); }
  }

  return <div className="admin-tool-module admin-order-entry-page">
    <section className="tool-hero"><span><ShoppingBag size={25} /></span><div><small>QUICK ORDER ENTRY</small><h1>订单录入</h1><p>选择或新建买家，粘贴识别收货信息后快速建单。</p></div></section>
    {loading ? <div className="admin-entry-loading"><LoaderCircle className="spin" size={24} />正在加载买家与订单选项</div> : <>
      {createdOrder ? <section className="order-success-card admin-entry-success"><CheckCircle2 size={27} /><div><small>ORDER CREATED</small><h2>订单录入成功</h2><p>{createdOrder.orderCode ? `订单号：${createdOrder.orderCode}` : `${selectedPurchaser?.name || "买家"}的订单已创建`}</p></div><button type="button" onClick={() => resetOrder(true)}>继续录入</button></section> : null}
      <form className="purchaser-order-form admin-order-entry-form" onSubmit={submit}>
        <section className="admin-entry-buyer-section"><header><span>1</span><div><h2>选择买家</h2><p>订单将关联买家短 ID 和绑定店铺</p></div></header>{selectedPurchaser ? <div className="admin-entry-selected-buyer"><span>{String(selectedPurchaser.name || "买").slice(0, 1)}</span><div><b>{selectedPurchaser.name}</b><p>{selectedPurchaser.phone} · ID {selectedPurchaser.shortId}</p><small><Store size={12} />{selectedPurchaser.storeName}</small></div><button type="button" onClick={() => setSelectedPurchaser(null)}>更换</button><button type="button" onClick={() => setForm((current) => ({ ...current, customer: selectedPurchaser.name || "", phone: selectedPurchaser.phone || "" }))}>设为收件人</button></div> : <><div className="admin-entry-buyer-search"><Search size={16} /><input value={buyerKeyword} onChange={(event) => setBuyerKeyword(event.target.value)} placeholder="搜索姓名、手机号、短 ID 或店铺" /><button type="button" onClick={() => setCreateOpen((value) => !value)}><UserPlus size={15} />新建</button></div><div className="admin-entry-buyer-list">{visiblePurchasers.map((item) => <button className={!item.storeId ? "unbound" : ""} type="button" key={item.id} onClick={() => choosePurchaser(item)}><span>{String(item.name || "买").slice(0, 1)}</span><div><b>{item.name || "未命名"}</b><small>{item.phone || "--"} · {item.shortId || "无短ID"}</small><em>{item.storeName || "未绑定店铺"}</em></div></button>)}</div>{!visiblePurchasers.length ? <p className="admin-entry-empty">没有匹配的买家，可以直接新建。</p> : null}</>}
          {createOpen && !selectedPurchaser ? <div className="admin-entry-create"><div><label><span>买家姓名</span><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></label><label><span>手机号</span><input inputMode="tel" maxLength={11} value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} /></label><label><span>绑定店铺</span><select value={createForm.storeCode} onChange={(event) => setCreateForm((current) => ({ ...current, storeCode: event.target.value }))}>{stores.map((store) => <option key={store.code} value={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select></label></div><button type="button" disabled={creating} onClick={createPurchaser}>{creating ? <LoaderCircle className="spin" size={16} /> : <UserPlus size={16} />}创建并选中</button></div> : null}
        </section>
        <section><header><span>2</span><div><h2>选择商品</h2><p>商品和规格来自后台实时字典</p></div></header><div className="purchaser-choice-grid">{products.map((item) => <button type="button" className={form.orderName === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderName", item.value)}>{item.label}</button>)}</div>{form.orderName === "other" ? <input value={form.orderNameDesc} onChange={(event) => setField("orderNameDesc", event.target.value)} placeholder="请输入商品名称" /> : null}<div className="purchaser-choice-grid compact">{sizes.map((item) => <button type="button" className={form.orderType === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderType", item.value)}>{item.label}</button>)}</div>{form.orderType === "other" ? <input value={form.orderTypeDesc} onChange={(event) => setField("orderTypeDesc", event.target.value)} placeholder="请输入规格" /> : null}<div className="purchaser-quantity"><span>商品数量</span><div><button type="button" onClick={() => setField("orderNum", Math.max(1, form.orderNum - 1))}><Minus size={16} /></button><b>{form.orderNum}</b><button type="button" onClick={() => setField("orderNum", Math.min(99, form.orderNum + 1))}><Plus size={16} /></button></div></div></section>
        <section><header><span>3</span><div><h2>收货信息</h2><p>保留原应用的粘贴与剪贴板识别</p></div></header><div className="purchaser-paste admin-entry-paste"><textarea rows={3} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="张三 13800138000 上海市青浦区……" /><div><button type="button" disabled={parsing} onClick={() => parseAddress()}>{parsing ? <LoaderCircle className="spin" size={15} /> : <ScanText size={15} />}识别</button><button type="button" disabled={parsing} onClick={pasteAndParse}><ClipboardPaste size={15} />粘贴并识别</button></div></div><label><span><User size={15} />收件人</span><input value={form.customer} onChange={(event) => setField("customer", event.target.value)} /></label><label><span><Phone size={15} />手机号</span><input inputMode="tel" maxLength={11} value={form.phone} onChange={(event) => setField("phone", event.target.value.replace(/\D/g, ""))} /></label><label><span><MapPin size={15} />详细地址</span><textarea rows={3} value={form.address} onChange={(event) => setField("address", event.target.value)} /></label></section>
        <section><header><span>4</span><div><h2>快递与备注</h2><p>快递信息选填，支持拍照识别条码</p></div></header><label><span><Truck size={15} />快递公司</span><select value={form.expCom} onChange={(event) => setField("expCom", event.target.value)}><option value="">暂不选择</option>{expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span><PackageCheck size={15} />快递单号</span><div className="admin-entry-express-code"><input value={form.expCode} onChange={(event) => setField("expCode", event.target.value)} placeholder="可稍后在订单管理中补充" /><button type="button" onClick={() => detectExpress()}><ScanText size={15} />识别快递</button><button type="button" disabled={scanning} onClick={() => scanInput.current?.click()}>{scanning ? <LoaderCircle className="spin" size={15} /> : <Camera size={15} />}扫码</button><input ref={scanInput} hidden type="file" accept="image/*" capture="environment" onChange={(event) => scanBarcode(event.target.files?.[0])} /></div></label><label><span>订单备注</span><textarea rows={3} value={form.orderDesc} onChange={(event) => setField("orderDesc", event.target.value)} placeholder="选填" /></label></section>
        {error ? <p className="tool-error admin-entry-error">{error}</p> : null}<button className="purchaser-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={19} /> : <PackageCheck size={19} />}{submitting ? "正在录入订单" : "确认信息并录入订单"}</button><p className="purchaser-submit-tip"><ShieldCheck size={13} />登录态直接提交，无需图形验证码；原有“新增订单”入口保持不变</p>
      </form>
    </>}
  </div>;
}
