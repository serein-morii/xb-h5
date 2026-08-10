import { createContext, useContext } from "react";
import { apiRequest } from "../lib/api";
import type { DataRow, MenuKey } from "./core";

export type AccessManifest = {
  schemaVersion: number;
  revision: string;
  superAdmin: boolean;
  subject?: { userId?: number; username?: string; nickname?: string; deptId?: number };
  roles: string[];
  capabilities: string[];
};

export type AccessState = AccessManifest & {
  ready: boolean;
  has: (capability: string) => boolean;
};

export const EMPTY_ACCESS: AccessState = {
  schemaVersion: 1,
  revision: "",
  superAdmin: false,
  roles: [],
  capabilities: [],
  ready: false,
  has: () => false,
};

export const AccessContext = createContext<AccessState>(EMPTY_ACCESS);

export function useAccess() {
  return useContext(AccessContext);
}

export function createAccessState(manifest: AccessManifest): AccessState {
  const granted = new Set(manifest.capabilities || []);
  return {
    ...manifest,
    ready: true,
    capabilities: [...granted],
    has: (capability) => manifest.superAdmin || granted.has(capability),
  };
}

export const MENU_CAPABILITIES: Record<MenuKey, string> = {
  home: "nav.home",
  orders: "nav.orders",
  orderEntry: "nav.orderEntry",
  batchOrder: "nav.batchOrder",
  bills: "nav.bills",
  express: "nav.express",
  prices: "nav.prices",
  products: "nav.products",
  stores: "nav.stores",
  orderLink: "nav.orderLink",
  purchasers: "nav.purchasers",
  tracking: "nav.tracking",
  logistics: "nav.logistics",
  shortLinks: "nav.shortLinks",
  systemCenter: "nav.systemCenter",
  operationsCenter: "nav.operationsCenter",
  mobileMenu: "system.mobileMenu.view",
  sysUsers: "system.users.view",
  sysRoles: "system.roles.view",
  sysDepts: "system.depts.view",
  sysPosts: "system.posts.view",
  sysMenus: "system.menus.view",
  sysDictTypes: "system.dictTypes.view",
  sysConfigs: "system.configs.view",
  sysNotices: "system.notices.view",
  opsOnline: "operations.online.view",
  opsJobs: "operations.jobs.view",
  opsJobLogs: "operations.jobs.view",
  opsOperLogs: "operations.operLogs.view",
  opsLoginLogs: "operations.loginLogs.view",
  opsServer: "operations.server.view",
  opsCache: "operations.cache.view",
  opsDruid: "operations.server.view",
  opsGenerator: "operations.codegen.view",
  opsSwagger: "operations.codegen.view",
  opsMessages: "operations.messages.view",
};

const SYSTEM_MODULE_KEYS: ReadonlyArray<MenuKey> = [
  "sysUsers", "sysRoles", "sysDepts", "sysPosts", "sysMenus", "sysDictTypes", "sysConfigs", "sysNotices", "mobileMenu",
];
const OPS_MODULE_KEYS: ReadonlyArray<MenuKey> = [
  "opsOnline", "opsJobs", "opsJobLogs", "opsOperLogs", "opsLoginLogs",
  "opsServer", "opsCache", "opsDruid", "opsGenerator", "opsSwagger", "opsMessages",
];

export function canOpenMenu(access: Pick<AccessState, "has">, key: MenuKey): boolean {
  // 编辑权限蕴含查看权限；否则可编辑移动菜单的管理员反而看不到入口。
  if (key === "mobileMenu") {
    return access.has("system.mobileMenu.view") || access.has("system.mobileMenu.edit");
  }
  // 系统中心是合并入口：任一系统子项权限即可进入（兼容老 nav.systemCenter 角色）
  if (key === "systemCenter") {
    if (access.has("nav.systemCenter")) return true;
    return SYSTEM_MODULE_KEYS.some((sub) => canOpenMenu(access, sub));
  }
  // 运行中心是合并入口：任一运行子项权限即可进入（兼容老 nav.operationsCenter 角色）
  if (key === "operationsCenter") {
    if (access.has("nav.operationsCenter")) return true;
    return OPS_MODULE_KEYS.some((sub) => access.has(MENU_CAPABILITIES[sub]));
  }
  return access.has(MENU_CAPABILITIES[key]);
}

