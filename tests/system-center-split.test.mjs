import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("system center is a standalone subsystem at /system", async () => {
  const [paths, routes, appRoutes] = await Promise.all([
    source("app/lib/pathConventions.ts"),
    source("app/systems/system/routes.tsx"),
    source("app/systems/routes.tsx"),
  ]);
  assert.match(paths, /systemCenter: "\/system"/);
  assert.match(paths, /APP_ROUTES\.systemCenter,/);
  assert.match(routes, /系统中心｜XB Workspace/);
  assert.match(appRoutes, /\.\.\.systemRoutes/);
});

test("system center app reuses order admin access/login and hosts three areas", async () => {
  const app = await source("app/systems/system/SystemCenterApp.tsx");
  assert.match(app, /AccessContext\.Provider/);
  assert.match(app, /fetchAccessManifest/);
  assert.match(app, /LoginScreen/);
  assert.match(app, /SystemManagementCenter/);
  assert.match(app, /OperationsCenterPage/);
  assert.match(app, /RiskIpAccessPage/);
});

test("order admin redirects legacy system menu keys to the standalone center", async () => {
  const shell = await source("app/systems/order/admin/shell.tsx");
  assert.match(shell, /SYSTEM_CENTER_REDIRECT_KEYS/);
  assert.match(shell, /SystemCenterRedirect/);
  assert.match(shell, /window\.location\.assign\(APP_ROUTES\.systemCenter\)/);
  // 移动菜单是订单工作台自己的设置，保留在本系统
  assert.match(shell, /SYSTEM_HUB_KEYS: ReadonlySet<MenuKey> = useMemo\(\(\) => new Set<MenuKey>\(\["mobileMenu"\]\)/);
});

test("order workbench default menu no longer lists sys*/ops* items", async () => {
  const config = await source("app/systems/order/admin/mobileMenu.config.ts");
  assert.match(config, /title: "系统"/);
  assert.doesNotMatch(config, /\{ key: "sysUsers" \}/);
  assert.doesNotMatch(config, /\{ key: "opsOnline" \}/);
  const promotions = await source("app/systems/order/admin/mobileEntryPromotions.config.ts");
  assert.match(promotions, /entries: \[\]/);
});

test("order system home links to the standalone system center", async () => {
  const home = await source("app/systems/order/OrderSystemHome.tsx");
  assert.match(home, /APP_ROUTES\.systemCenter/);
  assert.match(home, /系统中心/);
});

test("otp keeps logout inside 我的 page instead of the header", async () => {
  const workspace = await source("app/systems/otp/OtpVaultWorkspace.tsx");
  // 头部不再有退出按钮；退出/注销并入「账号与登录」分组
  assert.doesNotMatch(workspace, /vault-ghost vault-logout" onClick/);
  assert.match(workspace, /onClick=\{\(\) => setModal\("logoutConfirm"\)\}/);
  assert.match(workspace, /setDeleteStep\("warn"\); setDeleteConfirmText\(""\); setModal\("deleteAccountConfirm"\)/);
  assert.match(workspace, /deleteConfirmText !== \(accountName \|\| ""\)/);
  assert.match(workspace, /deleteVaultAccount/);
  assert.match(workspace, /vault-account-link is-danger/);
  assert.match(workspace, /<h2>我的<\/h2>/);
  assert.match(workspace, /\['settings', Settings2, '我的'\]/);
});

test("order admin exposes notification center from menu sheet and branded login", async () => {
  const [shell, login] = await Promise.all([
    source("app/systems/order/admin/shell.tsx"),
    source("app/systems/order/admin/login.tsx"),
  ]);
  assert.match(shell, /notifCount=\{unread\.count\}/);
  assert.match(shell, /onOpenNotif=\{\(\) => \{ setMenuOpen\(false\); setNotifOpen\(true\); \}\}/);
  assert.match(login, /login-order-page/);
  assert.match(login, /otp-login-methods/);
  assert.match(login, /requestEmailCode/);
  assert.match(login, /loginByEmail\(value, emailCode\.trim\(\)\)/);
  // 系统中心登录页独立维护：默认邮箱验证码方式，不共用订单登录组件
  const app = await source("app/systems/system/SystemCenterApp.tsx");
  assert.match(app, /import LoginScreen from "\.\/LoginScreen"/);
  assert.doesNotMatch(app, /order\/admin\/login/);
  const systemLogin = await source("app/systems/system/LoginScreen.tsx");
  assert.match(systemLogin, /login-system-page/);
  assert.match(systemLogin, /PLATFORM CONSOLE/);
  assert.match(systemLogin, /"email"\);$/m);
});
