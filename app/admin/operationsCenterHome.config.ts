/**
 * 运行中心首页"三大分组"配置
 *
 * 与 mobileMenu.config 形态一致：每个分组是 key + title + description + items。
 * 每个 item 是 ViewKey + 覆盖项，缺省走 ICON_MAP / opsEntries 默认值。
 */
import type { LucideIcon } from "lucide-react";
import { resolveMobileIcon } from "./mobileMenu.config";

export type OpsHomeItem = {
  key: string;
  title?: string;
  description?: string;
  /** 图标名（同 mobileMenu ICON_MAP 约定） */
  icon?: string;
  /** 卡片色：green / blue / amber / peach / ... */
  tone?: string;
  hidden?: boolean;
};

export type OpsHomeGroup = {
  key: string;
  title: string;
  description?: string;
  items: OpsHomeItem[];
};

export type OpsHomeConfig = {
  version: 1;
  groups: OpsHomeGroup[];
};

export const DEFAULT_OPS_HOME: OpsHomeConfig = {
  version: 1,
  groups: [
    {
      key: "runtime",
      title: "实时运行",
      description: "掌握服务与登录会话的即时状态",
      items: [
        { key: "online", description: "会话查看与强制退出", tone: "blue" },
        { key: "server", description: "CPU、内存、JVM 与磁盘", tone: "amber" },
        { key: "cache", description: "Redis 状态与缓存键管理", tone: "green" },
        { key: "druid", description: "Druid 连接池与 SQL 监控", tone: "peach" },
      ],
    },
    {
      key: "audit",
      title: "任务与审计",
      description: "调度后台任务，回溯关键操作",
      items: [
        { key: "jobs", description: "任务启停与立即执行", tone: "blue" },
        { key: "jobLogs", description: "任务执行结果与异常", tone: "amber" },
        { key: "operLogs", description: "后台操作审计轨迹", tone: "green" },
        { key: "loginLogs", description: "登录成功与失败记录", tone: "peach" },
      ],
    },
    {
      key: "devtools",
      title: "开发工具",
      description: "面向研发和联调的常用入口",
      items: [
        { key: "generator", description: "表结构同步与代码下载", tone: "blue" },
        { key: "swagger", description: "Swagger API 文档", tone: "amber" },
        { key: "messages", description: "调试消息通道", tone: "green" },
      ],
    },
  ],
};

export type ResolvedOpsHomeItem = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
};

export type ResolvedOpsHomeGroup = {
  key: string;
  title: string;
  description?: string;
  items: ResolvedOpsHomeItem[];
};

export function resolveOpsHomeItem(
  item: OpsHomeItem,
  defaults: { title: string; description: string; icon: LucideIcon },
): ResolvedOpsHomeItem | null {
  if (item.hidden) return null;
  return {
    key: item.key,
    title: item.title || defaults.title,
    description: item.description || defaults.description,
    icon: item.icon ? resolveMobileIcon(item.icon, defaults.icon) : defaults.icon,
    tone: item.tone || "blue",
  };
}

export function resolveOpsHome(
  config: OpsHomeConfig,
  defaultsByKey: Map<string, { title: string; description: string; icon: LucideIcon }>,
): ResolvedOpsHomeGroup[] {
  return config.groups
    .map((group) => ({
      key: group.key,
      title: group.title,
      description: group.description,
      items: group.items
        .map((item) => {
          const def = defaultsByKey.get(item.key);
          if (!def) return null;
          return resolveOpsHomeItem(item, def);
        })
        .filter((entry): entry is ResolvedOpsHomeItem => !!entry),
    }))
    .filter((group) => group.items.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeOpsHome(raw: unknown): OpsHomeConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_OPS_HOME)) as OpsHomeConfig;
  if (!isRecord(raw)) return base;
  if (Array.isArray(raw.groups) && raw.groups.length) base.groups = raw.groups as OpsHomeGroup[];
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getOpsHome(): OpsHomeConfig {
  return DEFAULT_OPS_HOME;
}

export async function fetchOpsHome(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<OpsHomeConfig> {
  try {
    const result = await request<Record<string, unknown>>("/system/ops-home/config");
    return mergeOpsHome((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_OPS_HOME;
  }
}
