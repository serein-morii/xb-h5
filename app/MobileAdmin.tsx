import {
  ArrowLeft,
  BadgeDollarSign,
  Box,
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  House,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCw,
  Search,
  SearchCheck,
  Send,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  Truck,
  Upload,
  User,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  apiRequest,
  clearStoredToken,
  downloadFile,
  getStoredToken,
  setStoredToken,
  uploadFile,
} from "./lib/api";
import AdminOrderEntry from "./AdminOrderEntry";
import OrderLinkGenerator from "./tools/order-link/OrderLinkGenerator";
import PurchaserManager from "./tools/purchasers/PurchaserManager";
import { buildOrderLink, formatOrderLinkCopy } from "./tools/order-link/format";

type DataRow = Record<string, any>;
type MenuKey = "home" | "orders" | "orderEntry" | "bills" | "express" | "prices" | "stores" | "orderLink" | "purchasers" | "tracking";
type ToastState = { message: string; type: "success" | "error" | "info" } | null;
type DictOption = { value: string; label: string };
type Dictionaries = {
  products: DictOption[];
  sizes: DictOption[];
  yesNo: DictOption[];
  expressCompanies: DictOption[];
  provinces: DictOption[];
  platforms: DictOption[];
  orderStatuses: DictOption[];
};

const EMPTY_DICTIONARIES: Dictionaries = {
  products: [], sizes: [], yesNo: [], expressCompanies: [], provinces: [], platforms: [], orderStatuses: [],
};
const DICTIONARY_TYPES: Record<keyof Dictionaries, string> = {
  products: "sys_order_name",
  sizes: "sys_order_type",
  yesNo: "sys_is_not",
  expressCompanies: "sys_exp_com",
  provinces: "sys_area_province",
  platforms: "sys_platform_type",
  orderStatuses: "sys_order_status",
};
const DictionaryContext = createContext<Dictionaries>(EMPTY_DICTIONARIES);
const EXPRESS_STATUS_OPTIONS = [
  { value: "DFH", label: "待发货" },
  { value: "YFH", label: "已发货" },
  { value: "YSJ", label: "已收寄" },
  { value: "YSZ", label: "运输中" },
  { value: "YSD", label: "已送达" },
  { value: "YWC", label: "已完成" },
];
const STORE_STATUS_OPTIONS = [
  { value: 1, label: "开业中" },
  { value: 2, label: "已关闭" },
];

async function fetchDictionaries(): Promise<Dictionaries> {
  const entries = await Promise.all(Object.entries(DICTIONARY_TYPES).map(async ([key, type]) => {
    const result = await apiRequest<DataRow>(`/system/dict/data/type/${type}`);
    const options = Array.isArray(result.data)
      ? result.data.filter((item: DataRow) => String(item.status ?? "0") === "0").map((item: DataRow) => ({ value: String(item.dictValue), label: String(item.dictLabel) }))
      : [];
    return [key, options] as const;
  }));
  return Object.fromEntries(entries) as Dictionaries;
}

function optionLabel(value: unknown, options?: Array<{ value: string | number; label: string }>) {
  if (value === null || value === undefined || value === "") return "--";
  return options?.find((item) => String(item.value) === String(value))?.label || String(value);
}

function shortDate(value: unknown, withTime = false) {
  if (!value) return "--";
  const normalized = String(value).replace("T", " ");
  return normalized.slice(0, withTime ? 19 : 10);
}

function maskPhone(value: string) {
  if (!value || value.length < 7) return value || "--";
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function maskEmail(value: string) {
  if (!value || !value.includes("@")) return value || "--";
  const [user, domain] = value.split("@");
  if (!user || !domain || user.length <= 1) return value;
  return `${user[0]}****@${domain}`;
}

function sexLabel(sex: unknown) {
  const value = String(sex);
  if (value === "0") return "男";
  if (value === "1") return "女";
  return "未设置";
}

const NAV_ITEMS: Array<{
  key: MenuKey;
  label: string;
  description: string;
  icon: typeof ShoppingBag;
}> = [
  { key: "home", label: "工作台", description: "订单与物流概览", icon: House },
  { key: "orders", label: "订单管理", description: "订单、发货与物流", icon: ShoppingBag },
  { key: "orderEntry", label: "订单录入", description: "选买家、识别地址建单", icon: FileSpreadsheet },
  { key: "bills", label: "账单管理", description: "成本与盈利核算", icon: ReceiptText },
  { key: "express", label: "快递管理", description: "物流节点维护", icon: Truck },
  { key: "prices", label: "价格管理", description: "商品与快递计价", icon: BadgeDollarSign },
  { key: "stores", label: "店铺管理", description: "店铺与通知配置", icon: StoreIcon },
  { key: "orderLink", label: "生成链接", description: "买家专属下单链接", icon: ShoppingBag },
  { key: "purchasers", label: "买家管理", description: "买家与店铺绑定", icon: User },
  { key: "tracking", label: "快递查询", description: "快递100、顺丰、EMS", icon: SearchCheck },
];

function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark"><span /></span>
      <span><b>喜八</b><small>XB MOBILE</small></span>
    </div>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`} role="status">
      {toast.type === "success" ? <Check size={17} /> : toast.type === "error" ? <X size={17} /> : <Sparkles size={17} />}
      {toast.message}
    </div>
  );
}

function Sheet({
  open,
  title,
  children,
  onClose,
  headerAction,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  headerAction?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    document.body.classList.add("sheet-open");
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.classList.remove("sheet-open");
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`sheet ${wide ? "sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grabber" />
        <header className="sheet-header">
          <div><span className="eyebrow">XB MOBILE</span><h2>{title}</h2></div>
          <div className="sheet-header-actions">{headerAction}<button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
        </header>
        <div className="sheet-content">{children}</div>
      </section>
    </div>
  );
}

function ConfirmDialog({
  state,
  onClose,
}: {
  state: { title: string; message: string; danger?: boolean; action: () => Promise<void> } | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  return (
    <div className="confirm-backdrop">
      <div className="confirm-card" role="alertdialog" aria-modal="true">
        <div className={`confirm-icon ${state.danger ? "danger" : ""}`}>
          {state.danger ? <Trash2 size={22} /> : <ShieldCheck size={22} />}
        </div>
        <h3>{state.title}</h3>
        <p>{state.message}</p>
        <div className="confirm-actions">
          <button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>取消</button>
          <button
            className={`button ${state.danger ? "button-danger" : "button-primary"}`}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await state.action(); onClose(); } finally { setBusy(false); }
            }}
          >{busy ? <LoaderCircle className="spin" size={17} /> : null}确认</button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [uuid, setUuid] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaOn, setCaptchaOn] = useState(true);
  const [publicKey, setPublicKey] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadCaptcha = useCallback(async () => {
    try {
      const result = await apiRequest<DataRow>("/captchaImage", { auth: false });
      const enabled = result.captchaOnOff === undefined ? true : Boolean(result.captchaOnOff);
      setCaptchaOn(enabled);
      setUuid(String(result.uuid || ""));
      setCaptcha(enabled && result.img ? `data:image/gif;base64,${result.img}` : "");
      setCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码加载失败");
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("xb-mobile-username");
    if (saved) setUsername(saved);
    Promise.all([
      apiRequest<DataRow>("/getPublicKey", { auth: false }).then((result) => {
        setPublicKey(String(result.publicKey || result.data?.publicKey || ""));
      }),
      loadCaptcha(),
    ]).catch((error) => setMessage(error instanceof Error ? error.message : "系统初始化失败"));
  }, [loadCaptcha]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!username.trim() || !password) return setMessage("请输入账号和密码");
    if (captchaOn && !code.trim()) return setMessage("请输入验证码");
    if (!publicKey) return setMessage("登录加密尚未准备完成，请稍后重试");
    setLoading(true);
    try {
      const { JSEncrypt } = await import("jsencrypt");
      const encryptor = new JSEncrypt();
      encryptor.setPublicKey(publicKey);
      const encryptedPassword = encryptor.encrypt(password);
      if (!encryptedPassword) throw new Error("密码加密失败");
      const result = await apiRequest<DataRow>("/login", {
        auth: false,
        method: "POST",
        body: { username: username.trim(), password: encryptedPassword, code: code.trim(), uuid },
      });
      const token = String(result.token || "");
      if (!token) throw new Error("登录成功但未返回凭证");
      if (remember) window.localStorage.setItem("xb-mobile-username", username.trim());
      else window.localStorage.removeItem("xb-mobile-username");
      onLogin(token, username.trim());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
      await loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-orb login-orb-one" /><div className="login-orb login-orb-two" />
      <section className="login-card">
        <AppLogo />
        <div className="login-copy"><span className="eyebrow">移动工作台</span><h1>欢迎回来</h1><p>在手机上高效处理订单、发货和账单。</p></div>
        <form onSubmit={submit} className="login-form">
          <label><span>账号</span><div className="input-shell"><User size={18} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入账号" /></div></label>
          <label><span>密码</span><div className="input-shell"><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入密码" /></div></label>
          {captchaOn ? <label><span>验证码</span><div className="captcha-login"><div className="input-shell"><ShieldCheck size={18} /><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="请输入" /></div><button type="button" onClick={loadCaptcha} aria-label="刷新验证码">{captcha ? <img src={captcha} alt="验证码" /> : <RefreshCw size={20} />}</button></div></label> : null}
          <label className="remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>记住账号</span></label>
          {message ? <p className="form-error">{message}</p> : null}
          <button className="login-submit" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={19} /> : <ShieldCheck size={19} />}{loading ? "正在登录" : "安全登录"}</button>
        </form>
        <p className="login-footnote"><span /> 账号密码将通过 RSA 加密传输</p>
        <a className="public-tools-entry" href="/tools"><Sparkles size={16} /><span><b>进入免登录工具箱</b><small>订单查询 · 运费计算 · 运费对比</small></span><ChevronRight size={16} /></a>
        <a className="icp-link login-icp" href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a>
      </section>
    </main>
  );
}

