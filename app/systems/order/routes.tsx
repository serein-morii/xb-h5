import { lazy } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import type { RouteConfig } from "../types";

const MobileAdmin = lazy(() => import("./MobileAdmin"));
const OrderSystemHome = lazy(() => import("./OrderSystemHome"));
const PublicOrder = lazy(() => import("./order/PublicOrder"));
const FreightCalculator = lazy(() => import("./tools/freight-calculator/FreightCalculator"));
const FreightCompare = lazy(() => import("./tools/freight-compare/FreightCompare"));
const OrderLinkGenerator = lazy(() => import("./tools/order-link/OrderLinkGenerator"));
const OrderSearch = lazy(() => import("./tools/order-search/OrderSearch"));
const ToolsPage = lazy(() => import("./tools/page"));
const PurchaserOrderPage = lazy(() => import("./tools/place-order/PurchaserOrderPage"));
const PurchaserManager = lazy(() => import("./tools/purchasers/PurchaserManager"));
const StoreQuery = lazy(() => import("./tools/store-query/StoreQuery"));
const StoreQueryList = lazy(() => import("./tools/store-query/StoreQueryList"));
const CustomerAuthPage = lazy(() => import("./customer/CustomerAuthPage"));

export const orderRoutes: Record<string, RouteConfig> = {
  [APP_ROUTES.orderSystem]: {
    title: "订单系统｜XB Workspace",
    description: "订单、查单、买家、店铺与后台管理入口。",
    content: <OrderSystemHome />,
  },
  [APP_ROUTES.manage]: {
    title: "喜八移动订单管理",
    description: "喜八订单、账单、快递、商品和店铺管理工作台。",
    content: <MobileAdmin />,
  },
  [APP_ROUTES.customerLogin]: {
    title: "客户登录｜炎陵黄桃",
    description: "登录炎陵黄桃客户中心。",
    content: <CustomerAuthPage mode="login" />,
  },
  [APP_ROUTES.customerRegister]: {
    title: "客户注册｜炎陵黄桃",
    description: "注册炎陵黄桃客户账号，可选绑定已有专属下单码。",
    content: <CustomerAuthPage mode="register" />,
  },
  [APP_ROUTES.customerReset]: {
    title: "找回密码｜炎陵黄桃",
    description: "通过邮箱验证码找回客户账号密码。",
    content: <CustomerAuthPage mode="reset" />,
  },
  [APP_ROUTES.orderQuery]: {
    title: "订单查询｜喜八",
    description: "查询喜八订单状态与物流进度。",
    content: <PublicOrder />,
  },
  [APP_ROUTES.tools]: {
    title: "公开工具｜喜八",
    description: "使用订单查询、运费计算与运费对比工具。",
    shell: "order-tools",
    content: <ToolsPage />,
  },
  [APP_ROUTES.toolOrderSearch]: {
    title: "订单查询｜喜八Tools",
    description: "通过手机号和验证码查询订单。",
    shell: "order-tools",
    content: <OrderSearch />,
  },
  [APP_ROUTES.toolOrderDetail]: {
    title: "订单详情｜喜八Tools",
    description: "通过加密订单链接查看订单状态与物流进度。",
    shell: "order-tools",
    content: <PublicOrder embedded />,
  },
  [APP_ROUTES.toolOrderLink]: {
    title: "生成链接｜喜八",
    description: "选择店铺和买家，生成专属下单链接。",
    shell: "order-tools",
    content: <OrderLinkGenerator />,
  },
  [APP_ROUTES.toolPlaceOrder]: {
    title: "专属下单｜喜八",
    description: "通过下单人专属短链接下单并查询历史订单。",
    shell: "order-tools",
    content: <PurchaserOrderPage />,
  },
  [APP_ROUTES.toolPurchasers]: {
    title: "买家管理｜喜八",
    description: "管理买家与店铺的绑定关系。",
    shell: "order-tools",
    content: <PurchaserManager />,
  },
  [APP_ROUTES.toolStoreQuery]: {
    title: "专属查询｜喜八",
    description: "选择店铺后只查询该店铺的订单，避免串单。",
    shell: "order-tools",
    content: <StoreQueryList />,
  },
  [APP_ROUTES.toolFreightCalculator]: {
    title: "运费计算｜喜八Tools",
    description: "批量计算常用快递公司的寄递费用。",
    shell: "order-tools",
    content: <FreightCalculator />,
  },
  [APP_ROUTES.toolFreightCompare]: {
    title: "运费对比｜喜八Tools",
    description: "对比不同快递公司的计价结果。",
    shell: "order-tools",
    content: <FreightCompare />,
  },
};

export function resolveOrderDynamicRoute(pathname: string, storeQueryResolvedName: string, onStoreName: (name: string) => void) {
  const orderShortIdMatch = pathname.match(/^\/tools\/order\/([2-9a-hj-km-np-z]{6})$/);
  if (orderShortIdMatch) {
    return {
      title: "专属下单｜喜八Tools",
      description: "通过下单人专属短链接下单并查询历史订单。",
      shell: "order-tools",
      content: <PurchaserOrderPage />,
    } satisfies RouteConfig;
  }

  const storeQueryMatch = pathname.match(/^\/tools\/store-query\/([^/]+)$/);
  if (!storeQueryMatch) return null;

  const rawCode = storeQueryMatch[1] || "";
  let storeCode = rawCode;
  try { storeCode = decodeURIComponent(rawCode); } catch { /* keep raw */ }
  const displayName = storeQueryResolvedName || storeCode;
  return {
    title: `${displayName}｜专属查询`,
    description: `查询 ${displayName} 店铺下的订单与物流进度。`,
    shell: "order-tools",
    content: <StoreQuery storeCode={storeCode} onResolvedName={onStoreName} />,
  } satisfies RouteConfig;
}

export function isStoreQueryRoute(pathname: string) {
  return /^\/tools\/store-query\/([^/]+)$/.test(pathname);
}
