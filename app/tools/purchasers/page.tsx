import type { Metadata } from "next";
import PurchaserManager from "./PurchaserManager";

export const metadata: Metadata = { title: "买家管理｜喜八", description: "管理买家与店铺的绑定关系。" };

export default function PurchasersPage() { return <PurchaserManager />; }
