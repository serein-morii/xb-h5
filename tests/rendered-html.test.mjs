import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  mergeOrderDetailPaymentStatus,
  normalizeOrderPaymentStatus,
} from "../app/systems/order/lib/payment.ts";
import { readExcelGrid, readExcelJson } from "../app/lib/excel.ts";
import { installViewportZoomLock } from "../app/lib/viewport.ts";
import {
  DEFAULT_MOBILE_ENTRY_PROMOTIONS,
  normalizeMobileMenuHierarchy,
  resolveMobileMenuHierarchy,
} from "../app/systems/order/admin/mobileEntryPromotions.config.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sourceMany = async (...paths) => {
  const parts = await Promise.all(paths.map((p) => source(p)));
  return parts.join("\n");
};

test("opens menus through the normalized capability manifest", async () => {
  const access = await source("app/systems/order/admin/access.tsx");
  assert.match(access, /home: "nav\.home"/);
  assert.match(access, /orders: "nav\.orders"/);
  assert.match(access, /systemCenter: "nav\.systemCenter"/);
  assert.match(access, /operationsCenter: "nav\.operationsCenter"/);
  assert.match(access, /return access\.has\(MENU_CAPABILITIES\[key\]\)/);
});

test("super admin bypasses capability checks and shell guards cached pages", async () => {
  const [access, shell] = await Promise.all([
    source("app/systems/order/admin/access.tsx"),
    source("app/systems/order/admin/shell.tsx"),
  ]);
  assert.match(access, /manifest\.superAdmin \|\| granted\.has\(capability\)/);
  assert.match(shell, /!mobileMenu\.directoryChildren\[active\]\?\.length && !canOpenMenu\(access, active\).*setActive\("home"\)/);
  assert.match(shell, /visibleActive = access\.ready && canOpenMenu\(access, active\) \? active : "home"/);
});

test("mobile menu hierarchy stays two levels and exposes directory children", () => {
  const hierarchy = resolveMobileMenuHierarchy(DEFAULT_MOBILE_ENTRY_PROMOTIONS);
  assert.equal(hierarchy.parentOf("mobileMenu"), "systemCenter");
  assert.ok(hierarchy.childrenOf("systemCenter").includes("sysUsers"));
  assert.ok(hierarchy.childrenOf("systemCenter").includes("mobileMenu"));

  const normalized = normalizeMobileMenuHierarchy([
    { key: "sysUsers", parentKey: "systemCenter" },
    { key: "systemCenter", parentKey: "home" },
    { key: "sysRoles", parentKey: "sysUsers" },
    { key: "orders", parentKey: "orders" },
  ]);
  assert.deepEqual(normalized, [{ key: "systemCenter", parentKey: "home" }]);

  const customKey = "directory:test-tools";
  const customHierarchy = resolveMobileMenuHierarchy({
    version: 3,
    directories: [{ key: customKey, label: "测试工具" }],
    entries: [{ key: "orders", parentKey: customKey }],
  });
  assert.equal(customHierarchy.parentOf("orders"), customKey);
  assert.deepEqual(customHierarchy.childrenOf(customKey), ["orders"]);

});

