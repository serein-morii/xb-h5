import type { Metadata } from "next";
import FreightCompare from "./FreightCompare";

export const metadata: Metadata = { title: "运费对比｜喜八工具箱", description: "对比京东、顺丰和邮政运费。" };

export default function FreightComparePage() { return <FreightCompare />; }
