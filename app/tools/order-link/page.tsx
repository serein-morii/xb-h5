import type { Metadata } from "next";
import OrderLinkGenerator from "./OrderLinkGenerator";

export const metadata: Metadata = { title: "生成链接｜喜八", description: "选择店铺和买家，生成专属免登录下单链接。" };

export default function OrderLinkPage() { return <OrderLinkGenerator />; }
