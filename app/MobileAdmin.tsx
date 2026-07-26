import {
  ArrowLeft,
  BadgeDollarSign,
  Bell,
  Box,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  ChevronDown,
  CircleCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Gauge,
  House,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Power,
  ReceiptText,
  RefreshCw,
  RotateCw,
  ScanText,
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
  adminUpdateLogisticsGlobalQuota,
  adminUpdateLogisticsQuota,
  apiRequest,
  bindEmail,
  changePwdByEmail,
  clearStoredToken,
  copyToClipboard,
  downloadFile,
  getLogisticsGlobalQuota,
  getStoredToken,
  listAllLogisticsQuota,
  listLogisticsUsage,
  listMyLogisticsQuota,
  loginByEmail,
  LogisticsGlobalQuotaStatus,
  LogisticsQuotaStatus,
  LogisticsSwitchType,
  LogisticsUsageRow,
  readFromClipboard,
  resetPasswordByEmail,
  sendEmailCode,
  setStoredToken,
  updateMyLogisticsSwitch,
  updateProfile,
  uploadFile,
} from "./lib/api";
import AdminOrderEntry from "./AdminOrderEntry";
import BatchOrderEntry from "./tools/batch-order/BatchOrderEntry";
import OrderLinkGenerator from "./tools/order-link/OrderLinkGenerator";
import PurchaserManager from "./tools/purchasers/PurchaserManager";
import ShortLinkManager from "./tools/short-links/ShortLinkManager";
import { buildOrderLink, formatOrderLinkCopy } from "./tools/order-link/format";
import { OnboardingOverlay, OnboardingProvider, getPageIntroSteps, getSystemTourSteps, registerOnboardingCommands, unregisterOnboardingCommands, useOnboarding, useOnboardingTriggers } from "./components/onboarding";

type DataRow = Record<string, any>;
type MenuKey = "home" | "orders" | "orderEntry" | "batchOrder" | "bills" | "express" | "prices" | "stores" | "orderLink" | "purchasers" | "tracking" | "logistics" | "shortLinks";
const ALL_MENU_KEYS: MenuKey[] = ["home", "orders", "orderEntry", "batchOrder", "bills", "express", "prices", "stores", "orderLink", "purchasers", "tracking", "logistics", "shortLinks"];
// 当前访问页面：用 localStorage 缓存（URL 保持干净，不带查询参数）
const ACTIVE_PAGE_CACHE_KEY = "xb-h5-active-page";
function readCachedActivePage(): MenuKey {
  if (typeof window === "undefined") return "home";
  try {
    const raw = window.localStorage.getItem(ACTIVE_PAGE_CACHE_KEY);
    if (raw && (ALL_MENU_KEYS as string[]).includes(raw)) return raw as MenuKey;
  } catch { /* 读不到就当首次访问 */ }
  return "home";
}
function writeCachedActivePage(key: MenuKey) {
  try { window.localStorage.setItem(ACTIVE_PAGE_CACHE_KEY, key); } catch { /* 写失败忽略 */ }
}
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
  { key: "batchOrder", label: "批量录单", description: "Excel 粘贴批量下单", icon: FileSpreadsheet },
  { key: "purchasers", label: "买家管理", description: "买家与店铺绑定", icon: User },
  { key: "tracking", label: "快递查询", description: "快递100、顺丰、EMS", icon: SearchCheck },
  { key: "logistics", label: "物流用量", description: "额度、开关与用量记录", icon: Gauge },
  { key: "shortLinks", label: "短链管理", description: "自定义域名短链接跳转", icon: Link2 },
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

/* 数字滚动 hook：从 from 平滑过渡到 to，时长 duration ms */
function useCountUp(to: number, duration = 600): number {
  const [value, setValue] = useState(to);
  const previous = useRef(to);
  useEffect(() => {
    const from = previous.current;
    if (from === to) return;
    const startedAt = performance.now();
    let frame = 0;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const current = from + (to - from) * easeOutCubic(progress);
      setValue(Math.round(current));
      if (progress < 1) frame = requestAnimationFrame(step);
      else previous.current = to;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);
  return value;
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
  const [emailLoginOpen, setEmailLoginOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  // 读取因登录过期跳转带来的 flash 提示（由 apiRequest 在 401 时写入 sessionStorage）
  useEffect(() => {
    const flash = window.sessionStorage.getItem("xb-mobile-flash");
    if (flash) {
      setMessage(flash);
      window.sessionStorage.removeItem("xb-mobile-flash");
    }
  }, []);

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
          {message ? <p className="tool-error login-alert"><ShieldCheck size={14} />{message}</p> : null}
          <button className="login-submit" disabled={loading} type="submit">{loading ? <LoaderCircle className="spin" size={19} /> : <ShieldCheck size={19} />}{loading ? "正在登录" : "安全登录"}</button>
        </form>
        <p className="login-footnote"><span /> 账号密码将通过 RSA 加密传输</p>
        <div className="login-secondary-links">
          <button type="button" className="login-link-button" onClick={() => setEmailLoginOpen(true)}>
            <Send size={14} />使用邮箱登录
          </button>
          <span className="login-link-divider" />
          <button type="button" className="login-link-button" onClick={() => setForgotOpen(true)}>
            <LockKeyhole size={14} />忘记密码
          </button>
        </div>
        <a className="public-tools-entry" href="/tools"><Sparkles size={16} /><span><b>进入免登录工具箱</b><small>订单查询 · 运费计算 · 运费对比</small></span><ChevronRight size={16} /></a>
        <a className="icp-link login-icp" href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a>
      </section>
      <EmailLoginSheet
        open={emailLoginOpen}
        onClose={() => setEmailLoginOpen(false)}
        onLogin={(token, email) => {
          setEmailLoginOpen(false);
          onLogin(token, email);
        }}
      />
      <ForgotPasswordSheet open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </main>
  );
}

/**
 * 邮箱登录 Sheet：邮箱 + 验证码（无密码），用于辅助登录入口
 */
function EmailLoginSheet({
  open,
  onClose,
  onLogin,
}: {
  open: boolean;
  onClose: () => void;
  onLogin: (token: string, username: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (!open) {
      setEmail("");
      setCode("");
      setMessage(null);
      setCountdown(0);
    }
  }, [open]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  async function requestCode() {
    if (!email.trim()) return setMessage({ type: "error", text: "请输入邮箱" });
    if (countdown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailCode(email, "login");
      setMessage({ type: "info", text: "验证码已发送，请到邮箱查收" });
      setCountdown(60);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "发送失败" });
    } finally {
      setSending(false);
    }
  }
  async function submit() {
    if (!email.trim() || !code.trim()) return setMessage({ type: "error", text: "请输入邮箱和验证码" });
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await loginByEmail(email, code);
      const token = String(result.token || "");
      if (!token) throw new Error("登录成功但未返回凭证");
      onLogin(token, email.trim());
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "登录失败" });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Sheet open={open} title="邮箱登录" onClose={onClose}>
      <form
        className="mobile-form email-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label>
          <span>邮箱</span>
          <div className="input-shell">
            <Send size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="请输入注册时使用的邮箱"
            />
          </div>
        </label>
        <label>
          <span>验证码</span>
          <div className="input-shell email-code-shell">
            <ShieldCheck size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
            />
            <button
              type="button"
              className="email-code-button"
              onClick={requestCode}
              disabled={sending || countdown > 0}
            >
              {sending ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
            </button>
          </div>
        </label>
        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
        <button className="button button-primary button-block" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}邮箱登录
        </button>
        <p className="email-auth-tip">未注册邮箱无法登录，请联系管理员开通账号</p>
      </form>
    </Sheet>
  );
}

/**
 * 忘记密码 Sheet：邮箱 + 验证码 + 新密码
 */
function ForgotPasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (!open) {
      setEmail("");
      setCode("");
      setNewPwd("");
      setConfirmPwd("");
      setMessage(null);
      setCountdown(0);
    }
  }, [open]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  async function requestCode() {
    if (!email.trim()) return setMessage({ type: "error", text: "请输入邮箱" });
    if (countdown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailCode(email, "reset");
      setMessage({ type: "info", text: "验证码已发送，请到邮箱查收" });
      setCountdown(60);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "发送失败" });
    } finally {
      setSending(false);
    }
  }
  async function submit() {
    if (!email.trim() || !code.trim()) return setMessage({ type: "error", text: "请输入邮箱和验证码" });
    if (!newPwd || newPwd.length < 5) return setMessage({ type: "error", text: "新密码至少 5 位" });
    if (newPwd !== confirmPwd) return setMessage({ type: "error", text: "两次输入的密码不一致" });
    setSubmitting(true);
    setMessage(null);
    try {
      await resetPasswordByEmail(email, code, newPwd);
      setMessage({ type: "info", text: "密码已重置，请使用新密码登录" });
      window.setTimeout(() => onClose(), 1200);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "重置失败" });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Sheet open={open} title="忘记密码" onClose={onClose}>
      <form
        className="mobile-form email-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label>
          <span>注册邮箱</span>
          <div className="input-shell">
            <Send size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="请输入注册时使用的邮箱"
            />
          </div>
        </label>
        <label>
          <span>验证码</span>
          <div className="input-shell email-code-shell">
            <ShieldCheck size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
            />
            <button
              type="button"
              className="email-code-button"
              onClick={requestCode}
              disabled={sending || countdown > 0}
            >
              {sending ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
            </button>
          </div>
        </label>
        <label>
          <span>新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={newPwd}
              onChange={(event) => setNewPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="至少 5 位"
            />
          </div>
        </label>
        <label>
          <span>确认新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={confirmPwd}
              onChange={(event) => setConfirmPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="再输一次"
            />
          </div>
        </label>
        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
        <button className="button button-primary button-block" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}重置密码
        </button>
      </form>
    </Sheet>
  );
}

/**
 * 改密 Sheet：已登录用户用「邮箱验证码」修改自己的密码
 * 前置：必须已绑定邮箱（由调用方在打开前判断）
 */
function ChangePwdByEmailSheet({
  open,
  boundEmail,
  onClose,
  notify,
}: {
  open: boolean;
  boundEmail: string;
  onClose: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (!open) {
      setEmail("");
      setCode("");
      setNewPwd("");
      setConfirmPwd("");
      setMessage(null);
      setCountdown(0);
    } else if (boundEmail) {
      // 预填当前账号邮箱，用户无需再输入（仍允许手动改）
      setEmail(boundEmail);
    }
  }, [open, boundEmail]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  async function requestCode() {
    if (!email.trim()) return setMessage({ type: "error", text: "请输入邮箱" });
    if (countdown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailCode(email, "change");
      setMessage({ type: "info", text: "验证码已发送，请到邮箱查收" });
      setCountdown(60);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "发送失败" });
    } finally {
      setSending(false);
    }
  }
  async function submit() {
    if (!email.trim() || !code.trim()) return setMessage({ type: "error", text: "请输入邮箱和验证码" });
    if (!newPwd || newPwd.length < 5) return setMessage({ type: "error", text: "新密码至少 5 位" });
    if (newPwd !== confirmPwd) return setMessage({ type: "error", text: "两次输入的密码不一致" });
    setSubmitting(true);
    setMessage(null);
    try {
      await changePwdByEmail(email, code, newPwd);
      notify("密码已修改，请使用新密码重新登录", "success");
      onClose();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "修改失败" });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Sheet open={open} title="修改密码" onClose={onClose}>
      <form
        className="mobile-form email-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="email-auth-tip top">已绑定邮箱才能通过验证码修改密码，验证码会发到下面的邮箱</p>
        <label>
          <span>邮箱</span>
          <div className="input-shell">
            <Send size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="请输入当前账号的邮箱"
            />
          </div>
        </label>
        <label>
          <span>验证码</span>
          <div className="input-shell email-code-shell">
            <ShieldCheck size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
            />
            <button
              type="button"
              className="email-code-button"
              onClick={requestCode}
              disabled={sending || countdown > 0}
            >
              {sending ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
            </button>
          </div>
        </label>
        <label>
          <span>新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={newPwd}
              onChange={(event) => setNewPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="至少 5 位"
            />
          </div>
        </label>
        <label>
          <span>确认新密码</span>
          <div className="input-shell">
            <LockKeyhole size={18} />
            <input
              type="password"
              value={confirmPwd}
              onChange={(event) => setConfirmPwd(event.target.value)}
              autoComplete="new-password"
              placeholder="再输一次"
            />
          </div>
        </label>
        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
        <button className="button button-primary button-block" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}确认修改
        </button>
      </form>
    </Sheet>
  );
}

/**
 * 编辑个人信息 Sheet：
 * - 可编辑：昵称、手机号、性别
 * - 不可编辑（只读）：登录账号、所属部门、岗位（这些由管理员维护）
 * - 邮箱：单独走 BindEmailSheet 流程（要验证码），不在这里编辑
 * - 调 PUT /system/user/profile 写入；保存成功后通过 onSaved 回调让父组件刷新 userInfo
 */
