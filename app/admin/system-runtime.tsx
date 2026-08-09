import {
  Activity,
  BookKey,
  BriefcaseBusiness,
  Building2,
  Bell,
  Clock3,
  Code2,
  Database,
  FileClock,
  HardDrive,
  History,
  LogIn,
  Menu as MenuIcon,
  MessageSquareCode,
  BookOpen,
  Server,
  Settings2,
  ShieldCheck,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useAccess } from "./access";
import { LoaderCircle } from "lucide-react";

const SystemManagementCenter = lazy(() => import("./system-management").then((m) => ({ default: m.SystemManagementCenter })));
const OperationsCenter = lazy(() => import("./operations-center").then((m) => ({ default: m.OperationsCenter })));
const MobileMenuSettingsPage = lazy(() => import("./mobile-menu-settings").then((m) => ({ default: m.MobileMenuSettingsPage })));

type Notify = (message: string, type?: "success" | "error" | "info") => void;
type SystemModule = "users" | "roles" | "depts" | "posts" | "menus" | "dictTypes" | "configs" | "notices";
type OpsView = "online" | "jobs" | "jobLogs" | "operLogs" | "loginLogs" | "server" | "cache" | "druid" | "generator" | "swagger" | "messages";
type HubView =
  | { kind: "home" }
  | { kind: "system"; module?: SystemModule | null }
  | { kind: "operations"; view?: OpsView | "home" }
  | { kind: "mobileMenu" };

type Entry = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  capability?: string;
  open: () => void;
};

function capabilityResource(key: string) {
  if (key === "dictTypes" || key === "dictData") return "dictionaries";
  return key;
}

function Loading() {
  return <div className="home-empty"><LoaderCircle className="spin" size={22} />正在加载模块</div>;
}

