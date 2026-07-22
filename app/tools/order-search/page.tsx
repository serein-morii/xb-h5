import type { Metadata } from "next";
import OrderSearch from "./OrderSearch";

export const metadata: Metadata = { title: "订单查询｜喜八工具箱", description: "通过手机号和验证码免登录查询订单。" };
export default function OrderSearchPage() { return <OrderSearch />; }