function StatusBadge({ row }: { row: DataRow }) {
  const text = String(row.orderStatusDesc || row.expStatusDesc || row.statusDesc || row.orderStatus || "未知");
  const value = `${row.orderStatus || row.expStatus || ""} ${text}`;
  const tone = /YWC|完成|送达/.test(value) ? "success" : /YFH|YSJ|YSZ|发货|运输|收寄/.test(value) ? "info" : /DTF|DFH|待发/.test(value) ? "warning" : "neutral";
  return <span className={`status status-${tone}`}><span />{text}</span>;
}

function StoreStatusBadge({ row }: { row: DataRow }) {
  const value = Number(row.isDelete);
  const text = value === 1 ? "开业中" : value === 2 ? "已关闭" : "状态未知";
  return <span className={`status ${value === 1 ? "status-success" : value === 2 ? "status-danger" : "status-neutral"}`}><span />{text}</span>;
}

function EmptyState({ loading, label }: { loading: boolean; label: string }) {
  return <div className="empty-state">{loading ? <LoaderCircle className="spin" size={28} /> : <Box size={30} />}<h3>{loading ? "正在加载" : `暂无${label}`}</h3><p>{loading ? "请稍候…" : "试试调整筛选条件"}</p></div>;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const normalizedValue = typeof value === "string" || typeof value === "number" ? value : "";
  const common = { id: field.key, value: normalizedValue, required: field.required, disabled: field.readonly, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value) };
  if (field.type === "textarea") return <textarea {...common} rows={3} placeholder={field.placeholder || `请输入${field.label}`} />;
  if (field.type === "select") return <select {...common}><option value="">请选择</option>{field.options?.map((item) => <option key={String(item.value)} value={String(item.value)}>{item.label}</option>)}</select>;
  return <input {...common} type={field.type || "text"} step={field.type === "number" ? "0.01" : undefined} placeholder={field.placeholder || `请输入${field.label}`} />;
}

type FieldConfig = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "textarea" | "select";
  required?: boolean;
  readonly?: boolean;
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
};

