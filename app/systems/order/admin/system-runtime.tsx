/**
 * DEPRECATED — 子页已全部升级为一级菜单项。
 *
 * 历史背景：本文件原本是"系统运行"统一入口的 hub，按角色 capability 把 20 多个
 * 子项（成员 / 角色 / 字典 / 服务监控 / 操作日志 等）动态塞进一个二级页里。
 *
 * 改造后：这些子项都成了 MenuKey（sys* / ops*），在菜单编辑器里和普通菜单项一样
 * 可配置；hub 行为下沉到 system-pages.tsx 的 SystemHubPage 分发器。
 *
 * 这里保留一个空壳导出，避免老缓存/外部 import 找不到符号；新代码不要继续使用。
 */
import type { MenuKey } from "./core";
import { useAccess } from "./access";
import { SystemHubPage } from "./system-pages";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

/** @deprecated 改用 system-pages.tsx 的 SystemHubPage */
export function SystemRuntimeCenter({ notify, active, onExit }: { notify: Notify; active?: MenuKey; onExit?: () => void }) {
  const access = useAccess();
  const fallbackActive: MenuKey = "systemCenter";
  if (!access.ready) return null;
  return <SystemHubPage active={active || fallbackActive} notify={notify} onExit={onExit || (() => undefined)} />;
}

/** @deprecated 改用 system-pages.tsx 的 SystemHubPage */
export default SystemRuntimeCenter;
