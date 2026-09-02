import { API_PATHS } from "../../../lib/pathConventions";
/**
 * 移动菜单两级目录配置。
 *
 * 历史上这个文件保存 tier/promotions；现在改为明确的父子关系：
 * - 没有 parentKey：一级入口，显示在「全部功能」；
 * - 有 parentKey：二级菜单，只显示在父级目录页；
 * - 有子项的一级入口自动成为目录，不再打开它原来的业务页面。
 *
 * 接口路径暂时保持不变，兼容已经部署的配置存储端。
 */
import type { MenuKey } from "./core";

export type MobileMenuCustomDirectoryKey = `directory:${string}`;
export type MobileMenuDirectoryKey = MenuKey | MobileMenuCustomDirectoryKey;

export type MobileMenuCustomDirectory = {
  key: MobileMenuCustomDirectoryKey;
  label: string;
  description?: string;
  icon?: string;
  groupKey?: string;
};

export type MobileMenuHierarchyEntry = {
  key: MenuKey;
  parentKey: MobileMenuDirectoryKey;
};

export type MobileEntryPromotionsConfig = {
  version: 3;
  entries: MobileMenuHierarchyEntry[];
  directories: MobileMenuCustomDirectory[];
};

const SYSTEM_CHILDREN: MenuKey[] = [
  "sysUsers", "sysRoles", "sysDepts", "sysPosts", "sysMenus", "sysDictTypes", "sysConfigs", "sysRiskIps", "sysNotices", "mobileMenu",
];

const OPERATIONS_CHILDREN: MenuKey[] = [
  "opsOnline", "opsJobs", "opsJobLogs", "opsOperLogs", "opsLoginLogs",
  "opsServer", "opsCache", "opsDruid", "opsGenerator", "opsSwagger", "opsMessages",
];

export const DEFAULT_MOBILE_ENTRY_PROMOTIONS: MobileEntryPromotionsConfig = {
  version: 3,
  entries: [
    ...SYSTEM_CHILDREN.map((key) => ({ key, parentKey: "systemCenter" as MenuKey })),
    ...OPERATIONS_CHILDREN.map((key) => ({ key, parentKey: "operationsCenter" as MenuKey })),
  ],
  directories: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMenuKey(value: unknown, allowed?: ReadonlySet<string>): value is MenuKey {
  return typeof value === "string" && (!allowed || allowed.has(value));
}

/**
 * 清理无效父子关系并强制只有两层：作为父目录的条目不能再挂到其他目录下。
 */
export function normalizeMobileMenuHierarchy(
  entries: readonly MobileMenuHierarchyEntry[],
  allowed?: ReadonlySet<string>,
  customDirectoryKeys?: ReadonlySet<string>,
): MobileMenuHierarchyEntry[] {
  const parentByKey = new Map<MenuKey, MobileMenuDirectoryKey>();
  for (const entry of entries) {
    if (!isMenuKey(entry?.key, allowed) || typeof entry?.parentKey !== "string") continue;
    const validParent = isMenuKey(entry.parentKey, allowed) || !!customDirectoryKeys?.has(entry.parentKey);
    if (!validParent) continue;
    if (entry.key === entry.parentKey) continue;
    parentByKey.set(entry.key, entry.parentKey);
  }

  // 父级必须处于第一层。如果 A 已经挂在 B 下，任何指向 A 的关系都无效。
  const normalized: MobileMenuHierarchyEntry[] = [];
  for (const [key, parentKey] of parentByKey) {
    if (!parentKey.startsWith("directory:") && parentByKey.has(parentKey as MenuKey)) continue;
    normalized.push({ key, parentKey });
  }
  return normalized;
}

export function resolveMobileMenuHierarchy(config: MobileEntryPromotionsConfig) {
  const directoryKeys = new Set(config.directories.map((item) => item.key));
  const parentByKey = new Map<MenuKey, MobileMenuDirectoryKey>();
  const childrenByParent = new Map<MobileMenuDirectoryKey, MenuKey[]>();
  for (const entry of normalizeMobileMenuHierarchy(config.entries, undefined, directoryKeys)) {
    parentByKey.set(entry.key, entry.parentKey);
    const children = childrenByParent.get(entry.parentKey) || [];
    children.push(entry.key);
    childrenByParent.set(entry.parentKey, children);
  }
  return {
    parentOf: (key: MenuKey) => parentByKey.get(key),
    childrenOf: (key: MobileMenuDirectoryKey) => childrenByParent.get(key) || [],
    isDirectory: (key: MobileMenuDirectoryKey) => childrenByParent.has(key),
  };
}

function normalizeCustomDirectories(raw: unknown): MobileMenuCustomDirectory[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item): MobileMenuCustomDirectory[] => {
    if (!isRecord(item) || typeof item.key !== "string" || !item.key.startsWith("directory:")) return [];
    const key = item.key as MobileMenuCustomDirectoryKey;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!label || seen.has(key)) return [];
    seen.add(key);
    return [{
      key,
      label: label.slice(0, 24),
      description: typeof item.description === "string" ? item.description.trim().slice(0, 60) : undefined,
      icon: typeof item.icon === "string" ? item.icon.trim() : "folder",
      groupKey: typeof item.groupKey === "string" ? item.groupKey.trim() : undefined,
    }];
  });
}

export function mergeMobileEntryPromotions(raw: unknown): MobileEntryPromotionsConfig {
  if (!isRecord(raw)) return DEFAULT_MOBILE_ENTRY_PROMOTIONS;
  if (isRecord(raw.config)) return mergeMobileEntryPromotions(raw.config);

  const directories = normalizeCustomDirectories(raw.directories);
  const directoryKeys = new Set(directories.map((item) => item.key));

  if (Array.isArray(raw.entries)) {
    return {
      version: 3,
      entries: normalizeMobileMenuHierarchy(raw.entries as MobileMenuHierarchyEntry[], undefined, directoryKeys),
      directories,
    };
  }

  // 兼容过渡期：若旧 promotions 已经携带 parentKey，也可直接恢复关系。
  if (Array.isArray(raw.promotions)) {
    const entries = (raw.promotions as Array<Record<string, unknown>>)
      .filter((item) => item.parentKey)
      .map((item) => ({ key: item.key as MenuKey, parentKey: item.parentKey as MenuKey }));
    if (entries.length) return { version: 3, entries: normalizeMobileMenuHierarchy(entries), directories: [] };
  }

  // 旧 tier 没有父级信息，无法安全迁移，使用内置目录结构避免菜单消失。
  return DEFAULT_MOBILE_ENTRY_PROMOTIONS;
}

export function getMobileEntryPromotions(): MobileEntryPromotionsConfig {
  return DEFAULT_MOBILE_ENTRY_PROMOTIONS;
}

export async function fetchMobileEntryPromotions(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<MobileEntryPromotionsConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.mobileMenu}/config`);
    const payload = (result as { data?: unknown }).data ?? result;
    return isRecord(payload) ? mergeMobileEntryPromotions(payload.hierarchy) : DEFAULT_MOBILE_ENTRY_PROMOTIONS;
  } catch {
    return DEFAULT_MOBILE_ENTRY_PROMOTIONS;
  }
}
