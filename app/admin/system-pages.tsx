/**
 * 系统/运行中心子页分发器
 *
 * 把 sys* / ops* 系列的 MenuKey 路由到 system-management / operations-center 对应的子模块。
 * 这些模块原本写在 system-runtime.tsx 里作为 "系统中心" 的内嵌子页，
 * 现在全部升级为一级菜单项，但仍复用同一套 CRUD UI。
 */
import { lazy, Suspense } from "react";
import { LoaderCircle, Settings2 } from "lucide-react";
import { useAccess } from "./access";
import type { MenuKey } from "./core";

type Notify = (message: string, type?: "success" | "error" | "info") => void;

const SystemManagementCenter = lazy(() =>
  import("./system-management").then((m) => ({ default: m.SystemManagementCenter })),
);
const OperationsCenterPage = lazy(() =>
  import("./operations-center").then((m) => ({ default: m.OperationsCenterPage })),
);
const MobileMenuSettingsPage = lazy(() =>
  import("./mobile-menu-settings").then((m) => ({ default: m.MobileMenuSettingsPage })),
);

/** sys* 系列 → system-management 的 module key */
const SYSTEM_MODULE_MAP: Partial<Record<MenuKey, string>> = {
  sysUsers: "users",
  sysRoles: "roles",
  sysDepts: "depts",
  sysPosts: "posts",
  sysMenus: "menus",
  sysDictTypes: "dictTypes",
  sysConfigs: "configs",
  sysNotices: "notices",
};

/** ops* 系列 → operations-center 的 view key */
const OPS_VIEW_MAP: Partial<Record<MenuKey, string>> = {
  opsOnline: "online",
  opsJobs: "jobs",
  opsJobLogs: "jobLogs",
  opsOperLogs: "operLogs",
  opsLoginLogs: "loginLogs",
  opsServer: "server",
  opsCache: "cache",
  opsDruid: "druid",
  opsGenerator: "generator",
  opsSwagger: "swagger",
  opsMessages: "messages",
};

function Loading() {
  return <div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载模块</div>;
}

type HubKind = "system" | "operations" | "menuEditor" | "unknown";

function classify(active: MenuKey): HubKind {
  if (active === "systemCenter" || active in SYSTEM_MODULE_MAP) return "system";
  if (active === "operationsCenter" || active in OPS_VIEW_MAP) return "operations";
  if (active === "mobileMenu") return "menuEditor";
  return "unknown";
}

function resolveSystemModule(active: MenuKey): string | null {
  if (active === "systemCenter") return null;
  return SYSTEM_MODULE_MAP[active] || null;
}

function resolveOpsView(active: MenuKey): string {
  if (active === "operationsCenter") return "home";
  return OPS_VIEW_MAP[active] || "home";
}

/**
 * 系统/运行中心子页统一入口。
 * shell.tsx 把 sys* / ops* / systemCenter / operationsCenter / mobileMenu 全部路由到这里。
 */
export function SystemHubPage({
  active,
  notify,
  onExit,
  exitLabel = "工作台",
}: {
  active: MenuKey;
  notify: Notify;
  onExit: () => void;
  exitLabel?: string;
}) {
  const access = useAccess();
  const kind = classify(active);
  if (kind === "system") {
    return (
      <Suspense fallback={<Loading />}>
        <SystemManagementCenter
          notify={notify}
          initialModule={(resolveSystemModule(active) as never) || null}
          onExit={onExit}
          exitLabel={exitLabel}
        />
      </Suspense>
    );
  }
  if (kind === "operations") {
    return (
      <Suspense fallback={<Loading />}>
        <OperationsCenterPage
          notify={notify}
          initialView={resolveOpsView(active) as never}
          onClose={onExit}
          exitLabel={exitLabel}
        />
      </Suspense>
    );
  }
  if (kind === "menuEditor") {
    const canEdit = access.has("system.mobileMenu.edit");
    const canView = access.has("system.mobileMenu.view") || canEdit;
    if (!canView) {
      return <div className="empty-state"><Settings2 size={28} /><h3>暂无权限</h3><p>当前角色没有移动菜单管理权限</p></div>;
    }
    return (
      <Suspense fallback={<Loading />}>
        <MobileMenuSettingsPage notify={notify} onBack={onExit} backLabel={exitLabel} />
      </Suspense>
    );
  }
  return <div className="empty-state"><Settings2 size={28} /><h3>未知菜单项</h3><p>未实现的菜单 key: {String(active)}</p></div>;
}

export default SystemHubPage;
