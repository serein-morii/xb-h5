import type { Metadata } from "next";
import PurchaserOrderPage from "./PurchaserOrderPage";

export const metadata: Metadata = { title: "专属下单｜喜八", description: "通过下单人专属短链接下单并免登录查询历史订单。" };

export default function PlaceOrderPage() { return <PurchaserOrderPage />; }
