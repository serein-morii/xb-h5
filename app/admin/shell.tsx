import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  House,
  LoaderCircle,
  Pencil,
  Search,
  SearchCheck,
  Sparkles,
  Truck,
  Copy,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "../lib/api";
import ThemeSettings from "../components/ThemeSettings";
import {
  OnboardingOverlay,
  OnboardingProvider,
  getPageIntroSteps,
  getSystemTourSteps,
  registerOnboardingCommands,
  unregisterOnboardingCommands,
  useOnboarding,
  useOnboardingTriggers,
} from "../components/onboarding";
import type { DataRow, Dictionaries, MenuKey, ToastState } from "./core";
import {
  DictionaryContext,
  EMPTY_DICTIONARIES,
  fetchDictionaries,
  maskEmail,
  maskPhone,
  readCachedActivePage,
  sexLabel,
  shortDate,
  writeCachedActivePage,
} from "./core";
import {
  fetchMobileMenuConfig,
  getMobileMenuConfig,
  MOBILE_MENU_ALL_KEY,
  resolveMobileIcon,
  resolveMobileMenu,
  type MobileMenuConfig,
} from "./mobileMenu.config";
import { createCrudConfigs, CrudModule } from "./crud";
import { fetchCrudOverrides, getCrudOverrides, type CrudOverridesConfig } from "./crudConfigs.config";
import { fetchTrackingServices, getTrackingServices, resolveTrackingServices } from "./trackingServices.config";
import { fetchProfileActions, getProfileActions, type ProfileActionsConfig } from "./profileActions.config";
import { DashboardPage } from "./dashboard";
import { BindEmailSheet, ChangePwdByEmailSheet, EditProfileSheet, LoginScreen } from "./login";
import { Sheet, Toast } from "./ui";
import { AccessContext, canOpenMenu, createAccessState, EMPTY_ACCESS, fetchAccessManifest, useAccess } from "./access";

const AdminOrderEntry = lazy(() => import("../AdminOrderEntry"));
const BatchOrderEntry = lazy(() => import("../tools/batch-order/BatchOrderEntry"));
const OrderLinkGenerator = lazy(() => import("../tools/order-link/OrderLinkGenerator"));
const PurchaserManager = lazy(() => import("../tools/purchasers/PurchaserManager"));
const ShortLinkManager = lazy(() => import("../tools/short-links/ShortLinkManager"));
const LogisticsPage = lazy(() => import("./logistics").then((module) => ({ default: module.LogisticsPage })));
const OrdersPage = lazy(() => import("./orders").then((module) => ({ default: module.OrdersPage })));
const ProductsPage = lazy(() => import("./products"));
const SystemHubPage = lazy(() => import("./system-pages").then((module) => ({ default: module.SystemHubPage })));

export function TrackingPage() {
  const [servicesConfig, setServicesConfig] = useState(getTrackingServices);
  useEffect(() => {
    let mounted = true;
    fetchTrackingServices(apiRequest).then((config) => { if (mounted) setServicesConfig(config); }).catch(() => { /* 默认兜底 */ });
    const reload = () => { fetchTrackingServices(apiRequest).then((config) => { if (mounted) setServicesConfig(config); }).catch(() => { /* */ }); };
    window.addEventListener("xb-tracking-services-changed", reload);
    return () => { mounted = false; window.removeEventListener("xb-tracking-services-changed", reload); };
  }, []);
  const services = resolveTrackingServices(servicesConfig);
  return <div className="module-page"><div className="module-hero compact-hero"><div><span className="eyebrow">物流工具</span><h1>快递查询</h1><p>快递官方入口集合</p></div><span className="hero-tool-icon"><SearchCheck size={27} /></span></div><div className="tracking-guide"><Sparkles size={20} /><div><b>查询提示</b><p>点击卡片将在新页面打开对应的官方查询页。</p></div></div><div className="tracking-grid">{services.map((service) => <a className={`tracking-card tracking-${service.color}`} href={service.url} target="_blank" rel="noreferrer" key={service.key}><span className="tracking-logo"><Truck size={24} /></span><div><b>{service.name}</b><p>{service.desc}</p></div><ExternalLink size={18} /></a>)}</div><div className="tracking-manual"><h2>快速识别</h2><p>复制快递单号后，选择上方对应平台即可查询。</p><div><Copy size={18} /><span>系统已针对手机端打开移动版查询入口</span></div></div></div>;
}