test("child pages opened from a directory return to that directory", async () => {
  const [shell, systemPages, systemManagement, operations, ui, menuSettings] = await Promise.all([
    source("app/systems/order/admin/shell.tsx"),
    source("app/systems/order/admin/system-pages.tsx"),
    source("app/systems/order/admin/system-management.tsx"),
    source("app/systems/order/admin/operations-center.tsx"),
    source("app/systems/order/admin/ui.tsx"),
    source("app/systems/order/admin/mobile-menu-settings.tsx"),
  ]);
  assert.match(ui, /export function MobileBackButton/);
  assert.match(ui, /mobile-back-nav/);
  assert.match(shell, /exitToParentOrHome/);
  assert.match(shell, /parentByChild\[active\]/);
  assert.match(shell, /setActiveDirectory\(parent\)/);
  assert.match(shell, /exitLabel=\{exitLabel\}/);
  assert.match(shell, /MobileBackButton/);
  assert.match(shell, /product-main-back-row/);
  assert.match(systemPages, /exitLabel = "工作台"/);
  assert.match(systemPages, /onBack=\{onExit\}/);
  assert.match(systemPages, /backLabel=\{exitLabel\}/);
  assert.match(menuSettings, /MobileBackButton/);
  assert.match(systemManagement, /MobileBackButton/);
  assert.match(systemManagement, /backLabel=\{active === "dictData"/);
  assert.match(operations, /MobileBackButton/);
  assert.match(operations, /backLabel = initialView !== "home" && onClose \? exitLabel : "运行中心"/);
});

test("keeps permission management focused on members roles and features", async () => {
  const management = await source("app/systems/order/admin/system-management.tsx");
  assert.match(management, /title: "成员"/);
  assert.match(management, /title: "角色"/);
  assert.match(management, /可用功能/);
  assert.match(management, /roleKey: `role_\$\{Date\.now\(\)\.toString\(36\)\}`/);
  assert.doesNotMatch(management, /\{ key: "roleKey", label: "权限字符"/);
  assert.doesNotMatch(management, /\{ key: "roleSort", label: "显示顺序"/);
});

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
  assert.equal(normalizeOrderPaymentStatus("待确认"), 3);
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
  const core = await source("app/systems/order/admin/core.ts");
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
    source("app/systems/order/tools/freight-calculator/FreightCalculator.tsx"),
    source("app/systems/order/tools/freight-compare/FreightCompare.tsx"),
    source("app/systems/order/tools/batch-order/BatchOrderEntry.tsx"),
    source("app/systems/order/tools/batch-order/formatTemplates.ts"),
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
    "app/systems/order/MobileAdmin.tsx",
    "app/systems/order/admin/core.ts",
    "app/systems/order/admin/shell.tsx",
    "app/systems/order/admin/orders.tsx",
    "app/systems/order/admin/dashboard.tsx",
    "app/systems/order/admin/login.tsx",
    "app/systems/order/admin/crud.tsx",
    "app/systems/order/admin/orderCopyMenu.config.ts",
    "app/components/SliderCaptcha.tsx",
  );
  const api = await source("app/lib/api.ts");

  for (const menu of ["工作台", "订单管理", "订单录入", "账单管理", "快递管理", "价格管理", "店铺管理", "快递查询"]) {
    assert.match(app, new RegExp(menu));
  }
  assert.match(app, /DashboardPage/);
  assert.match(app, /menu-home-entry/);
  assert.match(app, /recentPurchasers/);
  assert.match(app, /\/customers\/purchasers/);
  assert.match(app, /function ShippingEditor|export function ShippingEditor/);
  assert.match(app, /填写发货信息/);
  assert.match(app, /requestBatch\("send", "一键发货"\)/);
  assert.match(app, /创建并选中/);
  assert.match(app, /purchaserShortId/);
  assert.match(app, /function OrderCopyMenu|export function OrderCopyMenu/);
  for (const copyLabel of ["订单详情", "下单人链接", "收件人链接", "发货识别信息"]) assert.match(app, new RegExp(copyLabel));
  assert.match(app, /encodeURIComponent\(`v-\$\{signId\}`\)/);
  for (const endpoint of ["/auth/public-key", "/auth/captcha", "/auth/login", "/orders", "/administration/dictionaries/entries/type/"]) {
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
    sourceMany("app/systems/order/MobileAdmin.tsx", "app/systems/order/admin/shell.tsx"),
    source("app/systems/order/AdminOrderEntry.tsx"),
    source("app/lib/api.ts"),
  ]);
  assert.match(admin, /visibleActive === "orderEntry"/);
  for (const endpoint of ["/customers/purchasers", "/customers/purchasers", "/stores/options", "/content/search/order-options", "/content/search/addr", "/logistics/shipments/companies", "/logistics/shipments/companies/match", "/orders"]) {
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
    source("app/systems/order/order/PublicOrder.tsx"),
    sourceMany("app/systems/order/admin/orders.tsx", "app/systems/order/admin/shell.tsx", "app/systems/order/admin/orderCopyMenu.config.ts"),
  ]);
  assert.match(publicPage, /publicApiRequest/);
  assert.match(publicPage, /\/search\/by/);
  assert.match(admin, /\/tools\/order#\$\{encodeURIComponent/);
});

