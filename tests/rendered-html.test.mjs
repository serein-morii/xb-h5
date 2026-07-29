import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  mergeOrderDetailPaymentStatus,
  normalizeOrderPaymentStatus,
} from "../app/lib/orderPayment.ts";
import { readExcelGrid, readExcelJson } from "../app/lib/excel.ts";
import { installViewportZoomLock } from "../app/lib/viewport.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sourceMany = async (...paths) => {
  const parts = await Promise.all(paths.map((p) => source(p)));
  return parts.join("\n");
};

test("reads a real xlsx workbook through the shared Excel adapter", async () => {
  const imported = await import("exceljs");
  const ExcelJS = imported.default ?? imported;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("订单");
  worksheet.addRow(["收件人", "数量", "合计", "备注"]);
  worksheet.addRow([
    "林晓",
    2,
    { formula: "1+1", result: 2 },
    { richText: [{ text: "加急" }, { text: "发货" }] },
  ]);

  const bytes = await workbook.xlsx.writeBuffer();
  const arrayBuffer = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  assert.deepEqual(await readExcelGrid(arrayBuffer), [
    ["收件人", "数量", "合计", "备注"],
    ["林晓", "2", "2", "加急发货"],
  ]);
  assert.deepEqual(await readExcelJson(arrayBuffer), [
    { 收件人: "林晓", 数量: "2", 合计: "2", 备注: "加急发货" },
  ]);
});

test("locks the mobile viewport and prevents input-focus auto zoom", async () => {
  const [html, theme, viewport, main] = await Promise.all([
    source("index.html"),
    source("app/unified-theme.css"),
    source("app/lib/viewport.ts"),
    source("src/main.tsx"),
  ]);
  assert.match(html, /maximum-scale=1/);
  assert.match(html, /user-scalable=no/);
  assert.match(theme, /@media \(max-width: 768px\)/);
  assert.match(theme, /input\[type="text"\]/);
  assert.match(theme, /font-size: 16px !important/);
  assert.match(theme, /touch-action: pan-x pan-y/);
  for (const eventName of ["gesturestart", "gesturechange", "gestureend", "touchmove"]) {
    assert.match(viewport, new RegExp(eventName));
  }
  assert.match(viewport, /touches\.length > 1/);
  assert.match(viewport, /passive: false/);
  assert.match(main, /installViewportZoomLock\(\)/);
});