function OrderEditor({
  initial,
  onSaved,
  onClose,
  notify,
}: {
  initial: DataRow | null;
  onSaved: () => void;
  onClose: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const dictionaries = useContext(DictionaryContext);
  const [form, setForm] = useState<DataRow>(() => initial ? { ...initial } : { orderNum: 1, orderTime: new Date().toISOString().slice(0, 10), orderStatus: "DSH", isUpdateBill: false, isUpdateExp: false });
  const [saving, setSaving] = useState(false);
  const [purchasers, setPurchasers] = useState<DataRow[]>([]);
  const [stores, setStores] = useState<DataRow[]>([]);
  const [purchaserLoading, setPurchaserLoading] = useState(true);
  const [createPurchaserOpen, setCreatePurchaserOpen] = useState(false);
  const [creatingPurchaser, setCreatingPurchaser] = useState(false);
  const [purchaserForm, setPurchaserForm] = useState({ name: "", phone: "", storeCode: "" });
  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<{ data?: DataRow[] }>("/biz/purchaser/list"),
      apiRequest<{ data?: DataRow[] }>("/search/store", { auth: false, query: { createBy: "", name: "" } }),
    ]).then(([purchaserResult, storeResult]) => {
      if (!mounted) return;
      const purchaserRows = Array.isArray(purchaserResult.data) ? purchaserResult.data : [];
      const storeRows = Array.isArray(storeResult.data) ? storeResult.data.filter((item) => Number(item.isDelete ?? 1) === 1) : [];
      setPurchasers(purchaserRows); setStores(storeRows);
      setPurchaserForm((current) => ({ ...current, storeCode: current.storeCode || String(storeRows[0]?.code || "") }));
    }).catch((error) => notify(error instanceof Error ? error.message : "买家列表加载失败", "error"))
      .finally(() => mounted && setPurchaserLoading(false));
    return () => { mounted = false; };
  }, [notify]);
  const set = (key: string, value: unknown) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "orderName" && value !== "other") next.orderNameDesc = optionLabel(value, dictionaries.products);
    if (key === "orderType" && value !== "other") next.orderTypeDesc = optionLabel(value, dictionaries.sizes);
    if (key === "expCom") next.expComDesc = optionLabel(value, dictionaries.expressCompanies);
    if (key === "orderStatus") next.orderStatusDesc = optionLabel(value, dictionaries.orderStatuses);
    return next;
  });
  function selectPurchaser(shortId: string) {
    const purchaser = purchasers.find((item) => String(item.shortId) === shortId);
    if (!purchaser) {
      setForm((current) => ({ ...current, purchaserShortId: "" }));
      return;
    }
    if (!purchaser.storeId || !purchaser.storeName) {
      notify("该买家尚未绑定店铺，请先在买家管理中绑定", "info");
      return;
    }
    setForm((current) => ({ ...current, purchaser: purchaser.name || "", purchaserShortId: purchaser.shortId || "", store: purchaser.storeName || "" }));
  }
  async function createAndSelectPurchaser() {
    if (!purchaserForm.name.trim() || !/^1\d{10}$/.test(purchaserForm.phone) || !purchaserForm.storeCode) return notify("请填写买家姓名、11位手机号和绑定店铺", "info");
    setCreatingPurchaser(true);
    try {
      const result = await apiRequest<{ data?: DataRow }>("/biz/purchaser", { method: "POST", body: { name: purchaserForm.name.trim(), phone: purchaserForm.phone, storeCode: purchaserForm.storeCode } });
      if (!result.data) throw new Error("创建买家后未返回档案信息");
      const purchaser = result.data;
      setPurchasers((current) => [purchaser, ...current.filter((item) => item.id !== purchaser.id)]);
      setForm((current) => ({ ...current, purchaser: purchaser.name || "", purchaserShortId: purchaser.shortId || "", store: purchaser.storeName || "" }));
      setPurchaserForm({ name: "", phone: "", storeCode: String(stores[0]?.code || "") }); setCreatePurchaserOpen(false);
      notify("买家已创建并选中", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "创建买家失败", "error"); }
    finally { setCreatingPurchaser(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/biz/order", { method: form.id ? "PUT" : "POST", body: { ...form, orderNum: Number(form.orderNum || 1) } });
      notify(form.id ? "订单已修改" : "订单已新增", "success");
      onSaved(); onClose();
    } catch (error) { notify(error instanceof Error ? error.message : "保存失败", "error"); }
    finally { setSaving(false); }
  }
  return (
    <form className="mobile-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="span-full order-purchaser-field"><span>下单人 *</span><div className="order-purchaser-select"><select required={!form.id} disabled={purchaserLoading} value={form.purchaserShortId || ""} onChange={(e) => selectPurchaser(e.target.value)}><option value="">{purchaserLoading ? "正在加载买家" : "请选择已绑定店铺的买家"}</option>{form.purchaser && form.purchaserShortId && !purchasers.some((item) => String(item.shortId) === String(form.purchaserShortId)) ? <option value={form.purchaserShortId}>{form.purchaser} · 当前买家</option> : null}{purchasers.map((item) => <option disabled={!item.storeId} key={String(item.id)} value={item.shortId || ""}>{item.name || "未命名"} · {item.phone || "无手机号"} · {item.storeName || "未绑定店铺"}</option>)}</select><button type="button" onClick={() => setCreatePurchaserOpen((value) => !value)}><UserPlus size={16} />新增买家</button></div>{form.purchaserShortId ? <small className="order-purchaser-current"><StoreIcon size={13} />{form.purchaser || "--"} · ID {form.purchaserShortId} · {form.store || "未绑定店铺"}</small> : null}</label>
        {createPurchaserOpen ? <div className="span-full order-purchaser-create"><div><label><span>买家姓名</span><input value={purchaserForm.name} onChange={(event) => setPurchaserForm((current) => ({ ...current, name: event.target.value }))} /></label><label><span>手机号</span><input inputMode="tel" maxLength={11} value={purchaserForm.phone} onChange={(event) => setPurchaserForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} /></label><label><span>绑定店铺</span><select value={purchaserForm.storeCode} onChange={(event) => setPurchaserForm((current) => ({ ...current, storeCode: event.target.value }))}><option value="">请选择</option>{stores.map((store) => <option key={String(store.id || store.code)} value={store.code}>{store.name || store.text || store.value || store.code}</option>)}</select></label></div><button type="button" disabled={creatingPurchaser} onClick={createAndSelectPurchaser}>{creatingPurchaser ? <LoaderCircle className="spin" size={16} /> : <UserPlus size={16} />}创建并选中</button></div> : null}
        <label><span>下单时间 *</span><input required type="date" value={String(form.orderTime || "").slice(0, 10)} onChange={(e) => set("orderTime", e.target.value)} /></label>
        <label><span>订单状态</span><select value={form.orderStatus || ""} onChange={(e) => set("orderStatus", e.target.value)}><option value="">请选择</option>{dictionaries.orderStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>商品名称 *</span><select required value={form.orderName || ""} onChange={(e) => set("orderName", e.target.value)}><option value="">请选择</option>{dictionaries.products.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {form.orderName === "other" ? <label><span>自定义商品 *</span><input required value={form.orderNameDesc || ""} onChange={(e) => set("orderNameDesc", e.target.value)} /></label> : null}
        <label><span>商品规格 *</span><select required value={form.orderType || ""} onChange={(e) => set("orderType", e.target.value)}><option value="">请选择</option>{dictionaries.sizes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {form.orderType === "other" ? <label><span>自定义规格 *</span><input required value={form.orderTypeDesc || ""} onChange={(e) => set("orderTypeDesc", e.target.value)} /></label> : null}
        <label><span>商品数量 *</span><input required type="number" min="1" max="200" value={form.orderNum || 1} onChange={(e) => set("orderNum", e.target.value)} /></label>
        <label><span>收件人 *</span><input required value={form.customer || ""} onChange={(e) => set("customer", e.target.value)} /></label>
        <label><span>手机号 *</span><input required inputMode="tel" maxLength={11} value={form.phone || ""} onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="span-full"><span>收货地址 *</span><textarea required rows={3} value={form.address || ""} onChange={(e) => set("address", e.target.value)} /></label>
        <label><span>快递公司</span><select value={form.expCom || ""} onChange={(e) => set("expCom", e.target.value)}><option value="">请选择</option>{dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>快递单号</span><input value={form.expCode || ""} onChange={(e) => set("expCode", e.target.value)} /></label>
        <label className="span-full"><span>备注</span><textarea rows={3} maxLength={500} value={form.orderDesc || ""} onChange={(e) => set("orderDesc", e.target.value)} /></label>
      </div>
      {form.id ? <div className="switch-row"><label><input type="checkbox" checked={Boolean(form.isUpdateBill)} onChange={(e) => set("isUpdateBill", e.target.checked)} />更新价格</label><label><input type="checkbox" checked={Boolean(form.isUpdateExp)} onChange={(e) => set("isUpdateExp", e.target.checked)} />更新物流</label></div> : null}
      <button className="button button-primary button-block" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}保存订单</button>
    </form>
  );
}

function ShippingEditor({ initial, onSaved, onClose, notify }: { initial: DataRow; onSaved: () => void; onClose: () => void; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const dictionaries = useContext(DictionaryContext);
  const [expCom, setExpCom] = useState(String(initial.expCom || ""));
  const [expCode, setExpCode] = useState(String(initial.expCode || ""));
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  async function detectExpress() {
    if (!expCode.trim()) return notify("请先输入快递单号", "info");
    setDetecting(true);
    try {
      const result = await apiRequest<{ data?: DataRow }>("/biz/exp/getCom", { query: { expCode: expCode.trim() } });
      const detected = String(result.data?.expCom || "");
      if (detected) { setExpCom(detected); notify(`已识别为${result.data?.expComDesc || optionLabel(detected, dictionaries.expressCompanies)}`, "success"); }
      else notify("暂未识别快递公司，请手动选择", "info");
    } catch (error) { notify(error instanceof Error ? error.message : "快递识别失败", "error"); }
    finally { setDetecting(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!expCom || !expCode.trim()) return notify("请选择快递公司并填写快递单号", "info");
    setSaving(true);
    try {
      await apiRequest("/biz/order", { method: "PUT", body: { ...initial, expCom, expComDesc: optionLabel(expCom, dictionaries.expressCompanies), expCode: expCode.trim(), orderStatus: "YFH", orderStatusDesc: "已发货", isUpdateBill: false, isUpdateExp: false } });
      notify("发货成功，快递信息已保存", "success"); onSaved(); onClose();
    } catch (error) { notify(error instanceof Error ? error.message : "发货失败", "error"); }
    finally { setSaving(false); }
  }
  return <form className="shipping-editor" onSubmit={submit}><section><span><Truck size={22} /></span><div><small>待发货订单</small><h3>{initial.orderCode || "--"}</h3><p>{initial.customer || "--"} · {initial.orderNameDesc || initial.orderName || "--"} {initial.orderTypeDesc || initial.orderType || ""}</p></div></section><label><span>快递公司 *</span><select required value={expCom} onChange={(event) => setExpCom(event.target.value)}><option value="">请选择快递公司</option>{dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>快递单号 *</span><div className="shipping-code-input"><input required value={expCode} onChange={(event) => setExpCode(event.target.value.trim())} placeholder="请输入或扫描快递单号" /><button type="button" disabled={detecting} onClick={detectExpress}>{detecting ? <LoaderCircle className="spin" size={15} /> : <SearchCheck size={15} />}识别</button></div></label><p><ShieldCheck size={14} />提交后订单将变为已发货，并记录物流节点。</p><button className="button button-primary button-block" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}{saving ? "正在提交" : "确认发货"}</button></form>;
}

function OrderCopyMenu({ row, onCopy }: { row: DataRow; onCopy: (text: string, message: string) => void }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const orderLink = `${origin}/tools/order#${encodeURIComponent(String(row.signId || ""))}`;
  const purchaserLink = `${origin}/tools/order#${encodeURIComponent(`v-${String(row.signId || "")}`)}`;
  const orderDetail = `【订单详情】\n订单号: ${row.orderCode || ""}\n下单时间: ${shortDate(row.orderTime)}\n商品: ${row.orderNameDesc || ""} ${row.orderTypeDesc || ""} × ${row.orderNum || 1}\n收件人: ${row.customer || ""}\n手机号: ${row.phone || ""}\n地址: ${row.address || ""}\n快递: ${row.expComDesc || ""} ${row.expCode || ""}\n查看更多: ${orderLink}`;
  const purchaserOrders = `【${row.purchaser || "下单人"}】的订单列表：\n${purchaserLink}`;
  const customerOrders = `【${row.customer || "收件人"}】的订单：\n${orderLink}`;
  const expressInfo = `${row.orderNameDesc || ""}   ${row.orderTypeDesc || ""}   ${row.expComDesc || ""}\n\n收件人: ${row.customer || ""}\n手机号: ${row.phone || ""}\n地址: ${row.address || ""}`;
  const items = [
    { label: "订单详情", desc: "完整订单、快递及查询链接", icon: ReceiptText, text: orderDetail, message: "订单详情已复制", tone: "green" },
    { label: "下单人链接", desc: `${row.purchaser || "下单人"}的订单列表`, icon: User, text: purchaserOrders, message: "下单人查询链接已复制", tone: "blue" },
    { label: "收件人链接", desc: `${row.customer || "收件人"}的订单查询`, icon: ExternalLink, text: customerOrders, message: "收件人查询链接已复制", tone: "amber" },
    { label: "发货识别信息", desc: "商品、收件人、手机和地址", icon: Truck, text: expressInfo, message: "快递识别信息已复制", tone: "peach" },
  ];
  return <div className="order-copy-menu"><section><span><Copy size={21} /></span><div><small>订单 {row.orderCode || "--"}</small><h3>选择要复制的内容</h3><p>与 PC 端订单列表的复制按钮保持一致</p></div></section><div>{items.map((item) => { const Icon = item.icon; return <button type="button" key={item.label} onClick={() => onCopy(item.text, item.message)}><span className={`copy-tone-${item.tone}`}><Icon size={19} /></span><div><b>{item.label}</b><small>{item.desc}</small></div><Copy size={16} /></button>; })}</div></div>;
}

type DashboardData = {
  orderTotal: number;
  pending: number;
  waiting: number;
  sent: number;
  completed: number;
  billTotal: number;
  storeTotal: number;
  purchaserTotal: number;
  boundPurchaserTotal: number;
  recentOrders: DataRow[];
  recentExpress: DataRow[];
  recentPurchasers: DataRow[];
};

const EMPTY_DASHBOARD: DashboardData = {
  orderTotal: 0, pending: 0, waiting: 0, sent: 0, completed: 0, billTotal: 0, storeTotal: 0, purchaserTotal: 0, boundPurchaserTotal: 0, recentOrders: [], recentExpress: [], recentPurchasers: [],
};

// 工作台随机鸡汤（按当前时间/待办/完成数取不同池子）
const CHICKEN_SOUP_BUSY = [
  "还有 {n} 笔待处理，先挑简单的？",
  "{n} 单排队中，加把劲",
  "今日还有 {n} 单没完，加油",
  "{n} 单待处理，从最重要的开始",
  "还有 {n} 单，挑一个下手吧",
  "今日 {n} 单待办，节奏走起",
  "积压 {n} 单，先啃硬骨头",
  "还有 {n} 单排队，越早处理越轻松",
];
const CHICKEN_SOUP_DONE = [
  "今日已搞定 {n} 笔，厉害",
  "{n} 单完成，效率不错",
  "已经处理 {n} 单，保持节奏",
  "{n} 笔订单完成，可以喘口气",
  "今日 {n} 单已结，奈斯",
  "{n} 单交付，成就感拉满",
  "今日 {n} 单搞定，手感在线",
];
const CHICKEN_SOUP_IDLE = [
  "新的一天，从一杯水开始",
  "一日之计在于晨",
  "先把最棘手的那笔处理掉",
  "别急，一件件来",
  "忙了一上午，先去吃饭",
  "中午了，热饭吃了吗",
  "下午专注力最强",
  "今天的辛苦，明天的底气",
  "晚上好，记得按时回家",
  "今天已经够拼了",
  "事情一件件来，不慌",
  "难得清闲，喝杯茶吧",
  "夜深了，早点睡",
  "还在加班？记得喝水",
  "明天的活明天再说",
  "专注当下，效率翻倍",
  "你已经很努力了",
  "忙里偷闲，笑一下",
  "保持节奏，别急",
  "持续改进比完美更重要",
  "小步快跑，比完美更重要",
  "深呼吸，再继续",
  "今天也是好的一天",
];
const pickChicken = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const greetByHour = (h: number) => {
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 13) return "中午好";
  if (h < 18) return "下午好";
  if (h < 22) return "晚上好";
  return "夜深了";
};

function DashboardPage({ username, userInfo, onNavigate, notify }: { username: string; userInfo: DataRow | null; onNavigate: (key: MenuKey) => void; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date()), []);
  const displayName = String(userInfo?.nickName || userInfo?.userName || username);
  const deptName = String(userInfo?.dept?.deptName || "");
  const primaryRole = Array.isArray(userInfo?.roles) && userInfo.roles.length ? String(userInfo.roles[0]?.roleName || "") : "";
  const greeting = useMemo(() => greetByHour(new Date().getHours()), []);
  const subtitle = useMemo(() => {
    const pending = data.pending + data.waiting;
    if (pending > 0) {
      return pickChicken(CHICKEN_SOUP_BUSY).replace("{n}", String(pending));
    }
    if (data.completed > 0) {
      return pickChicken(CHICKEN_SOUP_DONE).replace("{n}", String(data.completed));
    }
    return pickChicken(CHICKEN_SOUP_IDLE);
  }, [data]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orders, pending, waiting, sent, completed, express, bills, stores, purchasers] = await Promise.all([
        apiRequest<DataRow>("/biz/order/list", { query: { pageNum: 1, pageSize: 5 } }),
        apiRequest<DataRow>("/biz/order/list", { query: { pageNum: 1, pageSize: 1, orderStatus: "DSH" } }),
        apiRequest<DataRow>("/biz/order/list", { query: { pageNum: 1, pageSize: 1, orderStatus: "DFH" } }),
        apiRequest<DataRow>("/biz/order/list", { query: { pageNum: 1, pageSize: 1, orderStatus: "YFH" } }),
        apiRequest<DataRow>("/biz/order/list", { query: { pageNum: 1, pageSize: 1, orderStatus: "YWC" } }),
        apiRequest<DataRow>("/biz/exp/list", { query: { pageNum: 1, pageSize: 4 } }),
        apiRequest<DataRow>("/biz/bill/list", { query: { pageNum: 1, pageSize: 1 } }),
        apiRequest<DataRow>("/biz/store/list", { query: { pageNum: 1, pageSize: 1, isDelete: 1 } }),
        apiRequest<{ data?: DataRow[] }>("/biz/purchaser/list"),
      ]);
      const purchaserRows = Array.isArray(purchasers.data) ? purchasers.data : [];
      setData({
        orderTotal: Number(orders.total || 0), pending: Number(pending.total || 0), waiting: Number(waiting.total || 0), sent: Number(sent.total || 0), completed: Number(completed.total || 0),
        billTotal: Number(bills.total || 0), storeTotal: Number(stores.total || 0), purchaserTotal: purchaserRows.length, boundPurchaserTotal: purchaserRows.filter((item) => item.shortId && item.storeId).length,
        recentOrders: Array.isArray(orders.rows) ? orders.rows : [], recentExpress: Array.isArray(express.rows) ? express.rows : [], recentPurchasers: purchaserRows.slice(0, 4),
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "工作台数据加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  async function copyPurchaserLink(purchaser: DataRow) {
    if (!purchaser.shortId || !purchaser.storeId) {
      notify("该买家尚未绑定店铺，请先完成绑定", "info");
      onNavigate("purchasers");
      return;
    }
    try {
      const text = formatOrderLinkCopy(purchaser.name, buildOrderLink(purchaser.shortId));
      await navigator.clipboard.writeText(text);
      notify(`${purchaser.name || "买家"}的下单链接已复制`, "success");
    } catch {
      notify("复制失败，请在买家管理中重试", "error");
    }
  }

  const shortcuts: Array<{ key: MenuKey; label: string; desc: string; icon: typeof ShoppingBag; tone: string }> = [
    { key: "orders", label: "订单管理", desc: "查询与发货", icon: ShoppingBag, tone: "green" },
    { key: "orderEntry", label: "订单录入", desc: "选买家快速建单", icon: FileSpreadsheet, tone: "blue" },
    { key: "orderLink", label: "生成链接", desc: "买家专属入口", icon: Send, tone: "peach" },
    { key: "purchasers", label: "买家管理", desc: `${data.purchaserTotal} 位买家`, icon: User, tone: "green" },
    { key: "express", label: "快递管理", desc: "物流轨迹", icon: Truck, tone: "blue" },
    { key: "bills", label: "账单管理", desc: `${data.billTotal} 条账单`, icon: WalletCards, tone: "amber" },
  ];

  return <div className="dashboard-page">
    <section className="dashboard-welcome">
      <div>
        <span className="eyebrow">
          {today}
          {deptName ? ` · ${deptName}` : ""}
          {primaryRole ? ` · ${primaryRole}` : ""}
        </span>
        <h1>{greeting}，{displayName}</h1>
        <p>{subtitle}</p>
      </div>
      <button type="button" onClick={load} aria-label="刷新工作台"><RefreshCw className={loading ? "spin" : ""} size={19} /></button>
      <span className="dashboard-orb" />
    </section>

    <section className="dashboard-metrics" aria-label="订单概况">
      <button type="button" onClick={() => onNavigate("orders")}><span className="metric-icon peach"><ShoppingBag size={18} /></span><small>全部订单</small><b>{data.orderTotal}</b></button>
      <button type="button" onClick={() => onNavigate("orders")}><span className="metric-icon amber"><RotateCw size={18} /></span><small>待处理</small><b>{data.pending}</b></button>
      <button type="button" onClick={() => onNavigate("orders")}><span className="metric-icon blue"><PackageCheck size={18} /></span><small>待发货</small><b>{data.waiting}</b></button>
      <button type="button" onClick={() => onNavigate("orders")}><span className="metric-icon green"><CircleCheck size={18} /></span><small>已完成</small><b>{data.completed}</b></button>
    </section>

    <div className="dashboard-pulse"><span><Truck size={17} /></span><div><b>{data.sent} 个订单已发货</b><p>最新物流动态已同步到工作台</p></div><button type="button" onClick={() => onNavigate("express")}>查看<ChevronRight size={14} /></button></div>

    <section className="dashboard-section"><div className="dashboard-section-title"><div><h2>快捷操作</h2><p>{data.storeTotal} 个店铺正在使用</p></div></div><div className="dashboard-shortcuts">{shortcuts.map((item) => { const Icon = item.icon; return <button type="button" onClick={() => onNavigate(item.key)} key={item.key}><span className={`shortcut-${item.tone}`}><Icon size={19} /></span><div><b>{item.label}</b><small>{item.desc}</small></div><ChevronRight size={15} /></button>; })}</div></section>

    <section className="dashboard-section"><div className="dashboard-section-title"><div><h2>最近新增买家</h2><p>{data.purchaserTotal} 位买家 · {data.boundPurchaserTotal} 位已绑定店铺</p></div><button type="button" onClick={() => onNavigate("purchasers")}>买家管理</button></div><div className="dashboard-purchaser-list">{loading && !data.recentPurchasers.length ? <div className="dashboard-empty"><LoaderCircle className="spin" size={22} />正在加载</div> : data.recentPurchasers.length ? data.recentPurchasers.map((purchaser) => <article key={String(purchaser.id || purchaser.shortId)}><span>{String(purchaser.name || "买").slice(0, 1)}</span><div><b>{purchaser.name || "未命名买家"}<em>ID {purchaser.shortId || "--"}</em></b><p>{purchaser.phone || "未填写手机号"} · {purchaser.storeName || "尚未绑定店铺"}</p><small>{purchaser.createTime ? `创建于 ${shortDate(purchaser.createTime, true)}` : "创建时间暂无"}</small></div><button className={purchaser.storeId ? "" : "unbound"} type="button" onClick={() => copyPurchaserLink(purchaser)}>{purchaser.storeId ? <><Copy size={14} />复制链接</> : <>去绑定<ChevronRight size={14} /></>}</button></article>) : <div className="dashboard-empty"><User size={22} />暂无买家，生成链接时可创建</div>}</div></section>

    <section className="dashboard-section"><div className="dashboard-section-title"><div><h2>最近订单</h2><p>最新 {data.recentOrders.length} 笔订单</p></div><button type="button" onClick={() => onNavigate("orders")}>查看全部</button></div><div className="dashboard-order-list">{loading && !data.recentOrders.length ? <div className="dashboard-empty"><LoaderCircle className="spin" size={22} />正在加载</div> : data.recentOrders.length ? data.recentOrders.map((row) => <button type="button" key={String(row.id)} onClick={() => onNavigate("orders")}><span className="dashboard-product">{String(row.orderNameDesc || "果").slice(-1)}</span><div><b>{row.orderNameDesc || row.orderName || "未命名商品"} · {row.orderTypeDesc || row.orderType || "--"}</b><small>{row.customer || "--"} · {shortDate(row.orderTime)}</small></div><StatusBadge row={row} /></button>) : <div className="dashboard-empty"><ShoppingBag size={22} />暂无订单</div>}</div></section>

    <section className="dashboard-section"><div className="dashboard-section-title"><div><h2>最新物流</h2><p>订单状态更新</p></div><button type="button" onClick={() => onNavigate("express")}>快递管理</button></div><div className="dashboard-logistics">{data.recentExpress.length ? data.recentExpress.map((row, index) => <div key={String(row.id)} className={index === 0 ? "latest" : ""}><i /><section><div><b>{row.expStatusDesc || row.expStatus || "物流更新"}</b><time>{shortDate(row.expTime, true)}</time></div><p>{row.expDesc || "暂无物流描述"}</p><small>订单 {row.orderCode || "--"}</small></section></div>) : <div className="dashboard-empty"><Truck size={22} />暂无物流动态</div>}</div></section>
  </div>;
}

function OrdersPage({ notify }: { notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const dictionaries = useContext(DictionaryContext);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DataRow>({ pageNum: 1, pageSize: 20 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [detail, setDetail] = useState<DataRow | null>(null);
  const [shipping, setShipping] = useState<DataRow | null>(null);
  const [copyTarget, setCopyTarget] = useState<DataRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<DataRow>("/biz/order/list", { query: filters });
      setRows(Array.isArray(result.rows) ? result.rows : []); setTotal(Number(result.total || 0));
    } catch (error) { notify(error instanceof Error ? error.message : "订单加载失败", "error"); }
    finally { setLoading(false); }
  }, [filters, notify]);
  useEffect(() => { load(); }, [load]);

  const selectedRows = rows.filter((row) => selected.has(String(row.id)));
  const ids = selectedRows.map((row) => row.id).join(",");
  const codes = selectedRows.map((row) => row.orderCode).join(",");
  const counts = useMemo(() => ({
    pending: rows.filter((row) => /DSH|待处理/.test(`${row.orderStatus}${row.orderStatusDesc}`)).length,
    shipping: rows.filter((row) => /DTF|DFH|待发/.test(`${row.orderStatus}${row.orderStatusDesc}`)).length,
    transit: rows.filter((row) => /YFH|YSJ|YSZ|发货|运输/.test(`${row.orderStatus}${row.orderStatusDesc}`)).length,
  }), [rows]);

  function toggle(id: unknown) {
    const value = String(id);
    setSelected((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; });
  }
  async function getDetail(row: DataRow) {
    try { const result = await apiRequest<DataRow>(`/biz/order/${row.id}`); setDetail(result.data || row); }
    catch (error) { notify(error instanceof Error ? error.message : "详情加载失败", "error"); }
  }
  async function getEditor(row: DataRow) {
    try { const result = await apiRequest<DataRow>(`/biz/order/${row.id}`); setEditor(result.data || row); }
    catch (error) { notify(error instanceof Error ? error.message : "订单加载失败", "error"); }
  }
  async function openShipping(row?: DataRow) {
    const target = row || selectedRows[0];
    if (!target) return notify("请先选择一个订单", "info");
    if (!row && selectedRows.length > 1) return notify("每个订单的快递单号不同，请逐笔填写发货", "info");
    try { const result = await apiRequest<DataRow>(`/biz/order/${target.id}`); setShipping(result.data || target); }
    catch (error) { notify(error instanceof Error ? error.message : "订单信息加载失败", "error"); }
  }
  function action(path: string, actionIds: string, success: string) {
    return async () => {
      try { await apiRequest(`/biz/order/${path}/${actionIds}`, { method: "PATCH" }); notify(success, "success"); setSelected(new Set()); await load(); }
      catch (error) { notify(error instanceof Error ? error.message : "操作失败", "error"); }
    };
  }
  function requestBatch(path: string, label: string, row?: DataRow) {
    const targetIds = row ? String(row.id) : ids;
    const count = row ? 1 : selected.size;
    if (!targetIds) return notify("请先选择订单", "info");
    setConfirm({ title: label, message: `确认对 ${count} 个订单执行“${label}”吗？`, action: action(path, targetIds, `${label}成功`) });
  }
  function requestDelete(row?: DataRow) {
    const target = row ? String(row.id) : ids;
    if (!target) return notify("请先选择订单", "info");
    setConfirm({ title: "删除订单", message: `删除后无法恢复，确认删除 ${row ? 1 : selected.size} 个订单？`, danger: true, action: async () => { await apiRequest(`/biz/order/${target}`, { method: "DELETE" }); notify("删除成功", "success"); setSelected(new Set()); await load(); } });
  }
  async function refreshLogistics(row?: DataRow) {
    const target = row ? String(row.orderCode) : codes;
    if (!target) return notify("请先选择订单", "info");
    try { await apiRequest(`/biz/exp/refresh/${target}`, { method: "PATCH" }); notify("物流轨迹已更新", "success"); await load(); }
    catch (error) { notify(error instanceof Error ? error.message : "物流刷新失败", "error"); }
  }
  async function copy(text: string, message: string) {
    await navigator.clipboard.writeText(text); notify(message, "success");
  }

  return (
    <div className="module-page order-page">
      <div className="module-hero">
        <div><span className="eyebrow">今日工作台</span><h1>订单管理</h1><p>查询、审核、发货与物流跟进</p></div>
        <button className="round-add" type="button" onClick={() => setEditor("new")}><Plus size={22} /><span>新增</span></button>
      </div>
      <div className="metric-grid">
        <div><span className="metric-icon peach"><ShoppingBag size={19} /></span><p>本页订单</p><b>{rows.length}</b></div>
        <div><span className="metric-icon amber"><RotateCw size={19} /></span><p>待处理</p><b>{counts.pending}</b></div>
        <div><span className="metric-icon blue"><PackageCheck size={19} /></span><p>待发货</p><b>{counts.shipping}</b></div>
        <div><span className="metric-icon green"><Truck size={19} /></span><p>运输中</p><b>{counts.transit}</b></div>
      </div>
      <div className="toolbar-card">
        <div className="quick-search"><Search size={18} /><input value={filters.orderCode || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderCode: e.target.value, pageNum: 1 }))} placeholder="搜索订单号" /><button type="button" onClick={load}><ArrowLeft className="search-arrow" size={18} /></button></div>
        <button className="filter-button" type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={18} /><span>筛选</span></button>
        <button className="icon-button surface" type="button" onClick={load} aria-label="刷新"><RefreshCw className={loading ? "spin" : ""} size={18} /></button>
      </div>
      <div className="secondary-actions">
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />导入</button>
        <button type="button" onClick={() => downloadFile("biz/order/export", filters, `order_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><Download size={16} />导出</button>
        <button type="button" onClick={() => downloadFile("biz/order/importTemplate", {}, `order_template_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><FileSpreadsheet size={16} />模板</button>
        <input ref={fileRef} hidden type="file" accept=".xls,.xlsx" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadFile("/biz/order/importData", file, { updateSupport: false, updateBill: false, updateExp: false }); notify("订单导入成功", "success"); load(); } catch (error) { notify(error instanceof Error ? error.message : "导入失败", "error"); } event.target.value = ""; }} />
      </div>

      {selected.size ? <div className="batch-bar"><div><b>已选 {selected.size} 项</b><button type="button" onClick={() => setSelected(new Set())}>取消选择</button></div><div className="batch-scroll"><button onClick={() => requestBatch("cancelsend", "取消待发")}><X size={15} />取消待发</button><button onClick={() => requestBatch("tosend", "设为待发")}><RotateCw size={15} />待发</button><button onClick={() => requestBatch("send", "一键发货")}><Send size={15} />一键发货</button><button onClick={() => requestBatch("finish", "一键完成")}><CircleCheck size={15} />完成</button><button onClick={() => refreshLogistics()}><RefreshCw size={15} />物流</button><button className="danger" onClick={() => requestDelete()}><Trash2 size={15} />删除</button></div></div> : null}

      <div className="list-heading"><div><h2>订单列表</h2><span>共 {total} 条</span></div>{rows.length ? <button type="button" onClick={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((row) => String(row.id))))}>{selected.size === rows.length ? "取消全选" : "全选本页"}</button> : null}</div>
      <div className="mobile-card-list">
        {!rows.length ? <EmptyState loading={loading} label="订单" /> : rows.map((row) => (
          <article className={`order-card ${selected.has(String(row.id)) ? "selected" : ""}`} key={String(row.id)}>
            <div className="card-topline"><label className="select-check"><input type="checkbox" checked={selected.has(String(row.id))} onChange={() => toggle(row.id)} /><span><Check size={13} /></span></label><button className="order-number" type="button" onClick={() => setCopyTarget(row)}>{row.orderCode || "暂无订单号"}<Copy size={13} /></button><StatusBadge row={row} /></div>
            <button className="card-main" type="button" onClick={() => getDetail(row)}>
              <span className="product-avatar">{String(row.orderNameDesc || "果").slice(-1)}</span>
              <span className="product-copy"><b>{row.orderNameDesc || optionLabel(row.orderName, dictionaries.products) || "未命名商品"}</b><small>{row.orderTypeDesc || optionLabel(row.orderType, dictionaries.sizes)} · 数量 {row.orderNum || 1}</small></span>
              <span className="order-price"><small>下单人</small><b>{row.purchaser || "--"}</b></span>
            </button>
            <div className="recipient-block"><div><User size={16} /><b>{row.customer || "--"}</b><a href={`tel:${row.phone || ""}`}><Phone size={14} />{row.phone || "--"}</a></div><p><MapPin size={15} />{row.address || "暂无收货地址"}</p></div>
            <div className="shipping-line"><span><Truck size={15} />{row.expComDesc || (row.expCom ? optionLabel(row.expCom, dictionaries.expressCompanies) : "尚未选择快递")}</span><span>{row.expCode || row.orderTime?.slice(0, 10) || ""}</span></div>
            {row.expNewDesc ? <p className="latest-route"><span />{row.expNewDesc}</p> : null}
            <div className="card-actions"><button onClick={() => getDetail(row)}><Eye size={16} />详情</button><button onClick={() => getEditor(row)}><Pencil size={16} />修改</button><button onClick={() => setCopyTarget(row)}><Copy size={16} />复制</button><button className="primary-action" onClick={() => openShipping(row)}><Send size={16} />发货</button></div>
            <div className="card-more"><button onClick={() => requestBatch("tosend", "设为待发", row)}>设为待发</button><button onClick={() => requestBatch("finish", "完成订单", row)}>完成</button><button onClick={() => refreshLogistics(row)}>刷新物流</button><button className="danger-text" onClick={() => requestDelete(row)}>删除</button></div>
          </article>
        ))}
      </div>
      {rows.length < total ? <button className="load-more" type="button" onClick={() => setFilters((current: DataRow) => ({ ...current, pageSize: Number(current.pageSize || 20) + 20 }))}>{loading ? <LoaderCircle className="spin" size={17} /> : <ChevronRight size={17} />}加载更多</button> : null}

      <Sheet open={filterOpen} title="筛选订单" onClose={() => setFilterOpen(false)}><form className="mobile-form" onSubmit={(e) => { e.preventDefault(); setFilters((current: DataRow) => ({ ...current, pageNum: 1 })); setFilterOpen(false); }}><div className="form-grid"><label><span>订单号</span><input value={filters.orderCode || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderCode: e.target.value }))} /></label><label><span>订单状态</span><select value={filters.orderStatus || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderStatus: e.target.value }))}><option value="">全部</option>{dictionaries.orderStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>商品名称</span><select value={filters.orderName || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderName: e.target.value }))}><option value="">全部</option>{dictionaries.products.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>商品规格</span><select value={filters.orderType || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderType: e.target.value }))}><option value="">全部</option>{dictionaries.sizes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{[["customer","收件人"],["phone","手机号"],["expCode","快递单号"],["createBy","创建人"],["purchaser","下单人"],["orderDesc","备注"]].map(([key,label]) => <label key={key}><span>{label}</span><input value={filters[key] || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, [key]: e.target.value }))} /></label>)}<label><span>快递公司</span><select value={filters.expCom || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, expCom: e.target.value }))}><option value="">全部</option>{dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>下单时间</span><input type="date" value={filters.orderTime || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderTime: e.target.value }))} /></label></div><div className="form-footer"><button type="button" className="button button-ghost" onClick={() => setFilters({ pageNum: 1, pageSize: 20 })}>重置</button><button className="button button-primary" type="submit"><Search size={17} />应用筛选</button></div></form></Sheet>
      <Sheet open={editor !== null} title={editor === "new" ? "新增订单" : "修改订单"} onClose={() => setEditor(null)} wide>{editor !== null ? <OrderEditor initial={editor === "new" ? null : editor} onSaved={load} onClose={() => setEditor(null)} notify={notify} /> : null}</Sheet>
      <Sheet open={shipping !== null} title="填写发货信息" onClose={() => setShipping(null)}>{shipping ? <ShippingEditor initial={shipping} onSaved={() => { setSelected(new Set()); load(); }} onClose={() => setShipping(null)} notify={notify} /> : null}</Sheet>
      <Sheet open={copyTarget !== null} title="复制订单信息" onClose={() => setCopyTarget(null)}>{copyTarget ? <OrderCopyMenu row={copyTarget} onCopy={(text, message) => { copy(text, message); setCopyTarget(null); }} /> : null}</Sheet>
      <Sheet open={detail !== null} title="订单详情" onClose={() => setDetail(null)} wide>{detail ? <OrderDetail row={detail} onCopy={() => { setCopyTarget(detail); setDetail(null); }} /> : null}</Sheet>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function OrderDetail({ row, onCopy }: { row: DataRow; onCopy: () => void }) {
  const details = [["订单状态", row.orderStatusDesc || row.orderStatus],["下单人", row.purchaser],["下单时间", row.orderTime],["商品", `${row.orderNameDesc || ""} ${row.orderTypeDesc || ""} × ${row.orderNum || 1}`],["收件人", row.customer],["手机号", row.phone],["收货地址", row.address],["快递公司", row.expComDesc || row.expCom],["快递单号", row.expCode],["备注", row.orderDesc],["店铺", row.store]];
  return <div className="detail-view"><div className="detail-code"><div><small>订单编号</small><b>{row.orderCode}</b></div><button className="icon-button" onClick={onCopy}><Copy size={18} /></button></div><div className="detail-grid">{details.map(([label,value]) => <div key={String(label)}><span>{label}</span><b>{value || "--"}</b></div>)}</div><div className="timeline-title"><Truck size={18} /><h3>物流轨迹</h3></div><div className="timeline">{Array.isArray(row.expInfoList) && row.expInfoList.length ? row.expInfoList.map((item: DataRow, index: number) => <div className={index === 0 ? "active" : ""} key={`${item.expTime}-${index}`}><span /><section><b>{item.expStatusDesc || "物流更新"}</b><p>{item.expDesc || "--"}</p><small>{item.expTime || ""}</small></section></div>) : <p className="timeline-empty">暂无物流轨迹</p>}</div></div>;
}

