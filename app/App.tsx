import { Suspense, useEffect, useState, type ReactNode } from "react";
import { resolveShortLink } from "./systems/order/api";
import { APP_ROUTES } from "./lib/pathConventions";
import { collectSubsystemPrefixes, resolveSubsystemPath } from "./lib/subsystemHost";
import { isStoreQueryRoute, resolveDynamicRoute, routes, wrapRouteContent } from "./systems/routes";

const subsystemPrefixes = collectSubsystemPrefixes(Object.keys(routes));

function NotFound() {
  return (
    <main className="spa-not-found">
      <span>404</span>
      <h1>页面不存在</h1>
      <p>链接可能已经失效，或者页面地址有误。</p>
      <a href={APP_ROUTES.home}>返回系统入口</a>
      <a href={APP_ROUTES.orderSystem}>打开订单系统</a>
      <a href={APP_ROUTES.manage}>打开管理端</a>
      <a href={APP_ROUTES.lab}>打开 Handy Lab</a>
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
  const matchedRoute = route || resolveDynamicRoute(pathname, storeQueryResolvedName, setStoreQueryResolvedName);
  const hasMatchedRoute = Boolean(matchedRoute);

  // catch-all：未知路径 → 解析短链 → window.location.replace 整页跳到目标
  // 不走 history.replaceState + setState 那条路：React 19 跟 effect 同步有 race，
  // 第一次进站时 `setPathname` 会丢，导致 URL 改了但页面不重渲（要刷新才有）。
  // 改用 window.location.replace：浏览器负责完整跳页，新页面会重新走 SPA 路由表。
  useEffect(() => {
    if (hasMatchedRoute || pathname === "/") {
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
  }, [pathname, hasMatchedRoute]);

  // 切路由时清空上一个专属查单页回填的店铺名，避免切到非 store-query 页时还残留旧名
  useEffect(() => {
    if (!isStoreQueryRoute(pathname)) setStoreQueryResolvedName("");
  }, [pathname]);

  // 已知路由：正常渲染
  let content: ReactNode;
  let title: string;
  let description: string;
  if (matchedRoute) {
    content = matchedRoute.content;
    title = matchedRoute.title;
    description = matchedRoute.description;
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
  const body = wrapRouteContent(matchedRoute, routeContent);

  return <Suspense fallback={<RouteFallback />}>{body}</Suspense>;
}
