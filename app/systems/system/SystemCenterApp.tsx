import { Activity, ArrowLeft, BellRing, LoaderCircle, LogOut, Menu as MenuIcon, Settings2, ShieldBan, UserCheck, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { apiRequest, clearStoredToken, getStoredToken, setStoredToken } from "../../lib/api";
import { AppStartup } from "../../components/AppStartup";
import { getStartupConfig } from "../../lib/startup";
import { getThemePreference, setThemePreference } from "../../lib/theme";
import { API_PATHS, APP_ROUTES } from "../../lib/pathConventions";
import { AccessContext, canOpenMenu, createAccessState, EMPTY_ACCESS, fetchAccessManifest } from "../order/admin/access";
import LoginScreen from "./LoginScreen";
import { MessagePopupHost, type MessageRequest } from "../../components/NotificationCenter";
import { Toast } from "../order/admin/ui";
import type { ToastState } from "../order/admin/core";
import "./system-center.css";
import { installDevPreview } from "./devPreview";

installDevPreview();

const SystemManagementCenter = lazy(() => import("../order/admin/system-management"));
const OperationsCenterPage = lazy(() => import("../order/admin/operations-center"));
const RiskIpAccessPage = lazy(() => import("../order/admin/risk-ip-access").then((m) => ({ default: m.RiskIpAccessPage })));
const MessageBroadcast = lazy(() => import("./MessageBroadcast"));
const RestoreAccount = lazy(() => import("./RestoreAccount"));

type AreaKey = "system" | "operations" | "riskIps" | "messages" | "restore";

const AREA_STORAGE_KEY = "xb-system-center-area";

function readCachedArea(): AreaKey {
  try {
    const raw = window.localStorage.getItem(AREA_STORAGE_KEY);
    if (raw === "operations" || raw === "riskIps" || raw === "system" || raw === "messages" || raw === "restore") return raw;
  } catch { /* ignore */ }
  return "system";
}

type AreaMeta = {
  key: AreaKey;
  label: string;
  description: string;
  icon: typeof Settings2;
  group: "platform" | "ops" | "service";
  adminOnly?: boolean;
  available: boolean;
};

/**
 * 独立的「系统中心」子系统：企业级控制台布局（侧边导航 + 顶栏 + 内容区）。
 *
 * 系统管理实际服务的是订单、OTP、LAB 等所有子系统，与具体业务无关，
 * 因此从订单管理工作台中拆出来平级运行；页面与权限能力清单（access manifest）
 * 直接复用订单管理的实现，登录态与后端也完全一致。
 */
export default function SystemCenterApp() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const [access, setAccess] = useState(EMPTY_ACCESS);
  const [accessError, setAccessError] = useState(false);
  const [accessReload, setAccessReload] = useState(0);
  const [area, setArea] = useState<AreaKey>(readCachedArea);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const notify = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) setToken(stored);
    setReady(true);
    const expire = () => setToken("");
    window.addEventListener("xb-session-expired", expire);
    return () => window.removeEventListener("xb-session-expired", expire);
  }, []);
  useEffect(() => {
    if (!ready) return;
    // 系统中心独立入口：进入时按系统偏好应用明暗主题，否则模块的暗色样式不会生效
    setThemePreference(getThemePreference());
    const timer = window.setTimeout(() => setShowSplash(false), getStartupConfig("order").minimumMs);
    return () => window.clearTimeout(timer);
  }, [ready]);
  useEffect(() => {
    if (!token) return;
    let mounted = true;
    setAccessError(false);
    fetchAccessManifest()
      .then((manifest) => { if (mounted) setAccess(createAccessState(manifest)); })
      .catch(() => {
        if (!mounted) return;
        setAccess(createAccessState({ schemaVersion: 1, revision: "unavailable", superAdmin: false, roles: [], capabilities: [] }));
        setAccessError(true);
        notify("权限清单加载失败，已进入受限模式", "error");
      });
    return () => { mounted = false; };
  }, [token, accessReload, notify]);
  useEffect(() => { try { window.localStorage.setItem(AREA_STORAGE_KEY, area); } catch { /* ignore */ } }, [area]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  async function logout() {
    try { await apiRequest(API_PATHS.auth.logout, { method: "POST" }); } catch { /* local logout still proceeds */ }
    clearStoredToken();
    setToken("");
  }

  if (showSplash) return <AppStartup system="order" message="正在进入系统中心" />;
  if (!token) return <LoginScreen onLogin={(nextToken) => { setStoredToken(nextToken); setToken(nextToken); }} />;

  const allAreas: AreaMeta[] = ([
    { key: "system", label: "系统管理", description: "成员、角色、菜单、字典与系统参数", icon: Settings2, group: "platform", available: canOpenMenu(access, "systemCenter") },
    { key: "riskIps", label: "风险 IP", description: "全局来源访问控制与封禁", icon: ShieldBan, group: "platform", available: canOpenMenu(access, "sysRiskIps") },
    { key: "operations", label: "运行中心", description: "在线用户、监控、任务与审计日志", icon: Activity, group: "ops", available: canOpenMenu(access, "operationsCenter") },
    // 站内信与账号恢复属于平台服务：广播/恢复接口仅超管可调用
    { key: "messages", label: "站内信", description: "系统通知群发、弹窗公告与投递记录", icon: BellRing, group: "service", adminOnly: true, available: access.superAdmin },
    { key: "restore", label: "账号恢复", description: "恢复用户自助注销的账号", icon: UserCheck, group: "service", adminOnly: true, available: access.superAdmin },
  ]);
  const areas = allAreas.filter((item) => item.available);
  const GROUP_TITLES: Record<AreaMeta["group"], string> = { platform: "平台管理", ops: "运维监控", service: "平台服务" };
  const activeArea = areas.some((item) => item.key === area) ? area : areas[0]?.key;
  const activeMeta = areas.find((item) => item.key === activeArea);
  const displayName = String(access.subject?.nickname || access.subject?.username || "管理员");
  const accountName = String(access.subject?.username || "");
  const avatarChar = displayName.slice(0, 1).toUpperCase();

  const navBlocks = (["platform", "ops", "service"] as const).map((group) => ({
    group,
    title: GROUP_TITLES[group],
    items: areas.filter((item) => item.group === group),
  })).filter((block) => block.items.length);

  // 受限模式且一个可用区域都没有：给出明确的恢复出口，而不是渲染空壳
  if (access.ready && !areas.length) {
    return <div className="sc-root">
      <div className="sc-denied">
        <ShieldBan size={30} />
        <h2>{accessError ? "权限清单加载失败" : "当前角色没有系统中心权限"}</h2>
        <p>{accessError ? "网络或登录状态异常，权限信息没有拉取成功。" : "请联系管理员为你的角色分配系统管理或运行中心权限。"}</p>
        <div className="sc-denied-actions">
          <button type="button" className="sc-ghost" onClick={() => setAccessReload((value) => value + 1)}><LoaderCircle size={15} />重试</button>
          <button type="button" className="sc-ghost" onClick={() => { clearStoredToken(); setToken(""); }}>重新登录</button>
          <a className="sc-ghost" href={APP_ROUTES.manage}><ArrowLeft size={15} />返回订单系统</a>
        </div>
      </div>
      <Toast toast={toast} />
    </div>;
  }

  const switchArea = (next: AreaKey) => { setArea(next); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "auto" }); };

  return <AccessContext.Provider value={access}>
    <div className="sc-root">
      <MessagePopupHost request={apiRequest as MessageRequest} />
      {sidebarOpen ? <div className="sc-scrim" onClick={() => setSidebarOpen(false)} aria-hidden="true" /> : null}
      <aside className={`sc-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="sc-brand">
          <span className="sc-brand-mark"><Settings2 size={19} /></span>
          <div><b>系统中心</b><small>XB PLATFORM CONSOLE</small></div>
          <button type="button" className="sc-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="关闭菜单"><X size={17} /></button>
        </div>
        <nav className="sc-nav" aria-label="系统中心导航">
          {navBlocks.map((block) => (
            <section key={block.group}>
              <p className="sc-nav-title">{block.title}{block.items.some((item) => item.adminOnly) ? <em>超管</em> : null}</p>
              {block.items.map((item) => {
                const Icon = item.icon;
                return <button type="button" key={item.key} className={activeArea === item.key ? "is-active" : ""} onClick={() => switchArea(item.key)} aria-current={activeArea === item.key ? "page" : undefined}>
                  <Icon size={17} /><span>{item.label}</span>
                </button>;
              })}
            </section>
          ))}
        </nav>
        <div className="sc-sidebar-foot">
          <a className="sc-foot-link" href={APP_ROUTES.manage}><ArrowLeft size={15} /><span>返回订单系统</span></a>
          <button type="button" className="sc-foot-link sc-logout" onClick={() => void logout()}><LogOut size={15} /><span>退出登录</span></button>
        </div>
      </aside>
      <div className="sc-main">
        <header className="sc-topbar">
          <button type="button" className="sc-hamburger" onClick={() => setSidebarOpen(true)} aria-label="打开菜单"><MenuIcon size={19} /></button>
          <div className="sc-topbar-title">
            <h1>{activeMeta?.label || "系统中心"}</h1>
            <p>{activeMeta?.description || "账号权限、系统配置与运行监控 · 服务于所有子系统"}</p>
          </div>
          <div className="sc-topbar-user" title={accountName ? `账号 ${accountName}` : undefined}>
            <span className="sc-avatar">{avatarChar}</span>
            <div><b>{displayName}</b>{accountName ? <small>{accountName}</small> : null}</div>
          </div>
        </header>
        <main className="sc-content">
          {!access.ready ? <div className="sc-loading"><LoaderCircle className="spin" size={22} />正在同步权限</div>
            : activeArea === "operations" ? <Suspense fallback={<div className="sc-loading"><LoaderCircle className="spin" size={22} />正在加载模块</div>}><OperationsCenterPage notify={notify} /></Suspense>
            : activeArea === "riskIps" ? <Suspense fallback={<div className="sc-loading"><LoaderCircle className="spin" size={22} />正在加载模块</div>}><RiskIpAccessPage notify={notify} /></Suspense>
            : activeArea === "messages" ? <Suspense fallback={<div className="sc-loading"><LoaderCircle className="spin" size={22} />正在加载模块</div>}><MessageBroadcast notify={notify} /></Suspense>
            : activeArea === "restore" ? <Suspense fallback={<div className="sc-loading"><LoaderCircle className="spin" size={22} />正在加载模块</div>}><RestoreAccount notify={notify} /></Suspense>
            : <Suspense fallback={<div className="sc-loading"><LoaderCircle className="spin" size={22} />正在加载模块</div>}><SystemManagementCenter notify={notify} /></Suspense>}
        </main>
      </div>
      <Toast toast={toast} />
    </div>
  </AccessContext.Provider>;
}
