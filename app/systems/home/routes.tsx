import { lazy } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import type { RouteConfig } from "../types";

const PeachHome = lazy(() => import("../../site/PeachHome"));
const SystemHome = lazy(() => import("./SystemHome"));

export const homeRoutes: Record<string, RouteConfig> = {
  [APP_ROUTES.home]: {
    title: "XB Workspace｜系统入口",
    description: "订单系统、OTP Vault 与 Handy Lab 的统一入口。",
    content: <SystemHome />,
  },
  [APP_ROUTES.peach]: {
    title: "炎陵黄桃｜高山鲜果，当季采摘",
    description: "来自湖南炎陵高山果园的当季黄桃，客户可注册进入专属页面下单并查看订单物流。",
    content: <PeachHome />,
  },
};
