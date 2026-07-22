import type { Metadata } from "next";
import PublicOrder from "../../order/PublicOrder";

export const metadata: Metadata = { title: "链接订单详情｜喜八工具箱", description: "通过加密订单链接查看订单状态与物流进度。" };

export default function ToolOrderPage() { return <PublicOrder embedded />; }
