import { useEffect, type ReactNode } from "react";
import MobileAdmin from "./MobileAdmin";
import PublicOrder from "./order/PublicOrder";
import FreightCalculator from "./tools/freight-calculator/FreightCalculator";
import FreightCompare from "./tools/freight-compare/FreightCompare";
import ToolsLayout from "./tools/layout";
import OrderLinkGenerator from "./tools/order-link/OrderLinkGenerator";
import OrderSearch from "./tools/order-search/OrderSearch";
import ToolsPage from "./tools/page";
import PurchaserOrderPage from "./tools/place-order/PurchaserOrderPage";
import PurchaserManager from "./tools/purchasers/PurchaserManager";

type RouteConfig = {
  title: string;
  description: string;
  tools?: boolean;
  content: ReactNode;
};

const routes: Record<string, RouteConfig> = {
  "/": {
    title: "喜八移动订单管理",
    description: "专为手机端设计的喜八订单、账单、快递、价格和店铺管理工作台。",
    content: <MobileAdmin />,
  },
  "/order": {
    title: "订单查询｜喜八",
    description: "查询喜八订单状态与物流进度。",
    content: <PublicOrder />,
  },
  "/tools": {
    title: "公开工具｜喜八",
    description: "无需登录使用订单查询、运费计算与运费对比工具。",
    tools: true,
    content: <ToolsPage />,
  },
  "/tools/order-search": {
    title: "订单查询｜喜八工具箱",
    description: "通过手机号和验证码免登录查询订单。",
    tools: true,
    content: <OrderSearch />,
  },
  "/tools/order": {
    title: "链接订单详情｜喜八工具箱",
    description: "通过加密订单链接查看订单状态与物流进度。",
    tools: true,
    content: <PublicOrder embedded />,
  },
  "/tools/order-link": {
    title: "生成链接｜喜八",
    description: "选择店铺和买家，生成专属免登录下单链接。",
    tools: true,
    content: <OrderLinkGenerator />,
  },
  "/tools/place-order": {
    title: "专属下单｜喜八",
    description: "通过下单人专属短链接下单并免登录查询历史订单。",
    tools: true,
    content: <PurchaserOrderPage />,
  },
  "/tools/purchasers": {
    title: "买家管理｜喜八",
    description: "管理买家与店铺的绑定关系。",
    tools: true,
    content: <PurchaserManager />,
  },
  "/tools/freight-calculator": {
    title: "运费计算｜喜八工具箱",
    description: "批量计算常用快递公司的寄递费用。",
    tools: true,
    content: <FreightCalculator />,
  },
  "/tools/freight-compare": {
    title: "运费对比｜喜八工具箱",
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
      <a href="/">返回管理首页</a>
      <a href="/tools">打开免登录工具箱</a>
    </main>
  );
}

export default function App() {
  const pathname = normalizePath(window.location.pathname);
  const route = routes[pathname];

  useEffect(() => {
    document.title = route?.title || "页面不存在｜喜八";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = route?.description || "喜八移动订单管理";
  }, [route]);

  if (!route) return <NotFound />;
  return route.tools ? <ToolsLayout>{route.content}</ToolsLayout> : route.content;
}
