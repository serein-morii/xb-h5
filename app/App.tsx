import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { resolveShortLink } from "./lib/api";
import { collectSubsystemPrefixes, resolveSubsystemPath } from "./lib/subsystemHost";
import PeachHome from "./site/PeachHome";

const MobileAdmin = lazy(() => import("./MobileAdmin"));
const PublicOrder = lazy(() => import("./order/PublicOrder"));
const FreightCalculator = lazy(() => import("./tools/freight-calculator/FreightCalculator"));
const FreightCompare = lazy(() => import("./tools/freight-compare/FreightCompare"));
const ToolsLayout = lazy(() => import("./tools/layout"));
const OrderLinkGenerator = lazy(() => import("./tools/order-link/OrderLinkGenerator"));
const OrderSearch = lazy(() => import("./tools/order-search/OrderSearch"));
const ToolsPage = lazy(() => import("./tools/page"));
const LabLayout = lazy(() => import("./lab/LabLayout"));
const LabHome = lazy(() => import("./lab/LabHome"));
const BeadStudioPage = lazy(() => import("./lab/BeadStudioPage"));
const VideoExtractPage = lazy(() => import("./lab/VideoExtractPage"));
const OtpVaultPage = lazy(() => import("./otp/OtpVaultPage"));
const VaultSharePage = lazy(() => import("./otp/VaultSharePage"));
const PurchaserOrderPage = lazy(() => import("./tools/place-order/PurchaserOrderPage"));
const PurchaserManager = lazy(() => import("./tools/purchasers/PurchaserManager"));
const StoreQuery = lazy(() => import("./tools/store-query/StoreQuery"));
const StoreQueryList = lazy(() => import("./tools/store-query/StoreQueryList"));
const CustomerAuthPage = lazy(() => import("./customer/CustomerAuthPage"));

type RouteConfig = {
  title: string;
  description: string;
  tools?: boolean;
  lab?: boolean;
  content: ReactNode;
};

function BeadStudioRedirect() {
  useEffect(() => {
    window.location.replace("/bead-studio");
  }, []);
  return <main className="spa-short-link-loading"><div className="app-loading-mark"><span /></div></main>;
}

function LabRedirect() {
  useEffect(() => {
    window.location.replace("/lab");
  }, []);
  return <main className="spa-short-link-loading"><div className="app-loading-mark"><span /></div></main>;
}

