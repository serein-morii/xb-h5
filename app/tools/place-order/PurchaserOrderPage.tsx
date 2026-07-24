
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, CircleHelp, History, LoaderCircle, MapPin, Minus, PackageCheck, Plus, RefreshCw, ScanText, ShieldCheck, ShoppingBag, Store, Truck, User, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import OrderList, { PublicOrderRecord } from "../OrderList";

type Row = Record<string, unknown>;
type Option = { value: string; label: string };
type LinkContext = { purchaserShortId?: string; purchaserName?: string; purchaserPhone?: string; storeCode?: string; storeName?: string; storeNotice?: string; requirePwd?: number };
type OrderForm = { orderName: string; orderNameDesc: string; orderType: string; orderTypeDesc: string; orderNum: number; customer: string; phone: string; address: string; orderDesc: string };
const EMPTY_FORM: OrderForm = { orderName: "", orderNameDesc: "", orderType: "", orderTypeDesc: "", orderNum: 1, customer: "", phone: "", address: "", orderDesc: "" };

// 商品 emoji 映射（按 label 匹配，未匹配的用 📦 兜底；后续可在后端字典加 emoji 字段）
const PRODUCT_EMOJI: Record<string, string> = {
  "苹果": "🍎", "青苹果": "🍏", "红富士": "🍎", "阿克苏": "🍎",
  "梨": "🍐", "雪梨": "🍐", "鸭梨": "🍐", "皇冠梨": "🍐", "香梨": "🍐",
  "橘子": "🍊", "蜜橘": "🍊", "砂糖橘": "🍊", "沃柑": "🍊", "丑橘": "🍊", "柑": "🍊",
  "橙子": "🍊", "脐橙": "🍊", "血橙": "🍊",
  "葡萄": "🍇", "巨峰": "🍇", "提子": "🍇", "阳光玫瑰": "🍇", "红提": "🍇",
  "草莓": "🍓", "奶油草莓": "🍓", "丹东草莓": "🍓",
  "樱桃": "🍒", "车厘子": "🍒", "大樱桃": "🍒",
  "桃": "🍑", "水蜜桃": "🍑", "黄桃": "🍑", "油桃": "🍑", "毛桃": "🍑",
  "芒果": "🥭", "台农": "🥭", "凯特芒": "🥭", "贵妃芒": "🥭",
  "香蕉": "🍌", "小米蕉": "🍌",
  "西瓜": "🍉", "麒麟瓜": "🍉", "甜王": "🍉",
  "哈密瓜": "🍈", "香瓜": "🍈", "甜瓜": "🍈", "白兰瓜": "🍈",
  "柠檬": "🍋", "青柠": "🍋",
  "蓝莓": "🫐", "黑莓": "🫐", "树莓": "🫐",
  "石榴": "🫐", "枣": "🫐", "李子": "🫐", "青李子": "🍏", "青李": "🍏",
  "猕猴桃": "🥝", "奇异果": "🥝", "kiwi": "🥝",
  "火龙果": "🐉", "红心火龙果": "🐉", "白心火龙果": "🐉",
  "山竹": "🟣", "榴莲": "🟡", "椰子": "🥥", "菠萝": "🍍", "木瓜": "🥭",
  "炎陵黄桃": "🍑", "炎陵奈李": "🍈", "青奈李": "🍏", "奈李": "🫐",
};
const emojiFor = (label: string) => PRODUCT_EMOJI[label] || "📦";

