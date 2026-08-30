import { API_PATHS } from "../../../lib/pathConventions";
/**
 * 工作台"常用操作"快捷入口配置
 *
 * 跟 mobileMenu.config 同样的形态：MenuKey + 覆盖项 + 后端覆盖。
 * descTemplate 支持 {purchaserTotal} 之类占位，运行时用 data 字段填充。
 */
import type { LucideIcon } from "lucide-react";
import type { MenuKey } from "./core";
import { MOBILE_PAGE_REGISTRY, resolveMobileIcon } from "./mobileMenu.config";

export type DashboardShortcutItem = {
  key: MenuKey;
  label?: string;
  desc?: string;
  /** 占位模板，如 "{purchaserTotal} 位买家"。data.* 字段会被替换；未匹配的 {x} 保留原样 */
  descTemplate?: string;
  /** 图标名（同 mobileMenu ICON_MAP 约定） */
  icon?: string;
  /** 卡片色：green / blue / amber / peach / ... */
  tone?: string;
  hidden?: boolean;
};

export type DashboardShortcutsConfig = {
  version: 1;
  items: DashboardShortcutItem[];
};

export const DEFAULT_DASHBOARD_SHORTCUTS: DashboardShortcutsConfig = {
  version: 1,
  items: [
    { key: "orders", desc: "查询与发货", tone: "green" },
    { key: "batchOrder", desc: "Excel 粘贴批量下单", tone: "green" },
    { key: "orderLink", desc: "买家专属入口", tone: "peach" },
    { key: "purchasers", descTemplate: "{purchaserTotal} 位买家", tone: "green" },
    { key: "express", desc: "物流轨迹", tone: "blue" },
    { key: "bills", descTemplate: "{billTotal} 条账单", tone: "amber" },
  ],
};

export type ResolvedDashboardShortcut = {
  key: MenuKey;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone: string;
};

const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

function fillTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_RE, (match, key) => {
    const value = data[key];
    if (value === null || value === undefined || value === "") return match;
    return String(value);
  });
}

export function resolveDashboardShortcut(
  item: DashboardShortcutItem,
  data: Record<string, unknown>,
): ResolvedDashboardShortcut | null {
  if (item.hidden) return null;
  const reg = MOBILE_PAGE_REGISTRY[item.key];
  if (!reg) return null;
  const label = item.label || reg.label;
  const fallbackDesc = item.desc || reg.description;
  const desc = item.descTemplate ? fillTemplate(item.descTemplate, data) : fallbackDesc;
  const icon = item.icon ? resolveMobileIcon(item.icon, reg.icon) : reg.icon;
  return { key: item.key, label, desc, icon, tone: item.tone || "green" };
}

export function resolveDashboardShortcuts(
  config: DashboardShortcutsConfig,
  data: Record<string, unknown>,
): ResolvedDashboardShortcut[] {
  return config.items
    .map((item) => resolveDashboardShortcut(item, data))
    .filter((entry): entry is ResolvedDashboardShortcut => !!entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeDashboardShortcuts(raw: unknown): DashboardShortcutsConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_SHORTCUTS)) as DashboardShortcutsConfig;
  if (!isRecord(raw)) return base;
  if (Array.isArray(raw.items) && raw.items.length) base.items = raw.items as DashboardShortcutItem[];
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getDashboardShortcuts(): DashboardShortcutsConfig {
  return DEFAULT_DASHBOARD_SHORTCUTS;
}

export async function fetchDashboardShortcuts(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<DashboardShortcutsConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.root}/dashboard-shortcuts/config`);
    return mergeDashboardShortcuts((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_DASHBOARD_SHORTCUTS;
  }
}
