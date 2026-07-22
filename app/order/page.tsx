import type { Metadata } from "next";
import PublicOrder from "./PublicOrder";

export const metadata: Metadata = {
  title: "订单查询｜喜八",
  description: "查询喜八订单状态与物流进度。",
};

export default function OrderPage() {
  return <PublicOrder />;
}