export function SystemRuntimeCenter({ notify }: { notify: Notify }) {
  const access = useAccess();
  const [view, setView] = useState<HubView>({ kind: "home" });

  const systemEntries = useMemo<Entry[]>(() => {
    const items: Array<{ key: string; title: string; description: string; icon: LucideIcon; capability: string }> = [
      { key: "users", title: "成员", description: "登录账号、状态与角色", icon: Users, capability: `system.${capabilityResource("users")}.view` },
      { key: "roles", title: "角色", description: "功能权限组合", icon: ShieldCheck, capability: `system.${capabilityResource("roles")}.view` },
      { key: "depts", title: "部门", description: "组织架构树", icon: Building2, capability: `system.${capabilityResource("depts")}.view` },
      { key: "posts", title: "岗位", description: "岗位编码与排序", icon: BriefcaseBusiness, capability: `system.${capabilityResource("posts")}.view` },
      { key: "menus", title: "菜单", description: "目录、页面与按钮", icon: MenuIcon, capability: `system.${capabilityResource("menus")}.view` },
      { key: "dictTypes", title: "字典", description: "字典类型与数据项", icon: BookKey, capability: `system.${capabilityResource("dictTypes")}.view` },
      { key: "configs", title: "参数", description: "系统参数设置", icon: Settings2, capability: `system.${capabilityResource("configs")}.view` },
      { key: "notices", title: "公告", description: "通知与公告", icon: Bell, capability: `system.${capabilityResource("notices")}.view` },
    ];
    const mapped = items
      .filter((item) => access.has(item.capability))
      .map((item) => ({ ...item, open: () => setView({ kind: "system", module: item.key as SystemModule }) }));
    if (access.has("system.mobileMenu.view")) {
      mapped.push({
        key: "mobileMenu",
        title: "移动菜单",
        description: "H5 Dock 与全部功能布局",
        icon: Settings2,
        capability: "system.mobileMenu.view",
        open: () => setView({ kind: "mobileMenu" }),
      });
    }
    return mapped;
  }, [access]);

  const opsEntries = useMemo<Entry[]>(() => {
    const items: Array<{ key: OpsView; title: string; description: string; icon: LucideIcon; capability: string }> = [
      { key: "online", title: "在线用户", description: "会话查看与强退", icon: Wifi, capability: "operations.online.view" },
      { key: "server", title: "服务监控", description: "CPU、内存与磁盘", icon: Server, capability: "operations.server.view" },
      { key: "cache", title: "缓存监控", description: "Redis 状态与键值", icon: Database, capability: "operations.cache.view" },
      { key: "druid", title: "数据源", description: "Druid 连接池监控", icon: HardDrive, capability: "operations.server.view" },
      { key: "jobs", title: "定时任务", description: "任务启停与执行", icon: Clock3, capability: "operations.jobs.view" },
      { key: "jobLogs", title: "调度日志", description: "任务执行结果", icon: FileClock, capability: "operations.jobs.view" },
      { key: "operLogs", title: "操作日志", description: "后台操作审计", icon: History, capability: "operations.operLogs.view" },
      { key: "loginLogs", title: "登录日志", description: "登录成功与失败", icon: LogIn, capability: "operations.loginLogs.view" },
      { key: "generator", title: "代码生成", description: "表结构与代码下载", icon: Code2, capability: "operations.codegen.view" },
      { key: "swagger", title: "接口文档", description: "Swagger API", icon: BookOpen, capability: "operations.codegen.view" },
      { key: "messages", title: "开发消息", description: "调试消息通道", icon: MessageSquareCode, capability: "operations.messages.view" },
    ];
    return items
      .filter((item) => access.has(item.capability))
      .map((item) => ({ ...item, open: () => setView({ kind: "operations", view: item.key }) }));
  }, [access]);

  if (view.kind === "system") {
    return (
      <Suspense fallback={<Loading />}>
        <SystemManagementCenter
          notify={notify}
          initialModule={view.module || null}
          onExit={() => setView({ kind: "home" })}
        />
      </Suspense>
    );
  }

  if (view.kind === "operations") {
    return (
      <Suspense fallback={<Loading />}>
        <OperationsCenter
          notify={notify}
          initialView={view.view || "home"}
          onClose={() => setView({ kind: "home" })}
        />
      </Suspense>
    );
  }

  if (view.kind === "mobileMenu") {
    return (
      <Suspense fallback={<Loading />}>
        <div className="module-page">
          <button className="module-back-link" type="button" onClick={() => setView({ kind: "home" })} style={{ margin: "0 0 8px 4px" }}>
            返回系统运行
          </button>
          <MobileMenuSettingsPage notify={notify} />
        </div>
      </Suspense>
    );
  }

  const groups = [
    { title: "账号与权限", description: "成员、角色与组织", items: systemEntries.filter((i) => ["users", "roles", "depts", "posts"].includes(i.key)) },
    { title: "系统配置", description: "菜单、字典、参数、公告与移动菜单", items: systemEntries.filter((i) => ["menus", "dictTypes", "configs", "notices", "mobileMenu"].includes(i.key)) },
    { title: "运行监控", description: "会话、服务与缓存状态", items: opsEntries.filter((i) => ["online", "server", "cache", "druid"].includes(i.key)) },
    { title: "任务与审计", description: "调度与操作轨迹", items: opsEntries.filter((i) => ["jobs", "jobLogs", "operLogs", "loginLogs"].includes(i.key)) },
    { title: "开发工具", description: "代码生成与联调入口", items: opsEntries.filter((i) => ["generator", "swagger", "messages"].includes(i.key)) },
  ].filter((group) => group.items.length);

  return (
    <div className="module-page">
      <div className="module-hero compact-hero">
        <div>
          <span className="eyebrow">系统运行</span>
          <h1>系统运行</h1>
          <p>账号权限、监控审计与开发工具统一入口</p>
        </div>
        <span className="hero-tool-icon"><Activity size={27} /></span>
      </div>

      {groups.length ? (
        <div className="menu-groups">
          {groups.map((group) => (
            <section className="menu-group" key={group.title}>
              <div className="menu-group-title"><b>{group.title}</b><small>{group.description}</small></div>
              <div className="menu-grid">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button type="button" key={item.key} onClick={item.open}>
                      <span><Icon size={19} /></span>
                      <b>{item.title}</b>
                      <small>{item.description}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state"><Settings2 size={28} /><h3>暂无可用功能</h3><p>当前角色没有系统运行相关权限</p></div>
      )}
    </div>
  );
}

export default SystemRuntimeCenter;
