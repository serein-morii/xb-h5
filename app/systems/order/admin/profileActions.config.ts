import { API_PATHS } from "../../../lib/pathConventions";
/**
 * 用户菜单 sheet 的"我的"子页 action 列表配置
 *
 * 每个 action 都有 handler（仍走代码），但 label / icon / 顺序 / 显隐可配。
 */
import { LogOut, type LucideIcon } from "lucide-react";
import { resolveMobileIcon } from "./mobileMenu.config";

export type ProfileActionKey = "editProfile" | "changePwd" | "bindEmail" | "replayTour" | "logout";

export type ProfileActionItem = {
  key: ProfileActionKey;
  label: string;
  /** 覆盖 label 的动态后缀（"绑定邮箱" ↔ "更换邮箱"），用 {action} 引用 label */
  altLabel?: string;
  icon: string;
  /** tone: 普通 = undefined；danger = 退出等 */
  danger?: boolean;
  hidden?: boolean;
};

export type ProfileActionsConfig = {
  version: 1;
  items: ProfileActionItem[];
};

export const DEFAULT_PROFILE_ACTIONS: ProfileActionsConfig = {
  version: 1,
  items: [
    { key: "editProfile", label: "编辑信息", icon: "pencil" },
    { key: "changePwd", label: "修改密码", icon: "lock" },
    { key: "bindEmail", label: "绑定邮箱", altLabel: "更换邮箱", icon: "send" },
    { key: "replayTour", label: "重看引导", icon: "sparkles" },
    { key: "logout", label: "退出当前账号", icon: "log-out", danger: true },
  ],
};

export type ResolvedProfileAction = {
  key: ProfileActionKey;
  label: string;
  icon: LucideIcon;
  danger: boolean;
};

export function resolveProfileActions(config: ProfileActionsConfig): ResolvedProfileAction[] {
  return config.items
    .filter((item) => !item.hidden)
    .map((item) => ({
      key: item.key,
      label: item.label,
      icon: resolveMobileIcon(item.icon, LogOut),
      danger: !!item.danger,
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeProfileActions(raw: unknown): ProfileActionsConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_PROFILE_ACTIONS)) as ProfileActionsConfig;
  if (!isRecord(raw)) return base;
  if (Array.isArray(raw.items) && raw.items.length) base.items = raw.items as ProfileActionItem[];
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getProfileActions(): ProfileActionsConfig {
  return DEFAULT_PROFILE_ACTIONS;
}

export async function fetchProfileActions(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<ProfileActionsConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.root}/profile-actions/config`);
    return mergeProfileActions((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_PROFILE_ACTIONS;
  }
}
