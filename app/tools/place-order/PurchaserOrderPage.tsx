
import { AlertCircle, ArrowLeft, ArrowRight, Ban, BookUser, CheckCircle2, ChevronRight, CircleHelp, Edit3, House, KeyRound, LoaderCircle, Lock, LockKeyhole, MapPin, Megaphone, Minus, PackageCheck, PackageSearch, Pencil, Plus, RefreshCw, ScanText, ShieldCheck, ShoppingBag, Star, Trash2, Truck, User, Wallet, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import OrderList, { PublicOrderRecord } from "../OrderList";
import { StatusFilter, computeOrderStats, filterOrdersByStatus } from "../OrderStatsCards";

type Row = Record<string, unknown>;
type Option = { value: string; label: string; icon?: string };
type LinkContext = { purchaserShortId?: string; purchaserName?: string; purchaserPhone?: string; storeCode?: string; storeName?: string; storeNotice?: string; requirePwd?: number; addressVerifyEnabled?: number; blockOrder?: number; blockQuery?: number; blockDisplayType?: string; viewCostPrice?: number; costPricePwdExpire?: string };
type BlockDisplay = "banner" | "fullscreen" | "confirm";
type PurchaserPage = "home" | "create" | "orders";
type OrderEditor = "product" | "address" | "delivery";
type OrderForm = { orderName: string; orderNameDesc: string; orderType: string; orderTypeDesc: string; orderNum: number; customer: string; phone: string; address: string; orderDesc: string; expCom: string };
type PurchaserAddressRecord = { id: number; receiverName: string; receiverPhone: string; address: string; isDefault?: number; useCount?: number; lastUsedTime?: string };
type AddressDraft = { id?: number; receiverName: string; receiverPhone: string; address: string; isDefault: boolean };
type AddressBookView = "auth" | "list" | "edit" | "delete";
const EMPTY_FORM: OrderForm = { orderName: "", orderNameDesc: "", orderType: "", orderTypeDesc: "", orderNum: 1, customer: "", phone: "", address: "", orderDesc: "", expCom: "" };
const EMPTY_ADDRESS_DRAFT: AddressDraft = { receiverName: "", receiverPhone: "", address: "", isDefault: false };
const COST_ACCESS_STORAGE_PREFIX = "xb:cost-access:";
// 指定快递：买家仅可从这三家中选（值与 sys_exp_com 字典一致）
const COURIER_OPTIONS: Option[] = [
  { value: "SF", label: "顺丰", icon: "https://cdn.kuaidi100.com/images/all/144/shunfeng.png" },
  { value: "JDL", label: "京东", icon: "https://cdn.kuaidi100.com/images/all/144/jd.png" },
  { value: "EMS", label: "邮政", icon: "https://cdn.kuaidi100.com/images/all/144/ems.png" },
];

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
  const [tab, setTab] = useState<PurchaserPage>("home");
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [, setErrorFieldId] = useState<string | null>(null);
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
  // 成本价查看：当前页解锁后保持 30 分钟，刷新订单列表也继续带上验证密码
  const [costPwd, setCostPwd] = useState("");
  const [costPwdBusy, setCostPwdBusy] = useState(false);
  const [costPwdError, setCostPwdError] = useState("");
  const [costPriceUnlocked, setCostPriceUnlocked] = useState(false);
  const [costAccessPassword, setCostAccessPassword] = useState("");
  const [costAccessExpiresAt, setCostAccessExpiresAt] = useState(0);
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [addressBookView, setAddressBookView] = useState<AddressBookView>("auth");
  const [addressBookBusy, setAddressBookBusy] = useState(false);
  const [addressBookError, setAddressBookError] = useState("");
  const [addressToken, setAddressToken] = useState("");
  const [addresses, setAddresses] = useState<PurchaserAddressRecord[]>([]);
  const [addressAuthPhone, setAddressAuthPhone] = useState("");
  const [addressAuthCode, setAddressAuthCode] = useState("");
  const [addressAuthPwd, setAddressAuthPwd] = useState("");
  const [addressCaptcha, setAddressCaptcha] = useState("");
  const [addressUuid, setAddressUuid] = useState("");
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const [addressDraftPasteText, setAddressDraftPasteText] = useState("");
  const [addressDraftParsing, setAddressDraftParsing] = useState(false);
  const [addressDeleteTarget, setAddressDeleteTarget] = useState<PurchaserAddressRecord | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [orderEditor, setOrderEditor] = useState<OrderEditor | null>(null);
  const [promptToast, setPromptToast] = useState<{ message: string } | null>(null);

  useEffect(() => {
    if (!promptToast) return;
    const timer = window.setTimeout(() => setPromptToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [promptToast]);

  function showPromptToast(message: string) {
    setPromptToast({ message });
  }

  const loadOrders = useCallback(async (purchaserId: string, password?: string) => {
    const result = await apiRequest<{ data?: PublicOrderRecord[] }>("/search/purchaser/orders", { auth: false, query: { id: purchaserId, ...(password ? { costPricePwd: password } : {}) } });
    const data = Array.isArray(result.data) ? result.data : [];
    setOrders(data);
    return data;
  }, []);

  const reloadOrders = useCallback(() => {
    const password = costPriceUnlocked && costAccessExpiresAt > Date.now() ? costAccessPassword : undefined;
    return loadOrders(linkKey.purchaserId, password);
  }, [costAccessExpiresAt, costAccessPassword, costPriceUnlocked, linkKey.purchaserId, loadOrders]);

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
      // 订单查询被拦时不开单（不论哪种展示模式都不需要加载订单列表），避免错误冒到下单页面顶部
      if (contextResult.data.blockQuery !== 1) {
        let restoredPassword = "";
        try {
          const saved = JSON.parse(window.sessionStorage.getItem(`${COST_ACCESS_STORAGE_PREFIX}${parsed.purchaserId}`) || "null") as { password?: string; expiresAt?: number } | null;
          if (saved?.password && Number(saved.expiresAt) > Date.now()) {
            restoredPassword = saved.password;
            setCostAccessPassword(saved.password);
            setCostAccessExpiresAt(Number(saved.expiresAt));
            setCostPriceUnlocked(true);
          } else {
            window.sessionStorage.removeItem(`${COST_ACCESS_STORAGE_PREFIX}${parsed.purchaserId}`);
          }
        } catch {
          restoredPassword = "";
        }
        const restoredOrders = await loadOrders(parsed.purchaserId, restoredPassword || undefined);
        if (restoredPassword && !restoredOrders.some((order) => order.totalPrice !== undefined && order.totalPrice !== null)) {
          setCostPriceUnlocked(false);
          setCostAccessPassword("");
          setCostAccessExpiresAt(0);
          try { window.sessionStorage.removeItem(`${COST_ACCESS_STORAGE_PREFIX}${parsed.purchaserId}`); } catch { /* ignore storage errors */ }
        }
      }
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
  const selectedProductLabel = form.orderName === "other" ? form.orderNameDesc.trim() : selectedProduct?.label;
  const selectedSizeLabel = form.orderType === "other" ? form.orderTypeDesc.trim() : selectedSize?.label;
  const selectedCourierLabel = form.expCom ? (couriers.find((item) => item.value === form.expCom)?.label || form.expCom) : "暂不指定";
  const addressRequiresVerify = Number(linkContext?.addressVerifyEnabled) === 1;

  // 顶部看板：用已加载的历史订单算统计
  const stats = useMemo(() => computeOrderStats(orders), [orders]);

  // 按顶部看板筛选：基于全量 orders 客户端过滤，零网络请求
  const filteredOrders = useMemo(() => filterOrdersByStatus(orders, statusFilter), [orders, statusFilter]);
  const latestOrder = orders[0];

  function applyFilter(key: StatusFilter) {
    setStatusFilter(key);
    setTab("orders");
    window.requestAnimationFrame(() => {
      document.getElementById("purchaser-history-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function setField<K extends keyof OrderForm>(key: K, value: OrderForm[K]) { setForm((current) => ({ ...current, [key]: value })); }

  function setManualAddressField(key: "customer" | "phone" | "address", value: string) {
    setSelectedAddressId(null);
    setField(key, value);
  }

  function addressTokenKey() {
    return `xb-purchaser-address-token:${linkKey.purchaserId}`;
  }

  function addressReverifyMessage(message: string) {
    const normalized = message.trim().replace(/[，,。；;：:\s]*请重新验证(?:[，,。；;：:\s]*请重新验证)*/g, "");
    return `${normalized || "地址访问已失效"}，请重新验证`;
  }

  async function loadAddressCaptcha() {
    try {
      const result = await apiRequest<Row>("/captchaImage", { auth: false });
      setAddressUuid(String(result.uuid || ""));
      setAddressCaptcha(result.img ? `data:image/png;base64,${result.img}` : "");
      setAddressAuthCode("");
    } catch (cause) {
      setAddressBookError(cause instanceof Error ? cause.message : "验证码加载失败");
    }
  }

  async function loadAddresses(token: string) {
    setAddressBookBusy(true);
    setAddressBookError("");
    try {
      const result = await apiRequest<{ data?: PurchaserAddressRecord[] }>("/search/purchaser/addresses", {
        auth: false,
        query: { id: linkKey.purchaserId },
        headers: token ? { "X-Address-Token": token } : {},
      });
      setAddresses(Array.isArray(result.data) ? result.data : []);
      setAddressToken(token);
      setAddressBookView("list");
    } catch (cause) {
      window.sessionStorage.removeItem(addressTokenKey());
      setAddressToken("");
      setAddressBookView(addressRequiresVerify ? "auth" : "list");
      setAddressBookError(cause instanceof Error
        ? (addressRequiresVerify ? addressReverifyMessage(cause.message) : cause.message)
        : (addressRequiresVerify ? "地址访问已失效，请重新验证" : "常用地址加载失败"));
      if (addressRequiresVerify && Number(linkContext?.requirePwd) !== 1) await loadAddressCaptcha();
    } finally {
      setAddressBookBusy(false);
    }
  }

  async function openAddressBook() {
    setAddressBookOpen(true);
    setAddressBookError("");
    setAddressDeleteTarget(null);
    if (!addressRequiresVerify) {
      setAddressBookView("list");
      await loadAddresses("");
      return;
    }
    const cachedToken = window.sessionStorage.getItem(addressTokenKey()) || "";
    if (cachedToken) {
      await loadAddresses(cachedToken);
      return;
    }
    setAddressBookView("auth");
    setAddressAuthPhone(form.phone);
    setAddressAuthPwd("");
    if (Number(linkContext?.requirePwd) !== 1) await loadAddressCaptcha();
  }

  async function resetExpiredAddressSession(message: string) {
    if (!addressRequiresVerify) return false;
    if (!message.includes("地址会话")) return false;
    window.sessionStorage.removeItem(addressTokenKey());
    setAddressToken("");
    setAddressBookView("auth");
    setAddressBookError(addressReverifyMessage(message));
    if (Number(linkContext?.requirePwd) !== 1) await loadAddressCaptcha();
    return true;
  }

  async function submitAddressAuth() {
    const usePassword = Number(linkContext?.requirePwd) === 1;
    if (usePassword && !/^\d{4,6}$/.test(addressAuthPwd.trim())) {
      showPromptToast("请输入 4-6 位下单码");
      return;
    }
    if (!usePassword && !/^1\d{10}$/.test(addressAuthPhone.trim())) {
      showPromptToast("请输入专属下单人绑定的完整手机号");
      return;
    }
    if (!usePassword && !addressAuthCode.trim()) {
      showPromptToast("请输入图中验证码");
      return;
    }
    setAddressBookBusy(true);
    setAddressBookError("");
    try {
      const result = await apiRequest<{ data?: { token?: string } }>("/search/purchaser/address-session", {
        auth: false,
        method: "POST",
        body: {
          purchaserShortId: linkKey.purchaserId,
          phone: addressAuthPhone.trim(),
          code: addressAuthCode.trim(),
          uuid: addressUuid,
          pwd: usePassword ? addressAuthPwd.trim() : undefined,
        },
      });
      const token = String(result.data?.token || "");
      if (!token) throw new Error("未获取到地址访问凭证");
      window.sessionStorage.setItem(addressTokenKey(), token);
      await loadAddresses(token);
    } catch (cause) {
      setAddressBookError(cause instanceof Error ? cause.message : "验证失败，请重试");
      if (!usePassword) await loadAddressCaptcha();
    } finally {
      setAddressBookBusy(false);
    }
  }

  function chooseAddress(item: PurchaserAddressRecord) {
    setForm((current) => ({ ...current, customer: item.receiverName, phone: item.receiverPhone, address: item.address }));
    setSelectedAddressId(item.id);
    setSaveAddress(false);
    setAddressBookOpen(false);
  }

  function openAddressEditor(item?: PurchaserAddressRecord) {
    setAddressBookError("");
    setAddressDraftPasteText("");
    setAddressDraft(item ? {
      id: item.id,
      receiverName: item.receiverName,
      receiverPhone: item.receiverPhone,
      address: item.address,
      isDefault: Number(item.isDefault) === 1,
    } : {
      receiverName: form.customer,
      receiverPhone: form.phone,
      address: form.address,
      isDefault: addresses.length === 0,
    });
    setAddressBookView("edit");
  }

  async function saveAddressRecord() {
    if (!addressDraft.receiverName.trim()) return showPromptToast("请填写收件人");
    if (!/^1\d{10}$/.test(addressDraft.receiverPhone.trim())) return showPromptToast("请填写 11 位手机号");
    if (!addressDraft.address.trim()) return showPromptToast("请填写详细地址");
    setAddressBookBusy(true);
    setAddressBookError("");
    try {
      const isEdit = Boolean(addressDraft.id);
      await apiRequest(`/search/purchaser/address${isEdit ? `/${addressDraft.id}` : ""}`, {
        auth: false,
        method: isEdit ? "PUT" : "POST",
        headers: addressToken ? { "X-Address-Token": addressToken } : {},
        body: {
          purchaserShortId: linkKey.purchaserId,
          receiverName: addressDraft.receiverName.trim(),
          receiverPhone: addressDraft.receiverPhone.trim(),
          address: addressDraft.address.trim(),
          isDefault: addressDraft.isDefault ? 1 : 0,
        },
      });
      await loadAddresses(addressToken);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "地址保存失败";
      if (!(await resetExpiredAddressSession(message))) setAddressBookError(message);
    } finally {
      setAddressBookBusy(false);
    }
  }

  function requestDeleteAddress(item: PurchaserAddressRecord) {
    setAddressDeleteTarget(item);
    setAddressBookError("");
    setAddressBookView("delete");
  }

  async function deleteAddressRecord() {
    if (!addressDeleteTarget) return;
    setAddressBookBusy(true);
    setAddressBookError("");
    try {
      await apiRequest(`/search/purchaser/address/${addressDeleteTarget.id}`, {
        auth: false,
        method: "DELETE",
        query: { purchaserShortId: linkKey.purchaserId },
        headers: addressToken ? { "X-Address-Token": addressToken } : {},
      });
      if (selectedAddressId === addressDeleteTarget.id) setSelectedAddressId(null);
      setAddressDeleteTarget(null);
      await loadAddresses(addressToken);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "地址删除失败";
      if (!(await resetExpiredAddressSession(message))) setAddressBookError(message);
    } finally {
      setAddressBookBusy(false);
    }
  }

  async function parseAddress() {
    if (!pasteText.trim()) return showPromptToast("请先粘贴收件人、手机号和地址");
    setParsing(true); setError("");
    try {
      const result = await apiRequest<{ data?: Row[] }>("/search/addr", { auth: false, query: { addr: pasteText.trim() } });
      const parsed = Array.isArray(result.data) ? result.data[0] : null;
      if (!parsed) throw new Error("没有识别到有效地址，请手动填写");
      const fullAddress = String(parsed.allAddress || [parsed.province, parsed.city, parsed.area, parsed.detail, parsed.address].filter(Boolean).join(""));
      setSelectedAddressId(null);
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

  function jumpToField(field: string) {
    setMissingFields([]);
    const editor: OrderEditor = FIELD_TO_SECTION[field] === "purchaser-section-address" ? "address" : "product";
    setOrderEditor(editor);
    const id = FIELD_TO_INPUT[field] || FIELD_TO_SECTION[field];
    if (!id) return;
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      setErrorFieldId(id);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus({ preventScroll: true });
        const clear = () => setErrorFieldId(null);
        el.addEventListener("input", clear, { once: true });
        el.addEventListener("focus", clear, { once: true });
      } else {
        window.setTimeout(() => setErrorFieldId(null), 1800);
      }
    }, 80);
  }

  async function parseAddressIntoDraft() {
    if (!addressDraftPasteText.trim()) return showPromptToast("请先粘贴收件人、手机号和详细地址");
    setAddressDraftParsing(true);
    setAddressBookError("");
    try {
      const result = await apiRequest<{ data?: Row[] }>("/search/addr", { auth: false, query: { addr: addressDraftPasteText.trim() } });
      const parsed = Array.isArray(result.data) ? result.data[0] : null;
      if (!parsed) throw new Error("没有识别到有效地址，请手动填写");
      const fullAddress = String(parsed.allAddress || [parsed.province, parsed.city, parsed.area, parsed.detail, parsed.address].filter(Boolean).join(""));
      setAddressDraft((current) => ({
        ...current,
        receiverName: String(parsed.name || current.receiverName),
        receiverPhone: String(parsed.mobile || parsed.phone || current.receiverPhone),
        address: fullAddress || current.address,
      }));
    } catch (cause) {
      setAddressBookError(cause instanceof Error ? cause.message : "地址识别失败");
    } finally {
      setAddressDraftParsing(false);
    }
  }

  function requestSubmit(event: FormEvent) {
    event.preventDefault(); setError(""); setErrorFieldId(null); setSuccess(null);
    // 拦截：被 blockOrder 禁止下单时，提交按钮不可用（兜底，正常情况下按钮 disabled 已经阻止了 form 提交）
    if (linkContext?.blockOrder === 1) {
      setError("当前链接已暂停下单服务，请联系店铺或客服");
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
      const body = { ...form, orderNameDesc: form.orderName === "other" ? form.orderNameDesc.trim() : selectedProduct?.label, orderTypeDesc: form.orderType === "other" ? form.orderTypeDesc.trim() : selectedSize?.label, purchaserShortId: linkKey.purchaserId, code: code.trim(), uuid, pwd: requirePwd ? pwd.trim() : undefined, addressId: selectedAddressId || undefined, saveAddress: selectedAddressId ? false : saveAddress };
      const result = await apiRequest<{ data?: Row }>("/search/order", { auth: false, method: "POST", body });
      setSuccess(result.data || {}); setCaptchaOpen(false); setForm((current) => ({ ...EMPTY_FORM, orderName: current.orderName, orderType: current.orderType })); setPasteText(""); setPwd(""); setSelectedAddressId(null); setSaveAddress(true);
      await reloadOrders();
      if (addressToken) await loadAddresses(addressToken);
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
      await reloadOrders();
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
      await reloadOrders();
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
        setCostPriceUnlocked(true);
        setCostAccessPassword(costPwd.trim());
        const expiresAt = Date.now() + 30 * 60 * 1000;
        setCostAccessExpiresAt(expiresAt);
        try { window.sessionStorage.setItem(`${COST_ACCESS_STORAGE_PREFIX}${linkKey.purchaserId}`, JSON.stringify({ password: costPwd.trim(), expiresAt })); } catch { /* 当前浏览器不支持会话存储时仍可在本页使用 */ }
        setCostPwd(""); setCostPwdError("");
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
    setCostAccessPassword("");
    setCostAccessExpiresAt(0);
    try { window.sessionStorage.removeItem(`${COST_ACCESS_STORAGE_PREFIX}${linkKey.purchaserId}`); } catch { /* ignore storage errors */ }
    // 重新拉一次不带密码的订单，把成本价字段从内存里去掉
    void loadOrders(linkKey.purchaserId);
  }

  useEffect(() => {
    if (!costPriceUnlocked || !costAccessExpiresAt) return;
    const delay = Math.max(0, costAccessExpiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setCostPriceUnlocked(false);
      setCostAccessPassword("");
      setCostAccessExpiresAt(0);
      try { window.sessionStorage.removeItem(`${COST_ACCESS_STORAGE_PREFIX}${linkKey.purchaserId}`); } catch { /* ignore storage errors */ }
      void loadOrders(linkKey.purchaserId);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [costPriceUnlocked, costAccessExpiresAt, linkKey.purchaserId, loadOrders]);

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
        <h1>专属链接已暂停服务</h1>
        <p>下单和订单查询功能暂时关闭，请联系店铺或客服了解恢复时间。</p>
        <small>店铺：{linkContext.storeName}，专属 ID {linkContext.purchaserShortId}</small>
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

  return <div className={`tool-page purchaser-order-page purchaser-page-${tab}`}>
    {promptToast ? <div className="purchaser-prompt-toast" role="status" aria-live="polite"><AlertCircle size={15} /><span>{promptToast.message}</span></div> : null}
    {tab === "home" ? (
      <section className="purchaser-home" aria-label="专属下单首页">
        <header className="purchaser-home-brand">
          <span><PackageCheck size={19} /></span>
          <div><b>{linkContext.storeName || "喜八鲜果店"}</b><small>{linkContext.purchaserName}的专属入口</small></div>
          <button type="button" onClick={() => setHelpOpen(true)} aria-label="查看下单说明"><CircleHelp size={19} /></button>
        </header>

        <section className="purchaser-home-hero">
          <div>
            <h1>您好，{linkContext.purchaserName}</h1>
            <p>下单、查物流，都从这里开始。</p>
            <div className="purchaser-home-meta">
              <small>专属 ID {linkContext.purchaserShortId}</small>
              {linkContext.storeNotice ? <small>{linkContext.storeNotice}</small> : null}
            </div>
          </div>
          <span className="purchaser-home-visual" aria-hidden="true"><PackageCheck size={34} /></span>
        </section>

        <section className="purchaser-home-actions" aria-label="主要功能">
          <button type="button" className="primary" disabled={blockOrderOn && blockDisplay !== "confirm"} onClick={() => setTab("create")}>
            <span><ShoppingBag size={20} /><b>{blockOrderOn ? "下单已暂停" : "立即下单"}</b><small>选择商品和收货地址</small></span>
            <ChevronRight size={19} />
          </button>
          <button type="button" disabled={blockQueryOn && blockDisplay !== "confirm"} onClick={() => setTab("orders")}>
            <span><PackageSearch size={20} /><b>{blockQueryOn ? "查单已暂停" : "查询订单"}</b><small>查看状态与物流</small></span>
            <ChevronRight size={19} />
          </button>
        </section>

        {showBannerTab ? <div className="purchaser-block-tab" role="status" aria-live="polite">
          <div><Ban size={15} /><b>{bannerTabText.title}</b><em>{bannerTabText.sub}</em></div>
        </div> : null}

        {!blockQueryOn ? <section className="purchaser-home-overview" aria-label="订单概况">
          <header><h2>订单概况</h2><button type="button" onClick={() => setTab("orders")}>全部订单<ChevronRight size={15} /></button></header>
          <div>
            <button type="button" onClick={() => applyFilter("pending")}><b>{stats.pending}</b><small>待发货</small></button>
            <button type="button" onClick={() => applyFilter("shipped")}><b>{stats.shipped}</b><small>运输中</small></button>
            <button type="button" onClick={() => applyFilter("done")}><b>{stats.done}</b><small>已完成</small></button>
          </div>
        </section> : null}

        {!blockQueryOn && latestOrder ? <button type="button" className="purchaser-home-recent" onClick={() => { setStatusFilter(null); setTab("orders"); }}>
          <span><small>最近订单</small><b>{String(latestOrder.orderNameDesc || "未命名商品")}</b><em>{String(latestOrder.orderTypeDesc || "")} × {Number(latestOrder.orderNum || 1)}</em></span>
          <span><strong>{String(latestOrder.orderStatusDesc || latestOrder.orderStatus || "处理中")}</strong><small>{String(latestOrder.orderTime || "").replace("T", " ").slice(0, 16)}</small><ChevronRight size={17} /></span>
        </button> : null}

      </section>
    ) : (
      <>
        <header className="purchaser-subpage-head">
          <button type="button" onClick={() => setTab("home")} aria-label="返回首页"><ArrowLeft size={19} /></button>
          <div><h1>{tab === "create" ? "选购鲜果" : "我的订单"}</h1><p>{tab === "create" ? "今日可下单商品" : "查询状态与物流进度"}</p></div>
          {tab === "create" ? <span className="purchaser-head-count">已选 <b>{form.orderName ? form.orderNum : 0}</b> 件</span> : <span><PackageSearch size={20} /></span>}
        </header>
        {tab === "create" ? <>
          <section className="purchaser-order-page-title"><h1>今天想吃点什么？</h1><p>选好商品，再确认收货信息。</p></section>
          {linkContext.storeNotice ? <section className="purchaser-order-notice-card"><Megaphone size={17} /><span><b>{linkContext.storeName || "店铺"} 温馨提示您：</b><small>{linkContext.storeNotice}</small></span></section> : null}
        </> : null}
        {tab === "orders" && !anyBlocked ? <section className="purchaser-orders-page-title"><h1>查订单</h1><p>按订单号、收件人或状态查看物流进度。</p></section> : null}
        {showBannerTab ? <div className="purchaser-block-tab" role="status" aria-live="polite">
          <div><Ban size={15} /><b>{bannerTabText.title}</b><em>{bannerTabText.sub}</em></div>
        </div> : null}
      </>
    )}

    {tab !== "home" ? ((showBannerTab && bothBlocked) ? <section className="purchaser-fullscreen-block">
      <Ban size={42} />
      <h1>专属链接已暂停服务</h1>
      <p>下单和订单查询功能暂时关闭，请联系店铺或客服了解恢复时间。</p>
      <small>店铺：{linkContext.storeName}，专属 ID {linkContext.purchaserShortId}</small>
    </section> : currentTabFullscreenBlocked ? (
      tab === "create" ? <section className="purchaser-fullscreen-block">
        <Ban size={42} />
        <h1>下单通道暂时关闭</h1>
        <p>当前无法提交新订单，请联系店铺或客服了解恢复时间。</p>
      </section> : <section className="purchaser-fullscreen-block">
        <Ban size={42} />
        <h1>订单查询暂时关闭</h1>
        <p>历史订单暂时无法查看，但不影响下单。如需订单详情，请联系店铺或客服。</p>
      </section>
    ) : tab === "create" ? (
      <>
        {success ? null : null}
        <form className="purchaser-order-form purchaser-design-order-form" onSubmit={requestSubmit}>
          <section id="purchaser-section-product" className="purchaser-design-product-list" aria-label="商品选择">
            <article className={`purchaser-design-product-card${selectedProductLabel ? " active" : ""}`}>
              <button type="button" className="purchaser-design-summary-head" onClick={() => setOrderEditor("product")}>
                <span className="purchaser-design-summary-icon"><PackageCheck size={20} /></span>
                <span className="purchaser-design-summary-copy">
                  <b>{selectedProductLabel || "商品规格"}</b>
                  <small>{selectedProductLabel && selectedSizeLabel ? `${selectedSizeLabel}，${form.orderNum} 件` : "点击选择商品、规格和数量"}</small>
                </span>
                <em>{selectedProductLabel ? "修改" : "选择"}</em>
                <ChevronRight size={15} />
              </button>
            </article>
          </section>

          <section id="purchaser-section-address" className={`purchaser-design-address-card${form.customer ? " active" : ""}`}>
            <button type="button" className="purchaser-design-summary-head" onClick={() => setOrderEditor("address")}>
              <span className="purchaser-design-summary-icon"><MapPin size={20} /></span>
              <span className="purchaser-design-summary-copy"><b>{form.customer ? `${form.customer}  ${form.phone}` : "收货地址"}</b><small>{form.address || "选择常用地址或填写新地址"}</small></span>
              <em>{form.customer ? "修改" : "填写"}</em>
              <ChevronRight size={15} />
            </button>
          </section>

          <section id="purchaser-section-delivery" className={`purchaser-design-delivery-card${form.expCom || form.orderDesc.trim() ? " active" : ""}`}>
            <button type="button" className="purchaser-design-summary-head" onClick={() => setOrderEditor("delivery")}>
              <span className="purchaser-design-summary-icon"><Truck size={20} /></span>
              <span className="purchaser-design-summary-copy">
                <b>快递与备注</b>
                <small>{selectedCourierLabel}{form.orderDesc.trim() ? `，${form.orderDesc.trim()}` : "，可添加订单备注"}</small>
              </span>
              <em>{form.expCom || form.orderDesc.trim() ? "修改" : "填写"}</em>
              <ChevronRight size={15} />
            </button>
          </section>

          {error && !captchaOpen ? <p className="tool-error purchaser-order-error">{error}</p> : null}
          <section className="purchaser-design-checkout">
            <span><small>本次下单</small><b>{selectedProductLabel ? `${selectedProductLabel} × ${form.orderNum}` : "请选择商品"}</b></span>
            <button className="purchaser-submit" type="submit" disabled={submitDisabled}>{blockOrderOn ? "已暂停下单" : "确认下单"}</button>
          </section>
          <p className="purchaser-submit-tip"><ShieldCheck size={13} />核对订单后完成验证即可提交</p>
        </form>
      </>
    ) : (blockDisplay === "confirm" && blockQueryOn) ? null : <section id="purchaser-history-section" className="purchaser-history-section">
      {/* 成本价密码：店铺开启"允许查看成本价"才显示 */}
      {Number(linkContext.viewCostPrice) === 1 && !costPriceUnlocked ? <details className="purchaser-secondary-tools purchaser-cost-disclosure">
        <summary>
          <span><LockKeyhole size={17} /><span><b>成本价权限</b><small>输入店铺提供的密码后查看</small></span></span>
          <ChevronRight size={17} />
        </summary>
        <section className="purchaser-cost-pwd">
          <div><LockKeyhole size={15} /><div><small>查看成本价</small><b>解锁后可查看商品、包装、快递和总成本</b></div></div>
          <div className="purchaser-cost-pwd-row">
            <input inputMode="numeric" maxLength={6} value={costPwd} onChange={(event) => { setCostPwd(event.target.value.replace(/\D/g, "")); setCostPwdError(""); }} placeholder="4-6 位数字密码" />
            <button type="button" disabled={costPwdBusy} onClick={submitCostPwd}>{costPwdBusy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}解锁</button>
          </div>
          {costPwdError ? <p className="tool-error"><AlertCircle size={13} />{costPwdError}</p> : null}
          {linkContext.costPricePwdExpire ? <small className="purchaser-cost-pwd-hint"><ShieldCheck size={11} />密码有效至 {String(linkContext.costPricePwdExpire).slice(0, 16)}</small> : null}
        </section>
      </details> : null}
      {Number(linkContext.viewCostPrice) === 1 && costPriceUnlocked ? <section className="purchaser-cost-unlocked">
        <div className="purchaser-cost-unlocked-main"><span className="purchaser-cost-unlocked-icon"><Wallet size={17} /></span><span><b>成本价已解锁</b><small>商品、包装、快递和总成本 · 本次有效 30 分钟</small></span></div>
        <button type="button" onClick={lockCostPrice}><Lock size={13} />立即锁定</button>
      </section> : null}
      <OrderList orders={filteredOrders} contact={linkContext.purchaserPhone} onEdit={openEdit} onDelete={requestDelete} onView={setViewingOrder} onRefresh={reloadOrders} collapseExtras enableCostSelection={costPriceUnlocked} />
    </section>) : null}

    <nav className="purchaser-bottom-nav" aria-label="专属下单导航">
      <button type="button" className={tab === "home" ? "active" : ""} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><House size={18} /><span>首页</span></button>
      <button type="button" className={tab === "create" ? "active" : ""} aria-current={tab === "create" ? "page" : undefined} disabled={blockOrderOn && blockDisplay !== "confirm"} onClick={() => setTab("create")}><ShoppingBag size={18} /><span>下单</span></button>
      <button type="button" className={tab === "orders" ? "active" : ""} aria-current={tab === "orders" ? "page" : undefined} disabled={blockQueryOn && blockDisplay !== "confirm"} onClick={() => setTab("orders")}><PackageSearch size={18} /><span>订单</span></button>
    </nav>

    {orderEditor ? <div className="purchaser-order-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOrderEditor(null)}>
      <section className={`purchaser-order-editor-modal purchaser-sheet purchaser-order-editor-${orderEditor}`} role="dialog" aria-modal="true" aria-labelledby="purchaser-order-editor-title">
        <button className="purchaser-captcha-close" type="button" onClick={() => setOrderEditor(null)} aria-label="关闭"><X size={19} /></button>
        <small>填写订单</small>
        <h2 id="purchaser-order-editor-title">{orderEditor === "product" ? "选择商品信息" : orderEditor === "address" ? "填写收货信息" : "配送与订单备注"}</h2>
        <p>{orderEditor === "product" ? "选择商品、规格和本次购买数量。" : orderEditor === "address" ? "可以使用常用地址，也可以粘贴后智能识别。" : "指定快递为选填项，备注会同步给店铺。"}</p>
        {orderEditor === "product" ? <div className="purchaser-popup-form">
          <label><span>商品</span><div className="purchaser-choice-grid purchaser-product-grid">{products.map((item) => <button type="button" className={`purchaser-product-option${form.orderName === item.value ? " active" : ""}`} key={item.value} onClick={() => setField("orderName", item.value)}><span><PackageCheck size={17} /></span><b>{item.label}</b>{form.orderName === item.value ? <CheckCircle2 size={15} /> : <ChevronRight size={15} />}</button>)}</div></label>
          {form.orderName === "other" ? <label><span>商品名称</span><input id="purchaser-custom-name" value={form.orderNameDesc} onChange={(event) => setField("orderNameDesc", event.target.value)} placeholder="请输入商品名称" /></label> : null}
          <label><span>规格</span><div className="purchaser-choice-grid compact">{sizes.map((item) => <button type="button" className={form.orderType === item.value ? "active" : ""} key={item.value} onClick={() => setField("orderType", item.value)}>{item.label}</button>)}</div></label>
          {form.orderType === "other" ? <label><span>规格名称</span><input id="purchaser-custom-spec" value={form.orderTypeDesc} onChange={(event) => setField("orderTypeDesc", event.target.value)} placeholder="请输入规格" /></label> : null}
          <div className="purchaser-quantity"><span><b>购买数量</b><small>每次最多 99 件</small></span><div><button type="button" onClick={() => setField("orderNum", Math.max(1, form.orderNum - 1))} aria-label="减少数量"><Minus size={16} /></button><b>{form.orderNum}</b><button type="button" onClick={() => setField("orderNum", Math.min(99, form.orderNum + 1))} aria-label="增加数量"><Plus size={16} /></button></div></div>
        </div> : orderEditor === "address" ? <div className="purchaser-popup-form">
          <button type="button" className="purchaser-address-book-trigger" onClick={openAddressBook}>
            <span><BookUser size={18} /></span>
            <span><b>{selectedAddressId ? "已选择常用地址" : "常用地址"}</b><small>{selectedAddressId ? "可重新选择或维护地址" : "选择、添加或管理收货地址"}</small></span>
            <ChevronRight size={17} />
          </button>
          <label><span>粘贴收货信息</span><div className="purchaser-paste"><textarea rows={3} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="例如：张三 13800138000 上海市青浦区……" aria-label="粘贴收货信息" /><button type="button" disabled={parsing} onClick={parseAddress}>{parsing ? <LoaderCircle className="spin" size={16} /> : <ScanText size={16} />}智能识别</button></div></label>
          <label><span>收件人</span><input id="purchaser-customer" value={form.customer} onChange={(event) => setManualAddressField("customer", event.target.value)} placeholder="请输入收件人姓名" /></label>
          <label><span>手机号</span><input id="purchaser-phone" inputMode="tel" maxLength={11} value={form.phone} onChange={(event) => setManualAddressField("phone", event.target.value.replace(/\D/g, ""))} placeholder="请输入 11 位手机号" /></label>
          <label><span>详细地址</span><textarea id="purchaser-address" rows={3} value={form.address} onChange={(event) => setManualAddressField("address", event.target.value)} placeholder="省市区 + 街道门牌号" /></label>
          <label className={`purchaser-save-address${selectedAddressId ? " selected" : ""}`}>
            <input type="checkbox" checked={selectedAddressId ? true : saveAddress} disabled={Boolean(selectedAddressId)} onChange={(event) => setSaveAddress(event.target.checked)} />
            <span><b>{selectedAddressId ? "已使用常用地址" : "保存为常用地址"}</b><small>{selectedAddressId ? "本次下单会更新最近使用时间" : "下单成功后保存，下次直接选择"}</small></span>
          </label>
        </div> : <div className="purchaser-popup-form">
          <label><span>指定快递</span><div className="purchaser-choice-grid four-cols"><button type="button" className={form.expCom === "" ? "active" : ""} onClick={() => setField("expCom", "")}>暂不选择</button>{couriers.map((item) => <button type="button" className={form.expCom === item.value ? "active" : ""} key={item.value} onClick={() => setField("expCom", item.value)}>{item.icon ? <img src={item.icon} alt="" loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}{item.label}</button>)}</div></label>
          <label><span>订单备注</span><textarea rows={4} value={form.orderDesc} onChange={(event) => setField("orderDesc", event.target.value)} placeholder="选填，如：送货前电话联系" /></label>
        </div>}
        <button className="purchaser-captcha-submit" type="button" onClick={() => setOrderEditor(null)}><CheckCircle2 size={18} />保存并返回</button>
      </section>
    </div> : null}

    {addressBookOpen ? <div className="purchaser-address-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAddressBookOpen(false)}>
      <section className="purchaser-address-modal purchaser-sheet" role="dialog" aria-modal="true" aria-labelledby="purchaser-address-title">
        <button className="purchaser-captcha-close" type="button" onClick={() => setAddressBookOpen(false)} aria-label="关闭"><X size={19} /></button>
        <small>常用地址</small>
        <h2 id="purchaser-address-title">{addressBookView === "auth" ? "先验证本人身份" : addressBookView === "edit" ? (addressDraft.id ? "编辑收货地址" : "新增收货地址") : addressBookView === "delete" ? "确认删除地址" : "选择收货地址"}</h2>
        {addressBookView === "auth" ? <>
          <p>地址属于隐私信息，验证通过后 30 分钟内无需重复验证。</p>
          <div className="purchaser-address-auth">
            {Number(linkContext?.requirePwd) === 1 ? <label><span>专属下单码</span><input autoFocus inputMode="numeric" maxLength={6} value={addressAuthPwd} onChange={(event) => { setAddressAuthPwd(event.target.value.replace(/\D/g, "")); setAddressBookError(""); }} placeholder="输入 4-6 位下单码" /></label> : <>
              <label><span>绑定手机号</span><input autoFocus inputMode="tel" maxLength={11} value={addressAuthPhone} onChange={(event) => { setAddressAuthPhone(event.target.value.replace(/\D/g, "")); setAddressBookError(""); }} placeholder="输入完整手机号" /></label>
              <label><span>图形验证码</span><div className="purchaser-address-captcha"><button type="button" onClick={loadAddressCaptcha} aria-label="刷新图形验证码" title="点击刷新验证码">{addressCaptcha ? <img src={addressCaptcha} alt="图形验证码" /> : <RefreshCw size={19} />}</button><input inputMode="text" autoComplete="off" value={addressAuthCode} onChange={(event) => { setAddressAuthCode(event.target.value); setAddressBookError(""); }} placeholder="输入验证码" aria-label="输入图形验证码" /></div></label>
            </>}
          </div>
          {addressBookError ? <p className="tool-error purchaser-address-error"><AlertCircle size={14} />{addressBookError}</p> : null}
          <button className="purchaser-captcha-submit" type="button" disabled={addressBookBusy} onClick={submitAddressAuth}>{addressBookBusy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}{addressBookBusy ? "正在验证" : "验证并查看地址"}</button>
        </> : addressBookView === "list" ? <>
          <div className="purchaser-address-list-head"><p>{addresses.length ? `已保存 ${addresses.length} 个地址` : "还没有保存的地址"}</p><button type="button" onClick={() => openAddressEditor()}><Plus size={15} />新增地址</button></div>
          {addressBookBusy ? <div className="purchaser-address-loading"><LoaderCircle className="spin" size={22} />正在读取地址</div> : addresses.length ? <div className="purchaser-address-list">
            {addresses.map((item) => <article key={item.id} className={selectedAddressId === item.id ? "selected" : ""}>
              <button type="button" className="purchaser-address-select" onClick={() => chooseAddress(item)}>
                <span className="purchaser-address-pin"><MapPin size={17} /></span>
                <span><b>{item.receiverName}<em>{item.receiverPhone}</em>{Number(item.isDefault) === 1 ? <i><Star size={11} />默认</i> : null}</b><small>{item.address}</small></span>
                <ChevronRight size={17} />
              </button>
              <div><small>{item.useCount ? `已使用 ${item.useCount} 次` : "尚未使用"}</small><span><button type="button" onClick={() => openAddressEditor(item)} aria-label={`编辑 ${item.receiverName} 的地址`}><Pencil size={14} /></button><button type="button" onClick={() => requestDeleteAddress(item)} aria-label={`删除 ${item.receiverName} 的地址`}><Trash2 size={14} /></button></span></div>
            </article>)}
          </div> : <div className="purchaser-address-empty"><BookUser size={30} /><b>新增第一个常用地址</b><p>保存后，下次下单可以直接选择，不用重复填写。</p><button type="button" onClick={() => openAddressEditor()}><Plus size={15} />新增地址</button></div>}
          {addressBookError ? <p className="tool-error purchaser-address-error"><AlertCircle size={14} />{addressBookError}</p> : null}
        </> : addressBookView === "edit" ? <>
          <p>可以先粘贴完整收货信息自动识别，也可以直接填写。</p>
          <div className="purchaser-address-editor">
            <label className="purchaser-address-recognizer">
              <span>粘贴收货信息</span>
              <div className="purchaser-paste">
                <textarea rows={3} value={addressDraftPasteText} onChange={(event) => { setAddressDraftPasteText(event.target.value); setAddressBookError(""); }} placeholder="例如：张三 13800138000 上海市青浦区……" />
                <button type="button" disabled={addressDraftParsing} onClick={parseAddressIntoDraft}>{addressDraftParsing ? <LoaderCircle className="spin" size={15} /> : <ScanText size={15} />}{addressDraftParsing ? "正在识别" : "智能识别"}</button>
              </div>
            </label>
            <label><span>收件人</span><input autoFocus value={addressDraft.receiverName} onChange={(event) => { setAddressDraft((current) => ({ ...current, receiverName: event.target.value })); setAddressBookError(""); }} placeholder="请输入收件人姓名" /></label>
            <label><span>手机号</span><input inputMode="tel" maxLength={11} value={addressDraft.receiverPhone} onChange={(event) => { setAddressDraft((current) => ({ ...current, receiverPhone: event.target.value.replace(/\D/g, "") })); setAddressBookError(""); }} placeholder="请输入 11 位手机号" /></label>
            <label><span>详细地址</span><textarea rows={3} value={addressDraft.address} onChange={(event) => { setAddressDraft((current) => ({ ...current, address: event.target.value })); setAddressBookError(""); }} placeholder="省市区 + 街道门牌号" /></label>
            <label className="purchaser-address-default"><input type="checkbox" checked={addressDraft.isDefault} onChange={(event) => setAddressDraft((current) => ({ ...current, isDefault: event.target.checked }))} /><span><Star size={15} />设为默认地址</span></label>
          </div>
          {addressBookError ? <p className="tool-error purchaser-address-error"><AlertCircle size={14} />{addressBookError}</p> : null}
          <div className="purchaser-address-actions"><button type="button" onClick={() => setAddressBookView("list")}>返回列表</button><button type="button" disabled={addressBookBusy} onClick={saveAddressRecord}>{addressBookBusy ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}{addressBookBusy ? "正在保存" : "保存地址"}</button></div>
        </> : <>
          <div className="purchaser-address-delete-card"><span><Trash2 size={20} /></span><div><b>{addressDeleteTarget?.receiverName} {addressDeleteTarget?.receiverPhone}</b><p>{addressDeleteTarget?.address}</p></div></div>
          <p>删除后无法恢复，但不会影响已经创建的历史订单。</p>
          {addressBookError ? <p className="tool-error purchaser-address-error"><AlertCircle size={14} />{addressBookError}</p> : null}
          <div className="purchaser-address-actions danger"><button type="button" onClick={() => setAddressBookView("list")}>暂不删除</button><button type="button" disabled={addressBookBusy} onClick={deleteAddressRecord}>{addressBookBusy ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}{addressBookBusy ? "正在删除" : "确认删除"}</button></div>
        </>}
      </section>
    </div> : null}

    {captchaOpen ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCaptchaOpen(false)}><section className="purchaser-captcha-modal purchaser-sheet"><button className="purchaser-captcha-close" type="button" onClick={() => setCaptchaOpen(false)}><X size={19} /></button><small>{Number(linkContext?.requirePwd) === 1 ? "下单验证" : "提交确认"}</small><h2>{Number(linkContext?.requirePwd) === 1 ? "请输入下单码" : "核对本次订单"}</h2><p>{Number(linkContext?.requirePwd) === 1 ? "下单码由店铺提供，微信付款后向店家索取。" : "确认商品和收货信息后，完成验证即可提交。"}</p><div className="purchaser-captcha-summary">
        <div><span>商品</span><b>{form.orderName === "other" ? form.orderNameDesc : selectedProduct?.label || "--"}</b></div>
        <div><span>规格</span><b>{form.orderType === "other" ? form.orderTypeDesc : selectedSize?.label || "--"}</b></div>
        <div><span>数量</span><b>{form.orderNum} 件</b></div>
        <div><span>收件人</span><b>{form.customer || "--"}</b></div>
        <div><span>手机号</span><b>{form.phone || "--"}</b></div>
        <div><span>收货地址</span><b>{form.address || "--"}</b></div>
        <div><span>指定快递</span><b>{form.expCom ? (couriers.find((item) => item.value === form.expCom)?.label || form.expCom) : "暂不选择"}</b></div>
        {form.orderDesc ? <div><span>备注</span><b>{form.orderDesc}</b></div> : null}
      </div>{Number(linkContext?.requirePwd) === 1 ? <div className="purchaser-captcha-row purchaser-captcha-pwd-row"><input className="purchaser-captcha-pwd" autoFocus inputMode="numeric" maxLength={6} value={pwd} onChange={(event) => setPwd(event.target.value.replace(/\D/g, ""))} placeholder="输入 4-6 位下单码" /></div> : <div className="purchaser-captcha-row"><button className="purchaser-captcha-image" type="button" onClick={loadCaptcha}>{captcha ? <img src={captcha} alt="验证码" /> : <RefreshCw size={20} />}</button><input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入图中验证码" /></div>}{error ? <p className="tool-error">{error}</p> : null}<button className="purchaser-captcha-submit" type="button" disabled={submitting} onClick={submitOrder}>{submitting ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{submitting ? "正在创建订单" : (Number(linkContext?.requirePwd) === 1 ? "输入下单码并提交" : "验证并提交订单")}</button></section></div> : null}
    {success ? <div className="purchaser-success-backdrop" onMouseDown={(event) => event.target === event.currentTarget && continueOrdering()}><section className="purchaser-success-modal purchaser-sheet" role="alertdialog" aria-modal="true">
      <button className="purchaser-success-close" type="button" onClick={continueOrdering} aria-label="关闭"><X size={18} /></button>
      <div className="purchaser-success-icon"><CheckCircle2 size={36} /></div>
      <small>订单已创建</small>
      <h2>下单成功</h2>
      <p className="purchaser-success-thanks">已提交 <span className="purchaser-success-product">{String(success.orderNameDesc || selectedProduct?.label || "您的商品")}</span></p>
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
    {helpOpen ? <div className="purchaser-help-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHelpOpen(false)}><section className="purchaser-help-modal purchaser-sheet">
      <button className="purchaser-help-close" type="button" onClick={() => setHelpOpen(false)} aria-label="关闭"><X size={19} /></button>
      <small>下单帮助</small>
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
    {missingFields.length > 0 ? <div className="purchaser-missing-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMissingFields([])}><section className="purchaser-missing-modal purchaser-sheet" role="alertdialog" aria-modal="true">
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
    {editingOrder ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeEdit()}><section className="purchaser-captcha-modal purchaser-edit-modal purchaser-sheet">
      <button className="purchaser-captcha-close" type="button" onClick={closeEdit} aria-label="关闭"><X size={19} /></button>
      <small>编辑订单</small>
      <h2>修改订单</h2>
      <p>仅待处理订单可修改，修改后店铺会收到最新信息。</p>
      <div className="purchaser-captcha-summary">
        <div><span>订单号</span><b>{editingOrder.orderCode || "--"}</b></div>
        <div><span>当前状态</span><b>{editingOrder.orderStatusDesc || editingOrder.orderStatus || "待处理"}</b></div>
      </div>
      <form onSubmit={requestEditSubmit} className="purchaser-edit-form">
        <section><header><span>1</span><div><h3>商品</h3></div></header><div className="purchaser-choice-grid">{products.map((item) => <button type="button" className={editForm.orderName === item.value ? "active" : ""} key={item.value} onClick={() => setEditField("orderName", item.value)}>{item.label}</button>)}</div>{editForm.orderName === "other" ? <input value={editForm.orderNameDesc} onChange={(event) => setEditField("orderNameDesc", event.target.value)} placeholder="请输入商品名称" /> : null}<div className="purchaser-choice-grid compact">{sizes.map((item) => <button type="button" className={editForm.orderType === item.value ? "active" : ""} key={item.value} onClick={() => setEditField("orderType", item.value)}>{item.label}</button>)}</div>{editForm.orderType === "other" ? <input value={editForm.orderTypeDesc} onChange={(event) => setEditField("orderTypeDesc", event.target.value)} placeholder="请输入规格" /> : null}<div className="purchaser-quantity purchaser-quantity-locked"><span>购买数量</span><div><b>{editForm.orderNum}</b><small>件，修改时不可调整</small></div></div></section>
        <section><header><span>2</span><div><h3>收货信息</h3></div></header><label><span><User size={15} />收件人</span><input value={editForm.customer} onChange={(event) => setEditField("customer", event.target.value)} placeholder="请输入收件人姓名" /></label><label><span><Truck size={15} />手机号</span><input inputMode="tel" maxLength={11} value={editForm.phone} onChange={(event) => setEditField("phone", event.target.value.replace(/\D/g, ""))} placeholder="请输入11位手机号" /></label><label><span><MapPin size={15} />详细地址</span><textarea rows={3} value={editForm.address} onChange={(event) => setEditField("address", event.target.value)} placeholder="省市区 + 街道门牌号" /></label><label><span><Truck size={15} />指定快递</span><div className="purchaser-choice-grid four-cols"><button type="button" className={editForm.expCom === "" ? "active" : ""} onClick={() => setEditField("expCom", "")}>暂不选择</button>{couriers.map((item) => <button type="button" className={editForm.expCom === item.value ? "active" : ""} key={item.value} onClick={() => setEditField("expCom", item.value)}>{item.icon ? <img src={item.icon} alt="" loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}{item.label}</button>)}</div></label></section>
        <section><header><span>3</span><div><h3>订单备注</h3></div></header><textarea rows={3} value={editForm.orderDesc} onChange={(event) => setEditField("orderDesc", event.target.value)} placeholder="如：送货前电话联系" /></section>
        {missingFields.length > 0 ? <p className="tool-error">请补全 {missingFields.length} 项必填信息</p> : null}
        {error ? <p className="tool-error">{error}</p> : null}
        <button className="purchaser-captcha-submit" type="submit" disabled={editSubmitting}><Edit3 size={18} />保存修改</button>
      </form>
    </section></div> : null}
    {viewingOrder ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setViewingOrder(null)}><section className="purchaser-captcha-modal purchaser-detail-modal purchaser-sheet">
      <button className="purchaser-captcha-close" type="button" onClick={() => setViewingOrder(null)} aria-label="关闭"><X size={19} /></button>
      <small>订单详情</small>
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
        </div>
      </div> : null}
    </section></div> : null}
    {confirmingEdit ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !editSubmitting && setConfirmingEdit(false)}><section className="purchaser-captcha-modal purchaser-sheet">
      <button className="purchaser-captcha-close" type="button" onClick={() => setConfirmingEdit(false)} disabled={editSubmitting} aria-label="关闭"><X size={19} /></button>
      <div className="purchaser-success-icon"><ShieldCheck size={36} /></div>
      <small>确认修改</small>
      <h2>确认修改订单？</h2>
      <p>订单 <b>{editingOrder?.orderCode || "--"}</b> 将按最新信息保存，店铺会同步收到变更。</p>
      <div className="purchaser-success-actions">
        <button type="button" className="purchaser-success-secondary" onClick={() => setConfirmingEdit(false)} disabled={editSubmitting}>再检查一下</button>
        <button type="button" className="purchaser-success-primary" onClick={submitEdit} disabled={editSubmitting}>{editSubmitting ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}{editSubmitting ? "正在保存" : "确认修改"}</button>
      </div>
    </section></div> : null}
    {confirmingDelete ? <div className="purchaser-captcha-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleteSubmitting && setConfirmingDelete(null)}><section className="purchaser-captcha-modal purchaser-sheet">
      <button className="purchaser-captcha-close" type="button" onClick={() => setConfirmingDelete(null)} disabled={deleteSubmitting} aria-label="关闭"><X size={19} /></button>
      <div className="purchaser-missing-icon"><AlertCircle size={28} /></div>
      <small>删除订单</small>
      <h2>确认删除订单？</h2>
      <p>订单 <b>{confirmingDelete.orderCode || "--"}</b> 删除后将从您的列表移除，店铺会保留记录以便核对，无法恢复。</p>
      <div className="purchaser-success-actions">
        <button type="button" className="purchaser-success-secondary" onClick={() => setConfirmingDelete(null)} disabled={deleteSubmitting}>取消</button>
        <button type="button" className="purchaser-missing-close" onClick={submitDelete} disabled={deleteSubmitting}>{deleteSubmitting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}{deleteSubmitting ? "正在删除" : "确认删除"}</button>
      </div>
    </section></div> : null}
    {blockConfirm ? <div className="purchaser-create-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setBlockConfirm(null)}><section className="purchaser-create-modal purchaser-confirm-modal purchaser-sheet">
      <span className="danger"><AlertCircle size={22} /></span>
      <small>链接提示</small>
      <h2>专属链接已设置访问限制</h2>
      {blockConfirm.orders ? <p>当前链接的下单功能已暂停。</p> : null}
      {blockConfirm.query ? <p>当前链接的订单查询已暂停。</p> : null}
      <button type="button" className="purchaser-create-action primary" onClick={() => setBlockConfirm(null)}>我知道了</button>
    </section></div> : null}
  </div>;
}