test("keeps OTP share preferences local and share browsing compact", async () => {
  const [workspace, share, api] = await Promise.all([
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/VaultSharePage.tsx"),
    source("app/systems/otp/vaultApi.ts"),
  ]);
  assert.match(workspace, /compact: true/);
  assert.match(workspace, /getVaultPreferences/);
  assert.match(workspace, /\[1, 3, 7, 30\]\.map/);
  assert.match(workspace, /vault-duration/);
  assert.match(api, /saveVaultPreferences/);
  assert.match(share, /localStorage\.setItem\("otp-vault-share-prefs"/);
  assert.match(share, /搜索服务或账号/);
  assert.match(share, /compact \? " is-compact"/);
  assert.match(share, /expiryProgress/);
  assert.match(share, /pathLength="100"/);
});

test("allows purchasers to edit and delete their own pending orders", async () => {
  const page = await source("app/systems/order/tools/place-order/PurchaserOrderPage.tsx");
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
    source("app/systems/order/tools/order-link/OrderLinkGenerator.tsx"),
    source("app/systems/order/tools/order-link/format.ts"),
    source("app/systems/order/tools/place-order/PurchaserOrderPage.tsx"),
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
  assert.match(orderPage, /SliderCaptcha/);
  assert.match(orderPage, /\/search\/order/);
  assert.doesNotMatch(orderPage, /storeCode: linkKey/);
  assert.doesNotMatch(orderPage, /buyer/i);
});

test("keeps historical purchaser links working before customer auth APIs are deployed", async () => {
  const orderPage = await source("app/systems/order/tools/place-order/PurchaserOrderPage.tsx");
  assert.match(orderPage, /cause instanceof ApiError && cause\.code === 404/);
  assert.match(orderPage, /legacyBackend = true/);
  assert.match(orderPage, /const authenticated = legacyBackend \|\|/);
  assert.match(orderPage, /return \{ data: \[\] \}/);
  assert.match(orderPage, /costPriceUnlocked\?: boolean/);
  assert.match(orderPage, /legacyUnlocked/);
});

test("keeps theme settings behind admin login and allows registration without a short id", async () => {
  const main = await source("src/main.tsx");
  const adminShell = await source("app/systems/order/admin/shell.tsx");
  const authPage = await source("app/systems/order/customer/CustomerAuthPage.tsx");
  assert.doesNotMatch(main, /<ThemeSettings\s*\/>/);
  assert.match(adminShell, /<ThemeSettings\s*\/>/);
  assert.match(authPage, /专属下单码（选填）/);
  assert.match(authPage, /SliderCaptcha/);
  assert.match(authPage, /captchaCode\.trim\(\)/);
  assert.match(authPage, /uuid: captchaUuid/);
  assert.match(authPage, /isSelfRegistration/);
  assert.match(authPage, /\/customer\/auth\/register-preview/);
  assert.match(authPage, /customer-register-confirm/);
  assert.match(authPage, /confirmExisting: confirmExisting \? "1" : "0"/);
});

test("keeps the original public HTML capabilities in the integrated project", async () => {
  const [menu, linkQuery, search, orderList, calculator, compare, freightData, admin, api] = await Promise.all([
    source("app/systems/order/tools/page.tsx"),
    source("app/systems/order/tools/LinkQueryCard.tsx"),
    source("app/systems/order/tools/order-search/OrderSearch.tsx"),
    source("app/systems/order/tools/OrderList.tsx"),
    source("app/systems/order/tools/freight-calculator/FreightCalculator.tsx"),
    source("app/systems/order/tools/freight-compare/FreightCompare.tsx"),
    source("app/systems/order/tools/freight-data.ts"),
    sourceMany("app/systems/order/admin/shell.tsx", "app/systems/order/admin/orders.tsx", "app/systems/order/admin/mobileMenu.config.ts"),
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
  assert.match(search, /SliderCaptcha/);
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
  assert.match(admin, /toolboxHref: "\/tools"/);
  assert.match(admin, /href=\{extras\.toolboxHref\}/);
});
