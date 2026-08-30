import { API_PATHS } from "../../../lib/pathConventions";
/**
 * 订单管理页 - 状态卡 + 付款快捷筛选配置
 *
 * - 状态：6 个卡片（含"本页订单"），key 对应 OrderStatusView（"all" 表示 null）
 * - 付款：4 个快捷按钮（含"全部付款"），key 对应后端 payStatus 值
 *
 * 后端字段固定，所以这里只动 label / 顺序 / 图标 / 隐藏。
 */
import { CreditCard, ShoppingBag, type LucideIcon } from "lucide-react";
import { resolveMobileIcon } from "./mobileMenu.config";

export type OrderStatusViewKey = "all" | "pending" | "shipping" | "transit" | "completed";

export type OrderStatusFilterItem = {
  key: OrderStatusViewKey;
  label: string;
  icon: string;
  /** 卡片色：peach / amber / blue / green / red ... */
  tone: string;
  hidden?: boolean;
};

export type OrderPayFilterKey = "all" | "1" | "3" | "0";

export type OrderPayFilterItem = {
  key: OrderPayFilterKey;
  label: string;
  icon?: string;
  hidden?: boolean;
};

export type OrderFiltersConfig = {
  version: 1;
  status: OrderStatusFilterItem[];
  pay: OrderPayFilterItem[];
};

export const DEFAULT_ORDER_FILTERS: OrderFiltersConfig = {
  version: 1,
  status: [
    { key: "all", label: "本页订单", icon: "shopping-bag", tone: "peach" },
    { key: "pending", label: "待处理", icon: "rotate", tone: "amber" },
    { key: "shipping", label: "待发货", icon: "packageBox", tone: "blue" },
    { key: "transit", label: "运输中", icon: "truck", tone: "green" },
    { key: "completed", label: "已完成", icon: "circle-check", tone: "green" },
  ],
  pay: [
    { key: "all", label: "全部付款" },
    { key: "1", label: "已付款", icon: "credit-card" },
    { key: "3", label: "待确认" },
    { key: "0", label: "未付款" },
  ],
};

export type ResolvedOrderStatusFilterItem = {
  key: OrderStatusViewKey;
  label: string;
  icon: LucideIcon;
  tone: string;
};

export type ResolvedOrderPayFilterItem = {
  key: OrderPayFilterKey;
  label: string;
  icon?: LucideIcon;
};

export function resolveOrderStatusFilter(config: OrderFiltersConfig): ResolvedOrderStatusFilterItem[] {
  return config.status
    .filter((item) => !item.hidden)
    .map((item) => ({
      key: item.key,
      label: item.label,
      tone: item.tone,
      icon: resolveMobileIcon(item.icon, ShoppingBag),
    }));
}

export function resolveOrderPayFilter(config: OrderFiltersConfig): ResolvedOrderPayFilterItem[] {
  return config.pay
    .filter((item) => !item.hidden)
    .map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon ? resolveMobileIcon(item.icon, CreditCard) : undefined,
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeOrderFilters(raw: unknown): OrderFiltersConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_ORDER_FILTERS)) as OrderFiltersConfig;
  if (!isRecord(raw)) return base;
  if (Array.isArray(raw.status) && raw.status.length) base.status = raw.status as OrderStatusFilterItem[];
  if (Array.isArray(raw.pay) && raw.pay.length) base.pay = raw.pay as OrderPayFilterItem[];
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getOrderFilters(): OrderFiltersConfig {
  return DEFAULT_ORDER_FILTERS;
}

export async function fetchOrderFilters(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<OrderFiltersConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.root}/order-filters/config`);
    return mergeOrderFilters((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_ORDER_FILTERS;
  }
}