type CrudConfig = {
  key: MenuKey;
  title: string;
  itemName: string;
  api: string;
  icon: typeof ReceiptText;
  titleKey: string;
  subtitle?: (row: DataRow) => string;
  searchFields: FieldConfig[];
  fields: FieldConfig[];
  display: Array<{ key: string; label: string; money?: boolean; options?: Array<{ value: string | number; label: string }>; format?: (row: DataRow) => string }>;
  note?: (row: DataRow) => string;
  extraAction?: { label: string; path: (row: DataRow) => string; method: string };
  importable?: boolean;
};

function createCrudConfigs(dictionaries: Dictionaries): Record<Exclude<MenuKey, "home" | "orders" | "orderEntry" | "orderLink" | "purchasers" | "tracking">, CrudConfig> {
  return {
  bills: {
    key: "bills", title: "账单管理", itemName: "账单", api: "/biz/bill", icon: ReceiptText, titleKey: "orderCode",
    subtitle: (row) => `${row.orderNameDesc || optionLabel(row.orderName, dictionaries.products)} · ${row.orderTypeDesc || optionLabel(row.orderType, dictionaries.sizes)} · ${row.customer || "暂无收件人"}`,
    searchFields: [{ key: "orderCode", label: "订单号" }, { key: "createBy", label: "创建人" }],
    fields: [{ key: "orderCode", label: "订单号", required: true }, { key: "goodsPrice", label: "商品成本", type: "number" }, { key: "packagePrice", label: "包装费", type: "number" }, { key: "expPrice", label: "快递费", type: "number" }, { key: "addPrice", label: "附加费", type: "number" }, { key: "totalPrice", label: "总成本", type: "number", readonly: true }, { key: "salePrice", label: "销售价格", type: "number" }, { key: "gainPrice", label: "盈利", type: "number", readonly: true }, { key: "remark", label: "备注", type: "textarea" }],
    display: [
      { key: "orderName", label: "商品名称", options: dictionaries.products }, { key: "orderType", label: "商品规格", options: dictionaries.sizes },
      { key: "orderNum", label: "数量" }, { key: "orderTime", label: "下单时间", format: (row) => shortDate(row.orderTime) },
      { key: "customer", label: "收件人" }, { key: "phone", label: "手机号" },
      { key: "goodsPrice", label: "商品成本", money: true },
      { key: "packagePrice", label: "包装费", money: true }, { key: "expPrice", label: "快递费", money: true },
      { key: "addPrice", label: "附加费", money: true }, { key: "totalPrice", label: "总成本", money: true },
      { key: "salePrice", label: "售价", money: true }, { key: "gainPrice", label: "盈利", money: true },
      { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", format: (row) => shortDate(row.createTime, true) },
    ],
    note: (row) => [row.address ? `收货地址：${row.address}` : "", row.remark ? `备注：${row.remark}` : ""].filter(Boolean).join(" · "),
    extraAction: { label: "同步价格", path: (row) => `/biz/bill/${row.id}`, method: "PATCH" },
  },
  express: {
    key: "express", title: "快递管理", itemName: "快递信息", api: "/biz/exp", icon: Truck, titleKey: "expCode",
    subtitle: (row) => String(row.orderCode || "暂无关联订单"),
    searchFields: [{ key: "orderCode", label: "订单号" }, { key: "expCode", label: "快递单号" }, { key: "expTime", label: "快递时间", type: "date" }, { key: "expStatus", label: "快递状态", type: "select", options: EXPRESS_STATUS_OPTIONS }],
    fields: [{ key: "expCode", label: "快递单号", required: true }, { key: "expTime", label: "快递时间", type: "datetime-local" }, { key: "expStatus", label: "快递状态", type: "select", options: EXPRESS_STATUS_OPTIONS }, { key: "expDesc", label: "快递描述", type: "textarea" }],
    display: [{ key: "orderCode", label: "订单号" }, { key: "expStatus", label: "快递状态", format: (row) => String(row.expStatusDesc || optionLabel(row.expStatus, EXPRESS_STATUS_OPTIONS)) }, { key: "expTime", label: "快递时间", format: (row) => shortDate(row.expTime, true) }],
    note: (row) => String(row.expDesc || ""),
    extraAction: { label: "刷新物流", path: (row) => `/biz/exp/refresh/${row.orderCode || row.expCode}`, method: "PATCH" },
  },
  prices: {
    key: "prices", title: "价格管理", itemName: "价格方案", api: "/biz/price", icon: BadgeDollarSign, titleKey: "priceCode",
    subtitle: (row) => `${optionLabel(row.orderName, dictionaries.products)} · ${optionLabel(row.orderType, dictionaries.sizes)}`,
    searchFields: [{ key: "orderName", label: "商品名称", type: "select", options: dictionaries.products }, { key: "orderType", label: "商品规格", type: "select", options: dictionaries.sizes }, { key: "expCom", label: "快递公司", type: "select", options: dictionaries.expressCompanies }, { key: "expArea", label: "快递区域", type: "select", options: dictionaries.provinces }, { key: "isDefault", label: "是否默认", type: "select", options: dictionaries.yesNo }, { key: "createBy", label: "创建人" }],
    fields: [{ key: "orderName", label: "商品名称", type: "select", options: dictionaries.products, required: true }, { key: "orderType", label: "商品规格", type: "select", options: dictionaries.sizes, required: true }, { key: "goodsPrice", label: "商品成本", type: "number" }, { key: "expCom", label: "快递公司", type: "select", options: dictionaries.expressCompanies }, { key: "expArea", label: "快递区域", type: "select", options: dictionaries.provinces }, { key: "expPrice", label: "快递费", type: "number" }, { key: "packagePrice", label: "包装费", type: "number" }, { key: "totalPrice", label: "总成本", type: "number", readonly: true }, { key: "salePrice", label: "销售价格", type: "number" }, { key: "isDefault", label: "是否默认", type: "select", options: dictionaries.yesNo, required: true }, { key: "startDate", label: "开始日期", type: "date", required: true }, { key: "endDate", label: "结束日期", type: "date", required: true }, { key: "remark", label: "备注", type: "textarea" }],
    display: [
      { key: "expCom", label: "快递公司", options: dictionaries.expressCompanies }, { key: "expArea", label: "快递区域", options: dictionaries.provinces },
      { key: "goodsPrice", label: "商品成本", money: true }, { key: "expPrice", label: "快递费", money: true },
      { key: "packagePrice", label: "包装费", money: true }, { key: "totalPrice", label: "总成本", money: true },
      { key: "salePrice", label: "销售价格", money: true }, { key: "validity", label: "有效期", format: (row) => `${shortDate(row.startDate)} 至 ${shortDate(row.endDate)}` },
    ],
    note: (row) => [row.remark, row.updateBy ? `修改人：${row.updateBy}` : "", row.updateTime ? `修改时间：${shortDate(row.updateTime, true)}` : ""].filter(Boolean).join(" · "),
    importable: true,
  },
  stores: {
    key: "stores", title: "店铺管理", itemName: "店铺", api: "/biz/store", icon: StoreIcon, titleKey: "name",
    subtitle: (row) => String(row.code || "暂无店铺编码"),
    searchFields: [{ key: "code", label: "店铺编码" }, { key: "name", label: "店铺名称" }, { key: "isDelete", label: "营业状态", type: "select", options: STORE_STATUS_OPTIONS }, { key: "defPurchaser", label: "默认买家" }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", type: "date" }],
    fields: [{ key: "code", label: "店铺编码", required: true }, { key: "name", label: "店铺名称", required: true }, { key: "isDelete", label: "营业状态", type: "select", options: STORE_STATUS_OPTIONS, required: true }, { key: "notice", label: "店铺通知", type: "textarea" }, { key: "defPurchaser", label: "默认买家" }, { key: "noticeType", label: "通知类型", type: "select", options: dictionaries.platforms }, { key: "noticeUrl", label: "通知地址", type: "textarea" }],
    display: [{ key: "isDelete", label: "营业状态", options: STORE_STATUS_OPTIONS }, { key: "code", label: "店铺编码" }, { key: "defPurchaser", label: "默认买家" }, { key: "noticeType", label: "通知类型", options: dictionaries.platforms }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", format: (row) => shortDate(row.createTime) }, { key: "updateTime", label: "更新时间", format: (row) => shortDate(row.updateTime) }],
    note: (row) => [row.notice, row.noticeUrl].filter(Boolean).join(" · "),
  },
  };
}

function CrudModule({ config, notify }: { config: CrudConfig; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const Icon = config.icon;
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<DataRow>({ pageNum: 1, pageSize: 15 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { setLoading(true); try { const result = await apiRequest<DataRow>(`${config.api}/list`, { query }); setRows(Array.isArray(result.rows) ? result.rows : []); setTotal(Number(result.total || 0)); } catch (error) { notify(error instanceof Error ? error.message : `${config.itemName}加载失败`, "error"); } finally { setLoading(false); } }, [config, notify, query]);
  useEffect(() => { load(); }, [load]);
  async function edit(row: DataRow) { try { const result = await apiRequest<DataRow>(`${config.api}/${row.id}`); setEditor(result.data || row); } catch (error) { notify(error instanceof Error ? error.message : "数据加载失败", "error"); } }
  async function extra(row: DataRow) { if (!config.extraAction) return; try { await apiRequest(config.extraAction.path(row), { method: config.extraAction.method }); notify(`${config.extraAction.label}成功`, "success"); load(); } catch (error) { notify(error instanceof Error ? error.message : "操作失败", "error"); } }
  function displayValue(row: DataRow, item: CrudConfig["display"][number]) {
    if (item.format) return item.format(row);
    const value = row[item.key];
    if (value === null || value === undefined || value === "") return "--";
    if (item.money) return `¥${Number(value).toFixed(2)}`;
    return optionLabel(value, item.options);
  }
  return (
    <div className="module-page">
      <div className="module-hero compact-hero"><div><span className="eyebrow">订单管理模块</span><h1>{config.title}</h1><p>共 {total} 条数据，支持手机端快速维护</p></div><button className="round-add" type="button" onClick={() => setEditor("new")}><Plus size={22} /><span>新增</span></button></div>
      <div className="toolbar-card"><div className="quick-search"><Search size={18} /><input value={query[config.searchFields[0]?.key] || ""} onChange={(event) => setQuery((current: DataRow) => ({ ...current, [config.searchFields[0]?.key]: event.target.value, pageNum: 1 }))} placeholder={`搜索${config.searchFields[0]?.label || config.itemName}`} /><button type="button" onClick={load}><ArrowLeft className="search-arrow" size={18} /></button></div><button className="filter-button" type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={18} />筛选</button><button className="icon-button surface" type="button" onClick={load}><RefreshCw className={loading ? "spin" : ""} size={18} /></button></div>
      <div className="secondary-actions">
        <button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/export`, query, `${config.key}_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><Download size={16} />导出</button>
        {config.importable ? <><button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />导入</button><button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/importTemplate`, {}, `${config.key}_template_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><FileSpreadsheet size={16} />模板</button><input ref={fileRef} hidden type="file" accept=".xls,.xlsx" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadFile(`${config.api}/importData`, file, { updateSupport: false }); notify("导入成功", "success"); load(); } catch (error) { notify(error instanceof Error ? error.message : "导入失败", "error"); } event.target.value = ""; }} /></> : null}
      </div>
      <div className="list-heading"><div><h2>{config.itemName}列表</h2><span>共 {total} 条</span></div></div>
      <div className="mobile-card-list">
        {!rows.length ? <EmptyState loading={loading} label={config.itemName} /> : rows.map((row) => {
          const note = config.note?.(row) || "";
          return <article className={`data-card data-card-${config.key}`} key={String(row.id)}>
            <div className="data-card-head"><span className="data-icon"><Icon size={20} /></span><div><b>{row[config.titleKey] || `未命名${config.itemName}`}</b><small>{config.subtitle?.(row) || shortDate(row.createTime, true)}</small></div>{config.key === "express" ? <StatusBadge row={row} /> : config.key === "stores" ? <StoreStatusBadge row={row} /> : row.isDefault !== undefined ? <span className={`status ${Number(row.isDefault) === 1 ? "status-success" : "status-neutral"}`}><span />{Number(row.isDefault) === 1 ? "默认" : "普通"}</span> : null}</div>
            <div className="data-metrics">{config.display.map((item) => <div key={item.key}><span>{item.label}</span><b className={item.money ? "money" : ""}>{displayValue(row, item)}</b></div>)}</div>
            {note ? <p className="data-note">{note}</p> : null}
            <div className="card-actions" style={{ gridTemplateColumns: `repeat(${config.extraAction ? 3 : 2}, 1fr)` }}><button type="button" onClick={() => edit(row)}><Pencil size={16} />修改</button>{config.extraAction ? <button type="button" className="primary-action" onClick={() => extra(row)}><RefreshCw size={16} />{config.extraAction.label}</button> : null}<button type="button" className="danger-text" onClick={() => setConfirm({ title: `删除${config.itemName}`, message: "删除后无法恢复，是否继续？", danger: true, action: async () => { await apiRequest(`${config.api}/${row.id}`, { method: "DELETE" }); notify("删除成功", "success"); load(); } })}><Trash2 size={16} />删除</button></div>
          </article>;
        })}
      </div>
      {rows.length < total ? <button className="load-more" type="button" onClick={() => setQuery((current: DataRow) => ({ ...current, pageSize: Number(current.pageSize || 15) + 15 }))}><ChevronRight size={17} />加载更多</button> : null}
      <Sheet open={filterOpen} title={`筛选${config.itemName}`} onClose={() => setFilterOpen(false)}><form className="mobile-form" onSubmit={(event) => { event.preventDefault(); setQuery((current: DataRow) => ({ ...current, pageNum: 1 })); setFilterOpen(false); }}><div className="form-grid">{config.searchFields.map((field) => <label key={field.key}><span>{field.label}</span><FieldInput field={field} value={query[field.key]} onChange={(value) => setQuery((current: DataRow) => ({ ...current, [field.key]: value }))} /></label>)}</div><div className="form-footer"><button type="button" className="button button-ghost" onClick={() => setQuery({ pageNum: 1, pageSize: 15 })}>重置</button><button className="button button-primary" type="submit"><Search size={17} />应用</button></div></form></Sheet>
      <Sheet open={editor !== null} title={`${editor === "new" ? "新增" : "修改"}${config.itemName}`} onClose={() => setEditor(null)} wide>{editor !== null ? <CrudEditor config={config} initial={editor === "new" ? null : editor} onClose={() => setEditor(null)} onSaved={load} notify={notify} /> : null}</Sheet>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function CrudEditor({ config, initial, onClose, onSaved, notify }: { config: CrudConfig; initial: DataRow | null; onClose: () => void; onSaved: () => void; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const [form, setForm] = useState<DataRow>(() => ({ ...(config.key === "stores" ? { isDelete: 1 } : {}), ...(initial || {}) }));
  const [saving, setSaving] = useState(false);
  function update(key: string, value: unknown) { setForm((current) => { const next = { ...current, [key]: value }; if (config.key === "bills") { const total = Number(next.goodsPrice || 0) + Number(next.packagePrice || 0) + Number(next.expPrice || 0) + Number(next.addPrice || 0); next.totalPrice = total; next.gainPrice = Number(next.salePrice || 0) - total; } if (config.key === "prices") next.totalPrice = Number(next.goodsPrice || 0) + Number(next.expPrice || 0) + Number(next.packagePrice || 0); return next; }); }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { const payload = { ...form }; if (config.key === "express" && typeof payload.expTime === "string") payload.expTime = payload.expTime.replace("T", " "); if (config.key === "stores") payload.isDelete = Number(payload.isDelete || 1); await apiRequest(config.api, { method: form.id ? "PUT" : "POST", body: payload }); notify(form.id ? "修改成功" : "新增成功", "success"); onSaved(); onClose(); } catch (error) { notify(error instanceof Error ? error.message : "保存失败", "error"); } finally { setSaving(false); } }
  return <form className="mobile-form" onSubmit={submit}><div className="form-grid">{config.fields.map((field) => <label className={field.type === "textarea" ? "span-full" : ""} key={field.key}><span>{field.label}{field.required ? " *" : ""}</span><FieldInput field={field} value={form[field.key]} onChange={(value) => update(field.key, value)} /></label>)}</div><button className="button button-primary button-block" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}保存</button></form>;
}

function TrackingPage() {
  const services = [{ name: "快递100", desc: "支持多家快递公司查询", url: "https://m.kuaidi100.com/", color: "orange" },{ name: "顺丰速运", desc: "顺丰官方运单跟踪", url: "https://www.sf-express.com/we/ow/chn/sc/waybill/list", color: "green" },{ name: "EMS", desc: "中国邮政 EMS 邮件查询", url: "https://www.ems.com.cn/queryList", color: "blue" }];
  return <div className="module-page"><div className="module-hero compact-hero"><div><span className="eyebrow">物流工具</span><h1>快递查询</h1><p>快递官方入口集合</p></div><span className="hero-tool-icon"><SearchCheck size={27} /></span></div><div className="tracking-guide"><Sparkles size={20} /><div><b>查询提示</b><p>点击卡片将在新页面打开对应的官方查询页。</p></div></div><div className="tracking-grid">{services.map((service) => <a className={`tracking-card tracking-${service.color}`} href={service.url} target="_blank" rel="noreferrer" key={service.name}><span className="tracking-logo"><Truck size={24} /></span><div><b>{service.name}</b><p>{service.desc}</p></div><ExternalLink size={18} /></a>)}</div><div className="tracking-manual"><h2>快速识别</h2><p>复制快递单号后，选择上方对应平台即可查询。</p><div><Copy size={18} /><span>系统已针对手机端打开移动版查询入口</span></div></div></div>;
}

function MenuSheet({ open, active, username, userInfo, onClose, onSelect, onLogout }: { open: boolean; active: MenuKey; username: string; userInfo: DataRow | null; onClose: () => void; onSelect: (key: MenuKey) => void; onLogout: () => void }) {
  const [view, setView] = useState<"menu" | "profile">("menu");
  useEffect(() => { if (!open) setView("menu"); }, [open]);
  const renderItems = (keys: MenuKey[]) => keys.map((key) => {
    const item = NAV_ITEMS.find((entry) => entry.key === key)!;
    const Icon = item.icon;
    return <button className={active === item.key ? "active" : ""} key={item.key} onClick={() => { onSelect(item.key); onClose(); }}><span><Icon size={21} /></span><b>{item.label}</b><small>{item.description}</small></button>;
  });
  const displayName = String(userInfo?.nickName || userInfo?.userName || username);
  const avatarChar = String(userInfo?.avatar || displayName).slice(0, 1).toUpperCase();
  const dept = userInfo?.dept;
  const roles = Array.isArray(userInfo?.roles) ? userInfo.roles : [];
  const userButton = <button className="menu-user-button" type="button" onClick={() => setView("profile")} aria-label="查看用户信息"><span>{avatarChar}</span><small>用户</small></button>;
  if (view === "profile") return <Sheet open={open} title="用户信息" onClose={onClose}><div className="profile-page">
    <section className="profile-card">
      <span className="profile-avatar">{avatarChar}</span>
      <div>
        <small>{dept?.deptName || "喜八移动工作台"}</small>
        <h3>{displayName}</h3>
        <p><span />{userInfo?.loginDate ? `上次登录 ${shortDate(userInfo.loginDate, true)}${userInfo?.loginIp ? ` · ${userInfo.loginIp}` : ""}` : "账号在线，登录状态正常"}</p>
      </div>
    </section>
    {roles.length ? <section className="profile-roles">{roles.map((role) => <span key={String(role.roleId || role.roleKey)} className="profile-role-chip">{String(role.roleName || role.roleKey || "角色")}</span>)}</section> : null}
    <section className="profile-info">
      <div><span>登录账号</span><b>{userInfo?.userName || username}</b></div>
      <div><span>昵称</span><b>{userInfo?.nickName || "--"}</b></div>
      <div><span>所属部门</span><b>{dept?.deptName || "--"}</b></div>
      <div><span>部门负责人</span><b>{dept?.leader || "--"}</b></div>
      <div><span>手机号</span><b>{maskPhone(String(userInfo?.phonenumber || ""))}</b></div>
      <div><span>邮箱</span><b>{maskEmail(String(userInfo?.email || ""))}</b></div>
      <div><span>性别</span><b>{sexLabel(userInfo?.sex)}</b></div>
      <div><span>最近登录 IP</span><b>{userInfo?.loginIp || "--"}</b></div>
      <div><span>最近登录时间</span><b>{userInfo?.loginDate ? shortDate(userInfo.loginDate, true) : "--"}</b></div>
      <div><span>账号状态</span><b className="profile-status">正常</b></div>
    </section>
    <button className="profile-back" type="button" onClick={() => setView("menu")}><ArrowLeft size={18} />返回全部功能</button>
    <button className="logout-row profile-logout" type="button" onClick={onLogout}><LogOut size={18} />退出当前账号</button>
  </div></Sheet>;
  return <Sheet open={open} title="全部功能" onClose={onClose} headerAction={userButton}><button className={`menu-public-tools menu-home-entry ${active === "home" ? "active" : ""}`} type="button" onClick={() => { onSelect("home"); onClose(); }}><House size={20} /><span><b>工作台</b><small>订单、买家与物流动态总览</small></span><ChevronRight size={17} /></button><div className="menu-groups">
    <section className="menu-group"><div className="menu-group-title"><b>订单处理</b><small>订单与物流日常操作</small></div><div className="menu-grid">{renderItems(["orders", "orderEntry", "express"])}</div></section>
    <section className="menu-group"><div className="menu-group-title"><b>经营管理</b><small>账单、价格及店铺配置</small></div><div className="menu-grid">{renderItems(["bills", "prices", "stores"])}</div></section>
    <section className="menu-group"><div className="menu-group-title"><b>买家服务</b><small>管理买家及专属下单入口</small></div><div className="menu-grid">{renderItems(["orderLink", "purchasers"])}</div></section>
    <section className="menu-group"><div className="menu-group-title"><b>查询工具</b><small>常用物流查询入口</small></div><div className="menu-grid">{renderItems(["tracking"])}</div></section>
  </div><a className="menu-public-tools" href="/tools"><Sparkles size={20} /><span><b>免登录工具箱</b><small>订单查询、链接查询与运费工具</small></span><ChevronRight size={17} /></a><a className="icp-link menu-icp" href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></Sheet>;
}

function AdminShell({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [active, setActive] = useState<MenuKey>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [dictionaries, setDictionaries] = useState<Dictionaries>(EMPTY_DICTIONARIES);
  const [userInfo, setUserInfo] = useState<DataRow | null>(null);
  const notify = useCallback((message: string, type: "success" | "error" | "info" = "info") => { setToast({ message, type }); window.setTimeout(() => setToast(null), 2600); }, []);
  useEffect(() => {
    let mounted = true;
    fetchDictionaries().then((result) => { if (mounted) setDictionaries(result); }).catch(() => notify("系统字典加载失败，列表将显示原始编码", "error"));
    return () => { mounted = false; };
  }, [notify]);
  useEffect(() => {
    let mounted = true;
    // 拉一次 /getInfo，失败时静默降级到 username；仅在已登录后由 AdminShell 持有 token 时调用
    apiRequest<DataRow>("/getInfo").then((result) => { if (mounted) setUserInfo((result.user as DataRow) || result); }).catch(() => { /* 接口失败时保留 username 兜底，不打扰用户 */ });
    return () => { mounted = false; };
  }, []);
  const configs = useMemo(() => createCrudConfigs(dictionaries), [dictionaries]);
  return <DictionaryContext.Provider value={dictionaries}><div className="admin-shell"><aside className="desktop-sidebar"><AppLogo compact /><nav>{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button className={active === item.key ? "active" : ""} key={item.key} onClick={() => setActive(item.key)}><span><Icon size={19} /></span><div><b>{item.label}</b><small>{item.description}</small></div><ChevronRight size={15} /></button>; })}</nav><a className="sidebar-public-tools" href="/tools"><Sparkles size={17} /><span><b>免登录工具箱</b><small>公开查询与运费工具</small></span><ExternalLink size={14} /></a><div className="sidebar-account"><span>{String(userInfo?.avatar || userInfo?.nickName || userInfo?.userName || username).slice(0, 1).toUpperCase()}</span><div><b>{String(userInfo?.nickName || userInfo?.userName || username)}</b><small>已安全登录</small></div><button onClick={onLogout}><LogOut size={17} /></button></div></aside><div className="app-column"><main className="app-main">{active === "home" ? <DashboardPage username={username} userInfo={userInfo} onNavigate={setActive} notify={notify} /> : active === "orders" ? <OrdersPage notify={notify} /> : active === "orderEntry" ? <AdminOrderEntry username={username} notify={notify} /> : active === "orderLink" ? <OrderLinkGenerator embedded /> : active === "purchasers" ? <PurchaserManager embedded /> : active === "tracking" ? <TrackingPage /> : <CrudModule config={configs[active as keyof typeof configs]} notify={notify} />}</main></div><nav className="bottom-nav"><button className={active === "home" ? "active" : ""} onClick={() => setActive("home")}><House size={21} /><span>首页</span></button><button className={active === "orders" ? "active" : ""} onClick={() => setActive("orders")}><ShoppingBag size={21} /><span>订单</span></button><button className={active === "bills" ? "active" : ""} onClick={() => setActive("bills")}><ReceiptText size={21} /><span>账单</span></button><button className={!['home','orders','bills'].includes(active) ? "active" : ""} onClick={() => setMenuOpen(true)}><Menu size={21} /><span>全部</span></button></nav><MenuSheet open={menuOpen} active={active} username={username} userInfo={userInfo} onClose={() => setMenuOpen(false)} onSelect={setActive} onLogout={onLogout} /><Toast toast={toast} /></div></DictionaryContext.Provider>;
}

export default function MobileAdmin() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("管理员");
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  useEffect(() => {
    const stored = getStoredToken();
    const savedName = window.localStorage.getItem("xb-mobile-username");
    if (stored) setToken(stored);
    if (savedName) setUsername(savedName);
    setReady(true);
    const expire = () => setToken("");
    window.addEventListener("xb-session-expired", expire);
    return () => window.removeEventListener("xb-session-expired", expire);
  }, []);
  useEffect(() => {
    if (!ready) return;
    // 启动动画至少展示 ~700ms，让 logo 弹入 + 进度条跑一会儿，再淡出
    const fadeTimer = window.setTimeout(() => setSplashFading(true), 700);
    const hideTimer = window.setTimeout(() => setShowSplash(false), 1100);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(hideTimer); };
  }, [ready]);
  async function logout() {
    try { await apiRequest("/logout", { method: "POST" }); } catch { /* local logout still proceeds */ }
    clearStoredToken(); setToken("");
  }
  if (showSplash) return <div className={`app-loading${splashFading ? " fading" : ""}`}>
    <div className="brand-mark app-loading-mark"><span /></div>
    <h1>xb</h1>
    <div className="app-loading-bar"><span /></div>
    <p>正在启动移动工作台</p>
  </div>;
  if (!token) return <LoginScreen onLogin={(nextToken, nextUsername) => { setStoredToken(nextToken); setToken(nextToken); setUsername(nextUsername); }} />;
  return <AdminShell username={username} onLogout={logout} />;
}
