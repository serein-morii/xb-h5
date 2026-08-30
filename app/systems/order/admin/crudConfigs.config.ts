import { API_PATHS } from "../../../lib/pathConventions";
/**
 * CrudModule 字段/列顺序 & label 的可配置覆盖层
 *
 * 设计目标（限定）：
 * - 只覆盖 searchFields / fields / display / expand / summary 的**列顺序**和**label**
 * - 不动 type / options / format / required / readonly 等函数逻辑（那些仍走代码默认）
 *
 * 形态跟 mobileMenu / dashboardShortcuts 一致：MenuKey → Override 列表。
 * 运行时合并：override 里出现过的字段先排；未出现的默认字段追加在后面；
 * `hidden: true` 显式隐藏某个字段。
 */
import type { MenuKey } from "./core";

export type CrudFieldOverride = {
  /** 必须匹配默认 config 里的某个字段 key */
  key: string;
  label?: string;
  hidden?: boolean;
};

export type CrudConfigOverride = {
  searchFields?: CrudFieldOverride[];
  fields?: CrudFieldOverride[];
  display?: CrudFieldOverride[];
  expand?: CrudFieldOverride[];
  summary?: CrudFieldOverride[];
};

export type CrudOverridesConfig = {
  version: 1;
  /** key 是 CrudConfig.key（即 MenuKey 之一） */
  overrides: Partial<Record<MenuKey, CrudConfigOverride>>;
};

export const DEFAULT_CRUD_OVERRIDES: CrudOverridesConfig = {
  version: 1,
  overrides: {},
};

/** CrudModule 支持被覆盖的字段类型（T = { key, label?, ...其他 }） */
export type CrudConfigFieldLike = { key: string; label?: string };

/**
 * 把 override 应用到默认字段列表：
 * - 列出 override 里的字段按 override 顺序、用新 label；
 * - 标 hidden: true 的字段被丢弃；
 * - 没在 override 出现的默认字段追加在末尾（不会丢）。
 */
export function applyCrudOverride<T extends CrudConfigFieldLike>(
  defaults: T[],
  override?: CrudFieldOverride[],
): T[] {
  if (!override || !override.length) return defaults;
  const byKey = new Map(defaults.map((field) => [field.key, field]));
  const result: T[] = [];
  const seen = new Set<string>();
  for (const ov of override) {
    const def = byKey.get(ov.key);
    if (!def) continue;
    seen.add(ov.key);
    if (ov.hidden) continue;
    result.push({ ...def, label: ov.label || def.label } as T);
  }
  for (const def of defaults) {
    if (!seen.has(def.key)) result.push(def);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeCrudOverrides(raw: unknown): CrudOverridesConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_CRUD_OVERRIDES)) as CrudOverridesConfig;
  if (!isRecord(raw)) return base;
  if (isRecord(raw.overrides)) {
    base.overrides = raw.overrides as CrudOverridesConfig["overrides"];
  }
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getCrudOverrides(): CrudOverridesConfig {
  return DEFAULT_CRUD_OVERRIDES;
}

export async function fetchCrudOverrides(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<CrudOverridesConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.root}/crud-overrides/config`);
    return mergeCrudOverrides((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_CRUD_OVERRIDES;
  }
}
