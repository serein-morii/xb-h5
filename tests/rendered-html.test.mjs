import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
    ["/tools/order-search", "订单查询｜喜八工具箱"],
    ["/tools/order", "链接订单详情｜喜八工具箱"],
    ["/tools/order-link", "生成链接｜喜八"],
    ["/tools/place-order", "专属下单｜喜八"],
    ["/tools/purchasers", "买家管理｜喜八"],
    ["/tools/freight-calculator", "运费计算｜喜八工具箱"],
    ["/tools/freight-compare", "运费对比｜喜八工具箱"],
  ];

  for (const [pathname, title] of routes) {
    assert.match(app, new RegExp(`"${pathname.replaceAll("/", "\\/")}"`));
    assert.match(app, new RegExp(title));
  }
  assert.match(app, /<ToolsLayout>/);
  assert.match(app, /normalizePath/);
  assert.match(app, /window\.location\.pathname/);
});

test("contains all order module entries and authentication endpoints", async () => {
  const [app, api] = await Promise.all([
    source("app/MobileAdmin.tsx"),
    source("app/lib/api.ts"),
  ]);

  for (const menu of ["工作台", "订单管理", "订单录入", "账单管理", "快递管理", "价格管理", "店铺管理", "快递查询"]) {
    assert.match(app, new RegExp(menu));
  }
  assert.match(app, /DashboardPage/);
  assert.match(app, /menu-home-entry/);
  assert.match(app, /recentPurchasers/);
  assert.match(app, /\/biz\/purchaser\/list/);
  assert.match(app, /function ShippingEditor/);
  assert.match(app, /填写发货信息/);
  assert.match(app, /requestBatch\("send", "一键发货"\)/);
  assert.match(app, /创建并选中/);
  assert.match(app, /purchaserShortId/);
  assert.match(app, /function OrderCopyMenu/);
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
  const [admin, entry] = await Promise.all([
    source("app/MobileAdmin.tsx"),
    source("app/AdminOrderEntry.tsx"),
  ]);
  assert.match(admin, /active === "orderEntry"/);
  for (const endpoint of ["/biz/purchaser/list", "/biz/purchaser", "/search/store", "/search/order-options", "/search/addr", "/biz/exp/getAllCom", "/biz/exp/getCom", "/biz/order"]) {
    assert.match(entry, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(entry, /purchaserShortId/);
  assert.match(entry, /navigator\.clipboard\.readText/);
  assert.match(entry, /BarcodeDetector/);
  assert.doesNotMatch(entry, /captchaImage/);
});

test("keeps the public order tracking route", async () => {
  const [publicPage, admin] = await Promise.all([
    source("app/order/PublicOrder.tsx"),
    source("app/MobileAdmin.tsx"),
  ]);
  assert.match(publicPage, /publicApiRequest/);
  assert.match(publicPage, /\/search\/by/);
  assert.match(admin, /\/tools\/order#\$\{encodeURIComponent/);
});

test("keeps purchaser naming and the short-link order workflow consistent", async () => {
  const [creator, orderPage] = await Promise.all([
    source("app/tools/order-link/OrderLinkGenerator.tsx"),
    source("app/tools/place-order/PurchaserOrderPage.tsx"),
  ]);
  assert.match(creator, /\/biz\/purchaser\/match/);
  assert.match(creator, /\/biz\/purchaser/);
  assert.match(creator, /tools\/place-order#/);
  assert.doesNotMatch(creator, /place-order#\$\{encodeURIComponent\(purchaser\.shortId\)\}~/);
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
  const [menu, linkQuery, search, orderList, calculator, compare, freightData, admin] = await Promise.all([
    source("app/tools/page.tsx"),
    source("app/tools/LinkQueryCard.tsx"),
    source("app/tools/order-search/OrderSearch.tsx"),
    source("app/tools/OrderList.tsx"),
    source("app/tools/freight-calculator/FreightCalculator.tsx"),
    source("app/tools/freight-compare/FreightCompare.tsx"),
    source("app/tools/freight-data.ts"),
    source("app/MobileAdmin.tsx"),
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
  assert.match(calculator, /sheet_to_json/);
  assert.match(calculator, /navigator\.clipboard/);
  assert.match(compare, /XLSX\.writeFile/);
  for (const company of ["京东", "顺丰", "邮政"]) assert.match(freightData, new RegExp(company));
  assert.match(admin, /href="\/tools"/);
});
