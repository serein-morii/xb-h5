import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { resolveShortLink } from "./lib/api";
import PeachHome from "./site/PeachHome";

const MobileAdmin = lazy(() => import("./MobileAdmin"));
const PublicOrder = lazy(() => import("./order/PublicOrder"));
const FreightCalculator = lazy(() => import("./tools/freight-calculator/FreightCalculator"));
const FreightCompare = lazy(() => import("./tools/freight-compare/FreightCompare"));
const ToolsLayout = lazy(() => import("./tools/layout"));
const OrderLinkGenerator = lazy(() => import("./tools/order-link/OrderLinkGenerator"));
const OrderSearch = lazy(() => import("./tools/order-search/OrderSearch"));
const ToolsPage = lazy(() => import("./tools/page"));
const PurchaserOrderPage = lazy(() => import("./tools/place-order/PurchaserOrderPage"));
const PurchaserManager = lazy(() => import("./tools/purchasers/PurchaserManager"));
const StoreQuery = lazy(() => import("./tools/store-query/StoreQuery"));
const StoreQueryList = lazy(() => import("./tools/store-query/StoreQueryList"));
const CustomerAuthPage = lazy(() => import("./customer/CustomerAuthPage"));

type RouteConfig = {
  title: string;
  description: string;
  tools?: boolean;
  content: ReactNode;
};

const routes: Record<string, RouteConfig> = {
  "/": {
    title: "炎陵黄桃｜高山鲜果，当季采摘",
    description: "来自湖南炎陵高山果园的当季黄桃，客户可注册进入专属页面下单并查看订单物流。",
    content: <PeachHome />,
  },
  "/manage": {
    title: "喜八移动订单管理",
    description: "喜八订单、账单、快递、商品和店铺管理工作台。",
    content: <MobileAdmin />,
  },
  "/customer/login": {
    title: "客户登录｜炎陵黄桃",
    description: "登录炎陵黄桃客户中心。",
    content: <CustomerAuthPage mode="login" />,
  },
  "/customer/register": {
    title: "客户注册｜炎陵黄桃",
    description: "注册炎陵黄桃客户账号，可选绑定已有专属下单码。",
    content: <CustomerAuthPage mode="register" />,
  },
  "/customer/reset": {
    title: "找回密码｜炎陵黄桃",
    description: "通过邮箱验证码找回客户账号密码。",
    content: <CustomerAuthPage mode="reset" />,
  },
  "/order": {
    title: "订单查询｜喜八",
    description: "查询喜八订单状态与物流进度。",
    content: <PublicOrder />,
  },
  "/tools": {
    title: "公开工具｜喜八",
    description: "使用订单查询、运费计算与运费对比工具。",
    tools: true,
    content: <ToolsPage />,
  },
  "/tools/order-search": {
    title: "订单查询｜喜八Tools",
    description: "通过手机号和验证码查询订单。",
    tools: true,
    content: <OrderSearch />,
  },
  "/tools/order": {
    title: "订单详情｜喜八Tools",
    description: "通过加密订单链接查看订单状态与物流进度。",
    tools: true,
    content: <PublicOrder embedded />,
  },
  "/tools/order-link": {
    title: "生成链接｜喜八",
    description: "选择店铺和买家，生成专属下单链接。",
    tools: true,
    content: <OrderLinkGenerator />,
  },
  "/tools/place-order": {
    title: "专属下单｜喜八",
    description: "通过下单人专属短链接下单并查询历史订单。",
    tools: true,
    content: <PurchaserOrderPage />,
  },
  "/tools/purchasers": {
    title: "买家管理｜喜八",
    description: "管理买家与店铺的绑定关系。",
    tools: true,
    content: <PurchaserManager />,
  },
  "/tools/store-query": {
    title: "专属查询｜喜八",
    description: "选择店铺后只查询该店铺的订单，避免串单。",
    tools: true,
    content: <StoreQueryList />,
  },
  "/tools/freight-calculator": {
    title: "运费计算｜喜八Tools",
    description: "批量计算常用快递公司的寄递费用。",
    tools: true,
    content: <FreightCalculator />,
  },
  "/tools/freight-compare": {
    title: "运费对比｜喜八Tools",
    description: "对比不同快递公司的计价结果。",
    tools: true,
    content: <FreightCompare />,
  },
};