const LEGACY_CAPABILITIES: Record<string, string[]> = {
  "nav.home": [], "nav.tracking": [],
  "nav.orders": ["biz:order:list"], "nav.orderEntry": ["biz:order:add"],
  "nav.batchOrder": ["biz:batchorder:add", "biz:order:add"], "nav.bills": ["biz:bill:list"],
  "nav.express": ["biz:exp:list"], "nav.prices": ["biz:price:list"],
  "nav.products": ["biz:product:list", "biz:price:list"], "nav.stores": ["biz:store:list"],
  "nav.orderLink": ["biz:purchaser:list", "biz:order:add"], "nav.purchasers": ["biz:purchaser:list", "biz:order:list"],
  "nav.logistics": ["system:logisticsQuota:list", "biz:exp:list"], "nav.shortLinks": ["biz:shortlink:list", "biz:nav:list"],
  "nav.systemCenter": ["system:user:list", "system:role:list", "system:dept:list", "system:post:list", "system:menu:list", "system:dict:list", "system:config:list", "system:notice:list", "system:mobileMenu:query"],
  "nav.operationsCenter": ["monitor:online:list", "monitor:job:list", "monitor:operlog:list", "monitor:logininfor:list", "monitor:server:list", "monitor:cache:list", "tool:gen:list", "dev:msg:list"],
  "products.view": ["biz:product:list", "biz:price:list"], "products.create": ["biz:product:add", "biz:price:add"],
  "products.edit": ["biz:product:edit", "biz:price:edit"], "products.delete": ["biz:product:remove", "biz:price:remove"],
  "shortLinks.view": ["biz:shortlink:list", "biz:nav:list"], "shortLinks.create": ["biz:shortlink:add", "biz:nav:add"],
  "shortLinks.edit": ["biz:shortlink:edit", "biz:nav:edit"], "shortLinks.delete": ["biz:shortlink:remove", "biz:nav:remove"],
  "logistics.view": ["system:logisticsQuota:list", "biz:exp:list"], "logistics.configure": ["system:logisticsQuota:edit"],
  "system.mobileMenu.view": ["system:mobileMenu:query", "system:config:list"],
  "system.mobileMenu.edit": ["system:mobileMenu:edit", "system:config:edit"],
};

for (const [resource, permission] of [
  ["users", "system:user"], ["roles", "system:role"], ["depts", "system:dept"], ["posts", "system:post"],
  ["menus", "system:menu"], ["dictionaries", "system:dict"], ["configs", "system:config"], ["notices", "system:notice"],
] as const) {
  LEGACY_CAPABILITIES[`system.${resource}.view`] = [`${permission}:list`];
  LEGACY_CAPABILITIES[`system.${resource}.create`] = [`${permission}:add`];
  LEGACY_CAPABILITIES[`system.${resource}.edit`] = [`${permission}:edit`];
  LEGACY_CAPABILITIES[`system.${resource}.delete`] = [`${permission}:remove`];
}
LEGACY_CAPABILITIES["system.dictTypes.view"] = ["system:dict:list"];
LEGACY_CAPABILITIES["system.dictTypes.create"] = ["system:dict:add"];
LEGACY_CAPABILITIES["system.dictTypes.edit"] = ["system:dict:edit"];
LEGACY_CAPABILITIES["system.dictTypes.delete"] = ["system:dict:remove"];
Object.assign(LEGACY_CAPABILITIES, {
  "system.users.import": ["system:user:import"], "system.users.export": ["system:user:export"],
  "system.users.resetPassword": ["system:user:resetPwd"],
  "operations.online.view": ["monitor:online:list"], "operations.online.forceLogout": ["monitor:online:forceLogout"],
  "operations.jobs.view": ["monitor:job:list"], "operations.jobs.create": ["monitor:job:add"],
  "operations.jobs.edit": ["monitor:job:edit"], "operations.jobs.delete": ["monitor:job:remove"],
  "operations.jobs.changeStatus": ["monitor:job:changeStatus"],
  "operations.operLogs.view": ["monitor:operlog:list"], "operations.operLogs.delete": ["monitor:operlog:remove"],
  "operations.loginLogs.view": ["monitor:logininfor:list"], "operations.loginLogs.delete": ["monitor:logininfor:remove"],
  "operations.server.view": ["monitor:server:list"], "operations.cache.view": ["monitor:cache:list"],
  "operations.codegen.view": ["tool:gen:list"], "operations.codegen.import": ["tool:gen:import"],
  "operations.codegen.edit": ["tool:gen:edit"], "operations.codegen.delete": ["tool:gen:remove"],
  "operations.codegen.preview": ["tool:gen:preview"], "operations.codegen.generate": ["tool:gen:code"],
  "operations.messages.view": ["dev:msg:list"],
});

function fromLegacyGetInfo(result: DataRow): AccessManifest {
  const permissions = new Set((Array.isArray(result.permissions) ? result.permissions : []).map(String));
  const roles = (Array.isArray(result.roles) ? result.roles : []).map(String);
  const superAdmin = permissions.has("*:*:*") || roles.includes("admin");
  const capabilities = Object.entries(LEGACY_CAPABILITIES)
    .filter(([, required]) => superAdmin || required.length === 0 || required.some((permission) => permissions.has(permission)))
    .map(([capability]) => capability);
  return { schemaVersion: 1, revision: `legacy-${[...permissions].sort().join("|")}`, superAdmin, roles, capabilities };
}

export async function fetchAccessManifest(): Promise<AccessManifest> {
  try {
    const result = await apiRequest<{ data?: AccessManifest }>("/system/access/manifest");
    if (result.data && Array.isArray(result.data.capabilities)) return result.data;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
  return fromLegacyGetInfo(await apiRequest<DataRow>("/getInfo"));
}