function parseShortId() {
  const match = window.location.pathname.match(/^\/tools\/order\/([2-9a-hj-km-np-z]{6})$/);
  return { purchaserId: match ? match[1] : "" };
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
  const [errorFieldId, setErrorFieldId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [success, setSuccess] = useState<Row | null>(null);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [uuid, setUuid] = useState("");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");

  const loadOrders = useCallback(async (purchaserId: string) => {
    const result = await apiRequest<{ data?: PublicOrderRecord[] }>("/search/purchaser/orders", { auth: false, query: { id: purchaserId } });
    setOrders(Array.isArray(result.data) ? result.data : []);
  }, []);

  const initialize = useCallback(async () => {
    const parsed = parseShortId(); setLinkKey(parsed); setError(""); setLoading(true); setLinkContext(null);
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
      // 默认不选中任何商品/规格，由用户主动选择
      await loadOrders(parsed.purchaserId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下单链接无效"); }
    finally { setLoading(false); }
  }, [loadOrders]);

  useEffect(() => { initialize(); }, [initialize]);

  const selectedProduct = useMemo(() => products.find((item) => item.value === form.orderName), [products, form.orderName]);
  const selectedSize = useMemo(() => sizes.find((item) => item.value === form.orderType), [sizes, form.orderType]);

  // 顶部看板：用已加载的历史订单算统计
  const stats = useMemo(() => {
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
  }, [orders]);

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

  const FIELD_TO_INPUT: Record<string, string> = {
    "自定义商品名称": "purchaser-custom-name",
    "自定义规格": "purchaser-custom-spec",
    "收件人": "purchaser-customer",
    "11位手机号": "purchaser-phone",
    "收货地址": "purchaser-address",
  };
  const FIELD_TO_SECTION: Record<string, string> = {
    "商品": "purchaser-section-product",
    "规格": "purchaser-section-product",
    "自定义商品名称": "purchaser-section-product",
    "自定义规格": "purchaser-section-product",
    "收件人": "purchaser-section-address",
    "11位手机号": "purchaser-section-address",
    "收货地址": "purchaser-section-address",
  };

  function scrollToFirstMissing(missing: string[]) {
    // 输入框类优先：精确定位 + 高亮 + 自动 focus
    for (const field of missing) {
      const id = FIELD_TO_INPUT[field];
      if (id) {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setErrorFieldId(id);
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            window.setTimeout(() => {
              el.focus({ preventScroll: true });
              const clear = () => setErrorFieldId(null);
              el.addEventListener("input", clear, { once: true });
              el.addEventListener("focus", clear, { once: true });
            }, 320);
          }
          return;
        }
      }
    }
    // 按钮类（商品/规格）：scroll 到 section 顶部 + 高亮 section
    for (const field of missing) {
      const id = FIELD_TO_SECTION[field];
      if (id) {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          setErrorFieldId(id);
          window.setTimeout(() => setErrorFieldId(null), 1800);
          return;
        }
      }
    }
  }

  function jumpToField(field: string) {
    setMissingFields([]);
    const id = FIELD_TO_INPUT[field] || FIELD_TO_SECTION[field];
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: FIELD_TO_INPUT[field] ? "center" : "start" });
    setErrorFieldId(id);
    window.setTimeout(() => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus({ preventScroll: true });
        const clear = () => setErrorFieldId(null);
        el.addEventListener("input", clear, { once: true });
        el.addEventListener("focus", clear, { once: true });
      } else {
        window.setTimeout(() => setErrorFieldId(null), 1800);
      }
    }, 320);
  }

  function requestSubmit(event: FormEvent) {
    event.preventDefault(); setError(""); setErrorFieldId(null); setSuccess(null);
    const missing: string[] = [];
    if (!form.orderName) missing.push("商品");
    if (!form.orderType) missing.push("规格");
    if (form.orderName === "other" && !form.orderNameDesc.trim()) missing.push("自定义商品名称");
    if (form.orderType === "other" && !form.orderTypeDesc.trim()) missing.push("自定义规格");
    if (!form.customer.trim()) missing.push("收件人");
    if (!/^1\d{10}$/.test(form.phone.trim())) missing.push("11位手机号");
    if (!form.address.trim()) missing.push("收货地址");
    if (missing.length > 0) {
      setMissingFields(missing);  // 弹窗显示更醒目
      return;
    }
    // 按店铺/买家开关决定走密码还是验证码
    if (Number(linkContext?.requirePwd) === 1) {
      setCode(""); setUuid(""); setPwd(""); setCaptcha(""); setError("");
      setCaptchaOpen(true);
    } else {
      loadCaptcha();
    }
  }

  async function submitOrder() {
    const requirePwd = Number(linkContext?.requirePwd) === 1;
    if (requirePwd) {
      if (!/^\d{4,6}$/.test(pwd.trim())) return setError("请输入 4-6 位下单码");
    } else {
      if (!code.trim()) return setError("请输入验证码");
    }
    setSubmitting(true); setError("");
    try {
      const body = { ...form, orderNameDesc: form.orderName === "other" ? form.orderNameDesc.trim() : selectedProduct?.label, orderTypeDesc: form.orderType === "other" ? form.orderTypeDesc.trim() : selectedSize?.label, purchaserShortId: linkKey.purchaserId, code: code.trim(), uuid, pwd: requirePwd ? pwd.trim() : undefined };
      const result = await apiRequest<{ data?: Row }>("/search/order", { auth: false, method: "POST", body });
      setSuccess(result.data || {}); setCaptchaOpen(false); setForm((current) => ({ ...EMPTY_FORM, orderName: current.orderName, orderType: current.orderType })); setPasteText(""); setPwd("");
      await loadOrders(linkKey.purchaserId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "下单失败，请重试");
      if (!requirePwd) await loadCaptcha();  // 验证码失败刷新，密码失败不刷新
    }
    finally { setSubmitting(false); }
  }

  function continueOrdering() {
    setSuccess(null);
    setError("");
    setPasteText("");
    setCode("");
    setPwd("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function viewOrders() {
    setSuccess(null);
    setTab("orders");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <div className="tool-page purchaser-order-page"><div className="purchaser-link-loading"><LoaderCircle className="spin" size={28} /><b>正在验证专属下单链接</b><small>同时加载店铺、商品和历史订单</small></div></div>;
  if (!linkContext) return <div className="tool-page purchaser-order-page"><section className="invalid-link-card"><X size={28} /><h1>链接无效</h1><p>{error || "无法识别该下单链接"}</p><small>专属链接只包含6位下单人短ID，修改短码、解绑店铺或关闭店铺后将无法下单。</small></section></div>;

  return <div className="tool-page purchaser-order-page">
    <section className="purchaser-order-hero"><div><small>XB EXPRESS ORDER</small><h1>你好，{linkContext.purchaserName}</h1><p><Store size={14} />{linkContext.storeName}<span>·</span>专属下单人 ID {linkContext.purchaserShortId}</p>{stats.pending + stats.shipped > 0 ? <p className="purchaser-order-hero-sub">📦 您有 <b>{stats.pending + stats.shipped}</b> 笔订单正在路上</p> : null}</div><span><ShoppingBag size={26} /></span></section>
    {linkContext.storeNotice ? <div className="purchaser-store-notice"><ShieldCheck size={16} /><p>{linkContext.storeNotice}</p></div> : null}
    <section className="purchaser-stats" aria-label="订单概览">
      <div className="purchaser-stat"><b>{stats.total}</b><small>全部订单</small></div>
      <div className="purchaser-stat"><b>{stats.pending}</b><small>待发货</small></div>
      <div className="purchaser-stat"><b>{stats.shipped}</b><small>运输中</small></div>
      <div className="purchaser-stat"><b>{stats.done}</b><small>已完成</small></div>
      <div className="purchaser-stat"><b>{stats.monthCount}</b><small>本月</small></div>
    </section>
    <nav className="purchaser-order-tabs"><button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><ShoppingBag size={17} />我要下单</button><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><History size={17} />我的订单<span>{orders.length}</span></button></nav>

    {tab === "create" ? <>
      {success ? null : null}
      <form className="purchaser-order-form" onSubmit={requestSubmit}>
        <section id="purchaser-section-product"><header><span>1</span><div><h2>选择商品</h2><p>商品与规格来自后台实时字典（默认未选，请主动选择）</p></div></header><div className="purchaser-choice-grid">{products.map((item) => <button type="button" className={form.orderName === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderName", item.value)}><span className="purchaser-choice-emoji">{emojiFor(item.label)}</span>{item.label}</button>)}</div>{form.orderName === "other" ? <input id="purchaser-custom-name" value={form.orderNameDesc} onChange={(event) => setField("orderNameDesc", event.target.value)} placeholder="请输入商品名称" /> : null}<div className="purchaser-choice-grid compact">{sizes.map((item) => <button type="button" className={form.orderType === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderType", item.value)}>{item.label}</button>)}</div>{form.orderType === "other" ? <input id="purchaser-custom-spec" value={form.orderTypeDesc} onChange={(event) => setField("orderTypeDesc", event.target.value)} placeholder="请输入规格" /> : null}<div className="purchaser-quantity"><span>购买数量</span><div><button type="button" onClick={() => setField("orderNum", Math.max(1, form.orderNum - 1))}><Minus size={16} /></button><b>{form.orderNum}</b><button type="button" onClick={() => setField("orderNum", Math.min(99, form.orderNum + 1))}><Plus size={16} /></button></div></div></section>
        <section id="purchaser-section-address"><header><span>2</span><div><h2>收货信息</h2><p>可粘贴整段信息后智能识别</p></div></header><div className="purchaser-paste"><textarea rows={3} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="例如：张三 13800138000 上海市青浦区……" /><button type="button" disabled={parsing} onClick={parseAddress}>{parsing ? <LoaderCircle className="spin" size={16} /> : <ScanText size={16} />}智能识别</button></div><label><span><User size={15} />收件人</span><input id="purchaser-customer" value={form.customer} onChange={(event) => setField("customer", event.target.value)} placeholder="请输入收件人姓名" /></label><label><span><Truck size={15} />手机号</span><input id="purchaser-phone" inputMode="tel" maxLength={11} value={form.phone} onChange={(event) => setField("phone", event.target.value.replace(/\D/g, ""))} placeholder="请输入11位手机号" /></label><label><span><MapPin size={15} />详细地址</span><textarea id="purchaser-address" rows={3} value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="省市区 + 街道门牌号" /></label></section>
        <section><header><span>3</span><div><h2>订单备注</h2><p>选填，告诉店铺需要特别注意的内容</p></div></header><textarea rows={3} value={form.orderDesc} onChange={(event) => setField("orderDesc", event.target.value)} placeholder="如：送货前电话联系" /></section>
        {error && !captchaOpen ? <p className="tool-error purchaser-order-error">{error}</p> : null}<button className="purchaser-submit" type="submit"><PackageCheck size={19} />确认商品并提交订单</button><p className="purchaser-submit-tip"><ShieldCheck size={13} />点击提交后才会弹出验证码，验证成功即创建订单</p>
        <button type="button" className="purchaser-help-button" onClick={() => setHelpOpen(true)}><CircleHelp size={15} />下单说明 · 常见问题</button>
      </form>
    </> : <section className="purchaser-history-section">{orders.length ? <OrderList orders={orders} contact={linkContext.purchaserPhone} /> : <div className="purchaser-no-orders"><History size={27} /><h2>还没有关联订单</h2><p>使用当前专属链接下单后，订单会自动显示在这里。</p></div>}</section>}

    {captchaOpen ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCaptchaOpen(false)}><section className="purchaser-captcha-modal"><button className="purchaser-captcha-close" type="button" onClick={() => setCaptchaOpen(false)}><X size={19} /></button><small>{Number(linkContext?.requirePwd) === 1 ? "ORDER CODE" : "FINAL VERIFICATION"}</small><h2>{Number(linkContext?.requirePwd) === 1 ? "请输入下单码" : "请确认订单信息并完成验证"}</h2><p>{Number(linkContext?.requirePwd) === 1 ? "下单码由店铺提供，微信付款后向店家索取" : "提交后无法修改，请仔细核对下方信息。"}</p><div className="purchaser-captcha-summary">
        <div><span>商品</span><b>{emojiFor((form.orderName === "other" ? form.orderNameDesc : selectedProduct?.label) || "")} {form.orderName === "other" ? form.orderNameDesc : selectedProduct?.label || "--"}</b></div>
        <div><span>规格</span><b>{form.orderType === "other" ? form.orderTypeDesc : selectedSize?.label || "--"}</b></div>
        <div><span>数量</span><b>{form.orderNum} 件</b></div>
        <div><span>收件人</span><b>{form.customer || "--"}</b></div>
        <div><span>手机号</span><b>{form.phone || "--"}</b></div>
        <div><span>收货地址</span><b>{form.address || "--"}</b></div>
        {form.orderDesc ? <div><span>备注</span><b>{form.orderDesc}</b></div> : null}
      </div>{Number(linkContext?.requirePwd) === 1 ? <div className="purchaser-captcha-row purchaser-captcha-pwd-row"><input className="purchaser-captcha-pwd" autoFocus inputMode="numeric" maxLength={6} value={pwd} onChange={(event) => setPwd(event.target.value.replace(/\D/g, ""))} placeholder="输入 4-6 位下单码" /></div> : <div className="purchaser-captcha-row"><button className="purchaser-captcha-image" type="button" onClick={loadCaptcha}>{captcha ? <img src={captcha} alt="验证码" /> : <RefreshCw size={20} />}</button><input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入图中验证码" /></div>}{error ? <p className="tool-error">{error}</p> : null}<button className="purchaser-captcha-submit" type="button" disabled={submitting} onClick={submitOrder}>{submitting ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{submitting ? "正在创建订单" : (Number(linkContext?.requirePwd) === 1 ? "输入下单码并提交" : "验证并提交订单")}</button></section></div> : null}
    {success ? <div className="purchaser-success-backdrop" onMouseDown={(event) => event.target === event.currentTarget && continueOrdering()}><section className="purchaser-success-modal" role="alertdialog" aria-modal="true">
      <button className="purchaser-success-close" type="button" onClick={continueOrdering} aria-label="关闭"><X size={18} /></button>
      <div className="purchaser-success-icon"><CheckCircle2 size={36} /></div>
      <small>ORDER CREATED</small>
      <h2>下单成功</h2>
      <p className="purchaser-success-thanks">感谢购买 <span className="purchaser-success-product">{emojiFor(String(success.orderNameDesc || selectedProduct?.label || ""))} {String(success.orderNameDesc || selectedProduct?.label || "您的商品")}</span>！</p>
      <p>订单已提交到「{linkContext.storeName || "店铺"}」，请耐心等待处理</p>
      <div className="purchaser-success-info">
        <div><span>订单号</span><b>{String(success.orderCode || success.id || "已生成")}</b></div>
        <div><span>商品</span><b>{String(success.orderNameDesc || selectedProduct?.label || "--")} {String(success.orderTypeDesc || selectedSize?.label || "")}</b></div>
        <div><span>数量</span><b>{String(success.orderNum || form.orderNum || 1)} 件</b></div>
        <div><span>收件人</span><b>{String(success.customer || form.customer || "--")}</b></div>
        <div><span>手机号</span><b>{String(success.phone || form.phone || "--")}</b></div>
      </div>
      <div className="purchaser-success-actions">
        <button type="button" className="purchaser-success-secondary" onClick={continueOrdering}><Plus size={16} />继续下单</button>
        <button type="button" className="purchaser-success-primary" onClick={viewOrders}>查询订单<ArrowRight size={16} /></button>
      </div>
    </section></div> : null}
    {helpOpen ? <div className="purchaser-help-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHelpOpen(false)}><section className="purchaser-help-modal">
      <button className="purchaser-help-close" type="button" onClick={() => setHelpOpen(false)} aria-label="关闭"><X size={19} /></button>
      <small>HOW TO ORDER</small>
      <h2>下单说明</h2>
      <p>先选商品、填收货信息，最后输验证码。一步步来就行，不漏必填项。</p>
      <div className="purchaser-help-content">
        <section>
          <h3>① 选择商品</h3>
          <p>点下方按钮选商品和规格。数量用 <b>+/−</b> 调整。如果列表里没想要的，选 <b>其他</b> 自定义名称。</p>
        </section>
        <section>
          <h3>② 收货信息</h3>
          <p>可以整段复制「张三 13800138000 上海市青浦区…」点 <b>智能识别</b> 自动拆字段。手机号必须 11 位数字。</p>
        </section>
        <section>
          <h3>③ 订单备注（选填）</h3>
          <p>给店铺的特殊交代：送货时间、包装要求、特殊需求等。留空也能下单。</p>
        </section>
        <section>
          <h3>④ 验证码</h3>
          <p>点 <b>确认商品并提交订单</b> 后弹验证码图片，输完即建单。本链接是专属的，可多次使用，每次订单都记在「我的订单」里。</p>
        </section>
        {linkContext.storeName ? <div className="purchaser-help-contact">
          <span>下单店铺</span>
          <b>{linkContext.storeName}</b>
          {linkContext.storeNotice ? <p>{linkContext.storeNotice}</p> : null}
        </div> : null}
      </div>
    </section></div> : null}
    {missingFields.length > 0 ? <div className="purchaser-missing-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMissingFields([])}><section className="purchaser-missing-modal" role="alertdialog" aria-modal="true">
      <div className="purchaser-missing-icon"><AlertCircle size={28} /></div>
      <small>请补全以下信息</small>
      <h2>{missingFields.length} 项待完成</h2>
      <p>点击下方任一项，快速跳到对应位置</p>
      <div className="purchaser-missing-list">
        {missingFields.map((field, index) => <button key={field} type="button" onClick={() => jumpToField(field)}>
          <span className="purchaser-missing-num">{index + 1}</span>
          <span className="purchaser-missing-name">{field}</span>
          <ChevronRight size={16} />
        </button>)}
      </div>
      <button className="purchaser-missing-close" type="button" onClick={() => setMissingFields([])}>关闭</button>
    </section></div> : null}
  </div>;
}
