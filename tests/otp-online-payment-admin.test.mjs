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
  assert.match(page, /round-add/);
  assert.doesNotMatch(page, /MobileBackButton|onBack|hero-tool-icon|online-payments-overview/);
  assert.match(page, /toolbar-card search-toolbar/);
  assert.match(page, /className="secondary-actions"/);
  assert.match(page, /metric-grid finance-status-grid/);
  assert.match(page, /order-card finance-card payment-card/);
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
  assert.match(page, /downloadFile/);
  assert.match(crud, /key: "bills", title: "账单管理"/);
  assert.match(crud, /BillOrderFilter/);
  assert.match(crud, /order-card finance-card bill-card/);
  assert.match(crud, /aria-label="账单汇总"/);
  assert.match(crud, /\$\{config\.api\}\/summary/);
  assert.match(styles, /\.finance-card \.card-topline/);
  assert.match(styles, /\.finance-strip/);
  assert.match(styles, /\.finance-page \.mobile-card-list/);
  assert.doesNotMatch(shell, /BillsPage|admin\/bills/);
  assert.match(menu, /onlinePayments: \{ key: "onlinePayments"/);
  assert.match(controller, /@GetMapping\("\/summary"\)/);
  assert.match(controller, /@PostMapping\("\/export"\)/);
  assert.match(mapper, /selectOnlinePaymentSummary/);
  assert.match(mapper, /createStart/);
  assert.match(capability, /BILLS_EXPORT\("bills\.export"/);
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
