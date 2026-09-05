import { lazy } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import type { RouteConfig } from "../types";

const SystemCenterApp = lazy(() => import("./SystemCenterApp"));

export const systemRoutes: Record<string, RouteConfig> = {
  [APP_ROUTES.systemCenter]: {
    title: "系统中心｜XB Workspace",
    description: "账号权限、系统配置与运行监控，独立于各业务子系统。",
    content: <SystemCenterApp />,
  },
};