function EditProfileSheet({
  open,
  userInfo,
  username,
  onClose,
  onSaved,
  onBindEmail,
  notify,
}: {
  open: boolean;
  userInfo: DataRow | null;
  username: string;
  onClose: () => void;
  onSaved: () => void;
  onBindEmail: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [nickName, setNickName] = useState("");
  const [phone, setPhone] = useState("");
  const [sex, setSex] = useState("0");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (open) {
      setNickName(String(userInfo?.nickName || ""));
      setPhone(String(userInfo?.phonenumber || ""));
      setSex(String(userInfo?.sex || "0"));
      setMessage(null);
    }
  }, [open, userInfo]);
  const dept = userInfo?.dept;
  const deptName = String(dept?.deptName || "--");
  const roles = Array.isArray(userInfo?.roles) ? userInfo.roles : [];
  const postNames = roles.map((role) => String(role.roleName || role.roleKey || "")).filter(Boolean);
  const lockName = String(userInfo?.userName || username);
  const currentEmail = String(userInfo?.email || "");
  async function submit() {
    if (!nickName.trim()) return setMessage({ type: "error", text: "请输入昵称" });
    if (phone && !/^1[3-9]\d{9}$/.test(phone.trim())) return setMessage({ type: "error", text: "手机号格式不正确" });
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({ nickName, phonenumber: phone, sex });
      notify("个人信息已更新", "success");
      onSaved();
      onClose();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet open={open} title="编辑个人信息" onClose={onClose}>
      <form
        className="mobile-form edit-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="email-auth-tip top">
          登录账号、所属部门和岗位由系统管理员维护，个人只能修改昵称、手机号、性别。邮箱通过验证码单独绑定/更换。
        </p>

        <label>
          <span>登录账号（不可改）</span>
          <div className="field-readonly"><LockKeyhole size={15} />{lockName}</div>
        </label>
        <label>
          <span>所属部门（不可改）</span>
          <div className="field-readonly"><Building2 size={15} />{deptName}</div>
        </label>
        <label>
          <span>岗位（不可改）</span>
          <div className="field-readonly"><Briefcase size={15} />{postNames.length ? postNames.join(" / ") : "--"}</div>
        </label>

        <label>
          <span>昵称</span>
          <div className="input-shell"><User size={18} /><input value={nickName} onChange={(event) => setNickName(event.target.value)} placeholder="请输入昵称" maxLength={30} /></div>
        </label>
        <label>
          <span>手机号</span>
          <div className="input-shell"><Phone size={18} /><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={11} placeholder="11 位手机号" /></div>
        </label>
        <label>
          <span>邮箱</span>
          <div className="field-readonly"><Send size={15} />{currentEmail || "未绑定"}</div>
          <button type="button" className="field-action" onClick={() => { onBindEmail(); onClose(); }}>
            {currentEmail ? "更换邮箱" : "立即绑定邮箱"}
          </button>
          <p className="field-readonly-hint">绑定后可使用「邮箱登录 / 忘记密码 / 邮箱改密」</p>
        </label>
        <label>
          <span>性别</span>
          <select value={sex} onChange={(event) => setSex(event.target.value)}>
            <option value="0">男</option>
            <option value="1">女</option>
            <option value="2">未填写</option>
          </select>
        </label>

        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
        <div className="edit-profile-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>取消</button>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}保存
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * 绑定/更换邮箱 Sheet：邮箱 + 验证码（type=bind）
 * 成功后通过 onSaved 回调让父组件刷新 userInfo
 */
function BindEmailSheet({
  open,
  currentEmail,
  onClose,
  onSaved,
  notify,
}: {
  open: boolean;
  currentEmail: string;
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  useEffect(() => {
    if (open) {
      setEmail(currentEmail || "");
      setCode("");
      setMessage(null);
      setCountdown(0);
    }
  }, [open, currentEmail]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  async function requestCode() {
    const trimmed = email.trim();
    if (!trimmed) return setMessage({ type: "error", text: "请输入邮箱" });
    if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(trimmed)) return setMessage({ type: "error", text: "邮箱格式不正确" });
    if (countdown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailCode(trimmed, "bind");
      setMessage({ type: "info", text: "验证码已发送，请到新邮箱查收" });
      setCountdown(60);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "发送失败" });
    } finally {
      setSending(false);
    }
  }
  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || !code.trim()) return setMessage({ type: "error", text: "请输入邮箱和验证码" });
    if (currentEmail && trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      return setMessage({ type: "error", text: "该邮箱已是当前账号的邮箱" });
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await bindEmail(trimmed, code);
      notify("邮箱已绑定", "success");
      onSaved();
      onClose();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "绑定失败" });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Sheet open={open} title={currentEmail ? "更换邮箱" : "绑定邮箱"} onClose={onClose}>
      <form
        className="mobile-form email-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="email-auth-tip top">
          验证码会发到下面填写的邮箱，填写后请到对应邮箱查收。{currentEmail ? `当前已绑定：${currentEmail}` : "当前未绑定邮箱，绑定后即可使用邮箱登录 / 找回密码 / 邮箱改密。"}
        </p>
        <label>
          <span>新邮箱</span>
          <div className="input-shell">
            <Send size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="请输入新邮箱"
            />
          </div>
        </label>
        <label>
          <span>验证码</span>
          <div className="input-shell email-code-shell">
            <ShieldCheck size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
            />
            <button
              type="button"
              className="email-code-button"
              onClick={requestCode}
              disabled={sending || countdown > 0}
            >
              {sending ? <LoaderCircle className="spin" size={16} /> : countdown > 0 ? `${countdown}s` : "获取验证码"}
            </button>
          </div>
        </label>
        {message ? (
          <p className={`tool-error email-auth-alert ${message.type === "info" ? "is-info" : ""}`}>
            <ShieldCheck size={14} />
            {message.text}
          </p>
        ) : null}
        <button className="button button-primary button-block" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}{currentEmail ? "确认更换" : "确认绑定"}
        </button>
      </form>
    </Sheet>
  );
}

function StatusBadge({ row }: { row: DataRow }) {
  const text = String(row.orderStatusDesc || row.expStatusDesc || row.statusDesc || row.orderStatus || "未知");
  const value = `${row.orderStatus || row.expStatus || ""} ${text}`;
  const tone = /YWC|完成|送达/.test(value) ? "success" : /YFH|YSJ|YSZ|发货|运输|收寄/.test(value) ? "info" : /DTF|DFH|待发/.test(value) ? "warning" : "neutral";
  return <span className={`status status-${tone}`}><span />{text}</span>;
}

/**
 * 物流用量页（per-store）：
 * - 非 admin：列出可见店铺的额度卡（额度 + 3 类分开关 + 今日用量 + 用量记录）
 * - admin：列出所有店铺，可编辑总额度 / 总开关 / 备注
 */
