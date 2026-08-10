/**
 * 工作台"今日重点卡" + "三联概览"配置
 *
 * - "今日重点" 区（focus）：当前用 focusSource[0]，这里只取 zone=="focus" 的第一项
 * - "概览三联" 区（strip）：底部三块卡，渲染 zone=="strip" 的项
 *
 * 字段 key 对应 DashboardData 的字段名（orderTotal / waiting / sent / completed / ...）
 */
import {
  CircleCheck,
  PackageCheck,
  RotateCw,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { MenuKey } from "./core";
import { resolveMobileIcon } from "./mobileMenu.config";

export type DashboardFocusItem = {
  /** 对应 DashboardData 字段名 */
  key: "orderTotal" | "todayOrders" | "pending" | "waiting" | "sent" | "completed";
  label: string;
  sub?: string;     // 副标文字，如"累计" / "需跟进" / "已归档"
  /** 卡片色 */
  tone?: string;
  /** 图标名（同 mobileMenu ICON_MAP 约定） */
  icon?: string;
  /** 点击跳转目标（不填则不可点） */
  onClickKey?: MenuKey;
  /** 当 zone=="focus" 时，点击后设置订单页的 status 筛选（不填则不筛） */
  filterStatus?: "pending" | "shipping" | "transit" | "completed";
  /** zone 决定这块卡放在哪里 */
  zone: "focus" | "strip";
  hidden?: boolean;
};

export type DashboardFocusConfig = {
  version: 1;
  items: DashboardFocusItem[];
};

export const DEFAULT_DASHBOARD_FOCUS: DashboardFocusConfig = {
  version: 1,
  items: [
    // 今日重点（首页大卡）
    { key: "pending", label: "待处理", zone: "focus", filterStatus: "pending", onClickKey: "orders" },
    // 概览三联
    { key: "orderTotal", label: "全部订单", sub: "累计", icon: "shopping-bag", tone: "peach", onClickKey: "orders", zone: "strip" },
    { key: "waiting", label: "待发货", sub: "需跟进", icon: "package", tone: "amber", onClickKey: "orders", zone: "strip" },
    { key: "completed", label: "已完成", sub: "已归档", icon: "circle-check", tone: "green", onClickKey: "orders", zone: "strip" },
  ],
};

const ICON_FALLBACK: Record<string, LucideIcon> = {
  "orderTotal": ShoppingBag,
  "todayOrders": ShoppingBag,
  "pending": RotateCw,
  "waiting": PackageCheck,
  "sent": Truck,
  "completed": CircleCheck,
};

export type ResolvedDashboardFocusItem = {
  key: string;
  label: string;
  sub?: string;
  tone: string;
  icon: LucideIcon;
  onClickKey?: MenuKey;
  filterStatus?: "pending" | "shipping" | "transit" | "completed";
  zone: "focus" | "strip";
};

export function resolveDashboardFocusItem(item: DashboardFocusItem): ResolvedDashboardFocusItem | null {
  if (item.hidden) return null;
  const fallbackIcon = ICON_FALLBACK[item.key] || ShoppingBag;
  const icon = item.icon ? resolveMobileIcon(item.icon, fallbackIcon) : fallbackIcon;
  return {
    key: item.key,
    label: item.label,
    sub: item.sub,
    tone: item.tone || "green",
    icon,
    onClickKey: item.onClickKey,
    filterStatus: item.filterStatus,
    zone: item.zone,
  };
}

export function resolveDashboardFocus(config: DashboardFocusConfig): {
  focus: ResolvedDashboardFocusItem | null;
  strip: ResolvedDashboardFocusItem[];
} {
  const resolved = config.items
    .map(resolveDashboardFocusItem)
    .filter((entry): entry is ResolvedDashboardFocusItem => !!entry);
  const focus = resolved.find((entry) => entry.zone === "focus") || null;
  const strip = resolved.filter((entry) => entry.zone === "strip");
  return { focus, strip };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeDashboardFocus(raw: unknown): DashboardFocusConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_FOCUS)) as DashboardFocusConfig;
  if (!isRecord(raw)) return base;
  if (Array.isArray(raw.items) && raw.items.length) base.items = raw.items as DashboardFocusItem[];
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getDashboardFocus(): DashboardFocusConfig {
  return DEFAULT_DASHBOARD_FOCUS;
}

export async function fetchDashboardFocus(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<DashboardFocusConfig> {
  try {
    const result = await request<Record<string, unknown>>("/system/dashboard-focus/config");
    return mergeDashboardFocus((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_DASHBOARD_FOCUS;
  }
}
