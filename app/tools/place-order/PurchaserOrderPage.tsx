
import { AlertCircle, ArrowRight, Ban, CheckCircle2, ChevronRight, CircleHelp, CreditCard, Edit3, Eye, History, KeyRound, LoaderCircle, Lock, LockKeyhole, MapPin, Minus, PackageCheck, Plus, RefreshCw, ScanText, ShieldCheck, ShoppingBag, Store, Trash2, Truck, User, Wallet, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import OrderList, { PublicOrderRecord } from "../OrderList";
import { OrderStatsCards, StatusFilter, computeOrderStats, filterOrdersByStatus } from "../OrderStatsCards";
import PeachTip from "../../components/PeachTip";

type Row = Record<string, unknown>;
type Option = { value: string; label: string; icon?: string };
type LinkContext = { purchaserShortId?: string; purchaserName?: string; purchaserPhone?: string; storeCode?: string; storeName?: string; storeNotice?: string; requirePwd?: number; blockOrder?: number; blockQuery?: number; blockDisplayType?: string; viewCostPrice?: number; costPricePwdExpire?: string };
type BlockDisplay = "banner" | "fullscreen" | "confirm";
type OrderForm = { orderName: string; orderNameDesc: string; orderType: string; orderTypeDesc: string; orderNum: number; customer: string; phone: string; address: string; orderDesc: string; expCom: string };
const EMPTY_FORM: OrderForm = { orderName: "", orderNameDesc: "", orderType: "", orderTypeDesc: "", orderNum: 1, customer: "", phone: "", address: "", orderDesc: "", expCom: "" };
// 指定快递：买家仅可从这三家中选（值与 sys_exp_com 字典一致）
const COURIER_OPTIONS: Option[] = [
  { value: "SF", label: "顺丰", icon: "https://cdn.kuaidi100.com/images/all/144/shunfeng.png" },
  { value: "JDL", label: "京东", icon: "https://cdn.kuaidi100.com/images/all/144/jd.png" },
  { value: "EMS", label: "邮政", icon: "https://cdn.kuaidi100.com/images/all/144/ems.png" },
];

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
  const [couriers] = useState<Option[]>(COURIER_OPTIONS);
  const [orders, setOrders] = useState<PublicOrderRecord[]>([]);
  const [tab, setTab] = useState<"create" | "orders">("create");
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
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
  // 编辑 / 删除 流程
  const [editingOrder, setEditingOrder] = useState<PublicOrderRecord | null>(null);
  const [editForm, setEditForm] = useState<OrderForm>(EMPTY_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [confirmingEdit, setConfirmingEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<PublicOrderRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  // 详情查看
  const [viewingOrder, setViewingOrder] = useState<PublicOrderRecord | null>(null);
  // confirm 模式：进入或切到被拦 tab 时弹窗提醒（每个 tab 切回去都会再弹一次）
  const [blockConfirm, setBlockConfirm] = useState<{ orders: boolean; query: boolean } | null>(null);
  // 成本价查看：当前是否解锁（验证过密码）；解锁后下次进页面靠 expireTime 重新走
  const [costPwd, setCostPwd] = useState("");
  const [costPwdBusy, setCostPwdBusy] = useState(false);
  const [costPwdError, setCostPwdError] = useState("");
  const [costPriceUnlocked, setCostPriceUnlocked] = useState(false);

  const loadOrders = useCallback(async (purchaserId: string, password?: string) => {
    const result = await apiRequest<{ data?: PublicOrderRecord[] }>("/search/purchaser/orders", { auth: false, query: { id: purchaserId, ...(password ? { costPricePwd: password } : {}) } });
    const data = Array.isArray(result.data) ? result.data : [];
    setOrders(data);
    return data;
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
      // 顶部 banner / 全屏模式：禁用其中一个 tab 时，开页直接落到另一个 tab（避免闪一下被拦的 tab）
      const display = contextResult.data.blockDisplayType || "banner";
      if (display !== "confirm") {
        const orderBlocked = contextResult.data.blockOrder === 1;
        const queryBlocked = contextResult.data.blockQuery === 1;
        if (orderBlocked && !queryBlocked) setTab("orders");
        else if (queryBlocked && !orderBlocked) setTab("create");
      }
      // 订单查询被拦时不开单（不论哪种展示模式都不需要加载订单列表），避免错误冒到下单页面顶部
      if (contextResult.data.blockQuery !== 1) await loadOrders(parsed.purchaserId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下单链接无效"); }
    finally { setLoading(false); }
  }, [loadOrders]);

  useEffect(() => { initialize(); }, [initialize]);

  // confirm 模式：进入 / 切到被拦 tab 时弹窗（每次切换都会再弹一次）
  useEffect(() => {
    if (!linkContext) return;
    if ((linkContext.blockDisplayType || "banner") !== "confirm") return;
    if (tab === "create" && linkContext.blockOrder === 1) setBlockConfirm({ orders: true, query: false });
    else if (tab === "orders" && linkContext.blockQuery === 1) setBlockConfirm({ orders: false, query: true });
  }, [linkContext, tab]);

  // 被拦的 tab 自动隐藏 → 当前 tab 不可见时切换到可见的那个（confirm 模式 tab 仍可见，不切换）
  useEffect(() => {
    if (!linkContext) return;
    if ((linkContext.blockDisplayType || "banner") === "confirm") return;
    if (tab === "create" && linkContext.blockOrder === 1 && linkContext.blockQuery !== 1) setTab("orders");
    else if (tab === "orders" && linkContext.blockQuery === 1 && linkContext.blockOrder !== 1) setTab("create");
  }, [linkContext, tab]);

  const selectedProduct = useMemo(() => products.find((item) => item.value === form.orderName), [products, form.orderName]);
  const selectedSize = useMemo(() => sizes.find((item) => item.value === form.orderType), [sizes, form.orderType]);

  // 顶部看板：用已加载的历史订单算统计
  const stats = useMemo(() => computeOrderStats(orders), [orders]);

  // 按顶部看板筛选：基于全量 orders 客户端过滤，零网络请求
  const filteredOrders = useMemo(() => filterOrdersByStatus(orders, statusFilter), [orders, statusFilter]);

  function applyFilter(key: StatusFilter) {
    setStatusFilter(key);
    setTab("orders");
    window.requestAnimationFrame(() => {
      document.getElementById("purchaser-history-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

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
    // 拦截：被 blockOrder 禁止下单时，提交按钮不可用（兜底，正常情况下按钮 disabled 已经阻止了 form 提交）
    if (linkContext?.blockOrder === 1) {
      setError("亲～当前链接已暂停下单服务\n请联系店铺或客服，我们会尽快帮您恢复");
      return;
    }
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

  // 打开编辑：把 label 反查成 value，找不到则落到 "other" + 旧 label 作为自定义
  function openEdit(order: PublicOrderRecord) {
    if (order.orderStatus !== "DSH") return;
    const productValue = products.find((item) => item.label === order.orderNameDesc)?.value || "other";
    const sizeValue = sizes.find((item) => item.label === order.orderTypeDesc)?.value || "other";
    const expComValue = String((order as Row).expCom || "");
    setEditForm({
      orderName: productValue,
      orderNameDesc: productValue === "other" ? (order.orderNameDesc || "") : "",
      orderType: sizeValue,
      orderTypeDesc: sizeValue === "other" ? (order.orderTypeDesc || "") : "",
      orderNum: Number(order.orderNum) || 1,
      customer: order.customer || "",
      phone: order.phone || "",
      address: order.address || "",
      orderDesc: order.orderDesc || "",
      expCom: expComValue,
    });
    setEditingOrder(order);
    setError(""); setErrorFieldId(null); setMissingFields([]);
  }

  function closeEdit() {
    setEditingOrder(null);
    setConfirmingEdit(false);
    setEditForm(EMPTY_FORM);
    setError(""); setErrorFieldId(null); setMissingFields([]);
  }

  function setEditField<K extends keyof OrderForm>(key: K, value: OrderForm[K]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function requestEditSubmit(event: FormEvent) {
    event.preventDefault(); setError(""); setErrorFieldId(null);
    const missing: string[] = [];
    if (!editForm.orderName) missing.push("商品");
    if (!editForm.orderType) missing.push("规格");
    if (editForm.orderName === "other" && !editForm.orderNameDesc.trim()) missing.push("自定义商品名称");
    if (editForm.orderType === "other" && !editForm.orderTypeDesc.trim()) missing.push("自定义规格");
    if (!editForm.customer.trim()) missing.push("收件人");
    if (!/^1\d{10}$/.test(editForm.phone.trim())) missing.push("11位手机号");
    if (!editForm.address.trim()) missing.push("收货地址");
    if (missing.length > 0) { setMissingFields(missing); return; }
    setConfirmingEdit(true);
  }

  async function submitEdit() {
    if (!editingOrder) return;
    setEditSubmitting(true); setError("");
    try {
      const body = {
        ...editForm,
        orderNameDesc: editForm.orderName === "other" ? editForm.orderNameDesc.trim() : products.find((item) => item.value === editForm.orderName)?.label,
        orderTypeDesc: editForm.orderType === "other" ? editForm.orderTypeDesc.trim() : sizes.find((item) => item.value === editForm.orderType)?.label,
      };
      await apiRequest(`/search/order/${editingOrder.id}`, { auth: false, method: "PUT", query: { purchaserShortId: linkKey.purchaserId }, body });
      setConfirmingEdit(false); setEditingOrder(null); setEditForm(EMPTY_FORM);
      await loadOrders(linkKey.purchaserId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "修改失败，请重试");
      setConfirmingEdit(false);
    }
    finally { setEditSubmitting(false); }
  }

  function requestDelete(order: PublicOrderRecord) {
    if (order.orderStatus !== "DSH") return;
    setConfirmingDelete(order);
  }

  async function submitDelete() {
    if (!confirmingDelete) return;
    setDeleteSubmitting(true); setError("");
    try {
      await apiRequest(`/search/order/${confirmingDelete.id}`, { auth: false, method: "DELETE", query: { purchaserShortId: linkKey.purchaserId } });
      setConfirmingDelete(null);
      await loadOrders(linkKey.purchaserId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败，请重试");
      setConfirmingDelete(null);
    }
    finally { setDeleteSubmitting(false); }
  }

  async function submitCostPwd() {
    if (!/^\d{4,6}$/.test(costPwd.trim())) { setCostPwdError("密码为 4-6 位数字"); return; }
    setCostPwdBusy(true); setCostPwdError("");
    try {
      // 用 loadOrders 的返回值判断（setOrders 是异步的，直接读 orders 拿到的是旧值，会误判）
      const fresh = await loadOrders(linkKey.purchaserId, costPwd.trim());
      const unlocked = fresh.some((order) => order.totalPrice !== undefined && order.totalPrice !== null);
      if (unlocked) {
        setCostPriceUnlocked(true); setCostPwd(""); setCostPwdError("");
      } else {
        setCostPwdError("密码错误或已过期，请向店铺重新索取");
      }
    } catch (cause) {
      setCostPwdError(cause instanceof Error ? cause.message : "验证失败，请重试");
    }
    finally { setCostPwdBusy(false); }
  }

  function lockCostPrice() {
    setCostPriceUnlocked(false);
    // 重新拉一次不带密码的订单，把成本价字段从内存里去掉
    void loadOrders(linkKey.purchaserId);
  }

  if (loading) return <div className="tool-page purchaser-order-page"><div className="purchaser-link-loading"><LoaderCircle className="spin" size={28} /><b>正在验证专属下单链接</b><small>同时加载店铺、商品和历史订单</small></div></div>;
  if (!linkContext) return <div className="tool-page purchaser-order-page"><section className="invalid-link-card"><X size={28} /><h1>链接无效</h1><p>{error || "无法识别该下单链接"}</p><small>专属链接只包含6位下单人短ID，修改短码、解绑店铺或关闭店铺后将无法下单。</small></section></div>;

  const blockOrderOn = linkContext.blockOrder === 1;
  const blockQueryOn = linkContext.blockQuery === 1;
  const blockDisplay = (linkContext.blockDisplayType || "banner") as BlockDisplay;
  const anyBlocked = blockOrderOn || blockQueryOn;
  const bothBlocked = blockOrderOn && blockQueryOn;
  // 被拦的按钮 / 入口：始终禁用（display=confirm 也只是叠加弹窗）
  const submitDisabled = blockOrderOn;
  // fullscreen 模式 + 两边都拦：整页只显示占位卡
  if (bothBlocked && blockDisplay === "fullscreen") {
    return <div className="tool-page purchaser-order-page">
      <section className="purchaser-fullscreen-block">
        <Ban size={42} />
        <h1>亲～专属链接已暂停服务 🙏</h1>
        <p>下单和订单查询功能均已暂时关闭，给您带来不便请见谅～请联系店铺或客服</p>
        <small>店铺：{linkContext.storeName} · 专属 ID {linkContext.purchaserShortId}</small>
      </section>
    </div>;
  }
  // banner 模式：禁用哪个，tab 区换成整行占满的禁用提示；下面仍渲染内容（auto-switch 后落到未禁用的 tab）
  const showBannerTab = blockDisplay === "banner" && anyBlocked;
  // 当前 tab 是不是被拦 + fullscreen 模式：渲染占位卡
  const currentTabFullscreenBlocked = blockDisplay === "fullscreen" && ((tab === "create" && blockOrderOn) || (tab === "orders" && blockQueryOn));
  // banner 模式的单行 tab 提示文案
  const bannerTabText = (() => {
    if (blockOrderOn && blockQueryOn) return { title: "下单和订单查询已暂停", sub: "请联系店铺或客服，了解恢复时间" };
    if (blockOrderOn) return { title: "下单功能已暂停", sub: "订单查询不受影响" };
    return { title: "订单查询已暂停", sub: "下单功能不受影响" };
  })();

  return <div className="tool-page purchaser-order-page">
    <section className="purchaser-order-hero"><div><small>XB EXPRESS ORDER</small><h1>你好，{linkContext.purchaserName}</h1><p><Store size={14} />{linkContext.storeName}<span>·</span>专属下单人 ID {linkContext.purchaserShortId}</p>{stats.pending + stats.shipped > 0 ? <p className="purchaser-order-hero-sub">📦 您有 <b>{stats.pending + stats.shipped}</b> 笔订单正在路上</p> : null}</div><span><ShoppingBag size={26} /></span></section>
    {linkContext.storeNotice ? <div className="purchaser-store-notice"><ShieldCheck size={16} /><p>{linkContext.storeNotice}</p></div> : null}
    <PeachTip />
    {anyBlocked ? null : <OrderStatsCards stats={stats} filter={statusFilter} onSelect={applyFilter} />}

    {showBannerTab ? (
      <div className="purchaser-block-tab" role="status" aria-live="polite">
        <div><Ban size={15} /><b>{bannerTabText.title}</b><span>·</span><em>{bannerTabText.sub}</em></div>
      </div>
    ) : blockDisplay === "confirm" ? (
      // confirm 模式：所有 tab 都展示，让用户能切到被拦的 tab 触发弹窗
      <nav className="purchaser-order-tabs">
        <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><ShoppingBag size={17} />我要下单</button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><History size={17} />我的订单<span>{orders.length}</span></button>
      </nav>
    ) : (
      // fullscreen 模式：只展示未被拦的 tab
      <nav className="purchaser-order-tabs">
        {!blockOrderOn ? <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}><ShoppingBag size={17} />我要下单</button> : null}
        {!blockQueryOn ? <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><History size={17} />我的订单<span>{orders.length}</span></button> : null}
      </nav>
    )}

    {(showBannerTab && bothBlocked) ? <section className="purchaser-fullscreen-block">
      <Ban size={42} />
      <h1>亲～专属链接已暂停服务 🙏</h1>
      <p>下单和订单查询功能均已暂时关闭，给您带来不便请见谅～请联系店铺或客服</p>
      <small>店铺：{linkContext.storeName} · 专属 ID {linkContext.purchaserShortId}</small>
    </section> : currentTabFullscreenBlocked ? (
      tab === "create" ? <section className="purchaser-fullscreen-block">
        <Ban size={42} />
        <h1>亲～下单通道已暂时关闭 🙏</h1>
        <p>下单功能已暂时关闭，给您带来不便请见谅～请联系店铺或客服，我们会尽快为您处理</p>
      </section> : <section className="purchaser-fullscreen-block">
        <Ban size={42} />
        <h1>亲～订单查询已暂时关闭 🙏</h1>
        <p>历史订单暂时无法查看（不影响下单）～如需了解订单详情请联系店铺或客服</p>
      </section>
    ) : tab === "create" ? (
      <>
        {success ? null : null}
        <form className="purchaser-order-form" onSubmit={requestSubmit}>
          <section id="purchaser-section-product"><header><span>1</span><div><h2>选择商品</h2><p>商品与规格来自后台实时字典（默认未选，请主动选择）</p></div></header><div className="purchaser-choice-grid">{products.map((item) => <button type="button" className={form.orderName === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderName", item.value)}><span className="purchaser-choice-emoji">{emojiFor(item.label)}</span>{item.label}</button>)}</div>{form.orderName === "other" ? <input id="purchaser-custom-name" value={form.orderNameDesc} onChange={(event) => setField("orderNameDesc", event.target.value)} placeholder="请输入商品名称" /> : null}<div className="purchaser-choice-grid compact">{sizes.map((item) => <button type="button" className={form.orderType === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderType", item.value)}>{item.label}</button>)}</div>{form.orderType === "other" ? <input id="purchaser-custom-spec" value={form.orderTypeDesc} onChange={(event) => setField("orderTypeDesc", event.target.value)} placeholder="请输入规格" /> : null}<div className="purchaser-quantity"><span>购买数量</span><div><button type="button" onClick={() => setField("orderNum", Math.max(1, form.orderNum - 1))}><Minus size={16} /></button><b>{form.orderNum}</b><button type="button" onClick={() => setField("orderNum", Math.min(99, form.orderNum + 1))}><Plus size={16} /></button></div></div></section>
          <section id="purchaser-section-address"><header><span>2</span><div><h2>收货信息</h2><p>可粘贴整段信息后智能识别</p></div></header><div className="purchaser-paste"><textarea rows={3} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="例如：张三 13800138000 上海市青浦区……" /><button type="button" disabled={parsing} onClick={parseAddress}>{parsing ? <LoaderCircle className="spin" size={16} /> : <ScanText size={16} />}智能识别</button></div><label><span><User size={15} />收件人</span><input id="purchaser-customer" value={form.customer} onChange={(event) => setField("customer", event.target.value)} placeholder="请输入收件人姓名" /></label><label><span><Truck size={15} />手机号</span><input id="purchaser-phone" inputMode="tel" maxLength={11} value={form.phone} onChange={(event) => setField("phone", event.target.value.replace(/\D/g, ""))} placeholder="请输入11位手机号" /></label><label><span><MapPin size={15} />详细地址</span><textarea id="purchaser-address" rows={3} value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="省市区 + 街道门牌号" /></label><label><span><Truck size={15} />指定快递</span><div className="purchaser-choice-grid four-cols"><button type="button" className={form.expCom === "" ? "active" : ""} onClick={() => setField("expCom", "")}>暂不选择</button>{couriers.map((item) => <button type="button" className={form.expCom === item.value ? "active" : ""} key={item.value} onClick={() => setField("expCom", item.value)}>{item.icon ? <img src={item.icon} alt="" loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}{item.label}</button>)}</div></label></section>
          <section><header><span>3</span><div><h2>订单备注</h2><p>选填，告诉店铺需要特别注意的内容</p></div></header><textarea rows={3} value={form.orderDesc} onChange={(event) => setField("orderDesc", event.target.value)} placeholder="如：送货前电话联系" /></section>
          {error && !captchaOpen ? <p className="tool-error purchaser-order-error">{error}</p> : null}<button className="purchaser-submit" type="submit" disabled={submitDisabled}><PackageCheck size={19} />{blockOrderOn ? "已暂停下单" : "确认商品并提交订单"}</button><p className="purchaser-submit-tip"><ShieldCheck size={13} />点击提交后才会弹出验证码，验证成功即创建订单</p>
          <button type="button" className="purchaser-help-button" onClick={() => setHelpOpen(true)}><CircleHelp size={15} />下单说明 · 常见问题</button>
        </form>
      </>
    ) : (blockDisplay === "confirm" && blockQueryOn) ? null : <>
      {/* 成本价密码：店铺开启"允许查看成本价"才显示；解锁后变成"重新上锁"小按钮 */}
      {Number(linkContext.viewCostPrice) === 1 && !costPriceUnlocked ? <section className="purchaser-cost-pwd">
        <div><LockKeyhole size={15} /><div><small>查看成本价</small><b>输入店铺提供的密码，可看到每笔订单的商品/包装/快递/总成本</b></div></div>
        <div className="purchaser-cost-pwd-row">
          <input inputMode="numeric" maxLength={6} value={costPwd} onChange={(event) => { setCostPwd(event.target.value.replace(/\D/g, "")); setCostPwdError(""); }} placeholder="4-6 位数字密码" />
          <button type="button" disabled={costPwdBusy} onClick={submitCostPwd}>{costPwdBusy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}解锁</button>
        </div>
        {costPwdError ? <p className="tool-error"><AlertCircle size={13} />{costPwdError}</p> : null}
        {linkContext.costPricePwdExpire ? <small className="purchaser-cost-pwd-hint"><ShieldCheck size={11} />密码有效至 {String(linkContext.costPricePwdExpire).slice(0, 16)}</small> : null}
      </section> : null}
      {Number(linkContext.viewCostPrice) === 1 && costPriceUnlocked ? <section className="purchaser-cost-unlocked">
        <div><Wallet size={14} /><b>已解锁成本价</b><em>每笔订单会显示总成本与销售价</em></div>
        <button type="button" onClick={lockCostPrice}><Lock size={13} />重新上锁</button>
      </section> : null}
      {orders.length ? <OrderList orders={filteredOrders} contact={linkContext.purchaserPhone} onEdit={openEdit} onDelete={requestDelete} onView={setViewingOrder} onRefresh={() => loadOrders(linkKey.purchaserId, costPriceUnlocked ? costPwd.trim() : undefined)} /> : <div className="purchaser-no-orders"><History size={27} /><h2>还没有关联订单</h2><p>使用当前专属链接下单后，订单会自动显示在这里。</p></div>}
    </>}

    {captchaOpen ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCaptchaOpen(false)}><section className="purchaser-captcha-modal"><button className="purchaser-captcha-close" type="button" onClick={() => setCaptchaOpen(false)}><X size={19} /></button><small>{Number(linkContext?.requirePwd) === 1 ? "ORDER CODE" : "FINAL VERIFICATION"}</small><h2>{Number(linkContext?.requirePwd) === 1 ? "请输入下单码" : "请确认订单信息并完成验证"}</h2><p>{Number(linkContext?.requirePwd) === 1 ? "下单码由店铺提供，微信付款后向店家索取" : "提交后无法修改，请仔细核对下方信息。"}</p><div className="purchaser-captcha-summary">
        <div><span>商品</span><b>{emojiFor((form.orderName === "other" ? form.orderNameDesc : selectedProduct?.label) || "")} {form.orderName === "other" ? form.orderNameDesc : selectedProduct?.label || "--"}</b></div>
        <div><span>规格</span><b>{form.orderType === "other" ? form.orderTypeDesc : selectedSize?.label || "--"}</b></div>
        <div><span>数量</span><b>{form.orderNum} 件</b></div>
        <div><span>收件人</span><b>{form.customer || "--"}</b></div>
        <div><span>手机号</span><b>{form.phone || "--"}</b></div>
        <div><span>收货地址</span><b>{form.address || "--"}</b></div>
        <div><span>指定快递</span><b>{form.expCom ? (couriers.find((item) => item.value === form.expCom)?.label || form.expCom) : "暂不选择"}</b></div>
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
    {editingOrder ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeEdit()}><section className="purchaser-captcha-modal purchaser-edit-modal">
      <button className="purchaser-captcha-close" type="button" onClick={closeEdit} aria-label="关闭"><X size={19} /></button>
      <small>EDIT ORDER</small>
      <h2>修改订单</h2>
      <p>仅待处理订单可修改，修改后店铺会收到最新信息。</p>
      <div className="purchaser-captcha-summary">
        <div><span>订单号</span><b>{editingOrder.orderCode || "--"}</b></div>
        <div><span>当前状态</span><b>{editingOrder.orderStatusDesc || editingOrder.orderStatus || "待处理"}</b></div>
      </div>
      <form onSubmit={requestEditSubmit} className="purchaser-edit-form">
        <section><header><span>1</span><div><h3>商品</h3></div></header><div className="purchaser-choice-grid">{products.map((item) => <button type="button" className={editForm.orderName === item.value ? "active" : ""} key={item.value} onClick={() => setEditField("orderName", item.value)}><span className="purchaser-choice-emoji">{emojiFor(item.label)}</span>{item.label}</button>)}</div>{editForm.orderName === "other" ? <input value={editForm.orderNameDesc} onChange={(event) => setEditField("orderNameDesc", event.target.value)} placeholder="请输入商品名称" /> : null}<div className="purchaser-choice-grid compact">{sizes.map((item) => <button type="button" className={editForm.orderType === item.value ? "active" : ""} key={item.value} onClick={() => setEditField("orderType", item.value)}>{item.label}</button>)}</div>{editForm.orderType === "other" ? <input value={editForm.orderTypeDesc} onChange={(event) => setEditField("orderTypeDesc", event.target.value)} placeholder="请输入规格" /> : null}<div className="purchaser-quantity purchaser-quantity-locked"><span>购买数量</span><div><b>{editForm.orderNum}</b><small>件 · 修改时不可调整</small></div></div></section>
        <section><header><span>2</span><div><h3>收货信息</h3></div></header><label><span><User size={15} />收件人</span><input value={editForm.customer} onChange={(event) => setEditField("customer", event.target.value)} placeholder="请输入收件人姓名" /></label><label><span><Truck size={15} />手机号</span><input inputMode="tel" maxLength={11} value={editForm.phone} onChange={(event) => setEditField("phone", event.target.value.replace(/\D/g, ""))} placeholder="请输入11位手机号" /></label><label><span><MapPin size={15} />详细地址</span><textarea rows={3} value={editForm.address} onChange={(event) => setEditField("address", event.target.value)} placeholder="省市区 + 街道门牌号" /></label><label><span><Truck size={15} />指定快递</span><div className="purchaser-choice-grid four-cols"><button type="button" className={editForm.expCom === "" ? "active" : ""} onClick={() => setEditField("expCom", "")}>暂不选择</button>{couriers.map((item) => <button type="button" className={editForm.expCom === item.value ? "active" : ""} key={item.value} onClick={() => setEditField("expCom", item.value)}>{item.icon ? <img src={item.icon} alt="" loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}{item.label}</button>)}</div></label></section>
        <section><header><span>3</span><div><h3>订单备注</h3></div></header><textarea rows={3} value={editForm.orderDesc} onChange={(event) => setEditField("orderDesc", event.target.value)} placeholder="如：送货前电话联系" /></section>
        {missingFields.length > 0 ? <p className="tool-error">请补全 {missingFields.length} 项必填信息</p> : null}
        {error ? <p className="tool-error">{error}</p> : null}
        <button className="purchaser-captcha-submit" type="submit" disabled={editSubmitting}><Edit3 size={18} />保存修改</button>
      </form>
    </section></div> : null}
    {viewingOrder ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setViewingOrder(null)}><section className="purchaser-captcha-modal purchaser-detail-modal">
      <button className="purchaser-captcha-close" type="button" onClick={() => setViewingOrder(null)} aria-label="关闭"><X size={19} /></button>
      <small>ORDER DETAILS</small>
      <h2>订单详情</h2>
      <p>订单号 <b>{viewingOrder.orderCode || "--"}</b> · {viewingOrder.orderStatusDesc || viewingOrder.orderStatus || "未知"} · {String(viewingOrder.orderTime || "").replace("T", " ").slice(0, 16) || "暂无时间"}</p>
      <div className="purchaser-detail-section">
        <h3>商品</h3>
        <div className="purchaser-captcha-summary">
          <div><span>商品名称</span><b>{viewingOrder.orderNameDesc || "--"}</b></div>
          <div><span>规格</span><b>{viewingOrder.orderTypeDesc || "--"}</b></div>
          <div><span>数量</span><b>{viewingOrder.orderNum || 1} 件</b></div>
          {viewingOrder.orderDesc ? <div className="full"><span>订单备注</span><b>{viewingOrder.orderDesc}</b></div> : null}
        </div>
      </div>
      <div className="purchaser-detail-section">
        <h3>收件信息</h3>
        <div className="purchaser-captcha-summary">
          <div><span>收件人</span><b>{viewingOrder.customer || "--"}</b></div>
          <div><span>手机号</span><b>{viewingOrder.phone || "--"}</b></div>
          <div className="full"><span>详细地址</span><b>{viewingOrder.address || "暂无地址"}</b></div>
        </div>
      </div>
      <div className="purchaser-detail-section">
        <h3>快递</h3>
        <div className="purchaser-captcha-summary">
          <div><span>快递公司</span><b>{viewingOrder.expComDesc || "暂无"}</b></div>
          <div><span>快递单号</span><b>{viewingOrder.expCode && viewingOrder.expCode !== "无" ? viewingOrder.expCode : "暂无"}</b></div>
        </div>
        {(viewingOrder.expInfoList || []).length ? <div className="tool-mini-timeline tool-full-timeline" style={{ marginTop: 11 }}>{(viewingOrder.expInfoList || []).map((item, index) => <div className={index === 0 ? "latest" : ""} key={String(item.id || `${item.expTime}-${index}`)}><i /><span><b>{item.expStatusDesc || item.expDesc || "物流更新"}</b><p>{item.expDesc || item.desc || "状态已更新"}</p>{item.expCode ? <em>快递单号：{item.expCode}</em> : null}<small>{item.expTime || item.createTime || ""}</small></span></div>)}</div> : <p style={{ margin: "7px 0 0", color: "var(--muted)", fontSize: 9 }}>暂无物流轨迹</p>}
      </div>
      {(viewingOrder.store || viewingOrder.purchaser || viewingOrder.createBy) ? <div className="purchaser-detail-section">
        <h3>其他</h3>
        <div className="purchaser-captcha-summary">
          {/* viewingOrder.store 现在存的是 storeCode（统一语义），对买家来说只会看到自己那家店，
              直接用 linkContext.storeName 展示更友好；没拿到 linkContext 时 fallback 显示原文 */}
          {viewingOrder.store ? <div><span>店铺</span><b>{linkContext.storeName || viewingOrder.store}</b></div> : null}
          {viewingOrder.purchaser || viewingOrder.createBy ? <div><span>下单人</span><b>{viewingOrder.purchaser || viewingOrder.createBy}</b></div> : null}
        </div>
      </div> : null}
      {viewingOrder.totalPrice !== undefined && viewingOrder.totalPrice !== null ? <div className="purchaser-detail-section purchaser-detail-cost">
        <h3><Wallet size={14} />成本明细</h3>
        <div className="purchaser-captcha-summary">
          {viewingOrder.goodsPrice !== undefined && viewingOrder.goodsPrice !== null ? <div><span>商品成本</span><b>¥{Number(viewingOrder.goodsPrice).toFixed(2)}</b></div> : null}
          {viewingOrder.packagePrice !== undefined && viewingOrder.packagePrice !== null ? <div><span>包装费</span><b>¥{Number(viewingOrder.packagePrice).toFixed(2)}</b></div> : null}
          {viewingOrder.expPrice !== undefined && viewingOrder.expPrice !== null ? <div><span>快递费</span><b>¥{Number(viewingOrder.expPrice).toFixed(2)}</b></div> : null}
          <div className="full"><span>总成本</span><b>¥{Number(viewingOrder.totalPrice).toFixed(2)}</b></div>
          {viewingOrder.salePrice !== undefined && viewingOrder.salePrice !== null ? <div className="full"><span>销售价</span><b>¥{Number(viewingOrder.salePrice).toFixed(2)}</b></div> : null}
        </div>
      </div> : null}
    </section></div> : null}
    {confirmingEdit ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !editSubmitting && setConfirmingEdit(false)}><section className="purchaser-captcha-modal">
      <button className="purchaser-captcha-close" type="button" onClick={() => setConfirmingEdit(false)} disabled={editSubmitting} aria-label="关闭"><X size={19} /></button>
      <div className="purchaser-success-icon"><ShieldCheck size={36} /></div>
      <small>CONFIRM EDIT</small>
      <h2>确认修改订单？</h2>
      <p>订单 <b>{editingOrder?.orderCode || "--"}</b> 将按最新信息保存，店铺会同步收到变更。</p>
      <div className="purchaser-success-actions">
        <button type="button" className="purchaser-success-secondary" onClick={() => setConfirmingEdit(false)} disabled={editSubmitting}>再检查一下</button>
        <button type="button" className="purchaser-success-primary" onClick={submitEdit} disabled={editSubmitting}>{editSubmitting ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}{editSubmitting ? "正在保存" : "确认修改"}</button>
      </div>
    </section></div> : null}
    {confirmingDelete ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleteSubmitting && setConfirmingDelete(null)}><section className="purchaser-captcha-modal">
      <button className="purchaser-captcha-close" type="button" onClick={() => setConfirmingDelete(null)} disabled={deleteSubmitting} aria-label="关闭"><X size={19} /></button>
      <div className="purchaser-missing-icon"><AlertCircle size={28} /></div>
      <small>CONFIRM DELETE</small>
      <h2>确认删除订单？</h2>
      <p>订单 <b>{confirmingDelete.orderCode || "--"}</b> 删除后将从您的列表移除，店铺会保留记录以便核对，无法恢复。</p>
      <div className="purchaser-success-actions">
        <button type="button" className="purchaser-success-secondary" onClick={() => setConfirmingDelete(null)} disabled={deleteSubmitting}>取消</button>
        <button type="button" className="purchaser-missing-close" onClick={submitDelete} disabled={deleteSubmitting}>{deleteSubmitting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}{deleteSubmitting ? "正在删除" : "确认删除"}</button>
      </div>
    </section></div> : null}
    {blockConfirm ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setBlockConfirm(null)}><section className="purchaser-create-modal purchaser-confirm-modal">
      <span className="danger"><AlertCircle size={22} /></span>
      <small>LINK NOTICE</small>
      <h2>专属链接已设置访问限制</h2>
      {blockConfirm.orders ? <p>亲～当前链接的下单功能已暂停。</p> : null}
      {blockConfirm.query ? <p>亲～当前链接的订单查询已暂停。</p> : null}
      <button type="button" className="purchaser-create-action primary" onClick={() => setBlockConfirm(null)}>我知道了</button>
    </section></div> : null}
  </div>;
}