const routes: Record<string, RouteConfig> = {
  "/": {
    title: "炎陵黄桃｜高山鲜果，当季采摘",
    description: "来自湖南炎陵高山果园的当季黄桃，客户可注册进入专属页面下单并查看订单物流。",
    content: <PeachHome />,
  },
  "/bead-studio": {
    title: "Bead Studio · 拼豆工作台",
    description: "把图片转成可编辑的拼豆图纸。",
    content: <BeadStudioPage />,
  },
  "/lab/bead-studio": {
    title: "正在打开拼豆工作台",
    description: "跳转到拼豆工作台。",
    content: <BeadStudioRedirect />,
  },
  "/lab/bead-studio.html": {
    title: "正在打开拼豆工作台",
    description: "跳转到拼豆工作台。",
    content: <BeadStudioRedirect />,
  },
  "/handy/bead-studio.html": {
    title: "正在打开拼豆工作台",
    description: "跳转到拼豆工作台。",
    content: <BeadStudioRedirect />,
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
  "/lab": {
    title: "Handy Lab｜灵感实验室",
    description: "独立于订单系统的创意工具实验室。",
    lab: true,
    content: <LabHome />,
  },
  "/lab/video-extract": {
    title: "短视频提取｜Handy Lab",
    description: "解析抖音、小红书、哔哩哔哩分享链接，预览并下载媒体。",
    lab: true,
    content: <VideoExtractPage />,
  },
  "/otp": {
    title: "OTP Vault｜私人身份保险库",
    description: "独立管理 OTP 凭据并创建限时访问授权。",
    content: <OtpVaultPage />,
  },
  "/utilities": {
    title: "正在打开 Handy Lab",
    description: "跳转到 Handy Lab。",
    content: <LabRedirect />,
  },
};

const subsystemPrefixes = collectSubsystemPrefixes(Object.keys(routes));

function NotFound() {
  return (
    <main className="spa-not-found">
      <span>404</span>
      <h1>页面不存在</h1>
      <p>链接可能已经失效，或者页面地址有误。</p>
      <a href="/">返回品牌主页</a>
      <a href="/manage">打开管理端</a>
      <a href="/tools">打开工具箱</a>
      <a href="/lab">打开 Handy Lab</a>
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
  const pathname = resolveSubsystemPath(window.location.pathname, window.location.hostname, subsystemPrefixes);
  const [shortLinkState, setShortLinkState] = useState<ShortLinkResolveState | null>(null);
  // 专属查单页用：店铺名异步加载好之后回传上来，标题/描述才有真名而不是 URL 里的 code
  const [storeQueryResolvedName, setStoreQueryResolvedName] = useState<string>("");

  const route = routes[pathname];
  // 动态路由：/tools/order/:shortId（6 位短码）→ 买家专属下单页
  const orderShortIdMatch = pathname.match(/^\/tools\/order\/([2-9a-hj-km-np-z]{6})$/);
  // 动态路由：/tools/store-query/:storeCode（任意非空字符串，URL 解码后传给 StoreQuery）
  const storeQueryMatch = pathname.match(/^\/tools\/store-query\/([^/]+)$/);
  const vaultShareMatch = pathname.match(/^\/s\/([A-Za-z0-9]{5}|[A-Za-z0-9_-]{10})$/);

  // catch-all：未知路径 → 解析短链 → window.location.replace 整页跳到目标
  // 不走 history.replaceState + setState 那条路：React 19 跟 effect 同步有 race，
  // 第一次进站时 `setPathname` 会丢，导致 URL 改了但页面不重渲（要刷新才有）。
  // 改用 window.location.replace：浏览器负责完整跳页，新页面会重新走 SPA 路由表。
  useEffect(() => {
    if (route || orderShortIdMatch || storeQueryMatch || vaultShareMatch || pathname === "/") {
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
  }, [pathname, route, orderShortIdMatch, storeQueryMatch, vaultShareMatch]);

  // 切路由时清空上一个专属查单页回填的店铺名，避免切到非 store-query 页时还残留旧名
  useEffect(() => {
    if (!storeQueryMatch) setStoreQueryResolvedName("");
  }, [pathname, storeQueryMatch]);

  // 已知路由：正常渲染
  let content: ReactNode;
  let title: string;
  let description: string;
  let isToolsRoute: boolean;
  let isLabRoute: boolean;
  if (route) {
    content = route.content;
    title = route.title;
    description = route.description;
    isToolsRoute = !!route.tools;
    isLabRoute = !!route.lab;
  } else if (orderShortIdMatch) {
    content = <PurchaserOrderPage />;
    title = "专属下单｜喜八Tools";
    description = "通过下单人专属短链接下单并查询历史订单。";
    isToolsRoute = true;
    isLabRoute = false;
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
    isLabRoute = false;
  } else if (vaultShareMatch) {
    content = <VaultSharePage token={vaultShareMatch[1]} />;
    title = "临时凭据授权｜OTP Vault";
    description = "通过访问码查看限时授权凭据。";
    isToolsRoute = false;
    isLabRoute = false;
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

  const routeContent = <div className="page-transition" key={pathname}>{content}</div>;
  const body = isToolsRoute
    ? <ToolsLayout>{routeContent}</ToolsLayout>
    : isLabRoute
      ? <LabLayout>{routeContent}</LabLayout>
      : routeContent;

  return <Suspense fallback={<RouteFallback />}>{body}</Suspense>;
}
