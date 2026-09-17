import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relative) => readFile(path.join(root, relative), "utf8");

test("payment orders follow bill management layout and expose backed admin actions", async () => {
  const [page, styles, controller, mapper, capability] = await Promise.all([
    source("app/systems/order/admin/online-payments.tsx"),
    source("app/unified-theme.css"),
    source("../xb/src/main/java/com/xb/modules/payment/api/AdminPaymentController.java"),
    source("../xb/src/main/resources/mybatis/modules/payment/PaymentOrderMapper.xml"),
    source("../xb/src/main/java/com/xb/modules/identity/domain/access/AccessCapability.java"),
  ]);

  assert.match(page, /toolbar-card search-toolbar/);
  assert.match(page, /secondary-actions online-payments-secondary-actions/);
  assert.match(page, /data-card-summary data-card-summary-3/);
  assert.match(page, /expand-wrapper/);
  assert.match(page, /筛选支付订单/);
  assert.match(page, /同步本页/);
  assert.match(page, /确认全额退款/);
  assert.match(page, /downloadFile/);
  assert.match(styles, /\.online-payments-overview/);
  assert.match(controller, /@GetMapping\("\/summary"\)/);
  assert.match(controller, /@PostMapping\("\/export"\)/);
  assert.match(mapper, /selectOnlinePaymentSummary/);
  assert.match(mapper, /createStart/);
  assert.match(capability, /BILLS_EXPORT\("bills\.export"/);
});