test("actively prevents Safari gestures and multi-touch zoom", () => {
  const originalDocument = globalThis.document;
  const listeners = new Map();
  const removed = new Set();
  globalThis.document = {
    addEventListener(name, listener, options) {
      listeners.set(name, { listener, options });
    },
    removeEventListener(name) {
      removed.add(name);
    },
  };

  try {
    const uninstall = installViewportZoomLock();
    for (const eventName of ["gesturestart", "gesturechange", "gestureend", "touchmove"]) {
      assert.equal(listeners.get(eventName)?.options?.passive, false);
    }

    let gesturePrevented = false;
    listeners.get("gesturestart").listener({
      preventDefault() {
        gesturePrevented = true;
      },
    });
    assert.equal(gesturePrevented, true);

    let multiTouchPrevented = false;
    listeners.get("touchmove").listener({
      touches: [{}, {}],
      preventDefault() {
        multiTouchPrevented = true;
      },
    });
    assert.equal(multiTouchPrevented, true);

    let singleTouchPrevented = false;
    listeners.get("touchmove").listener({
      touches: [{}],
      preventDefault() {
        singleTouchPrevented = true;
      },
    });
    assert.equal(singleTouchPrevented, false);

    uninstall();
    assert.deepEqual(removed, new Set(["gesturestart", "gesturechange", "gestureend", "touchmove"]));
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("preserves and normalizes payment status when opening an order detail", () => {
  assert.equal(normalizeOrderPaymentStatus(true), 1);
  assert.equal(normalizeOrderPaymentStatus("1"), 1);
  assert.equal(normalizeOrderPaymentStatus("PAID"), 1);
  assert.equal(normalizeOrderPaymentStatus(false), 0);
  assert.equal(normalizeOrderPaymentStatus("unpaid"), 0);
  assert.equal(normalizeOrderPaymentStatus("已退款"), 2);
  assert.equal(normalizeOrderPaymentStatus("unknown"), undefined);

  assert.deepEqual(
    mergeOrderDetailPaymentStatus(
      { id: 8, payStatus: 1, paidTime: "2026-07-28 18:00:00" },
      { id: 8, orderStatus: "DFH" },
    ),
    {
      id: 8,
      payStatus: 1,
      paidTime: "2026-07-28 18:00:00",
      orderStatus: "DFH",
    },
  );
  assert.equal(
    mergeOrderDetailPaymentStatus({ id: 9, payStatus: 1 }, { id: 9, isPaid: false }).payStatus,
    0,
  );
});

test("admin deep-link helpers keep valid menu keys", async () => {
  const core = await source("app/admin/core.ts");
  assert.match(core, /ALL_MENU_KEYS/);
  assert.match(core, /readCachedActivePage/);
  assert.match(core, /writeCachedActivePage/);
  assert.match(core, /params\.get\("page"\)/);
  assert.match(core, /searchParams\.set\("page"/);
  assert.match(core, /"orders"/);
  assert.match(core, /"home"/);
});

test("api layer exposes timeout-aware request helpers", async () => {
  const api = await source("app/lib/api.ts");
  assert.match(api, /DEFAULT_REQUEST_TIMEOUT_MS/);
  assert.match(api, /fetchWithTimeout/);
  assert.match(api, /AbortController/);
  assert.match(api, /Authorization/);
  assert.match(api, /VITE_API_BASE/);
  assert.doesNotMatch(api, /NEXT_PUBLIC_/);
});

test("excel helpers use exceljs only (no xlsx dual engine)", async () => {
  const [excel, pkg, calc, compare, batch, templates] = await Promise.all([
    source("app/lib/excel.ts"),
    source("package.json"),
    source("app/tools/freight-calculator/FreightCalculator.tsx"),
    source("app/tools/freight-compare/FreightCompare.tsx"),
    source("app/tools/batch-order/BatchOrderEntry.tsx"),
    source("app/tools/batch-order/formatTemplates.ts"),
  ]);
  assert.match(excel, /exceljs/);
  assert.match(excel, /readExcelGrid/);
  assert.match(excel, /downloadExcelJson/);
  assert.doesNotMatch(pkg, /"xlsx"/);
  assert.match(calc, /readExcelJson|lib\/excel/);
  assert.match(compare, /downloadExcelJson|lib\/excel/);
  assert.match(batch, /readExcelGrid|lib\/excel/);
  assert.match(templates, /exceljs/);
  assert.doesNotMatch(calc + compare + batch + templates, /from ["']xlsx["']|import\(["']xlsx["']\)/);
});

test("builds a self-contained static SPA for Nginx", async () => {
  const [html, assets] = await Promise.all([
    source("dist/index.html"),
    readdir(new URL("../dist/assets/", import.meta.url)),
  ]);

  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>喜八移动订单管理<\/title>/i);
  assert.match(html, /id="root"/i);
  assert.match(html, /正在启动移动工作台/);
  assert.match(html, /\/assets\/index-[^"']+\.js/);
  assert.ok(assets.some((name) => name.endsWith(".js")));
  assert.ok(assets.some((name) => name.endsWith(".css")));
  await assert.rejects(source("dist/server/index.js"));
});

test("keeps every public route in the client-side route table", async () => {
  const app = await source("app/App.tsx");
  const routes = [
    ["/", "喜八移动订单管理"],
    ["/order", "订单查询｜喜八"],
    ["/tools", "公开工具｜喜八"],
    ["/tools/order-search", "订单查询｜喜八Tools"],
    ["/tools/order", "订单详情｜喜八Tools"],
    ["/tools/order-link", "生成链接｜喜八"],
    ["/tools/place-order", "专属下单｜喜八"],
    ["/tools/purchasers", "买家管理｜喜八"],
    ["/tools/freight-calculator", "运费计算｜喜八Tools"],
    ["/tools/freight-compare", "运费对比｜喜八Tools"],
  ];

  for (const [pathname, title] of routes) {
    assert.match(app, new RegExp(`"${pathname.replaceAll("/", "\\/")}"`));
    assert.match(app, new RegExp(title));
  }
  assert.match(app, /ToolsLayout/);
  assert.match(app, /lazy\(/);
  assert.match(app, /Suspense/);
  assert.match(app, /normalizePath/);
  assert.match(app, /window\.location\.pathname/);
});

test("contains all order module entries and authentication endpoints", async () => {
  const app = await sourceMany(
    "app/MobileAdmin.tsx",
    "app/admin/core.ts",
    "app/admin/shell.tsx",
    "app/admin/orders.tsx",
    "app/admin/dashboard.tsx",
    "app/admin/login.tsx",
    "app/admin/crud.tsx",
  );
  const api = await source("app/lib/api.ts");

  for (const menu of ["工作台", "订单管理", "订单录入", "账单管理", "快递管理", "价格管理", "店铺管理", "快递查询"]) {
    assert.match(app, new RegExp(menu));
  }
  assert.match(app, /DashboardPage/);
  assert.match(app, /menu-home-entry/);
  assert.match(app, /recentPurchasers/);
  assert.match(app, /\/biz\/purchaser\/list/);
  assert.match(app, /function ShippingEditor|export function ShippingEditor/);
  assert.match(app, /填写发货信息/);
  assert.match(app, /requestBatch\("send", "一键发货"\)/);
  assert.match(app, /创建并选中/);
  assert.match(app, /purchaserShortId/);
  assert.match(app, /function OrderCopyMenu|export function OrderCopyMenu/);
  for (const copyLabel of ["订单详情", "下单人链接", "收件人链接", "发货识别信息"]) assert.match(app, new RegExp(copyLabel));
  assert.match(app, /`v-\$\{String\(row\.signId/);
  for (const endpoint of ["/getPublicKey", "/captchaImage", "/login", "/biz/order/list", "/system/dict/data/type/"]) {
    assert.match(app, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  for (const billField of ["商品成本", "包装费", "快递费", "附加费", "总成本", "销售价格", "盈利", "收货地址"]) {
    assert.match(app, new RegExp(billField));
  }
  assert.match(app, /STORE_STATUS_OPTIONS/);
  assert.match(app, /value: 1, label: "开业中"/);
  assert.match(app, /value: 2, label: "已关闭"/);
  assert.match(app, /key: "isDelete", label: "营业状态"/);
  assert.match(app, /payload\.isDelete = Number/);
  assert.match(api, /Authorization/);
  assert.match(api, /VITE_API_BASE/);
  assert.doesNotMatch(api, /NEXT_PUBLIC_/);
});

test("keeps the migrated authenticated quick order entry workflow", async () => {
  const [admin, entry, api] = await Promise.all([
    sourceMany("app/MobileAdmin.tsx", "app/admin/shell.tsx"),
    source("app/AdminOrderEntry.tsx"),
    source("app/lib/api.ts"),
  ]);
  assert.match(admin, /active === "orderEntry"/);
  for (const endpoint of ["/biz/purchaser/list", "/biz/purchaser", "/biz/store/options", "/search/order-options", "/search/addr", "/biz/exp/getAllCom", "/biz/exp/getCom", "/biz/order"]) {
    assert.match(entry, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(entry, /purchaserShortId/);
  assert.match(entry, /readFromClipboard/);
  assert.match(api, /navigator\.clipboard\.readText/);
  assert.match(entry, /BarcodeDetector/);
  assert.doesNotMatch(entry, /captchaImage/);
});

test("keeps the public order tracking route", async () => {
  const [publicPage, admin] = await Promise.all([
    source("app/order/PublicOrder.tsx"),
    sourceMany("app/admin/orders.tsx", "app/admin/shell.tsx"),
  ]);
  assert.match(publicPage, /publicApiRequest/);
  assert.match(publicPage, /\/search\/by/);
  assert.match(admin, /\/tools\/order#\$\{encodeURIComponent/);
});

test("allows purchasers to edit and delete their own pending orders", async () => {
  const page = await source("app/tools/place-order/PurchaserOrderPage.tsx");
  assert.match(page, /\/search\/order\/\$\{editingOrder\.id\}/);
  assert.match(page, /\/search\/order\/\$\{confirmingDelete\.id\}/);
  assert.match(page, /confirmingEdit/);
  assert.match(page, /confirmingDelete/);
  assert.match(page, /order\.orderStatus !== "DSH"/);
  assert.match(page, /purchaserShortId: linkKey\.purchaserId/);
  assert.match(page, /expCom/);
});

test("keeps purchaser naming and the short-link order workflow consistent", async () => {
  const [creator, format, orderPage] = await Promise.all([
    source("app/tools/order-link/OrderLinkGenerator.tsx"),
    source("app/tools/order-link/format.ts"),
    source("app/tools/place-order/PurchaserOrderPage.tsx"),
  ]);
  assert.match(creator, /\/biz\/purchaser\/match/);
  assert.match(creator, /\/biz\/purchaser/);
  assert.match(format, /tools\/order\//);
  assert.match(format, /buildOrderLink/);
  assert.match(format, /formatOrderLinkCopy/);
  assert.match(format, /点击链接即可下单/);
  assert.match(creator, /storeCode/);
  assert.doesNotMatch(creator, /buyer/i);
  assert.match(orderPage, /purchaserShortId/);
  assert.match(orderPage, /\/search\/purchaser\/orders/);
  assert.match(orderPage, /\/search\/order-options/);
  assert.match(orderPage, /\/captchaImage/);
  assert.match(orderPage, /\/search\/order/);
  assert.doesNotMatch(orderPage, /storeCode: linkKey/);
  assert.doesNotMatch(orderPage, /buyer/i);
});

test("keeps the original public HTML capabilities in the integrated project", async () => {
  const [menu, linkQuery, search, orderList, calculator, compare, freightData, admin, api] = await Promise.all([
    source("app/tools/page.tsx"),
    source("app/tools/LinkQueryCard.tsx"),
    source("app/tools/order-search/OrderSearch.tsx"),
    source("app/tools/OrderList.tsx"),
    source("app/tools/freight-calculator/FreightCalculator.tsx"),
    source("app/tools/freight-compare/FreightCompare.tsx"),
    source("app/tools/freight-data.ts"),
    sourceMany("app/admin/shell.tsx", "app/admin/orders.tsx"),
    source("app/lib/api.ts"),
  ]);
  for (const route of ["/tools/order-search", "/tools/freight-calculator", "/tools/freight-compare"]) assert.match(menu, new RegExp(route));
  assert.ok(menu.indexOf("<LinkQueryCard />") < menu.indexOf("freightTools.map"));
  assert.ok(menu.indexOf('href: "/tools/freight-compare"') < menu.indexOf('href: "/tools/freight-calculator"'));
  assert.match(menu, /LinkQueryCard/);
  assert.match(linkQuery, /链接查询/);
  assert.match(linkQuery, /\/tools\/order#\$\{encodeURIComponent/);
  assert.match(linkQuery, /rawHash\.startsWith\("id="\)/);
  assert.match(linkQuery, /new URLSearchParams/);
  assert.match(search, /\/captchaImage/);
  assert.match(search, /method: "POST"/);
  assert.match(search, /OrderList/);
  assert.match(orderList, /物流信息详情/);
  assert.match(orderList, /expInfoList/);
  assert.match(orderList, /expDesc/);
  assert.match(orderList, /expanded/);
  assert.match(calculator, /copyToClipboard/);
  assert.match(api, /navigator\.clipboard\.writeText/);
  assert.match(compare, /downloadExcelJson|exportExcel/);
  for (const company of ["京东", "顺丰", "邮政"]) assert.match(freightData, new RegExp(company));
  assert.match(admin, /href="\/tools"/);
});
