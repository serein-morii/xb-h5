import { lazy, type ReactNode } from "react";
import { homeRoutes } from "./home/routes";
import { labRoutes } from "./lab/routes";
import { isStoreQueryRoute, orderRoutes, resolveOrderDynamicRoute } from "./order/routes";
import { otpRoutes } from "./otp/routes";
import { systemRoutes } from "./system/routes";
import type { RouteConfig } from "./types";

const OrderToolsLayout = lazy(() => import("./order/tools/layout"));
const LabLayout = lazy(() => import("./lab/LabLayout"));

export const routes = {
  ...homeRoutes,
  ...orderRoutes,
  ...labRoutes,
  ...otpRoutes,
  ...systemRoutes,
};

export { isStoreQueryRoute };

export function resolveDynamicRoute(
  pathname: string,
  storeName: string,
  onStoreName: (name: string) => void,
) {
  return resolveOrderDynamicRoute(pathname, storeName, onStoreName);
}

export function wrapRouteContent(route: RouteConfig, content: ReactNode) {
  if (route.shell === "order-tools") return <OrderToolsLayout>{content}</OrderToolsLayout>;
  if (route.shell === "lab") return <LabLayout>{content}</LabLayout>;
  return content;
}