function LogisticsPage({ userInfo, notify }: { userInfo: DataRow | null; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const isAdmin = Number(userInfo?.userId) === 1;
  // 「全局额度」模块只对 admin / pengchenghui 这两个账户开放；
  // 其他个人维度账户直接隐藏整个模块（连数据都不拉）。
  const canViewGlobalQuota = useMemo(() => {
    const u = String(userInfo?.userName || "");
    return u === "admin" || u === "pengchenghui";
  }, [userInfo?.userName]);
  const [stores, setStores] = useState<LogisticsQuotaStatus[]>([]);
  const [global, setGlobal] = useState<LogisticsGlobalQuotaStatus | null>(null);
  const [usage, setUsage] = useState<{ rows: LogisticsUsageRow[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTotal, setEditTotal] = useState<string>("");
  const [editEnabled, setEditEnabled] = useState<number>(1);
  const [editRemark, setEditRemark] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [filterStore, setFilterStore] = useState<string>("");
  const [globalEditing, setGlobalEditing] = useState(false);
  const [globalTotal, setGlobalTotal] = useState<string>("");
  const [globalEnabled, setGlobalEnabled] = useState<number>(1);
  const [globalRemark, setGlobalRemark] = useState<string>("");
  const [globalSaving, setGlobalSaving] = useState(false);
  const pageSize = 20;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Array<Promise<unknown>> = [
        (isAdmin ? listAllLogisticsQuota() : listMyLogisticsQuota()).then((d: any) => setStores((d.data ?? d) as LogisticsQuotaStatus[])),
        ...(canViewGlobalQuota
          ? [getLogisticsGlobalQuota().then((d: any) => setGlobal((d.data ?? d) as LogisticsGlobalQuotaStatus))]
          : [Promise.resolve().then(() => setGlobal(null))]),
        listLogisticsUsage({ pageNum, pageSize, storeCode: filterStore || undefined }).then((d: any) => setUsage({ rows: d.rows || [], total: d.total || 0 })),
      ];
      await Promise.all(tasks);
    } catch (err) {
      notify(err instanceof Error ? err.message : "物流用量加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, canViewGlobalQuota, pageNum, filterStore, notify]);

  useEffect(() => { reload(); }, [reload]);

  async function toggleSwitch(storeCode: string, type: LogisticsSwitchType, currentEnabled: number) {
    const next = currentEnabled === 1 ? 0 : 1;
    try {
      await updateMyLogisticsSwitch(storeCode, type, next === 1);
      notify(next === 1 ? "已开启" : "已关闭", "success");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "更新失败", "error");
    }
  }

  function openEdit(row: LogisticsQuotaStatus) {
    setEditing(row.storeCode);
    setEditTotal(String(row.totalQuota ?? 0));
    setEditEnabled(row.enabled ?? 0);
    setEditRemark(row.remark ?? "");
  }
  async function saveEdit() {
    if (!editing) return;
    const total = Number(editTotal);
    if (!Number.isFinite(total) || total < 0) {
      notify("总额度必须为非负整数", "error");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateLogisticsQuota({
        storeCode: editing,
        totalQuota: total,
        enabled: (editEnabled === 1 ? 1 : 0) as 0 | 1,
        remark: editRemark.trim() || undefined,
      });
      notify("已保存", "success");
      setEditing(null);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  function openGlobalEdit() {
    if (!global) return;
    setGlobalTotal(String(global.totalQuota ?? 0));
    setGlobalEnabled(global.enabled ?? 0);
    setGlobalRemark(global.remark ?? "");
    setGlobalEditing(true);
  }
  async function saveGlobalEdit() {
    const total = Number(globalTotal);
    if (!Number.isFinite(total) || total < 0) {
      notify("全局总额度必须为非负整数", "error");
      return;
    }
    setGlobalSaving(true);
    try {
      await adminUpdateLogisticsGlobalQuota({
        totalQuota: total,
        enabled: (globalEnabled === 1 ? 1 : 0) as 0 | 1,
        remark: globalRemark.trim() || undefined,
      });
      notify("全局额度已保存", "success");
      setGlobalEditing(false);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setGlobalSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(usage.total / pageSize));
  const globalTotal2 = global?.totalQuota ?? 0;
  const globalUsed2 = global?.usedQuota ?? 0;
  const globalRemaining2 = Math.max(0, globalTotal2 - globalUsed2);
  const globalPercent = globalTotal2 > 0 ? Math.min(100, Math.round((globalUsed2 / globalTotal2) * 100)) : 0;
  const globalIsOn = global?.enabled === 1;

  return (
    <div className="module-page logistics-page">
      <div className="module-hero compact-hero">
        <div><small>LOGISTICS USAGE</small><h1>物流用量</h1><p>按店铺维度管理 alicloud 物流接口调用额度和分类型开关</p></div>
        <span className="hero-tool-icon"><Gauge size={27} /></span>
      </div>

      {canViewGlobalQuota && global ? (
        <section className="card logistics-store-card logistics-global-card">
          <header className="quota-header">
            <div>
              <h3>全局额度</h3>
              <p className="card-sub">
                所有店铺共享{isAdmin ? " · 单店额度不得超过此值" : ""}
                {global.remark ? ` · ${global.remark}` : ""}
              </p>
            </div>
            <span className="quota-badge">
              <b>{globalRemaining2}</b>
              <small>/ {globalTotal2} 剩余</small>
            </span>
          </header>
          <div className="quota-bar">
            <span style={{ width: `${globalPercent}%` }} />
          </div>
          <p className="quota-stats">
            已用 {globalUsed2}
            {isAdmin ? ` · 可分配余额 ${global.distributable ?? globalRemaining2}` : ""}
          </p>
          <div className="quota-switches">
            <label className="quota-switch">
              <div>
                <b>全局总开关</b>
                <small>关闭后所有店铺都不能调用物流刷新</small>
              </div>
              {isAdmin ? (
                <div className="quota-switch-control">
                  <span className={`toggle-status ${globalIsOn ? "on" : "off"}`}>{globalIsOn ? "已开启" : "已关闭"}</span>
                  <button
                    type="button"
                    className={`toggle ${globalIsOn ? "on" : "off"}`}
                    onClick={async () => {
                      setGlobalSaving(true);
                      try {
                        await adminUpdateLogisticsGlobalQuota({ enabled: globalIsOn ? 0 : 1 });
                        notify(globalIsOn ? "已关闭" : "已开启", "success");
                        reload();
                      } catch (err) {
                        notify(err instanceof Error ? err.message : "更新失败", "error");
                      } finally {
                        setGlobalSaving(false);
                      }
                    }}
                    aria-pressed={globalIsOn}
                    disabled={globalSaving}
                  >
                    <span />
                  </button>
                </div>
              ) : (
                <span className={`toggle-status ${globalIsOn ? "on" : "off"}`}>{globalIsOn ? "已开启" : "已关闭"}</span>
              )}
            </label>
          </div>
          {isAdmin ? (
            <div className="logistics-store-actions">
              <button className="button button-soft button-small" type="button" onClick={openGlobalEdit}>
                <Pencil size={14} />编辑全局
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {loading && stores.length === 0 ? (
        <div className="page-loading"><LoaderCircle className="spin" size={22} /> 加载中…</div>
      ) : null}

      <div className="list-heading">
        <div>
          <h2>店铺额度</h2>
          <span>共 {stores.length} 个{isAdmin ? "店铺" : "可见店铺"}</span>
        </div>
      </div>

      <div className="logistics-store-list">
        {stores.map((row) => (
          <StoreQuotaCard
            key={row.storeCode}
            row={row}
            isAdmin={isAdmin}
            onToggle={(type, current) => toggleSwitch(row.storeCode, type, current)}
            onEdit={() => openEdit(row)}
          />
        ))}
        {stores.length === 0 && !loading ? (
          <EmptyState loading={false} label="店铺额度" />
        ) : null}
      </div>

      <section className="card logistics-usage-card">
        <div className="list-heading">
          <div>
            <h2>用量记录</h2>
            <span>共 {usage.total} 条 · 每次 alicloud HTTP 200 成功调用记一条</span>
          </div>
          <div className="logistics-usage-filter">
            <select value={filterStore} onChange={(e) => { setFilterStore(e.target.value); setPageNum(1); }}>
              <option value="">全部店铺</option>
              {stores.map((s) => (
                <option key={s.storeCode} value={s.storeCode}>{s.storeName || s.storeCode}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>店铺</th>
                <th>用户</th>
                <th>类型</th>
                <th>来源</th>
                <th>订单号</th>
                <th>扣费</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {usage.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.createTime ? shortDate(row.createTime, true) : "--"}</td>
                  <td>{row.storeName || row.storeCode || "--"}</td>
                  <td>{row.nickName || row.userName || `#${row.userId}`}</td>
                  <td>{switchLabel(row.switchType)}</td>
                  <td>{sourceLabel(row.source)}</td>
                  <td className="td-code">{row.orderCode || "--"}</td>
                  <td>{row.cost}</td>
                  <td>
                    <span className={`status status-${row.success === 1 ? "success" : "warning"}`}><span />{row.success === 1 ? "成功" : "未成功"}</span>
                  </td>
                </tr>
              ))}
              {usage.rows.length === 0 ? (
                <tr><td colSpan={8} className="td-empty">暂无用量记录</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="pager">
            <button className="button button-ghost button-small" type="button" disabled={pageNum <= 1} onClick={() => setPageNum((n) => n - 1)}>上一页</button>
            <span>{pageNum} / {totalPages}</span>
            <button className="button button-ghost button-small" type="button" disabled={pageNum >= totalPages} onClick={() => setPageNum((n) => n + 1)}>下一页</button>
          </div>
        ) : null}
      </section>

      {/* admin 编辑弹窗 */}
      {editing != null ? (
        <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && setEditing(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="编辑店铺额度">
            <header className="sheet-header">
              <h2>编辑店铺额度</h2>
              <button className="sheet-close" type="button" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button>
            </header>
            <form
              className="mobile-form"
              onSubmit={(event) => { event.preventDefault(); saveEdit(); }}
            >
              <label>
                <span>店铺</span>
                <div className="input-shell">
                  <input value={stores.find((s) => s.storeCode === editing)?.storeName || editing} readOnly />
                </div>
              </label>
              <label>
                <span>总额度</span>
                <div className="input-shell">
                  <input type="number" min={0} value={editTotal} onChange={(e) => setEditTotal(e.target.value)} />
                </div>
              </label>
              <label>
                <span>总开关</span>
                <select value={editEnabled} onChange={(e) => setEditEnabled(Number(e.target.value))}>
                  <option value={1}>开启</option>
                  <option value={0}>关闭</option>
                </select>
              </label>
              <label>
                <span>备注</span>
                <div className="input-shell">
                  <input value={editRemark} onChange={(e) => setEditRemark(e.target.value)} maxLength={120} placeholder="可选" />
                </div>
              </label>
              <div className="form-actions">
                <button className="button button-ghost" type="button" onClick={() => setEditing(null)} disabled={saving}>取消</button>
                <button className="button button-primary" type="submit" disabled={saving}>
                  {saving ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}保存
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* admin 编辑全局弹窗 */}
      {globalEditing ? (
        <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !globalSaving && setGlobalEditing(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="编辑全局额度">
            <header className="sheet-header">
              <h2>编辑全局额度</h2>
              <button className="sheet-close" type="button" onClick={() => setGlobalEditing(false)} aria-label="关闭"><X size={18} /></button>
            </header>
            <form
              className="mobile-form"
              onSubmit={(event) => { event.preventDefault(); saveGlobalEdit(); }}
            >
              <p className="card-sub" style={{ margin: "0 0 4px" }}>
                所有店铺的用量汇总后不能超过全局总额度；
                单店总额度调高时不能超过「全局总额度 - 其他店铺已用」。
                当前全局已用 <b>{global?.usedQuota ?? 0}</b>。
              </p>
              <label>
                <span>全局总额度</span>
                <div className="input-shell">
                  <input type="number" min={0} value={globalTotal} onChange={(e) => setGlobalTotal(e.target.value)} />
                </div>
              </label>
              <label>
                <span>全局总开关</span>
                <select value={globalEnabled} onChange={(e) => setGlobalEnabled(Number(e.target.value))}>
                  <option value={1}>开启</option>
                  <option value={0}>关闭</option>
                </select>
              </label>
              <label>
                <span>备注</span>
                <div className="input-shell">
                  <input value={globalRemark} onChange={(e) => setGlobalRemark(e.target.value)} maxLength={120} placeholder="可选" />
                </div>
              </label>
              <div className="form-actions">
                <button className="button button-ghost" type="button" onClick={() => setGlobalEditing(false)} disabled={globalSaving}>取消</button>
                <button className="button button-primary" type="submit" disabled={globalSaving}>
                  {globalSaving ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}保存
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function switchLabel(type: string) {
  if (type === "manual") return "手动";
  if (type === "scheduled") return "定时";
  if (type === "query") return "查询";
  return type || "--";
}
function sourceLabel(source?: string) {
  if (!source) return "--";
  if (source === "user_button") return "按钮";
  if (source === "user_batch") return "批量";
  if (source === "scheduled_task") return "定时任务";
  if (source === "search_query") return "查询";
  if (source === "import") return "导入";
  return source;
}

function StoreQuotaCard({
  row,
  isAdmin,
  onToggle,
  onEdit,
}: {
  row: LogisticsQuotaStatus;
  isAdmin: boolean;
  onToggle: (type: LogisticsSwitchType, currentEnabled: number) => void;
  onEdit: () => void;
}) {
  const remaining = row.remainingQuota ?? 0;
  const total = row.totalQuota ?? 0;
  const used = row.usedQuota ?? 0;
  const usagePercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <section className="card logistics-store-card">
      <header className="quota-header">
        <div>
          <h3>{row.storeName || row.storeCode}</h3>
          <p className="card-sub">
            {row.storeCode}
            {" · "}
            总开关：{row.enabled === 1 ? "已开启" : "已关闭"}
            {row.remark ? ` · ${row.remark}` : ""}
          </p>
        </div>
        <span className="quota-badge">
          <b>{remaining}</b>
          <small>/ {total} 剩余</small>
        </span>
      </header>
      <div className="quota-bar">
        <span style={{ width: `${usagePercent}%` }} />
      </div>
      <p className="quota-stats">已用 {used} · 今日成功 {row.todayUsage ?? 0} 次</p>
      <div className="quota-switches">
        {row.switches.map((sw) => {
          const isOn = sw.enabled === 1;
          return (
            <label className="quota-switch" key={sw.type}>
              <div>
                <b>{sw.label}</b>
                <small>{sw.type === "manual" ? "前端手动刷新按钮" : sw.type === "scheduled" ? "定时任务自动跑" : "查询订单时隐式刷"}</small>
              </div>
              <div className="quota-switch-control">
                <span className={`toggle-status ${isOn ? "on" : "off"}`}>{isOn ? "已开启" : "已关闭"}</span>
                <button
                  type="button"
                  className={`toggle ${isOn ? "on" : "off"}`}
                  onClick={() => onToggle(sw.type, sw.enabled)}
                  aria-pressed={isOn}
                >
                  <span />
                </button>
              </div>
            </label>
          );
        })}
      </div>
      {isAdmin ? (
        <div className="logistics-store-actions">
          <button className="button button-soft button-small" type="button" onClick={onEdit}>
            <Pencil size={14} />编辑额度
          </button>
        </div>
      ) : null}
    </section>
  );
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
      apiRequest<{ data?: DataRow[] }>("/biz/store/options", { query: { createBy: "", name: "" } }),
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
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  async function detectExpress(codeToCheck?: string) {
    const code = (codeToCheck || expCode).trim();
    if (!code) return notify("请先输入快递单号", "info");
    setDetecting(true);
    try {
      const result = await apiRequest<{ data?: DataRow }>("/biz/exp/getCom", { query: { expCode: code } });
      const detected = String(result.data?.expCom || "");
      if (detected) { setExpCom(detected); notify(`已识别为${result.data?.expComDesc || optionLabel(detected, dictionaries.expressCompanies)}`, "success"); }
      else notify("暂未识别快递公司，请手动选择", "info");
    } catch (error) { notify(error instanceof Error ? error.message : "快递识别失败", "error"); }
    finally { setDetecting(false); }
  }
  // 从一段杂文本里挑出最像快递单号的那一截：优先 10+ 位纯数字，其次 10+ 位字母数字混合
  function extractTrackingNumber(text: string): string {
    const digitRuns = text.match(/\d{10,20}/g);
    if (digitRuns && digitRuns.length) {
      digitRuns.sort((a, b) => b.length - a.length);
      return digitRuns[0] || text.trim();
    }
    const alnum = text.match(/[A-Za-z0-9]{10,20}/g);
    if (alnum && alnum.length) {
      alnum.sort((a, b) => b.length - a.length);
      return alnum[0] || text.trim();
    }
    return text.trim();
  }
  async function scanExpress() {
    if (scanning) return;
    setScanning(true);
    try {
      // 优先尝试用 BarcodeDetector + 摄像头真扫码；不支持的浏览器/设备走剪贴板兜底（与录单页的「智能识别」一致）
      if (typeof window !== "undefined" && "BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia) {
        const Detector = (window as unknown as { BarcodeDetector: new (init?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "itf", "pdf417"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        const track = stream.getVideoTracks()[0];
        const capture = new ImageCapture(track);
        // grabFrame 已在 Chromium 实现但 lib.dom.d.ts 未声明，绕过类型检查
        const grabFrame = (capture as unknown as { grabFrame: () => Promise<ImageBitmap> }).grabFrame.bind(capture);
        try {
          for (let attempt = 0; attempt < 30; attempt += 1) {
            const bitmap = await grabFrame();
            const codes = await detector.detect(bitmap);
            if (codes.length) {
              const number = extractTrackingNumber(codes[0].rawValue || "");
              if (number) {
                setExpCode(number);
                notify("扫码成功，正在识别快递公司", "success");
                detectExpress(number);
                return;
              }
            }
            await new Promise((resolve) => window.setTimeout(resolve, 250));
          }
          notify("未识别到快递单号，请手动输入或粘贴", "info");
        } finally {
          track.stop();
          stream.getTracks().forEach((t) => t.stop());
        }
        return;
      }
      // 兜底：从剪贴板读取（手机端扫完码通常会复制，或用户手动复制）
      const text = await readFromClipboard();
      const trimmed = (text || "").trim();
      if (!trimmed) return notify("剪贴板为空，请先扫描或复制快递单号", "info");
      const number = extractTrackingNumber(trimmed);
      if (!number) return notify("未识别到快递单号", "info");
      setExpCode(number);
      notify("已读取剪贴板单号，正在识别快递公司", "success");
      detectExpress(number);
    } catch (error) { notify(error instanceof Error ? error.message : "扫码失败", "error"); }
    finally { setScanning(false); }
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
  return <form className="shipping-editor" onSubmit={submit}><section><span><Truck size={22} /></span><div><small>待发货订单</small><h3>{initial.orderCode || "--"}</h3><p>{initial.customer || "--"} · {initial.orderNameDesc || initial.orderName || "--"} {initial.orderTypeDesc || initial.orderType || ""}</p></div></section><label><span>快递公司 *</span><select required value={expCom} onChange={(event) => setExpCom(event.target.value)}><option value="">请选择快递公司</option>{dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>快递单号 *</span><div className="shipping-code-input"><input required value={expCode} onChange={(event) => setExpCode(event.target.value.trim())} placeholder="请输入或扫描快递单号" /><button type="button" disabled={scanning} onClick={scanExpress} aria-label="扫描快递单号">{scanning ? <LoaderCircle className="spin" size={15} /> : <ScanText size={15} />}扫码</button><button type="button" disabled={detecting} onClick={() => detectExpress()}>{detecting ? <LoaderCircle className="spin" size={15} /> : <SearchCheck size={15} />}识别</button></div></label><p><ShieldCheck size={14} />提交后订单将变为已发货，并记录物流节点。</p><button className="button button-primary button-block" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}{saving ? "正在提交" : "确认发货"}</button></form>;
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
  const [expanded, setExpanded] = useState<{ orders: boolean; buyers: boolean }>({ orders: false, buyers: false });
  const HOME_LIST_PREVIEW = 3;
  const toggleExpanded = (key: "orders" | "buyers") => setExpanded((current) => ({ ...current, [key]: !current[key] }));
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
      // 后端聚合接口：一次返回订单按状态分组计数、账单/店铺/买家总数、最近 10/8/8 列表
      // 替代原先的 8 个并发分页请求（其中 4 个 pageSize=1 只为拿 total）
      const stats = await apiRequest<{ data?: DataRow }>("/biz/order/stats");
      const payload = (stats.data && typeof stats.data === "object" ? stats.data : {}) as DataRow;
      setData({
        orderTotal: Number(payload.orderTotal || 0),
        pending: Number(payload.pending || 0),
        waiting: Number(payload.waiting || 0),
        sent: Number(payload.sent || 0),
        completed: Number(payload.completed || 0),
        billTotal: Number(payload.billTotal || 0),
        storeTotal: Number(payload.storeTotal || 0),
        purchaserTotal: Number(payload.purchaserTotal || 0),
        boundPurchaserTotal: Number(payload.boundPurchaserTotal || 0),
        recentOrders: Array.isArray(payload.recentOrders) ? payload.recentOrders : [],
        recentExpress: Array.isArray(payload.recentExpress) ? payload.recentExpress : [],
        recentPurchasers: Array.isArray(payload.recentPurchasers) ? payload.recentPurchasers : [],
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
      const ok = await copyToClipboard(text);
      if (!ok) throw new Error("复制失败");
      notify(`${purchaser.name || "买家"}的下单链接已复制`, "success");
    } catch {
      notify("复制失败，请在买家管理中重试", "error");
    }
  }

  const shortcuts: Array<{ key: MenuKey; label: string; desc: string; icon: typeof ShoppingBag; tone: string }> = [
    { key: "orders", label: "订单管理", desc: "查询与发货", icon: ShoppingBag, tone: "green" },
    { key: "batchOrder", label: "批量录单", desc: "Excel 粘贴批量下单", icon: FileSpreadsheet, tone: "green" },
    { key: "orderLink", label: "生成链接", desc: "买家专属入口", icon: Send, tone: "peach" },
    { key: "purchasers", label: "买家管理", desc: `${data.purchaserTotal} 位买家`, icon: User, tone: "green" },
    { key: "express", label: "快递管理", desc: "物流轨迹", icon: Truck, tone: "blue" },
    { key: "bills", label: "账单管理", desc: `${data.billTotal} 条账单`, icon: WalletCards, tone: "amber" },
  ];

  const attentionTotal = data.pending + data.waiting;
  const animatedAttention = useCountUp(attentionTotal, 700);

  return <div className="home-space">
    <header className="home-intro">
      <div>
        <span>{today}{deptName ? ` · ${deptName}` : ""}{primaryRole ? ` · ${primaryRole}` : ""}</span>
        <h1>{greeting}，{displayName}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="home-intro-actions">
        <button className="home-create-order" type="button" onClick={() => onNavigate("orderEntry")}><Plus size={18} />快速录单</button>
        <button className="home-refresh" type="button" onClick={load} aria-label="刷新首页"><RefreshCw className={loading ? "spin" : ""} size={18} /></button>
      </div>
    </header>

    <section className="home-glance" aria-label="今日订单概况">
      <button className="home-attention" type="button" onClick={() => onNavigate("orders")}>
        <div className="attention-body">
          <span><RotateCw size={19} />今日重点</span>
          <em>打开订单<ChevronRight size={16} /></em>
        </div>
        <div className={`attention-number ${attentionTotal ? "" : "zero"}`}>
          <b>{animatedAttention}</b>
          <small>{attentionTotal ? "待处理" : "已清空"}</small>
        </div>
      </button>
      <div className="home-stat-strip">
        <button type="button" onClick={() => onNavigate("orders")}><small>全部订单</small><b>{data.orderTotal}</b><span><ShoppingBag size={16} />累计</span></button>
        <button type="button" onClick={() => onNavigate("orders")}><small>待发货</small><b>{data.waiting}</b><span><PackageCheck size={16} />需跟进</span></button>
        <button type="button" onClick={() => onNavigate("orders")}><small>已完成</small><b>{data.completed}</b><span><CircleCheck size={16} />已归档</span></button>
      </div>
    </section>

    <section className="home-actions">
      <div className="home-section-heading"><div><h2>常用操作</h2><p>{data.storeTotal} 个店铺正在使用</p></div></div>
      <div className="home-action-rail">{shortcuts.map((item) => { const Icon = item.icon; return <button type="button" onClick={() => onNavigate(item.key)} key={item.key}><span><Icon size={19} /></span><b>{item.label}</b><small>{item.desc}</small></button>; })}</div>
    </section>

    <div className="home-content-grid">
      <section className="home-feed home-order-feed">
        <div className="home-section-heading"><div><h2>最近订单</h2><p>最新 {data.recentOrders.length} 笔订单</p></div><button type="button" onClick={() => onNavigate("orders")}>全部订单<ChevronRight size={15} /></button></div>
        <div className="home-order-list">{loading && !data.recentOrders.length ? <div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载</div> : data.recentOrders.length ? (expanded.orders ? data.recentOrders : data.recentOrders.slice(0, HOME_LIST_PREVIEW)).map((row) => <button type="button" key={String(row.id)} onClick={() => onNavigate("orders")}><span className="home-order-mark">{String(row.orderNameDesc || "果").slice(-1)}</span><div><b>{row.orderNameDesc || row.orderName || "未命名商品"} · {row.orderTypeDesc || row.orderType || "--"}</b><small>{row.customer || "--"} · {shortDate(row.orderTime)}</small></div><StatusBadge row={row} /></button>) : <div className="home-empty"><ShoppingBag size={22} />暂无订单</div>}</div>
        {data.recentOrders.length > HOME_LIST_PREVIEW ? <button className="home-list-toggle" type="button" onClick={() => toggleExpanded("orders")}>{expanded.orders ? "收起" : "展开更多"}<ChevronDown size={15} className={expanded.orders ? "rotated" : ""} /></button> : null}
      </section>

      <section className="home-feed home-buyer-feed">
        <div className="home-section-heading"><div><h2>最近买家</h2><p>{data.boundPurchaserTotal}/{data.purchaserTotal} 已绑定店铺</p></div><button type="button" onClick={() => onNavigate("purchasers")}>管理买家<ChevronRight size={15} /></button></div>
        <div className="home-buyer-list">{loading && !data.recentPurchasers.length ? <div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载</div> : data.recentPurchasers.length ? (expanded.buyers ? data.recentPurchasers : data.recentPurchasers.slice(0, HOME_LIST_PREVIEW)).map((purchaser) => <article key={String(purchaser.id || purchaser.shortId)}><span>{String(purchaser.name || "买").slice(0, 1)}</span><div><b>{purchaser.name || "未命名买家"}</b><p>{purchaser.storeName || "尚未绑定店铺"}</p></div><button className={purchaser.storeId ? "" : "unbound"} type="button" onClick={() => copyPurchaserLink(purchaser)}>{purchaser.storeId ? <Copy size={15} /> : <ChevronRight size={15} />}</button></article>) : <div className="home-empty"><User size={22} />暂无买家</div>}</div>
        {data.recentPurchasers.length > HOME_LIST_PREVIEW ? <button className="home-list-toggle" type="button" onClick={() => toggleExpanded("buyers")}>{expanded.buyers ? "收起" : "展开更多"}<ChevronDown size={15} className={expanded.buyers ? "rotated" : ""} /></button> : null}
      </section>
    </div>

    <section className="home-logistics">
      <div className="home-section-heading"><div><h2>物流动态</h2><p>{data.sent} 个订单已发货</p></div><button type="button" onClick={() => onNavigate("express")}>快递管理<ChevronRight size={15} /></button></div>
      {data.recentExpress.length ? <div className="home-logistics-row">{data.recentExpress.map((row, index) => <article key={String(row.id)} className={index === 0 ? "latest" : ""}><i /><div><div><b>{row.expStatusDesc || row.expStatus || "物流更新"}</b><time>{shortDate(row.expTime, true)}</time></div><p>{row.expDesc || "暂无物流描述"}</p><small>订单 {row.orderCode || "--"}</small></div></article>)}</div> : <div className="home-empty"><Truck size={22} />暂无物流动态</div>}
    </section>
  </div>;
}

function OrdersPage({ notify, onNavigate }: { notify: (message: string, type?: "success" | "error" | "info") => void; onNavigate?: (key: MenuKey) => void }) {
  const dictionaries = useContext(DictionaryContext);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadAllState, setLoadAllState] = useState<{ loading: boolean; current: number; total: number }>({ loading: false, current: 0, total: 0 });
  const [filters, setFilters] = useState<DataRow>({ pageNum: 1, pageSize: 20 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [detail, setDetail] = useState<DataRow | null>(null);
  const [shipping, setShipping] = useState<DataRow | null>(null);
  const [copyTarget, setCopyTarget] = useState<DataRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 顶部状态卡片过滤：null = 不过滤（全部）
  const [statusFilter, setStatusFilter] = useState<"pending" | "shipping" | "transit" | null>(null);
  // 串行刷新物流进度（与同步所有同款结构）
  const [refreshState, setRefreshState] = useState<{ loading: boolean; current: number; total: number; success: number; failed: number }>({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<DataRow>("/biz/order/list", { query: filters });
      setRows(Array.isArray(result.rows) ? result.rows : []); setTotal(Number(result.total || 0));
    } catch (error) { notify(error instanceof Error ? error.message : "订单加载失败", "error"); }
    finally { setLoading(false); }
  }, [filters, notify]);
  useEffect(() => { load(); }, [load]);
  // order_info.store 现在统一存的是 storeCode。订单详情展示时拿 code 反查店名，
  // 让运营看到的还是「小曾桃铺」而不是「xiaozeng_001」。
  const [storeList, setStoreList] = useState<DataRow[]>([]);
  useEffect(() => {
    let mounted = true;
    apiRequest<{ data?: DataRow[] }>("/biz/store/options", { query: { createBy: "", name: "" } })
      .then((result) => {
        if (!mounted) return;
        const list = Array.isArray(result.data) ? result.data : [];
        setStoreList(list.filter((item) => Number(item.isDelete ?? 1) === 1));
      })
      .catch(() => { /* 加载失败不影响主功能 */ });
    return () => { mounted = false; };
  }, []);
  const storeNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    storeList.forEach((row) => {
      const code = String(row.code || "").trim();
      const name = String(row.name || row.value || "").trim();
      if (code && name) map[code] = name;
    });
    return map;
  }, [storeList]);

  const selectedRows = rows.filter((row) => selected.has(String(row.id)));
  const ids = selectedRows.map((row) => row.id).join(",");
  const codes = selectedRows.map((row) => row.orderCode).join(",");
  // 顶部 4 个状态卡片：基于全量 rows 客户端聚合（不受 statusFilter 影响）
  const counts = useMemo(() => ({
    pending: rows.filter((row) => /DSH|待处理/.test(`${row.orderStatus}${row.orderStatusDesc}`)).length,
    shipping: rows.filter((row) => /DTF|DFH|待发/.test(`${row.orderStatus}${row.orderStatusDesc}`)).length,
    transit: rows.filter((row) => /YFH|YSJ|YSZ|发货|运输/.test(`${row.orderStatus}${row.orderStatusDesc}`)).length,
  }), [rows]);
  // 按顶部状态卡片过滤后的可见订单（用于列表渲染 + 全选本页）
  const visibleRows = useMemo(() => {
    if (!statusFilter) return rows;
    if (statusFilter === "pending") return rows.filter((row) => /DSH|待处理/.test(`${row.orderStatus}${row.orderStatusDesc}`));
    if (statusFilter === "shipping") return rows.filter((row) => /DTF|DFH|待发/.test(`${row.orderStatus}${row.orderStatusDesc}`));
    return rows.filter((row) => /YFH|YSJ|YSZ|发货|运输/.test(`${row.orderStatus}${row.orderStatusDesc}`));
  }, [rows, statusFilter]);

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
  // 单条刷新（卡片/批量条都用）
  async function refreshLogistics(row?: DataRow) {
    const target = row ? String(row.orderCode) : codes;
    if (!target) return notify("请先选择订单", "info");
    try { await apiRequest(`/biz/exp/refresh/${target}`, { method: "PATCH" }); notify("物流轨迹已更新", "success"); await load(); }
    catch (error) { notify(error instanceof Error ? error.message : "物流刷新失败", "error"); }
  }
  // 串行刷新：按列表顺序，只刷「已发货 YFH」状态；与价格页「同步所有」同款实现
  async function refreshLogisticsAll() {
    if (refreshState.loading) return;
    // 选中有 → 只刷选中的已发货；未选 → 刷当前可见的已发货（顶部过滤后剩余）
    const pool = selected.size ? selectedRows : visibleRows;
    const targets = pool.filter((row) => /YFH|已发货/.test(`${row.orderStatus}${row.orderStatusDesc}`));
    if (!targets.length) {
      notify("没有可刷新的已发货订单", "info");
      return;
    }
    const total = targets.length;
    let processed = 0;
    let success = 0;
    let failed = 0;
    let firstErrorMsg = "";
    setRefreshState({ loading: true, current: 0, total, success: 0, failed: 0 });
    for (const row of targets) {
      try {
        await apiRequest(`/biz/exp/refresh/${row.orderCode}`, { method: "PATCH" });
        success += 1;
      } catch (error) {
        failed += 1;
        if (!firstErrorMsg) firstErrorMsg = error instanceof Error ? error.message : "刷新失败";
      }
      processed += 1;
      setRefreshState({ loading: true, current: processed, total, success, failed });
    }
    setRefreshState({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
    const summary = `刷新完成：成功 ${success} 条，失败 ${failed} 条${firstErrorMsg ? `（${firstErrorMsg}）` : ""}`;
    notify(summary, failed ? "error" : "success");
    await load();
  }
  async function copy(text: string, message: string) {
    const ok = await copyToClipboard(text);
    if (ok) notify(message, "success");
    else notify("复制失败，请手动选择文本复制", "error");
  }
  async function loadAllOrders() {
    if (loadAllState.loading) return;
    const pageSize = Number(filters.pageSize || 20) || 20;
    setLoadAllState({ loading: true, current: 0, total: 0 });
    const accumulated: DataRow[] = [];
    let serverTotal = 0;
    let pageNum = 1;
    const maxPages = 200;
    try {
      while (pageNum <= maxPages) {
        const result = await apiRequest<DataRow>("/biz/order/list", { query: { ...filters, pageNum, pageSize } });
        const pageRows = Array.isArray(result.rows) ? result.rows : [];
        serverTotal = Number(result.total || 0);
        accumulated.push(...pageRows);
        setLoadAllState({ loading: true, current: accumulated.length, total: serverTotal });
        if (!pageRows.length || accumulated.length >= serverTotal) break;
        pageNum += 1;
      }
      setRows(accumulated);
      setTotal(serverTotal);
      notify(`已加载全部 ${accumulated.length} 条订单`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "加载所有订单失败", "error");
      if (accumulated.length) {
        setRows(accumulated);
        setTotal(serverTotal);
      }
    } finally {
      setLoadAllState({ loading: false, current: 0, total: 0 });
    }
  }

  return (
    <div className="module-page order-page">
      <div className="module-hero">
        <div><span className="eyebrow">今日工作台</span><h1>订单管理</h1><p>查询、审核、发货与物流跟进</p></div>
        <button className="round-add" type="button" onClick={() => setEditor("new")}><Plus size={22} /><span>新增</span></button>
      </div>
      <div className="metric-grid">
        <button type="button" className={statusFilter === null ? "active" : ""} onClick={() => setStatusFilter(null)} aria-pressed={statusFilter === null}><span className="metric-icon peach"><ShoppingBag size={19} /></span><p>本页订单</p><b>{rows.length}</b></button>
        <button type="button" className={statusFilter === "pending" ? "active" : ""} onClick={() => setStatusFilter("pending")} aria-pressed={statusFilter === "pending"}><span className="metric-icon amber"><RotateCw size={19} /></span><p>待处理</p><b>{counts.pending}</b></button>
        <button type="button" className={statusFilter === "shipping" ? "active" : ""} onClick={() => setStatusFilter("shipping")} aria-pressed={statusFilter === "shipping"}><span className="metric-icon blue"><PackageCheck size={19} /></span><p>待发货</p><b>{counts.shipping}</b></button>
        <button type="button" className={statusFilter === "transit" ? "active" : ""} onClick={() => setStatusFilter("transit")} aria-pressed={statusFilter === "transit"}><span className="metric-icon green"><Truck size={19} /></span><p>运输中</p><b>{counts.transit}</b></button>
      </div>
      <div className="toolbar-card search-toolbar">
        <label className="quick-search">
          <Search size={15} strokeWidth={2.2} />
          <input
            value={filters.orderCode || ""}
            onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderCode: e.target.value, pageNum: 1 }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); load(); } }}
            placeholder="搜索订单号"
            enterKeyHint="search"
          />
          {filters.orderCode ? <button className="search-clear" type="button" aria-label="清空" onClick={() => setFilters((current: DataRow) => ({ ...current, orderCode: "", pageNum: 1 }))}><X size={14} /></button> : null}
        </label>
        <button
          className={`filter-chip${[filters.orderStatus, filters.orderName, filters.orderType, filters.customer, filters.phone, filters.purchaser, filters.store, filters.expCom, filters.expCode].some((value) => String(value || "").trim()) ? " active" : ""}`}
          type="button"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal size={14} strokeWidth={2.2} />
          筛选
        </button>
        <button className="toolbar-icon" type="button" onClick={load} aria-label="刷新"><RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} /></button>
      </div>
      <div className="secondary-actions">
        <button type="button" onClick={() => onNavigate?.("batchOrder")}><FileSpreadsheet size={16} />批量录入</button>
        <button type="button" onClick={() => downloadFile("biz/order/export", filters, `order_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><Download size={16} />导出</button>
        <button type="button" onClick={loadAllOrders} disabled={loadAllState.loading} className={loadAllState.loading ? "is-loading" : ""}>
          {loadAllState.loading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
          {loadAllState.loading ? (loadAllState.total ? `加载中 ${loadAllState.current}/${loadAllState.total}` : "加载中…") : "加载所有"}
        </button>
      </div>

      {selected.size ? <div className="batch-bar"><div><b>已选 {selected.size} 项</b><button type="button" onClick={() => setSelected(new Set())}>取消选择</button></div><div className="batch-scroll"><button onClick={() => requestBatch("cancelsend", "取消待发")}><X size={15} />取消待发</button><button onClick={() => requestBatch("tosend", "设为待发")}><RotateCw size={15} />待发</button><button onClick={() => requestBatch("send", "一键发货")}><Send size={15} />一键发货</button><button onClick={() => requestBatch("finish", "一键完成")}><CircleCheck size={15} />完成</button><button onClick={refreshLogisticsAll} disabled={refreshState.loading} className={refreshState.loading ? "is-loading" : ""}>{refreshState.loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{refreshState.loading ? `刷新中 ${refreshState.success + refreshState.failed}/${refreshState.total}` : "刷新物流"}</button><button className="danger" onClick={() => requestDelete()}><Trash2 size={15} />删除</button></div></div> : null}

      <div className="list-heading"><div><h2>订单列表</h2><span>共 {total} 条{statusFilter ? ` · 筛选后 ${visibleRows.length} 条` : ""}</span></div>{visibleRows.length ? <button type="button" onClick={() => setSelected(visibleRows.every((row) => selected.has(String(row.id))) ? new Set() : new Set(visibleRows.map((row) => String(row.id))))}>{visibleRows.every((row) => selected.has(String(row.id))) ? "取消全选" : "全选本页"}</button> : null}</div>
      <div className="mobile-card-list">
        {!visibleRows.length ? <EmptyState loading={loading} label={statusFilter ? "筛选结果" : "订单"} /> : visibleRows.map((row) => (
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

      <Sheet open={filterOpen} title="筛选订单" onClose={() => setFilterOpen(false)}>
        <form
          className="filter-sheet"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((current: DataRow) => ({ ...current, pageNum: 1 }));
            setFilterOpen(false);
            load();
          }}
        >
          <div className="filter-sheet-body">
            <section className="filter-section">
              <header><h3>订单状态</h3></header>
              <div className="filter-chips" role="listbox" aria-label="订单状态">
                <button type="button" className={!filters.orderStatus ? "active" : ""} onClick={() => setFilters((current: DataRow) => ({ ...current, orderStatus: "" }))}>全部</button>
                {dictionaries.orderStatuses.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    className={String(filters.orderStatus || "") === String(item.value) ? "active" : ""}
                    onClick={() => setFilters((current: DataRow) => ({ ...current, orderStatus: item.value }))}
                  >{item.label}</button>
                ))}
              </div>
            </section>

            <section className="filter-section">
              <header><h3>商品与规格</h3></header>
              <div className="filter-field-grid">
                <label>
                  <span>商品</span>
                  <select value={filters.orderName || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderName: e.target.value }))}>
                    <option value="">全部商品</option>
                    {dictionaries.products.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>规格</span>
                  <select value={filters.orderType || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderType: e.target.value }))}>
                    <option value="">全部规格</option>
                    {dictionaries.sizes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="filter-section">
              <header><h3>收件信息</h3></header>
              <div className="filter-field-stack">
                <label>
                  <span>订单号</span>
                  <input value={filters.orderCode || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderCode: e.target.value }))} placeholder="输入订单号" />
                </label>
                <div className="filter-field-grid">
                  <label>
                    <span>收件人</span>
                    <input value={filters.customer || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, customer: e.target.value }))} placeholder="姓名" />
                  </label>
                  <label>
                    <span>手机号</span>
                    <input inputMode="tel" value={filters.phone || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, phone: e.target.value }))} placeholder="手机号" />
                  </label>
                </div>
              </div>
            </section>

            <section className="filter-section">
              <header><h3>物流与人员</h3></header>
              <div className="filter-field-stack">
                <div className="filter-field-grid">
                  <label>
                    <span>快递公司</span>
                    <select value={filters.expCom || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, expCom: e.target.value }))}>
                      <option value="">全部快递</option>
                      {dictionaries.expressCompanies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>快递单号</span>
                    <input value={filters.expCode || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, expCode: e.target.value }))} placeholder="运单号" />
                  </label>
                </div>
                <div className="filter-field-grid">
                  <label>
                    <span>下单人</span>
                    <input value={filters.purchaser || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, purchaser: e.target.value }))} placeholder="买家/下单人" />
                  </label>
                  <label>
                    <span>创建人</span>
                    <input value={filters.createBy || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, createBy: e.target.value }))} placeholder="创建人" />
                  </label>
                </div>
                <div className="filter-field-grid">
                  <label>
                    <span>下单时间</span>
                    <input type="date" value={filters.orderTime || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderTime: e.target.value }))} />
                  </label>
                  <label>
                    <span>备注</span>
                    <input value={filters.orderDesc || ""} onChange={(e) => setFilters((current: DataRow) => ({ ...current, orderDesc: e.target.value }))} placeholder="备注关键词" />
                  </label>
                </div>
              </div>
            </section>
          </div>

          <div className="filter-sheet-footer">
            <button
              type="button"
              className="filter-reset"
              onClick={() => {
                setFilters({ pageNum: 1, pageSize: 20 });
              }}
            >重置</button>
            <button className="filter-apply" type="submit">查看结果</button>
          </div>
        </form>
      </Sheet>
      <Sheet open={editor !== null} title={editor === "new" ? "新增订单" : "修改订单"} onClose={() => setEditor(null)} wide>{editor !== null ? <OrderEditor initial={editor === "new" ? null : editor} onSaved={load} onClose={() => setEditor(null)} notify={notify} /> : null}</Sheet>
      <Sheet open={shipping !== null} title="填写发货信息" onClose={() => setShipping(null)}>{shipping ? <ShippingEditor initial={shipping} onSaved={() => { setSelected(new Set()); load(); }} onClose={() => setShipping(null)} notify={notify} /> : null}</Sheet>
      <Sheet open={copyTarget !== null} title="复制订单信息" onClose={() => setCopyTarget(null)}>{copyTarget ? <OrderCopyMenu row={copyTarget} onCopy={(text, message) => { copy(text, message); setCopyTarget(null); }} /> : null}</Sheet>
      <Sheet open={detail !== null} title="订单详情" onClose={() => setDetail(null)} wide>{detail ? <OrderDetail row={detail} onCopy={() => { setCopyTarget(detail); setDetail(null); }} storeNameByCode={storeNameByCode} /> : null}</Sheet>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function statusTone(code?: string): "default" | "success" | "info" | "warning" | "danger" {
  if (code === "YWC") return "success";
  if (/YFH|YSJ|YSZ|YSD/.test(code || "")) return "info";
  if (/YC|YQX/.test(code || "")) return "danger";
  return "warning";
}

function OrderDetail({ row, onCopy, storeNameByCode }: { row: DataRow; onCopy: () => void; storeNameByCode: Record<string, string> }) {
  const tone = statusTone(row.orderStatus);
  const tracking = Array.isArray(row.expInfoList) ? row.expInfoList : [];
  const product = `${row.orderNameDesc || row.orderName || ""} ${row.orderTypeDesc || row.orderType || ""} × ${row.orderNum || 1}`.trim();
  // order_info.store 是 storeCode，展示时用 code→name 反查；如果没匹配上再 fallback 显示原文
  const storeCode = String(row.store || "").trim();
  const storeName = storeCode ? storeNameByCode[storeCode] || storeCode : "";
  return <div className="order-detail">
    <div className="order-detail-head">
      <div className="order-detail-head-info">
        <small>订单编号</small>
        <b>{row.orderCode || "--"}</b>
        <span className={`pill pill-${tone}`}>{row.orderStatusDesc || row.orderStatus || "未知"}</span>
      </div>
      <button className="icon-button" type="button" onClick={onCopy} aria-label="复制订单"><Copy size={18} /></button>
    </div>

    <section className="order-detail-section">
      <header className="order-detail-section-head"><ShoppingBag size={15} /><h3>订单信息</h3></header>
      <div className="order-detail-grid">
        <div><span>下单人</span><b>{row.purchaser || "--"}</b></div>
        <div><span>下单时间</span><b>{String(row.orderTime || "").replace("T", " ").slice(0, 19) || "--"}</b></div>
        <div className="full-width"><span>商品</span><b>{product || "--"}</b></div>
        {storeName ? <div><span>店铺</span><b>{storeName}</b></div> : null}
      </div>
    </section>

    <section className="order-detail-section">
      <header className="order-detail-section-head"><User size={15} /><h3>收件信息</h3></header>
      <div className="order-detail-grid">
        <div><span>收件人</span><b>{row.customer || "--"}</b></div>
        <div><span>手机号</span><b>{row.phone || "--"}</b></div>
        {row.address ? <div className="full-width"><span>收货地址</span><b>{row.address}</b></div> : null}
      </div>
    </section>

    <section className="order-detail-section">
      <header className="order-detail-section-head"><Truck size={15} /><h3>物流信息</h3></header>
      <div className="order-detail-grid">
        <div><span>快递公司</span><b>{row.expComDesc || row.expCom || "暂无"}</b></div>
        <div><span>快递单号</span><b>{row.expCode && row.expCode !== "无" ? row.expCode : "暂无"}</b></div>
      </div>
      {tracking.length ? <div className="order-detail-timeline">{tracking.map((item, index) => <div className={index === 0 ? "latest" : ""} key={String(item.id || `${item.expTime}-${index}`)}><i /><div><b>{item.expStatusDesc || item.expDesc || "物流更新"}</b><p>{item.expDesc || item.desc || "状态已更新"}</p><small>{item.expTime || item.createTime || ""}</small></div></div>)}</div> : <p className="order-detail-empty">暂无物流轨迹</p>}
    </section>

    {row.orderDesc ? <section className="order-detail-section">
      <header className="order-detail-section-head"><Sparkles size={15} /><h3>备注</h3></header>
      <p className="order-detail-note">{row.orderDesc}</p>
    </section> : null}
  </div>;
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
  display: Array<{ key: string; label: string; money?: boolean; fullWidth?: boolean; options?: Array<{ value: string | number; label: string }>; format?: (row: DataRow) => string }>;
  expand?: Array<{ key: string; label: string; money?: boolean; options?: Array<{ value: string | number; label: string }>; format?: (row: DataRow) => string }>;
  summary?: Array<{ key: string; label: string; money?: boolean; tone?: "default" | "success" | "danger"; valueFormat?: (row: DataRow) => string }>;
  note?: (row: DataRow) => string;
  extraAction?: { label: string; path: (row: DataRow) => string; method: string };
  importable?: boolean;
};

function createCrudConfigs(dictionaries: Dictionaries): Record<Exclude<MenuKey, "home" | "orders" | "orderEntry" | "batchOrder" | "orderLink" | "purchasers" | "tracking" | "logistics" | "shortLinks">, CrudConfig> {
  return {
  bills: {
    key: "bills", title: "账单管理", itemName: "账单", api: "/biz/bill", icon: ReceiptText, titleKey: "orderCode",
    subtitle: (row) => `${row.orderNameDesc || optionLabel(row.orderName, dictionaries.products)} · ${row.orderTypeDesc || optionLabel(row.orderType, dictionaries.sizes)} · ${row.customer || "暂无收件人"}`,
    searchFields: [{ key: "orderCode", label: "订单号" }, { key: "createBy", label: "创建人" }],
    fields: [{ key: "orderCode", label: "订单号", required: true }, { key: "goodsPrice", label: "商品成本", type: "number" }, { key: "packagePrice", label: "包装费", type: "number" }, { key: "expPrice", label: "快递费", type: "number" }, { key: "addPrice", label: "附加费", type: "number" }, { key: "totalPrice", label: "总成本", type: "number", readonly: true }, { key: "salePrice", label: "销售价格", type: "number" }, { key: "gainPrice", label: "盈利", type: "number", readonly: true }, { key: "remark", label: "备注", type: "textarea" }],
    summary: [
      { key: "salePrice", label: "售价", money: true, tone: "default" },
      { key: "totalPrice", label: "总成本", money: true, tone: "default" },
      { key: "gainPrice", label: "盈利", money: true, tone: "success" },
    ],
    display: [
      { key: "orderName", label: "商品名称", options: dictionaries.products },
      { key: "orderTypeNum", label: "规格×数量", format: (row) => `${optionLabel(row.orderType, dictionaries.sizes) || row.orderTypeDesc || "--"} × ${row.orderNum || 1}` },
      { key: "customer", label: "收件人" }, { key: "phone", label: "手机号" },
      { key: "address", label: "收货地址", fullWidth: true, format: (row) => row.address || "暂无地址" },
    ],
    expand: [
      { key: "goodsPrice", label: "商品成本", money: true },
      { key: "packagePrice", label: "包装费", money: true },
      { key: "expPrice", label: "快递费", money: true },
      { key: "addPrice", label: "附加费", money: true },
      { key: "createBy", label: "下单人" },
      { key: "orderTime", label: "下单时间", format: (row) => shortDate(row.orderTime) },
    ],
    note: (row) => row.remark ? `备注：${row.remark}` : "",
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
      { key: "totalPrice", label: "总成本", money: true }, { key: "salePrice", label: "销售价格", money: true },
      { key: "validity", label: "有效期", format: (row) => `${shortDate(row.startDate)} 至 ${shortDate(row.endDate)}` },
    ],
    expand: [
      { key: "goodsPrice", label: "商品成本", money: true },
      { key: "packagePrice", label: "包装费", money: true },
      { key: "expPrice", label: "快递费", money: true },
    ],
    note: (row) => [row.remark, row.updateBy ? `修改人：${row.updateBy}` : "", row.updateTime ? `修改时间：${shortDate(row.updateTime, true)}` : ""].filter(Boolean).join(" · "),
    importable: true,
  },
  stores: {
    key: "stores", title: "店铺管理", itemName: "店铺", api: "/biz/store", icon: StoreIcon, titleKey: "name",
    subtitle: (row) => String(row.code || "暂无店铺编码"),
    summary: [
      { key: "isDelete", label: "营业状态", tone: "default", valueFormat: (row) => Number(row.isDelete) === 1 ? "营业中" : Number(row.isDelete) === 2 ? "已暂停" : "未知" },
      { key: "orderCodeRequirePwd", label: "下单码", tone: "default", valueFormat: (row) => Number(row.orderCodeRequirePwd) === 1 ? (row.orderCodePwd ? "需要 · 密码已设" : "需要 · 密码未设") : "免下单码" },
    ],
    searchFields: [{ key: "code", label: "店铺编码" }, { key: "name", label: "店铺名称" }, { key: "isDelete", label: "营业状态", type: "select", options: STORE_STATUS_OPTIONS }, { key: "defPurchaser", label: "默认买家" }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", type: "date" }],
    fields: [{ key: "code", label: "店铺编码", required: true }, { key: "name", label: "店铺名称", required: true }, { key: "isDelete", label: "营业状态", type: "select", options: STORE_STATUS_OPTIONS, required: true }, { key: "notice", label: "店铺通知", type: "textarea" }, { key: "orderCodeRequirePwd", label: "需要下单码", type: "select", options: [{ value: "0", label: "否" }, { value: "1", label: "是" }] }, { key: "orderCodePwd", label: "店铺下单码", placeholder: "4-6 位数字，留空则买家单独配置" }, { key: "defPurchaser", label: "默认买家" }, { key: "noticeType", label: "通知类型", type: "select", options: dictionaries.platforms }, { key: "noticeUrl", label: "通知地址", type: "textarea" }],
    display: [{ key: "isDelete", label: "营业状态", options: STORE_STATUS_OPTIONS }, { key: "code", label: "店铺编码" }, { key: "orderCodeRequirePwd", label: "下单码", format: (row) => Number(row.orderCodeRequirePwd) === 1 ? "需要" : "不需要" }, { key: "defPurchaser", label: "默认买家" }, { key: "noticeType", label: "通知类型", options: dictionaries.platforms }, { key: "createBy", label: "创建人" }, { key: "createTime", label: "创建时间", format: (row) => shortDate(row.createTime) }, { key: "updateTime", label: "更新时间", format: (row) => shortDate(row.updateTime) }],
    note: (row) => [row.notice, row.noticeUrl].filter(Boolean).join(" · "),
  },
  };
}

function CrudModule({ config, dictionaries, notify }: { config: CrudConfig; dictionaries: Dictionaries; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const Icon = config.icon;
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadAllState, setLoadAllState] = useState<{ loading: boolean; current: number; total: number }>({ loading: false, current: 0, total: 0 });
  const [syncAllState, setSyncAllState] = useState<{ loading: boolean; current: number; total: number; success: number; failed: number }>({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
  const [query, setQuery] = useState<DataRow>({ pageNum: 1, pageSize: 15 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { setLoading(true); try { const result = await apiRequest<DataRow>(`${config.api}/list`, { query }); setRows(Array.isArray(result.rows) ? result.rows : []); setTotal(Number(result.total || 0)); } catch (error) { notify(error instanceof Error ? error.message : `${config.itemName}加载失败`, "error"); } finally { setLoading(false); } }, [config, notify, query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setExpanded(new Set()); }, [config.key]);
  async function edit(row: DataRow) { try { const result = await apiRequest<DataRow>(`${config.api}/${row.id}`); setEditor(result.data || row); } catch (error) { notify(error instanceof Error ? error.message : "数据加载失败", "error"); } }
  async function extra(row: DataRow) { if (!config.extraAction) return; try { await apiRequest(config.extraAction.path(row), { method: config.extraAction.method }); notify(`${config.extraAction.label}成功`, "success"); load(); } catch (error) { notify(error instanceof Error ? error.message : "操作失败", "error"); } }
  async function loadAllRows() {
    if (loadAllState.loading) return;
    const pageSize = Number(query.pageSize || 15) || 15;
    setLoadAllState({ loading: true, current: 0, total: 0 });
    const accumulated: DataRow[] = [];
    let serverTotal = 0;
    let pageNum = 1;
    const maxPages = 200;
    try {
      while (pageNum <= maxPages) {
        const result = await apiRequest<DataRow>(`${config.api}/list`, { query: { ...query, pageNum, pageSize } });
        const pageRows = Array.isArray(result.rows) ? result.rows : [];
        serverTotal = Number(result.total || 0);
        accumulated.push(...pageRows);
        setLoadAllState({ loading: true, current: accumulated.length, total: serverTotal });
        if (!pageRows.length || accumulated.length >= serverTotal) break;
        pageNum += 1;
      }
      setRows(accumulated);
      setTotal(serverTotal);
      notify(`已加载全部 ${accumulated.length} 条${config.itemName}`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : `加载所有${config.itemName}失败`, "error");
      if (accumulated.length) {
        setRows(accumulated);
        setTotal(serverTotal);
      }
    } finally {
      setLoadAllState({ loading: false, current: 0, total: 0 });
    }
  }
  async function syncAllRows() {
    if (!config.extraAction || syncAllState.loading) return;
    const pageSize = Number(query.pageSize || 15) || 15;
    const maxPages = 200;
    let totalKnown = 0;
    let processed = 0;
    let success = 0;
    let failed = 0;
    let pageNum = 1;
    setSyncAllState({ loading: true, current: 0, total: 0, success: 0, failed: 0 });
    try {
      while (pageNum <= maxPages) {
        const result = await apiRequest<DataRow>(`${config.api}/list`, { query: { ...query, pageNum, pageSize } });
        const pageRows = Array.isArray(result.rows) ? result.rows : [];
        const serverTotal = Number(result.total || 0);
        if (pageNum === 1) {
          totalKnown = serverTotal;
          if (!totalKnown) {
            notify("没有可同步的记录", "info");
            return;
          }
          setSyncAllState({ loading: true, current: 0, total: totalKnown, success: 0, failed: 0 });
        }
        for (const row of pageRows) {
          try {
            await apiRequest(config.extraAction.path(row), { method: config.extraAction.method });
            success += 1;
          } catch {
            failed += 1;
          }
          processed += 1;
          setSyncAllState({ loading: true, current: processed, total: totalKnown, success, failed });
        }
        if (!pageRows.length || processed >= totalKnown) break;
        pageNum += 1;
      }
      notify(`同步完成：成功 ${success} 条，失败 ${failed} 条`, failed ? "info" : "success");
      load();
    } catch (error) {
      notify(error instanceof Error ? error.message : `同步所有${config.itemName}失败`, "error");
    } finally {
      setSyncAllState({ loading: false, current: 0, total: 0, success: 0, failed: 0 });
    }
  }
  function toggleExpand(id: string | number) {
    setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function copyText(text: string, message: string) {
    const ok = await copyToClipboard(text);
    notify(ok ? message : "复制失败，请手动选择文本复制", ok ? "success" : "error");
  }
  // 店铺专用：快速切换营业/暂停（PUT 全量对象，仅翻 isDelete 一个字段）
  async function toggleStoreStatus(row: DataRow) {
    const isOpen = Number(row.isDelete) === 1;
    const nextValue = isOpen ? 2 : 1;
    setConfirm({
      title: isOpen ? "暂停营业" : "恢复营业",
      message: isOpen ? `暂停后「${row.name || row.code || "该店铺"}」将从列表隐藏（仍可在筛选里选「已关闭」查回），确认？` : `恢复后「${row.name || row.code || "该店铺"}」将重新出现在列表里，确认？`,
      action: async () => {
        try {
          await apiRequest(config.api, { method: "PUT", body: { ...row, isDelete: nextValue } });
          notify(isOpen ? "已暂停营业" : "已恢复营业", "success");
          setConfirm(null);
          load();
        } catch (error) {
          notify(error instanceof Error ? error.message : "切换营业状态失败", "error");
          setConfirm(null);
        }
      },
    });
  }
  function displayValue(row: DataRow, item: CrudConfig["display"][number]) {
    if (item.format) return item.format(row);
    const value = row[item.key];
    if (value === null || value === undefined || value === "") return "--";
    if (item.money) return `¥${Number(value).toFixed(2)}`;
    return optionLabel(value, item.options);
  }
  function summaryValue(row: DataRow, item: NonNullable<CrudConfig["summary"]>[number]) {
    if (item.valueFormat) return item.valueFormat(row);
    const value = row[item.key];
    if (value === null || value === undefined || value === "") return item.money ? "¥0.00" : "--";
    if (item.money) {
      const num = Number(value);
      const sign = num < 0 ? "-" : "";
      return `${sign}¥${Math.abs(num).toFixed(2)}`;
    }
    return String(value);
  }
  function summaryTone(row: DataRow, item: NonNullable<CrudConfig["summary"]>[number]): "default" | "success" | "danger" {
    if (item.tone !== "success") return item.tone || "default";
    const num = Number(row[item.key]);
    if (Number.isFinite(num)) return num < 0 ? "danger" : "success";
    return "success";
  }
  return (
    <div className="module-page">
      <div className="module-hero compact-hero"><div><span className="eyebrow">订单管理模块</span><h1>{config.title}</h1><p>共 {total} 条数据，支持手机端快速维护</p></div><button className="round-add" type="button" onClick={() => setEditor("new")}><Plus size={22} /><span>新增</span></button></div>
      <div className="toolbar-card search-toolbar"><label className="quick-search"><Search size={15} strokeWidth={2.2} /><input value={query[config.searchFields[0]?.key] || ""} onChange={(event) => setQuery((current: DataRow) => ({ ...current, [config.searchFields[0]?.key]: event.target.value, pageNum: 1 }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); load(); } }} placeholder={`搜索${config.searchFields[0]?.label || config.itemName}`} enterKeyHint="search" />{query[config.searchFields[0]?.key] ? <button className="search-clear" type="button" aria-label="清空" onClick={() => setQuery((current: DataRow) => ({ ...current, [config.searchFields[0]?.key]: "", pageNum: 1 }))}><X size={14} /></button> : null}</label><button className={`filter-chip${config.searchFields.some((field) => String(query[field.key] || "").trim()) ? " active" : ""}`} type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={14} strokeWidth={2.2} />筛选</button><button className="toolbar-icon" type="button" onClick={load} aria-label="刷新"><RefreshCw className={loading ? "spin" : ""} size={15} strokeWidth={2.2} /></button></div>
      <div className="secondary-actions">
        <button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/export`, query, `${config.key}_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><Download size={16} />导出</button>
        {config.importable ? <><button type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />导入</button><button type="button" onClick={() => downloadFile(`${config.api.slice(1)}/importTemplate`, {}, `${config.key}_template_${Date.now()}.xlsx`).catch((error) => notify(error.message, "error"))}><FileSpreadsheet size={16} />模板</button><input ref={fileRef} hidden type="file" accept=".xls,.xlsx" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await uploadFile(`${config.api}/importData`, file, { updateSupport: false }); notify("导入成功", "success"); load(); } catch (error) { notify(error instanceof Error ? error.message : "导入失败", "error"); } event.target.value = ""; }} /></> : null}
        <button type="button" onClick={loadAllRows} disabled={loadAllState.loading || (total > 0 && rows.length >= total)} className={loadAllState.loading ? "is-loading" : ""}>
          {loadAllState.loading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
          {loadAllState.loading ? (loadAllState.total ? `加载中 ${loadAllState.current}/${loadAllState.total}` : "加载中…") : "加载所有"}
        </button>
        {config.key === "bills" && config.extraAction ? <button type="button" onClick={syncAllRows} disabled={syncAllState.loading} className={syncAllState.loading ? "is-loading" : ""}>
          {syncAllState.loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          {syncAllState.loading ? (syncAllState.total ? `同步中 ${syncAllState.current}/${syncAllState.total}` : "同步中…") : "同步所有"}
        </button> : null}
      </div>
      <div className="list-heading"><div><h2>{config.itemName}列表</h2><span>共 {total} 条</span></div></div>
      <div className="mobile-card-list">
        {!rows.length ? <EmptyState loading={loading} label={config.itemName} /> : rows.map((row) => {
          const note = config.note?.(row) || "";
          const summary = config.summary;
          const expand = config.expand;
          const isOpen = expanded.has(row.id as string | number);
          const hasExpand = !!expand?.length;
          return <article className={`data-card data-card-${config.key}`} key={String(row.id)}>
            <div className="data-card-head"><span className="data-icon"><Icon size={20} /></span><div><b>{row[config.titleKey] || `未命名${config.itemName}`}</b><small>{config.subtitle?.(row) || shortDate(row.createTime, true)}</small></div>{config.key === "express" ? <StatusBadge row={row} /> : config.key === "stores" ? <StoreStatusBadge row={row} /> : row.isDefault !== undefined ? <span className={`status ${Number(row.isDefault) === 1 ? "status-success" : "status-neutral"}`}><span />{Number(row.isDefault) === 1 ? "默认" : "普通"}</span> : null}</div>
            {summary?.length ? <div className={`data-card-summary data-card-summary-${summary.length}`}>{summary.map((item) => { const tone = summaryTone(row, item); return <div className={`summary-cell tone-${tone}`} key={item.key}><span>{item.label}</span><b>{summaryValue(row, item)}</b></div>; })}</div> : null}
            <div className="data-metrics">{config.display.map((item) => <div key={item.key} className={item.fullWidth ? "full-width" : ""}><span>{item.label}</span><b className={item.money ? "money" : ""}>{displayValue(row, item)}</b></div>)}</div>
            {hasExpand ? <div className={`expand-wrapper ${isOpen ? "open" : ""}`}><div className="expand-inner"><div className="data-metrics data-metrics-expand">{expand!.map((item) => <div key={item.key}><span>{item.label}</span><b className={item.money ? "money" : ""}>{displayValue(row, item)}</b></div>)}</div></div></div> : null}
            {hasExpand ? <button type="button" className={`data-more-toggle ${isOpen ? "open" : ""}`} onClick={() => toggleExpand(row.id as string | number)} aria-expanded={isOpen}><span>{isOpen ? "收起明细" : "查看更多"}</span><ChevronDown size={15} /></button> : null}
            {note ? <p className="data-note">{note}</p> : null}
            {config.key === "stores" ? <div className="store-extras">
              {row.notice ? <div className="store-extra-line"><span><Bell size={13} />{row.noticeType ? optionLabel(row.noticeType, dictionaries.platforms) : "店铺通知"}</span><b>{row.notice}</b></div> : null}
              {row.noticeUrl ? <div className="store-extra-line"><span><ExternalLink size={13} />通知地址</span><b className="store-notice-url">{row.noticeUrl}</b><button type="button" className="store-extra-copy" onClick={() => copyText(String(row.noticeUrl), "通知地址已复制")}><Copy size={12} />复制</button></div> : null}
              {row.orderCodeRequirePwd && row.orderCodePwd ? <div className="store-extra-line"><span><LockKeyhole size={13} />店铺下单码</span><b>{row.orderCodePwd}</b><button type="button" className="store-extra-copy" onClick={() => copyText(String(row.orderCodePwd), "下单码已复制")}><Copy size={12} />复制</button></div> : null}
            </div> : null}
            <div className="card-actions"><button type="button" onClick={() => edit(row)}><Pencil size={16} />修改</button>{config.key === "stores" ? <button type="button" className="primary-action" onClick={() => toggleStoreStatus(row)}><Power size={16} />{Number(row.isDelete) === 1 ? "暂停营业" : "恢复营业"}</button> : null}{config.extraAction ? <button type="button" className="primary-action" onClick={() => extra(row)}><RefreshCw size={16} />{config.extraAction.label}</button> : null}<button type="button" className="danger-text" onClick={() => setConfirm({ title: `删除${config.itemName}`, message: "删除后无法恢复，是否继续？", danger: true, action: async () => { await apiRequest(`${config.api}/${row.id}`, { method: "DELETE" }); notify("删除成功", "success"); load(); } })}><Trash2 size={16} />删除</button></div>
          </article>;
        })}
      </div>
      {rows.length < total ? <button className="load-more" type="button" onClick={() => setQuery((current: DataRow) => ({ ...current, pageSize: Number(current.pageSize || 15) + 15 }))}><ChevronRight size={17} />加载更多</button> : null}
      <Sheet open={filterOpen} title={`筛选${config.itemName}`} onClose={() => setFilterOpen(false)}>
        <form
          className="filter-sheet"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery((current: DataRow) => ({ ...current, pageNum: 1 }));
            setFilterOpen(false);
            load();
          }}
        >
          <div className="filter-sheet-body">
            <section className="filter-section">
              <header><h3>筛选条件</h3></header>
              <div className="filter-field-stack">
                {config.searchFields.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <FieldInput field={field} value={query[field.key]} onChange={(value) => setQuery((current: DataRow) => ({ ...current, [field.key]: value }))} />
                  </label>
                ))}
              </div>
            </section>
          </div>
          <div className="filter-sheet-footer">
            <button type="button" className="filter-reset" onClick={() => setQuery({ pageNum: 1, pageSize: 15 })}>重置</button>
            <button className="filter-apply" type="submit">查看结果</button>
          </div>
        </form>
      </Sheet>
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

function MenuSheet({ open, active, username, userInfo, onClose, onSelect, onLogout, onUserInfoChanged, onReplayTour, notify }: { open: boolean; active: MenuKey; username: string; userInfo: DataRow | null; onClose: () => void; onSelect: (key: MenuKey) => void; onLogout: () => void; onUserInfoChanged: () => void; onReplayTour: () => void; notify: (message: string, type?: "success" | "error" | "info") => void }) {
  const [view, setView] = useState<"menu" | "profile" | "settings">("menu");
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [bindEmailOpen, setBindEmailOpen] = useState(false);
  // 标记修改密码流程是否需要"先绑定邮箱再改密"
  const [pendingChangePwd, setPendingChangePwd] = useState(false);
  useEffect(() => { if (!open) { setView("menu"); setChangePwdOpen(false); setEditProfileOpen(false); setBindEmailOpen(false); setPendingChangePwd(false); } }, [open]);
  const renderItems = (keys: MenuKey[]) => keys.map((key) => {
    const item = NAV_ITEMS.find((entry) => entry.key === key)!;
    const Icon = item.icon;
    return <button className={active === item.key ? "active" : ""} key={item.key} onClick={() => { onSelect(item.key); onClose(); }}><span><Icon size={21} /></span><b>{item.label}</b><small>{item.description}</small></button>;
  });
  const displayName = String(userInfo?.nickName || userInfo?.userName || username);
  const avatarChar = String(userInfo?.avatar || displayName).slice(0, 1).toUpperCase();
  const dept = userInfo?.dept;
  const roles = Array.isArray(userInfo?.roles) ? userInfo.roles : [];
  const userEmail = String(userInfo?.email || "");
  const userButton = <button className="menu-user-button" type="button" data-onboard="menu-user-button" onClick={() => setView("profile")} aria-label="查看用户信息"><span>{avatarChar}</span><small>用户</small></button>;
  // 点"修改密码"：未绑定邮箱先弹 BindEmailSheet，绑定成功后再弹改密弹窗
  function handleChangePwdClick() {
    if (!userEmail) {
      setPendingChangePwd(true);
      setBindEmailOpen(true);
    } else {
      setChangePwdOpen(true);
    }
  }
  function handleEmailBound() {
    // 通知 AdminShell 重新拉取 /getInfo（让 userInfo.email 反映最新值）
    onUserInfoChanged();
    // 如果是从"修改密码"流程进来的，绑完邮箱直接接着弹改密
    if (pendingChangePwd) {
      setPendingChangePwd(false);
      // 短暂延迟，让 userInfo 异步刷新到位（虽然 onUserInfoChanged 已触发，但 state 是异步的）
      window.setTimeout(() => setChangePwdOpen(true), 50);
    }
  }
  if (view === "profile") return <>
    <Sheet open={open} title="用户信息" onClose={onClose}><div className="profile-page">
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
        <div><span>邮箱</span><b className={userEmail ? "" : "profile-info-warn"}>{userEmail ? maskEmail(userEmail) : "未绑定（点下方按钮完善）"}</b></div>
        <div><span>性别</span><b>{sexLabel(userInfo?.sex)}</b></div>
        <div><span>最近登录 IP</span><b>{userInfo?.loginIp || "--"}</b></div>
        <div><span>最近登录时间</span><b>{userInfo?.loginDate ? shortDate(userInfo.loginDate, true) : "--"}</b></div>
        <div><span>账号状态</span><b className="profile-status">正常</b></div>
      </section>
      <button className="profile-back" type="button" onClick={() => setView("menu")}><ArrowLeft size={18} />返回全部功能</button>
      <button className="profile-action" type="button" onClick={() => setEditProfileOpen(true)}>
        <Pencil size={18} />编辑信息
      </button>
      <button className="profile-action" type="button" onClick={handleChangePwdClick} title="通过邮箱验证码修改密码">
        <LockKeyhole size={18} />修改密码
      </button>
      <button className="profile-action" type="button" onClick={() => setBindEmailOpen(true)}>
        <Send size={18} />{userEmail ? "更换邮箱" : "绑定邮箱"}
      </button>
      <button className="profile-action" type="button" onClick={onReplayTour} title="再看一遍新手引导">
        <Sparkles size={18} />重看引导
      </button>
      <button className="logout-row profile-logout" type="button" onClick={onLogout}><LogOut size={18} />退出当前账号</button>
    </div></Sheet>
    <EditProfileSheet
      open={editProfileOpen}
      userInfo={userInfo}
      username={username}
      onClose={() => setEditProfileOpen(false)}
      onSaved={onUserInfoChanged}
      onBindEmail={() => { setEditProfileOpen(false); window.setTimeout(() => setBindEmailOpen(true), 200); }}
      notify={notify}
    />
    <BindEmailSheet
      open={bindEmailOpen}
      currentEmail={userEmail}
      onClose={() => { setBindEmailOpen(false); setPendingChangePwd(false); }}
      onSaved={handleEmailBound}
      notify={notify}
    />
    <ChangePwdByEmailSheet
      open={changePwdOpen}
      boundEmail={userEmail}
      onClose={() => setChangePwdOpen(false)}
      notify={notify}
    />
  </>;
  return <Sheet open={open} title="全部功能" onClose={onClose} headerAction={userButton}><button className={`menu-public-tools menu-home-entry ${active === "home" ? "active" : ""}`} type="button" onClick={() => { onSelect("home"); onClose(); }}><House size={20} /><span><b>工作台</b><small>订单、买家与物流动态总览</small></span><ChevronRight size={17} /></button><div className="menu-groups">
    <section className="menu-group" data-onboard="menu-group-orders"><div className="menu-group-title"><b>订单处理</b><small>订单与物流日常操作</small></div><div className="menu-grid">{renderItems(["orders", "orderEntry", "batchOrder", "express"])}</div></section>
    <section className="menu-group" data-onboard="menu-group-manage"><div className="menu-group-title"><b>经营管理</b><small>账单、价格、店铺、物流额度及短链</small></div><div className="menu-grid">{renderItems(["bills", "prices", "stores", "logistics", "shortLinks"])}</div></section>
    <section className="menu-group" data-onboard="menu-group-buyer"><div className="menu-group-title"><b>买家服务</b><small>管理买家及专属下单入口</small></div><div className="menu-grid">{renderItems(["orderLink", "purchasers"])}</div></section>
    <section className="menu-group" data-onboard="menu-group-tracking"><div className="menu-group-title"><b>查询工具</b><small>常用物流查询入口</small></div><div className="menu-grid">{renderItems(["tracking"])}</div></section>
  </div><a className="menu-public-tools" data-onboard="menu-public-tools" href="/tools"><Sparkles size={20} /><span><b>免登录工具箱</b><small>订单查询、链接查询与运费工具</small></span><ChevronRight size={17} /></a><a className="icp-link menu-icp" href="http://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></Sheet>;
}

function AdminShell({ username, onLogout }: { username: string; onLogout: () => void }) {
  // 当前访问页：先从 localStorage 缓存里取，刷新/下拉刷新后自动停留在上次的页面
  const [active, setActive] = useState<MenuKey>(readCachedActivePage);
  useEffect(() => { writeCachedActivePage(active); }, [active]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [dictionaries, setDictionaries] = useState<Dictionaries>(EMPTY_DICTIONARIES);
  const [userInfo, setUserInfo] = useState<DataRow | null>(null);
  // 登录后若邮箱为空，自动弹"绑定邮箱"页（不再用 Toast 提示）。
  // 用户可关闭；下次登录仍会再弹，直到真正去绑定邮箱。
  const [bindEmailOpen, setBindEmailOpen] = useState(false);
  // 邮箱与系统引导互斥：首次登录且没绑邮箱时，先弹邮箱；引导等邮箱弹窗关闭后再触发。
  // 邮箱关掉/绑好 → 解除门控 → 引导才出来。
  const [tourGatedByEmail, setTourGatedByEmail] = useState(false);
  const notify = useCallback((message: string, type: "success" | "error" | "info" = "info") => { setToast({ message, type }); window.setTimeout(() => setToast(null), 2600); }, []);
  const refreshUserInfo = useCallback(() => {
    // 静默重新拉取 /getInfo，用于"绑定邮箱 / 编辑信息"后让 userInfo 同步最新值
    apiRequest<DataRow>("/getInfo").then((result) => {
      const info = (result.user as DataRow) || result;
      setUserInfo(info);
    }).catch(() => { /* 静默失败，不打扰用户 */ });
  }, []);
  // 引导：注册打开/关闭菜单命令；首次进入触发系统引导；切换 active 触发单步介绍
  const onboardingFull = useOnboarding();
  const onboardingTriggers = useOnboardingTriggers();
  const replaySystemTour = useCallback(() => {
    onboardingTriggers.replaySystemTour(getSystemTourSteps());
    setMenuOpen(false);
    setActive("home");
  }, [onboardingTriggers]);
  // 「全部」按钮的点击：触发菜单打开 + 若当前在 awaitClick 步骤则推进引导
  const handleDockMenuClick = useCallback(() => {
    setMenuOpen(true);
    if (onboardingFull.current?.id === "dock-menu" && onboardingFull.current.awaitClick) {
      void onboardingFull.next();
    }
  }, [onboardingFull]);
  useEffect(() => {
    registerOnboardingCommands({
      openMenu: () => setMenuOpen(true),
      closeMenu: () => setMenuOpen(false),
    });
    return () => unregisterOnboardingCommands();
  }, []);
  useEffect(() => {
    let mounted = true;
    fetchDictionaries().then((result) => { if (mounted) setDictionaries(result); }).catch(() => notify("系统字典加载失败，列表将显示原始编码", "error"));
    return () => { mounted = false; };
  }, [notify]);
  useEffect(() => {
    let mounted = true;
    // 拉一次 /getInfo，失败时静默降级到 username；仅在已登录后由 AdminShell 持有 token 时调用
    apiRequest<DataRow>("/getInfo").then((result) => {
      if (!mounted) return;
      const info = (result.user as DataRow) || result;
      setUserInfo(info);
      // 登录后邮箱完整性检查：未绑邮箱时弹绑定页。
      // 邮箱与系统引导互斥：首次登录（systemDone=false）时，引导等邮箱弹窗关闭后再触发；
      // 老用户（systemDone=true）只弹邮箱，不触发引导。
      if (!info?.email) {
        let systemDone = false;
        try {
          const raw = window.localStorage.getItem("xb-h5-onboarding");
          if (raw) systemDone = (JSON.parse(raw) as { systemDone?: boolean }).systemDone === true;
        } catch { /* */ }
        if (!systemDone) {
          // 首次登录：把引导门控住，先让邮箱弹窗走完
          setTourGatedByEmail(true);
        }
        window.setTimeout(() => {
          if (mounted) setBindEmailOpen(true);
        }, 600);
      }
    }).catch(() => { /* 接口失败时保留 username 兜底，不打扰用户 */ });
    return () => { mounted = false; };
  }, [notify]);
  // 引导结束（steps 变 null）后，如果还欠着邮箱绑定弹窗就补上
  useEffect(() => {
    if (tourGatedByEmail) return; // 引导被邮箱挡住，不放行
    const raw = window.localStorage.getItem("xb-h5-onboarding");
    let systemDone = false;
    if (raw) {
      try { systemDone = (JSON.parse(raw) as { systemDone?: boolean }).systemDone === true; } catch { /* */ }
    }
    if (!systemDone) {
      // 延迟到首屏 splash 结束、用户进入主界面之后再触发
      const t = window.setTimeout(() => {
        onboardingTriggers.startSystemTour(getSystemTourSteps());
      }, 1500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [onboardingTriggers, tourGatedByEmail]);
  // 切换模块：触发单步介绍（如果没看过）。仅在系统引导完成后才触发，避免与首次引导叠加。
  useEffect(() => {
    const steps = getPageIntroSteps(active);
    if (steps.length === 0) return;
    const t = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("xb-h5-onboarding");
        const systemDone = raw ? (JSON.parse(raw) as { systemDone?: boolean }).systemDone === true : false;
        if (!systemDone) return;
      } catch { /* */ }
      onboardingTriggers.startPageIntro(steps);
    }, 320);
    return () => window.clearTimeout(t);
  }, [active, onboardingTriggers]);
  const configs = useMemo(() => createCrudConfigs(dictionaries), [dictionaries]);
  const renderPage = active === "home" ? <DashboardPage username={username} userInfo={userInfo} onNavigate={setActive} notify={notify} />
    : active === "orders" ? <OrdersPage notify={notify} onNavigate={setActive} />
    : active === "orderEntry" ? <AdminOrderEntry username={username} notify={notify} />
    : active === "batchOrder" ? <BatchOrderEntry />
    : active === "orderLink" ? <OrderLinkGenerator embedded />
    : active === "purchasers" ? <PurchaserManager embedded />
    : active === "tracking" ? <TrackingPage />
    : active === "logistics" ? <LogisticsPage userInfo={userInfo} notify={notify} />
    : active === "shortLinks" ? <ShortLinkManager embedded />
    : <CrudModule config={configs[active as keyof typeof configs]} dictionaries={dictionaries} notify={notify} />;

  return <DictionaryContext.Provider value={dictionaries}>
    <div className="product-shell">
      <main className="product-main" data-onboard={`page-${active}`}>{renderPage}</main>
      <nav className="workspace-dock" aria-label="主要功能">
        <button className={active === "home" ? "active" : ""} data-onboard="dock-home" onClick={() => setActive("home")}><House size={21} /><span>首页</span></button>
        <button className={active === "orders" ? "active" : ""} data-onboard="dock-orders" onClick={() => setActive("orders")}><ShoppingBag size={21} /><span>订单</span></button>
        <button className={`dock-create${active === "orderEntry" ? " active" : ""}`} data-onboard="dock-create" type="button" onClick={() => setActive("orderEntry")} aria-label="录单"><span className="dock-create-glyph" aria-hidden="true"><Plus size={22} strokeWidth={2.4} /></span><span>录单</span></button>
        <button className={active === "bills" ? "active" : ""} data-onboard="dock-bills" onClick={() => setActive("bills")}><ReceiptText size={21} /><span>账单</span></button>
        <button className={!["home", "orders", "orderEntry", "bills"].includes(active) ? "active" : ""} data-onboard="dock-menu" onClick={handleDockMenuClick}><Menu size={21} /><span>全部</span></button>
      </nav>
      <MenuSheet open={menuOpen} active={active} username={username} userInfo={userInfo} onClose={() => setMenuOpen(false)} onSelect={setActive} onLogout={onLogout} onUserInfoChanged={refreshUserInfo} onReplayTour={replaySystemTour} notify={notify} />
      <BindEmailSheet
        open={bindEmailOpen}
        currentEmail={String(userInfo?.email || "")}
        onClose={() => {
          setBindEmailOpen(false);
          // 邮箱弹窗关闭（不论绑没绑）→ 解除门控，引导可以走
          setTourGatedByEmail(false);
        }}
        onSaved={() => {
          refreshUserInfo();
          // 邮箱已绑定成功 → 解除门控，引导可以走
          setTourGatedByEmail(false);
        }}
        notify={notify}
      />
      <Toast toast={toast} />
    </div>
  </DictionaryContext.Provider>;
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
  return <OnboardingProvider>
    <AdminShell username={username} onLogout={logout} />
    <OnboardingOverlay />
  </OnboardingProvider>;
}
