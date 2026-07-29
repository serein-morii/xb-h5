import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  House,
  LockKeyhole,
  LogOut,
  LoaderCircle,
  Menu,
  Pencil,
  Plus,
  ReceiptText,
  SearchCheck,
  Send,
  ShoppingBag,
  Sparkles,
  Truck,
  Copy,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "../lib/api";
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
  NAV_ITEMS,
  readCachedActivePage,
  sexLabel,
  shortDate,
  writeCachedActivePage,
} from "./core";
import { createCrudConfigs, CrudModule } from "./crud";
import { DashboardPage } from "./dashboard";
import { BindEmailSheet, ChangePwdByEmailSheet, EditProfileSheet, LoginScreen } from "./login";
import { Sheet, Toast } from "./ui";

const AdminOrderEntry = lazy(() => import("../AdminOrderEntry"));
const BatchOrderEntry = lazy(() => import("../tools/batch-order/BatchOrderEntry"));
const OrderLinkGenerator = lazy(() => import("../tools/order-link/OrderLinkGenerator"));
const PurchaserManager = lazy(() => import("../tools/purchasers/PurchaserManager"));
const ShortLinkManager = lazy(() => import("../tools/short-links/ShortLinkManager"));
const LogisticsPage = lazy(() => import("./logistics").then((module) => ({ default: module.LogisticsPage })));
const OrdersPage = lazy(() => import("./orders").then((module) => ({ default: module.OrdersPage })));

export function TrackingPage() {
  const services = [{ name: "快递100", desc: "支持多家快递公司查询", url: "https://m.kuaidi100.com/", color: "orange" },{ name: "顺丰速运", desc: "顺丰官方运单跟踪", url: "https://www.sf-express.com/we/ow/chn/sc/waybill/list", color: "green" },{ name: "EMS", desc: "中国邮政 EMS 邮件查询", url: "https://www.ems.com.cn/queryList", color: "blue" }];
  return <div className="module-page"><div className="module-hero compact-hero"><div><span className="eyebrow">物流工具</span><h1>快递查询</h1><p>快递官方入口集合</p></div><span className="hero-tool-icon"><SearchCheck size={27} /></span></div><div className="tracking-guide"><Sparkles size={20} /><div><b>查询提示</b><p>点击卡片将在新页面打开对应的官方查询页。</p></div></div><div className="tracking-grid">{services.map((service) => <a className={`tracking-card tracking-${service.color}`} href={service.url} target="_blank" rel="noreferrer" key={service.name}><span className="tracking-logo"><Truck size={24} /></span><div><b>{service.name}</b><p>{service.desc}</p></div><ExternalLink size={18} /></a>)}</div><div className="tracking-manual"><h2>快速识别</h2><p>复制快递单号后，选择上方对应平台即可查询。</p><div><Copy size={18} /><span>系统已针对手机端打开移动版查询入口</span></div></div></div>;
}

export function MenuSheet({ open, active, username, userInfo, onClose, onSelect, onLogout, onUserInfoChanged, onReplayTour, notify }: { open: boolean; active: MenuKey; username: string; userInfo: DataRow | null; onClose: () => void; onSelect: (key: MenuKey) => void; onLogout: () => void; onUserInfoChanged: () => void; onReplayTour: () => void; notify: (message: string, type?: "success" | "error" | "info") => void }) {
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
  </div><a className="menu-public-tools" data-onboard="menu-public-tools" href="/tools"><Sparkles size={20} /><span><b>工具箱</b><small>订单查询、链接查询与运费工具</small></span><ChevronRight size={17} /></a><a className="icp-link menu-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2024070228号</a></Sheet>;
}

export function AdminShell({ username, onLogout }: { username: string; onLogout: () => void }) {
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
      <main className="product-main" data-onboard={`page-${active}`}>
        <Suspense fallback={<div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载模块</div>}>
          {renderPage}
        </Suspense>
      </main>
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
