import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relative) => readFile(path.join(root, relative), "utf8");

test("bill and payment orders follow the order-list visual hierarchy and expose backed admin actions", async () => {
  const [page, crud, styles, menu, shell, controller, mapper, capability] = await Promise.all([
    source("app/systems/order/admin/online-payments.tsx"),
    source("app/systems/order/admin/crud.tsx"),
    source("app/unified-theme.css"),
    source("app/systems/order/admin/mobileMenu.config.ts"),
    source("app/systems/order/admin/shell.tsx"),
    source("../xb/src/main/java/com/xb/modules/payment/api/AdminPaymentController.java"),
    source("../xb/src/main/resources/mybatis/modules/payment/PaymentOrderMapper.xml"),
    source("../xb/src/main/java/com/xb/modules/identity/domain/access/AccessCapability.java"),
  ]);

  assert.match(page, /finance-page/);
  assert.match(page, /className="module-hero"/);
  assert.doesNotMatch(page, /MobileBackButton|onBack|hero-tool-icon|online-payments-overview/);
  assert.match(page, /toolbar-card search-toolbar/);
  assert.match(page, /className="secondary-actions"/);
  assert.match(page, /className="finance-status-grid"/);
  assert.match(page, /<p>支付成功<\/p><b>\{summary\.paidCount\}<\/b>/);
  assert.match(page, /<p>待支付<\/p><b>\{summary\.pendingCount\}<\/b>/);
  assert.doesNotMatch(page, /className="round-add"/);
  assert.doesNotMatch(page, /<span>收货地址<\/span><b>\{row\.address/);
  assert.match(page, /if \(value === 0\) return "待支付"/);
  assert.match(page, /<span>订单付款状态<\/span>/);
  assert.match(page, /order-card finance-card payment-card/);
  assert.match(page, /module-page order-page crud-page/);
  assert.match(page, /card-topline/);
  assert.match(page, /card-main/);
  assert.match(page, /recipient-block/);
  assert.doesNotMatch(page, /data-card-summary data-card-summary-3/);
  assert.match(page, /expand-wrapper/);
  assert.match(page, /筛选支付订单/);
  assert.match(page, /同步本页/);
  assert.match(page, /加载所有/);
  assert.match(page, /加载更多/);
  assert.doesNotMatch(page, /sysm-pager|上一页|下一页/);
  assert.match(page, /确认全额退款/);
  assert.match(page, /className="online-payment-copy-line"/);
  assert.match(page, /downloadFile/);
  assert.match(crud, /key: "bills", title: "账单管理"/);
  assert.match(crud, /BillOrderFilter/);
  assert.match(crud, /order-card finance-card bill-card/);
  assert.match(crud, /order-page finance-page/);
  assert.match(crud, /aria-label="账单汇总"/);
  assert.match(crud, /\$\{config\.api\}\/summary/);
  assert.match(styles, /\.order-page \.order-card \.card-actions/);
  assert.match(styles, /\.finance-strip/);
  assert.match(styles, /\.finance-status-grid \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(styles, /\.finance-page \.secondary-actions button \{[^}]*width: auto !important/s);
  assert.match(styles, /\.finance-card \.data-metrics \.online-payment-copy-line \{[^}]*display: flex;[^}]*width: fit-content;/s);
  assert.match(styles, /\.finance-page \.mobile-card-list/);
  assert.doesNotMatch(shell, /BillsPage|admin\/bills/);
  assert.match(menu, /onlinePayments: \{ key: "onlinePayments"/);
  assert.match(controller, /@GetMapping\("\/summary"\)/);
  assert.match(controller, /@PostMapping\("\/export"\)/);
  assert.match(mapper, /selectOnlinePaymentSummary/);
  assert.match(mapper, /createStart/);
  assert.match(mapper, /when po\.status = 'PENDING' and o\.pay_status in \(1, 2\) then 'CLOSED'/);
  assert.match(capability, /BILLS_EXPORT\("bills\.export"/);
});

test("saved mobile Dock and groups stay authoritative instead of restoring removed defaults", async () => {
  const config = await source("app/systems/order/admin/mobileMenu.config.ts");
  assert.match(config, /base\.dock = raw\.dock as MobileMenuConfig\["dock"\]/);
  assert.match(config, /base\.groups = raw\.groups as MobileMenuGroupConfig\[\]/);
  assert.doesNotMatch(config, /DEFAULT_MOBILE_MENU_CONFIG\.dock\.filter/);
  assert.doesNotMatch(config, /baseGroup\.items\.filter/);
});

test("dashboard overview keeps four status columns", async () => {
  const [focus, dashboard, styles] = await Promise.all([
    source("app/systems/order/admin/dashboardFocus.config.ts"),
    source("app/systems/order/admin/dashboard.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(focus, /概览四列/);
  assert.match(focus, /key: "orderTotal"/);
  assert.match(focus, /key: "waiting"/);
  assert.match(focus, /key: "sent"/);
  assert.match(focus, /key: "completed"/);
  assert.match(dashboard, /item\.filterStatus/);
  assert.match(styles, /\.home-stat-strip \{\s*overflow: hidden;\s*display: grid;\s*grid-template-columns: repeat\(4, 1fr\);/);
});

test("all-features sheet restores brand title with notification, profile and close actions", async () => {
  const [sheet, shell] = await Promise.all([
    source("app/systems/order/admin/ui.tsx"),
    source("app/systems/order/admin/shell.tsx"),
  ]);

  // 左侧恢复品牌标识头部（XB MOBILE 眉题 + 标题），右侧为关闭 + 铃铛 + 个人头像
  assert.match(sheet, /<span className="eyebrow">XB MOBILE<\/span><h2>\{title\}<\/h2>/);
  assert.match(sheet, /sheet-header-cancel/);
  assert.match(shell, /headerAction=\{userButton\}/);
  assert.match(shell, /menu-header-actions"><NotificationBellButton/);
  assert.doesNotMatch(shell, /headerLeading=\{<NotificationBellButton/);
  assert.doesNotMatch(shell, /headerCenter=\{userButton\}/);
  assert.match(shell, /className="menu-user-avatar"/);
  assert.match(shell, /打开个人资料与账号设置/);
});