export function MenuSheet({ open, active, username, userInfo, onClose, onSelect, onLogout, onUserInfoChanged, onReplayTour, notify, menuConfig }: { open: boolean; active: MenuKey; username: string; userInfo: DataRow | null; onClose: () => void; onSelect: (key: MenuKey) => void; onLogout: () => void; onUserInfoChanged: () => void; onReplayTour: () => void; notify: (message: string, type?: "success" | "error" | "info") => void; menuConfig: MobileMenuConfig }) {
  const access = useAccess();
  const [view, setView] = useState<"menu" | "profile" | "settings">("menu");
  const [menuQuery, setMenuQuery] = useState("");
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [bindEmailOpen, setBindEmailOpen] = useState(false);
  // 标记修改密码流程是否需要"先绑定邮箱再改密"
  const [pendingChangePwd, setPendingChangePwd] = useState(false);
  const [profileActionsConfig, setProfileActionsConfig] = useState<ProfileActionsConfig>(getProfileActions);
  useEffect(() => {
    let mounted = true;
    fetchProfileActions(apiRequest).then((config) => { if (mounted) setProfileActionsConfig(config); }).catch(() => { /* */ });
    const reload = () => { fetchProfileActions(apiRequest).then((config) => { if (mounted) setProfileActionsConfig(config); }).catch(() => { /* */ }); };
    window.addEventListener("xb-profile-actions-changed", reload);
    return () => { mounted = false; window.removeEventListener("xb-profile-actions-changed", reload); };
  }, []);
  const mobileMenu = useMemo(
    () => resolveMobileMenu(menuConfig, (key) => canOpenMenu(access, key)),
    [access, menuConfig],
  );
  useEffect(() => { if (!open) { setView("menu"); setMenuQuery(""); setChangePwdOpen(false); setEditProfileOpen(false); setBindEmailOpen(false); setPendingChangePwd(false); } }, [open]);
  const filteredGroups = useMemo(() => {
    const keyword = menuQuery.trim().toLowerCase();
    if (!keyword) return mobileMenu.groups;
    return mobileMenu.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.items.length > 0);
  }, [menuQuery, mobileMenu.groups]);
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
      {profileActionsConfig.items.filter((item) => !item.hidden).map((item) => {
        const Icon = resolveMobileIcon(item.icon, Pencil);
        const label = item.key === "bindEmail" && userEmail && item.altLabel ? item.altLabel : item.label;
        const titleByKey: Record<string, string> = {
          changePwd: "通过邮箱验证码修改密码",
          replayTour: "再看一遍新手引导",
        };
        if (item.key === "logout") {
          return <button key={item.key} className="logout-row profile-logout" type="button" onClick={onLogout}><Icon size={18} />{label}</button>;
        }
        const onClick = () => {
          if (item.key === "editProfile") setEditProfileOpen(true);
          else if (item.key === "changePwd") handleChangePwdClick();
          else if (item.key === "bindEmail") setBindEmailOpen(true);
          else if (item.key === "replayTour") onReplayTour();
        };
        return <button key={item.key} className="profile-action" type="button" onClick={onClick} title={titleByKey[item.key] || ""}><Icon size={18} />{label}</button>;
      })}
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
  const extras = mobileMenu.extras;
  return <Sheet open={open} title="全部功能" onClose={onClose} headerAction={userButton}>
    <div className="toolbar-card search-toolbar menu-search-toolbar">
      <label className="quick-search">
        <Search size={15} strokeWidth={2.2} />
        <input
          value={menuQuery}
          onChange={(event) => setMenuQuery(event.target.value)}
          placeholder="搜索功能"
          autoComplete="off"
          enterKeyHint="search"
          aria-label="搜索功能"
        />
        {menuQuery ? (
          <button className="search-clear" type="button" onClick={() => setMenuQuery("")} aria-label="清空搜索">
            <X size={14} />
          </button>
        ) : null}
      </label>
    </div>
    {!menuQuery && extras.showHomeEntry ? (
      <button className={`menu-public-tools menu-home-entry ${active === "home" ? "active" : ""}`} type="button" onClick={() => { onSelect("home"); onClose(); }}>
        <House size={20} />
        <span><b>{extras.homeLabel}</b><small>{extras.homeDescription}</small></span>
        <ChevronRight size={17} />
      </button>
    ) : null}
    <div className={`menu-groups${menuQuery ? " searching" : ""}`}>
      {filteredGroups.map((group) => (
        <section className="menu-group" data-onboard={group.onboard} key={group.key}>
          <div className="menu-group-title"><b>{group.title}</b>{group.description ? <small>{group.description}</small> : null}</div>
          <div className="menu-grid">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button className={active === item.key || (item.key === "systemCenter" && (active === "operationsCenter" || active.startsWith("sys") || active === "mobileMenu")) || (item.key === "operationsCenter" && active.startsWith("ops")) ? "active" : ""} key={item.key} onClick={() => { onSelect(item.key); onClose(); }}>
                  <span><Icon size={21} /></span>
                  <b>{item.label}</b>
                  <small>{item.description}</small>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {menuQuery && !filteredGroups.length ? <div className="empty-state" style={{ minHeight: 160 }}><Search size={24} /><h3>没有匹配功能</h3><p>试试其他关键词</p></div> : null}
    </div>
    {extras.showToolboxEntry ? (
      <a className="menu-public-tools" data-onboard="menu-public-tools" href={extras.toolboxHref}>
        <Sparkles size={20} />
        <span><b>{extras.toolboxLabel}</b><small>{extras.toolboxDescription}</small></span>
        <ChevronRight size={17} />
      </a>
    ) : null}
    <a className="icp-link menu-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a>
  </Sheet>;
}

export function AdminShell({ username, onLogout }: { username: string; onLogout: () => void }) {
  // 当前访问页：先从 localStorage 缓存里取，刷新/下拉刷新后自动停留在上次的页面
  const [active, setActive] = useState<MenuKey>(readCachedActivePage);
  useEffect(() => { writeCachedActivePage(active); }, [active]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [dictionaries, setDictionaries] = useState<Dictionaries>(EMPTY_DICTIONARIES);
  const [userInfo, setUserInfo] = useState<DataRow | null>(null);
  const [access, setAccess] = useState(EMPTY_ACCESS);
  const [menuConfig, setMenuConfig] = useState<MobileMenuConfig>(getMobileMenuConfig);
  const [crudOverrides, setCrudOverrides] = useState<CrudOverridesConfig>(getCrudOverrides);
  useEffect(() => {
    let mounted = true;
    fetchCrudOverrides(apiRequest).then((config) => { if (mounted) setCrudOverrides(config); }).catch(() => { /* 本地默认兜底 */ });
    const reload = () => { fetchCrudOverrides(apiRequest).then((config) => { if (mounted) setCrudOverrides(config); }).catch(() => { /* */ }); };
    window.addEventListener("xb-crud-overrides-changed", reload);
    return () => { mounted = false; window.removeEventListener("xb-crud-overrides-changed", reload); };
  }, []);
  // 登录后若邮箱为空，自动弹"绑定邮箱"页（不再用 Toast 提示）。
  // 用户可关闭；下次登录仍会再弹，直到真正去绑定邮箱。
  const [bindEmailOpen, setBindEmailOpen] = useState(false);
  // 邮箱与系统引导互斥：首次登录且没绑邮箱时，先弹邮箱；引导等邮箱弹窗关闭后再触发。
  // 邮箱关掉/绑好 → 解除门控 → 引导才出来。
  const [tourGatedByEmail, setTourGatedByEmail] = useState(false);
  const notify = useCallback((message: string, type: "success" | "error" | "info" = "info") => { setToast({ message, type }); window.setTimeout(() => setToast(null), 2600); }, []);
  const refreshAccess = useCallback(async () => {
    try {
      setAccess(createAccessState(await fetchAccessManifest()));
    } catch {
      setAccess(createAccessState({ schemaVersion: 1, revision: "unavailable", superAdmin: false, roles: [], capabilities: ["nav.home", "nav.tracking"] }));
      notify("权限清单加载失败，已进入受限模式", "error");
    }
  }, [notify]);
  const refreshUserInfo = useCallback(() => {
    // 静默重新拉取 /getInfo，用于"绑定邮箱 / 编辑信息"后让 userInfo 同步最新值
    apiRequest<DataRow>("/getInfo").then((result) => {
      const info = (result.user as DataRow) || result;
      setUserInfo(info);
    }).catch(() => { /* 静默失败，不打扰用户 */ });
    void refreshAccess();
  }, [refreshAccess]);
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
    if (!access.ready) return;
    let mounted = true;
    const loadMenu = () => {
      fetchMobileMenuConfig(apiRequest).then((config) => {
        if (mounted) setMenuConfig(config);
      }).catch(() => { /* 本地默认兜底 */ });
    };
    loadMenu();
    window.addEventListener("xb-mobile-menu-changed", loadMenu);
    return () => {
      mounted = false;
      window.removeEventListener("xb-mobile-menu-changed", loadMenu);
    };
  }, [access.ready]);

  useEffect(() => {
    void refreshAccess();
    const refresh = () => void refreshAccess();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("xb-access-changed", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("xb-access-changed", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refreshAccess]);
  useEffect(() => {
    if (access.ready && !canOpenMenu(access, active)) setActive("home");
  }, [access, active]);
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
  const configs = useMemo(() => createCrudConfigs(dictionaries, crudOverrides), [dictionaries, crudOverrides]);
  const mobileMenu = useMemo(
    () => resolveMobileMenu(menuConfig, (key) => canOpenMenu(access, key)),
    [access, menuConfig],
  );
  const navigate = useCallback((key: MenuKey) => {
    if (canOpenMenu(access, key)) setActive(key);
    else notify("当前角色没有此功能权限", "error");
  }, [access, notify]);
  const visibleActive = access.ready && canOpenMenu(access, active) ? active : "home";
  const exitToHome = useCallback(() => setActive("home"), []);
  const SYSTEM_HUB_KEYS: ReadonlySet<MenuKey> = useMemo(() => new Set<MenuKey>([
    "systemCenter", "operationsCenter", "mobileMenu",
    "sysUsers", "sysRoles", "sysDepts", "sysPosts", "sysMenus", "sysDictTypes", "sysConfigs", "sysNotices",
    "opsOnline", "opsJobs", "opsJobLogs", "opsOperLogs", "opsLoginLogs",
    "opsServer", "opsCache", "opsDruid", "opsGenerator", "opsSwagger", "opsMessages",
  ]), []);
  const renderPage = visibleActive === "home" ? <DashboardPage username={username} userInfo={userInfo} onNavigate={navigate} notify={notify} />
    : visibleActive === "orders" ? <OrdersPage notify={notify} onNavigate={navigate} />
    : visibleActive === "orderEntry" ? <AdminOrderEntry username={username} notify={notify} />
    : visibleActive === "batchOrder" ? <BatchOrderEntry />
    : visibleActive === "orderLink" ? <OrderLinkGenerator embedded />
    : visibleActive === "purchasers" ? <PurchaserManager embedded />
    : visibleActive === "products" ? <ProductsPage notify={notify} />
    : visibleActive === "tracking" ? <TrackingPage />
    : visibleActive === "logistics" ? <LogisticsPage notify={notify} />
    : visibleActive === "shortLinks" ? <ShortLinkManager embedded />
    : SYSTEM_HUB_KEYS.has(visibleActive) ? <SystemHubPage active={visibleActive} notify={notify} onExit={exitToHome} />
    : <CrudModule config={configs[visibleActive as keyof typeof configs]} dictionaries={dictionaries} notify={notify} />;

  if (!access.ready) return <div className="app-loading"><LoaderCircle className="spin" size={28} /><p>正在同步权限</p></div>;

  return <AccessContext.Provider value={access}><DictionaryContext.Provider value={dictionaries}>
    <div className="product-shell">
      <main className="product-main" data-onboard={`page-${active}`}>
        <Suspense fallback={<div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载模块</div>}>
          {renderPage}
        </Suspense>
      </main>
      <nav className="workspace-dock" aria-label="主要功能">
        {mobileMenu.dock.map((item) => {
          const Icon = item.icon;
          if (item.key === MOBILE_MENU_ALL_KEY) {
            const dockKeys = mobileMenu.dock.map((entry) => entry.key).filter((key) => key !== MOBILE_MENU_ALL_KEY);
            const isActive = !dockKeys.includes(active);
            return (
              <button className={isActive ? "active" : ""} data-onboard="dock-menu" key={item.key} onClick={handleDockMenuClick}>
                <Icon size={21} /><span>{item.label}</span>
              </button>
            );
          }
          const pageKey = item.key;
          const isActive = active === pageKey || (pageKey === "systemCenter" && active === "operationsCenter");
          if (item.emphasis) {
            return (
              <button className={`dock-create${isActive ? " active" : ""}`} data-onboard={`dock-${pageKey}`} key={pageKey} type="button" onClick={() => navigate(pageKey)} aria-label={item.label}>
                <span className="dock-create-glyph" aria-hidden="true"><Icon size={22} strokeWidth={2.4} /></span>
                <span>{item.label}</span>
              </button>
            );
          }
          return (
            <button className={isActive ? "active" : ""} data-onboard={`dock-${pageKey}`} key={pageKey} onClick={() => pageKey === "home" ? setActive("home") : navigate(pageKey)}>
              <Icon size={21} /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <MenuSheet open={menuOpen} active={active} username={username} userInfo={userInfo} onClose={() => setMenuOpen(false)} onSelect={navigate} onLogout={onLogout} onUserInfoChanged={refreshUserInfo} onReplayTour={replaySystemTour} notify={notify} menuConfig={menuConfig} />
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
      <ThemeSettings />
      <Toast toast={toast} />
    </div>
  </DictionaryContext.Provider></AccessContext.Provider>;
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
    <h1>XB</h1>
    <div className="app-loading-bar"><span /></div>
    <p>正在启动移动工作台</p>
  </div>;
  if (!token) return <LoginScreen onLogin={(nextToken, nextUsername) => { setStoredToken(nextToken); setToken(nextToken); setUsername(nextUsername); }} />;
  return <OnboardingProvider>
    <AdminShell username={username} onLogout={logout} />
    <OnboardingOverlay />
  </OnboardingProvider>;
}