function normalizePath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function NotFound() {
  return (
    <main className="spa-not-found">
      <span>404</span>
      <h1>页面不存在</h1>
      <p>链接可能已经失效，或者页面地址有误。</p>
      <a href="/">返回品牌主页</a>
      <a href="/manage">打开管理端</a>
      <a href="/tools">打开工具箱</a>
    </main>
  );
}

function ShortLinkLoading() {
  return (
    <main className="spa-short-link-loading">
      <div className="app-loading-mark"><span /></div>
    </main>
  );
}

function RouteFallback() {
  return (
    <main className="spa-short-link-loading">
      <div className="app-loading-mark"><span /></div>
    </main>
  );
}

type ShortLinkResolveState =
  | { status: "loading" }
  | { status: "not-found" };

export default function App() {
  const pathname = normalizePath(window.location.pathname);
  const [shortLinkState, setShortLinkState] = useState<ShortLinkResolveState | null>(null);
  // 专属查单页用：店铺名异步加载好之后回传上来，标题/描述才有真名而不是 URL 里的 code
  const [storeQueryResolvedName, setStoreQueryResolvedName] = useState<string>("");

  const route = routes[pathname];
  // 动态路由：/tools/order/:shortId（6 位短码）→ 买家专属下单页
  const orderShortIdMatch = pathname.match(/^\/tools\/order\/([2-9a-hj-km-np-z]{6})$/);
  // 动态路由：/tools/store-query/:storeCode（任意非空字符串，URL 解码后传给 StoreQuery）
  const storeQueryMatch = pathname.match(/^\/tools\/store-query\/([^/]+)$/);

  // catch-all：未知路径 → 解析短链 → window.location.replace 整页跳到目标
  // 不走 history.replaceState + setState 那条路：React 19 跟 effect 同步有 race，
  // 第一次进站时 `setPathname` 会丢，导致 URL 改了但页面不重渲（要刷新才有）。
  // 改用 window.location.replace：浏览器负责完整跳页，新页面会重新走 SPA 路由表。
  useEffect(() => {
    if (route || orderShortIdMatch || storeQueryMatch || pathname === "/") {
      setShortLinkState(null);
      return;
    }
    let cancelled = false;
    setShortLinkState({ status: "loading" });
    const lookup = pathname.replace(/^\/+/, "");
    resolveShortLink(lookup)
      .then((r) => {
        if (cancelled) return;
        const data = r.data;
        if (!data) {
          setShortLinkState({ status: "not-found" });
          return;
        }
        try {
          window.location.replace(data.target);
        } catch {
          setShortLinkState({ status: "not-found" });
        }
      })
      .catch(() => {
        if (!cancelled) setShortLinkState({ status: "not-found" });
      });
    return () => { cancelled = true; };
  }, [pathname, route, orderShortIdMatch, storeQueryMatch]);

  // 切路由时清空上一个专属查单页回填的店铺名，避免切到非 store-query 页时还残留旧名
  useEffect(() => {
    if (!storeQueryMatch) setStoreQueryResolvedName("");
  }, [pathname, storeQueryMatch]);

  // 已知路由：正常渲染
  let content: ReactNode;
  let title: string;
  let description: string;
  let isToolsRoute: boolean;
  if (route) {
    content = route.content;
    title = route.title;
    description = route.description;
    isToolsRoute = !!route.tools;
  } else if (orderShortIdMatch) {
    content = <PurchaserOrderPage />;
    title = "专属下单｜喜八Tools";
    description = "通过下单人专属短链接下单并查询历史订单。";
    isToolsRoute = true;
  } else if (storeQueryMatch) {
    const rawCode = storeQueryMatch[1] || "";
    let storeCode = rawCode;
    try { storeCode = decodeURIComponent(rawCode); } catch { /* keep raw */ }
    const displayName = storeQueryResolvedName || storeCode;
    content = (
      <StoreQuery
        storeCode={storeCode}
        onResolvedName={setStoreQueryResolvedName}
      />
    );
    title = `${displayName}｜专属查询`;
    description = `查询 ${displayName} 店铺下的订单与物流进度。`;
    isToolsRoute = true;
  } else if (shortLinkState?.status === "not-found") {
    return <NotFound />;
  } else {
    return <ShortLinkLoading />;
  }

  useEffect(() => {
    document.title = title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = description;
  }, [title, description]);

  const body = isToolsRoute
    ? <ToolsLayout><div className="page-transition" key={pathname}>{content}</div></ToolsLayout>
    : <div className="page-transition" key={pathname}>{content}</div>;

  return <Suspense fallback={<RouteFallback />}>{body}</Suspense>;
}
