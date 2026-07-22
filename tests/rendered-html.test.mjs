import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the mobile order application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>喜八移动订单管理<\/title>/i);
  assert.match(html, /正在启动移动工作台/);
  assert.match(html, /MobileAdmin-/);
});

test("contains all order module entries and authentication endpoints", async () => {
  const [app, api] = await Promise.all([
    readFile(new URL("../app/MobileAdmin.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8"),
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
  assert.match(api, /NEXT_PUBLIC_API_BASE/);
});

test("keeps the migrated authenticated quick order entry workflow", async () => {
  const [admin, entry] = await Promise.all([
    readFile(new URL("../app/MobileAdmin.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AdminOrderEntry.tsx", import.meta.url), "utf8"),
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

test("renders the public order tracking route", async () => {
  const response = await render("/order");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>订单查询｜喜八<\/title>/i);
  assert.match(html, /PublicOrder-/);

  const [publicPage, admin] = await Promise.all([
    readFile(new URL("../app/order/PublicOrder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MobileAdmin.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(publicPage, /publicApiRequest/);
  assert.match(publicPage, /\/search\/by/);
  assert.match(admin, /\/tools\/order#\$\{encodeURIComponent/);
});

test("renders the public tool menu and all merged tool routes", async () => {
  const routes = [
    ["/tools", /<title>公开工具｜喜八<\/title>/i],
    ["/tools/order-search", /<title>订单查询｜喜八工具箱<\/title>/i],
    ["/tools/order", /<title>链接订单详情｜喜八工具箱<\/title>/i],
    ["/tools/order-link", /<title>生成链接｜喜八<\/title>/i],
    ["/tools/place-order", /<title>专属下单｜喜八<\/title>/i],
    ["/tools/purchasers", /<title>买家管理｜喜八<\/title>/i],
    ["/tools/freight-calculator", /<title>运费计算｜喜八工具箱<\/title>/i],
    ["/tools/freight-compare", /<title>运费对比｜喜八工具箱<\/title>/i],
  ];
  for (const [pathname, title] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), title, pathname);
  }
});

test("keeps purchaser naming and the short-link order workflow consistent", async () => {
  const [creator, orderPage] = await Promise.all([
    readFile(new URL("../app/tools/order-link/OrderLinkGenerator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/place-order/PurchaserOrderPage.tsx", import.meta.url), "utf8"),
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
    readFile(new URL("../app/tools/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/LinkQueryCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/order-search/OrderSearch.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/OrderList.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/freight-calculator/FreightCalculator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/freight-compare/FreightCompare.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tools/freight-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MobileAdmin.tsx", import.meta.url), "utf8"),
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
