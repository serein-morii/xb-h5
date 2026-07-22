import type { Metadata } from "next";
import FreightCalculator from "./FreightCalculator";

export const metadata: Metadata = { title: "运费计算｜喜八工具箱", description: "批量计算黄桃订单寄递运费。" };

export default function FreightCalculatorPage() { return <FreightCalculator />; }
