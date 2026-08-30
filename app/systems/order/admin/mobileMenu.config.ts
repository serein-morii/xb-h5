import { API_PATHS, APP_ROUTES } from "../../../lib/pathConventions";
/**
 * 移动端菜单配置（H5 专用）
 *
 * 和 PC「菜单管理」完全分离：
 * - PC 菜单：权限树 + 侧栏路由
 * - 移动菜单：底部 Dock + 全部功能分组
 *
 * 权限仍走 access/capability；本文件只决定「展示什么、怎么排」。
 * 未在 PAGE_REGISTRY 注册、或当前角色无权限的项，运行时自动隐藏。
 */
import {
  Activity,
  BadgeDollarSign,
  Bell,
  BookKey,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CircleCheck,
  Clock3,
  Code2,
  CreditCard,
  Database,
  ExternalLink,
  FileClock,
  FileSpreadsheet,
  FolderTree,
  Gauge,
  HardDrive,
  History,
  House,
  Link2,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  MessageSquareCode,
  Package as PackageIcon,
  PackageCheck,
  PackageOpen,
  Pencil,
  Plus,
  ReceiptText,
  RotateCw,
  SearchCheck,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  Truck,
  User,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { MenuKey } from "./core";
import {
  DEFAULT_MOBILE_ENTRY_PROMOTIONS,
  mergeMobileEntryPromotions,
  resolveMobileMenuHierarchy,
  type MobileEntryPromotionsConfig,
  type MobileMenuDirectoryKey,
} from "./mobileEntryPromotions.config";

/** Dock 特殊键：打开全部功能 */
export const MOBILE_MENU_ALL_KEY = "__all__" as const;
export type MobileDockKey = MenuKey | typeof MOBILE_MENU_ALL_KEY;

export type MobileDockItemConfig = {
  key: MobileDockKey;
  label: string;
  /** lucide 图标名，见 ICON_MAP */
  icon: string;
  /** 中间强调大按钮（如录单） */
  emphasis?: boolean;
  /** 无权限时仍显示（仅建议给「全部」） */
  pinned?: boolean;
};

export type MobileMenuItemConfig = {
  key: MenuKey;
  /** 覆盖注册表默认标题 */
  label?: string;
  /** 覆盖注册表默认描述 */
  description?: string;
  icon?: string;
  hidden?: boolean;
};

export type MobileMenuGroupConfig = {
  key: string;
  title: string;
  description?: string;
  items: MobileMenuItemConfig[];
};

export type MobileMenuConfig = {
  version: 1;
  dock: MobileDockItemConfig[];
  groups: MobileMenuGroupConfig[];
  extras: {
    showHomeEntry: boolean;
    showToolboxEntry: boolean;
    homeLabel: string;
    homeDescription: string;
    toolboxLabel: string;
    toolboxDescription: string;
    toolboxHref: string;
  };
  hierarchy?: MobileEntryPromotionsConfig;
};

/** 页面注册表：功能 key → 默认展示信息（开发维护，配置只引用 key） */
export type MobilePageRegistryItem = {
  key: MenuKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const MOBILE_PAGE_REGISTRY: Record<MenuKey, MobilePageRegistryItem> = {
  home: { key: "home", label: "工作台", description: "订单与物流概览", icon: House },
  orders: { key: "orders", label: "订单管理", description: "订单、发货与物流", icon: ShoppingBag },
  orderEntry: { key: "orderEntry", label: "订单录入", description: "选买家、识别地址建单", icon: FileSpreadsheet },
  batchOrder: { key: "batchOrder", label: "批量录单", description: "Excel 粘贴批量下单", icon: FileSpreadsheet },
  bills: { key: "bills", label: "账单管理", description: "成本与盈利核算", icon: ReceiptText },
  express: { key: "express", label: "快递管理", description: "物流节点维护", icon: Truck },
  prices: { key: "prices", label: "价格管理", description: "商品与快递计价", icon: BadgeDollarSign },
  products: { key: "products", label: "商品管理", description: "客户商品与多规格售价", icon: PackageOpen },
  stores: { key: "stores", label: "店铺管理", description: "店铺与通知配置", icon: StoreIcon },
  orderLink: { key: "orderLink", label: "生成链接", description: "买家专属下单链接", icon: ShoppingBag },
  purchasers: { key: "purchasers", label: "买家管理", description: "买家与店铺绑定", icon: User },
  tracking: { key: "tracking", label: "快递查询", description: "快递100、顺丰、EMS", icon: SearchCheck },
  logistics: { key: "logistics", label: "物流用量", description: "额度、开关与用量记录", icon: Gauge },
  shortLinks: { key: "shortLinks", label: "短链管理", description: "自定义域名短链接跳转", icon: Link2 },
  systemCenter: { key: "systemCenter", label: "系统中心", description: "账号权限与系统配置", icon: Settings2 },
  operationsCenter: { key: "operationsCenter", label: "运行中心", description: "监控审计与开发工具", icon: Activity },
  mobileMenu: { key: "mobileMenu", label: "移动菜单", description: "H5 Dock 与全部功能布局", icon: SlidersHorizontal },
  sysUsers: { key: "sysUsers", label: "成员", description: "登录账号、状态与角色", icon: Users },
  sysRoles: { key: "sysRoles", label: "角色", description: "功能权限组合", icon: ShieldCheck },
  sysDepts: { key: "sysDepts", label: "部门", description: "组织架构树", icon: Building2 },
  sysPosts: { key: "sysPosts", label: "岗位", description: "岗位编码与排序", icon: BriefcaseBusiness },
  sysMenus: { key: "sysMenus", label: "菜单", description: "目录、页面与按钮", icon: Menu },
  sysDictTypes: { key: "sysDictTypes", label: "字典", description: "字典类型与数据项", icon: BookKey },
  sysConfigs: { key: "sysConfigs", label: "参数", description: "系统参数设置", icon: Settings2 },
  sysNotices: { key: "sysNotices", label: "公告", description: "通知与公告", icon: Bell },
  opsOnline: { key: "opsOnline", label: "在线用户", description: "会话查看与强退", icon: Wifi },
  opsServer: { key: "opsServer", label: "服务监控", description: "CPU、内存与磁盘", icon: Server },
  opsCache: { key: "opsCache", label: "缓存监控", description: "Redis 状态与键值", icon: Database },
  opsDruid: { key: "opsDruid", label: "数据源", description: "Druid 连接池监控", icon: HardDrive },
  opsJobs: { key: "opsJobs", label: "定时任务", description: "任务启停与执行", icon: Clock3 },
  opsJobLogs: { key: "opsJobLogs", label: "调度日志", description: "任务执行结果", icon: FileClock },
  opsOperLogs: { key: "opsOperLogs", label: "操作日志", description: "后台操作审计", icon: History },
  opsLoginLogs: { key: "opsLoginLogs", label: "登录日志", description: "登录成功与失败", icon: LogIn },
  opsGenerator: { key: "opsGenerator", label: "代码生成", description: "表结构与代码下载", icon: Code2 },
  opsSwagger: { key: "opsSwagger", label: "接口文档", description: "Swagger API", icon: BookOpen },
  opsMessages: { key: "opsMessages", label: "开发消息", description: "调试消息通道", icon: MessageSquareCode },
};

const ICON_MAP: Record<string, LucideIcon> = {
  house: House,
  home: House,
  "shopping-bag": ShoppingBag,
  shoppingBag: ShoppingBag,
  plus: Plus,
  receipt: ReceiptText,
  receiptText: ReceiptText,
  menu: Menu,
  truck: Truck,
  package: PackageOpen,
  packageOpen: PackageOpen,
  store: StoreIcon,
  user: User,
  users: Users,
  link: Link2,
  link2: Link2,
  gauge: Gauge,
  search: SearchCheck,
  searchCheck: SearchCheck,
  settings: Settings2,
  settings2: Settings2,
  sliders: SlidersHorizontal,
  slidersHorizontal: SlidersHorizontal,
  activity: Activity,
  file: FileSpreadsheet,
  fileSpreadsheet: FileSpreadsheet,
  dollar: BadgeDollarSign,
  badgeDollarSign: BadgeDollarSign,
  shield: ShieldCheck,
  shieldCheck: ShieldCheck,
  building: Building2,
  building2: Building2,
  briefcase: BriefcaseBusiness,
  briefcaseBusiness: BriefcaseBusiness,
  book: BookKey,
  bookKey: BookKey,
  bookOpen: BookOpen,
  bell: Bell,
  wifi: Wifi,
  server: Server,
  database: Database,
  hardDrive: HardDrive,
  clock: Clock3,
  clock3: Clock3,
  fileClock: FileClock,
  history: History,
  logIn: LogIn,
  code: Code2,
  code2: Code2,
  message: MessageSquareCode,
  messageSquareCode: MessageSquareCode,
  rotate: RotateCw,
  rotateCw: RotateCw,
  packageBox: PackageIcon,
  packageCheck: PackageCheck,
  "package-check": PackageCheck,
  "circle-check": CircleCheck,
  circleCheck: CircleCheck,
  "credit-card": CreditCard,
  creditCard: CreditCard,
  pencil: Pencil,
  lock: LockKeyhole,
  "lock-keyhole": LockKeyhole,
  lockKeyhole: LockKeyhole,
  send: Send,
  sparkles: Sparkles,
  "log-out": LogOut,
  logOut: LogOut,
  "external-link": ExternalLink,
  externalLink: ExternalLink,
};

export function resolveMobileIcon(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback;
  return ICON_MAP[name] || ICON_MAP[name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] || fallback;
}

/**
 * 默认移动端菜单布局。
 * 改这里即可调整 Dock 和全部功能，无需改 shell 渲染逻辑。
 */
export const DEFAULT_MOBILE_MENU_CONFIG: MobileMenuConfig = {
  version: 1,
  dock: [
    { key: "home", label: "首页", icon: "house", pinned: true },
    { key: "orders", label: "订单", icon: "shopping-bag" },
    { key: "orderEntry", label: "录单", icon: "plus", emphasis: true },
    { key: "bills", label: "账单", icon: "receipt" },
    { key: MOBILE_MENU_ALL_KEY, label: "全部", icon: "menu", pinned: true },
  ],
  groups: [
    {
      key: "orders",
      title: "订单处理",
      description: "订单与物流日常操作",
      items: [
        { key: "orders" },
        { key: "orderEntry" },
        { key: "batchOrder" },
        { key: "express" },
      ],
    },
    {
      key: "manage",
      title: "经营管理",
      description: "账单、商品、价格、店铺、物流额度及短链",
      items: [
        { key: "bills" },
        { key: "products" },
        { key: "prices" },
        { key: "stores" },
        { key: "logistics" },
        { key: "shortLinks" },
      ],
    },
    {
      key: "buyer",
      title: "买家服务",
      description: "管理买家及专属下单入口",
      items: [
        { key: "orderLink" },
        { key: "purchasers" },
      ],
    },
    {
      key: "system",
      title: "系统运行",
      description: "账号权限、监控日志与开发工具",
      items: [
        { key: "systemCenter" },
        { key: "operationsCenter" },
        { key: "sysUsers" },
        { key: "sysRoles" },
        { key: "sysDepts" },
        { key: "sysPosts" },
        { key: "sysMenus" },
        { key: "sysDictTypes" },
        { key: "sysConfigs" },
        { key: "sysNotices" },
        { key: "opsOnline" },
        { key: "opsServer" },
        { key: "opsCache" },
        { key: "opsDruid" },
        { key: "opsJobs" },
        { key: "opsJobLogs" },
        { key: "opsOperLogs" },
        { key: "opsLoginLogs" },
        { key: "opsGenerator" },
        { key: "opsSwagger" },
        { key: "opsMessages" },
        { key: "mobileMenu" },
      ],
    },
    {
      key: "tools",
      title: "查询工具",
      description: "常用物流查询入口",
      items: [
        { key: "tracking" },
      ],
    },
  ],
  extras: {
    showHomeEntry: true,
    showToolboxEntry: true,
    homeLabel: "工作台",
    homeDescription: "订单、买家与物流动态总览",
    toolboxLabel: "工具箱",
    toolboxDescription: "订单查询、链接查询与运费工具",
    toolboxHref: APP_ROUTES.tools,
  },
  hierarchy: DEFAULT_MOBILE_ENTRY_PROMOTIONS,
};

export type ResolvedMobileMenuItem = {
  key: MobileMenuDirectoryKey;
  label: string;
  description: string;
  icon: LucideIcon;
  directory?: boolean;
};

export type ResolvedMobileDockItem = {
  key: MobileDockKey;
  label: string;
  icon: LucideIcon;
  emphasis?: boolean;
  pinned?: boolean;
};

export type ResolvedMobileMenuGroup = {
  key: string;
  title: string;
  description?: string;
  onboard?: string;
  items: ResolvedMobileMenuItem[];
};

export type ResolvedMobileMenu = {
  dock: ResolvedMobileDockItem[];
  groups: ResolvedMobileMenuGroup[];
  extras: MobileMenuConfig["extras"];
  directoryChildren: Partial<Record<MobileMenuDirectoryKey, ResolvedMobileMenuItem[]>>;
  parentByChild: Partial<Record<MenuKey, MobileMenuDirectoryKey>>;
};

const GROUP_ONBOARD: Record<string, string> = {
  orders: "menu-group-orders",
  manage: "menu-group-manage",
  buyer: "menu-group-buyer",
  tools: "menu-group-tracking",
};

function resolveItem(item: MobileMenuItemConfig): ResolvedMobileMenuItem | null {
  if (item.hidden) return null;
  const reg = MOBILE_PAGE_REGISTRY[item.key];
  if (!reg) return null;
  return {
    key: item.key,
    label: item.label || reg.label,
    description: item.description || reg.description,
    icon: item.icon ? resolveMobileIcon(item.icon, reg.icon) : reg.icon,
  };
}

/** 将配置、权限与两级父子关系解析为可渲染菜单。 */
export function resolveMobileMenu(
  config: MobileMenuConfig,
  canOpen: (key: MenuKey) => boolean,
  hierarchyConfig: MobileEntryPromotionsConfig = DEFAULT_MOBILE_ENTRY_PROMOTIONS,
): ResolvedMobileMenu {
  const hierarchy = resolveMobileMenuHierarchy(hierarchyConfig);
  const configuredItems = new Map<MenuKey, MobileMenuItemConfig>();
  for (const group of config.groups) {
    for (const item of group.items) {
      if (!configuredItems.has(item.key)) configuredItems.set(item.key, item);
    }
  }

  const resolveKey = (key: MenuKey): ResolvedMobileMenuItem | null => {
    const configured = configuredItems.get(key) || { key };
    return resolveItem(configured);
  };

  const directoryChildren: Partial<Record<MobileMenuDirectoryKey, ResolvedMobileMenuItem[]>> = {};
  const parentByChild: Partial<Record<MenuKey, MobileMenuDirectoryKey>> = {};
  const directoryKeys: MobileMenuDirectoryKey[] = [
    ...(Object.keys(MOBILE_PAGE_REGISTRY) as MenuKey[]),
    ...hierarchyConfig.directories.map((item) => item.key),
  ];
  for (const parentKey of directoryKeys) {
    const children = hierarchy.childrenOf(parentKey)
      .map((key) => resolveKey(key))
      .filter((item): item is ResolvedMobileMenuItem => !!item && canOpen(item.key as MenuKey));
    if (!children.length) continue;
    directoryChildren[parentKey] = children;
    for (const child of children) parentByChild[child.key as MenuKey] = parentKey;
  }

  const dock: ResolvedMobileDockItem[] = [];
  for (const item of config.dock) {
    if (item.key === MOBILE_MENU_ALL_KEY) {
      dock.push({
        key: item.key,
        label: item.label,
        icon: resolveMobileIcon(item.icon, Menu),
        emphasis: item.emphasis,
        pinned: true,
      });
      continue;
    }
    const pageKey = item.key as MenuKey;
    const reg = MOBILE_PAGE_REGISTRY[pageKey];
    if (!reg) continue;
    const isConfiguredDirectory = hierarchy.isDirectory(pageKey);
    const isVisibleDirectory = !!directoryChildren[pageKey]?.length;
    if (isConfiguredDirectory && !isVisibleDirectory) continue;
    if (!isConfiguredDirectory && !item.pinned && !canOpen(pageKey)) continue;
    // pinned 但无权限：首页仍显示；其他 pinned 业务键若无权限则跳过
    if (!isConfiguredDirectory && item.pinned && pageKey !== "home" && !canOpen(pageKey)) continue;
    dock.push({
      key: pageKey,
      label: item.label || reg.label,
      icon: resolveMobileIcon(item.icon, reg.icon),
      emphasis: item.emphasis,
      pinned: item.pinned,
    });
  }

  const groups: ResolvedMobileMenuGroup[] = [];
  for (const group of config.groups) {
    const items: ResolvedMobileMenuItem[] = [];
    for (const configured of group.items) {
      if (hierarchy.parentOf(configured.key)) continue;
      const entry = resolveItem(configured);
      if (!entry) continue;
      const children = directoryChildren[entry.key] || [];
      if (hierarchy.isDirectory(entry.key)) {
        if (children.length) items.push({ ...entry, directory: true });
      } else if (canOpen(entry.key as MenuKey)) items.push(entry);
    }
    for (const directory of hierarchyConfig.directories) {
      const targetGroup = directory.groupKey || config.groups[0]?.key;
      if (targetGroup !== group.key) continue;
      const children = directoryChildren[directory.key] || [];
      if (!children.length) continue;
      items.push({
        key: directory.key,
        label: directory.label,
        description: directory.description || `${children.length} 个功能`,
        icon: resolveMobileIcon(directory.icon, FolderTree),
        directory: true,
      });
    }
    if (!items.length) continue;
    groups.push({
      key: group.key,
      title: group.title,
      description: group.description,
      onboard: GROUP_ONBOARD[group.key],
      items,
    });
  }

  return {
    dock,
    groups,
    extras: config.extras,
    directoryChildren,
    parentByChild,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * 后端配置做宽松合并：缺字段时用本地默认兜底，避免后台半份 JSON 把 H5 打挂。
 *
 * 同时**追加**（不是替换）本地默认里新增的项 —— 后端历史回滚到旧版本时，
 * 那些在 DEFAULT 里但 raw 里没有的 item 会被自动补回来，不会让运营方丢掉新功能入口。
 */
export function mergeMobileMenuConfig(raw: unknown): MobileMenuConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_MOBILE_MENU_CONFIG)) as MobileMenuConfig;
  if (!isRecord(raw)) return base;

  if (Array.isArray(raw.dock) && raw.dock.length) {
    // Dock 也追加新默认项（保证新加的菜单 key 也能进 Dock 默认位）
    const rawDockKeys = new Set(raw.dock.map((item) => item.key));
    base.dock = [
      ...(raw.dock as MobileMenuConfig["dock"]),
      ...DEFAULT_MOBILE_MENU_CONFIG.dock.filter((item) => !rawDockKeys.has(item.key)),
    ];
  }
  if (Array.isArray(raw.groups)) {
    const rawGroups = raw.groups as MobileMenuGroupConfig[];
    // 对每个默认分组：取 raw 中同 key 的组，items 合并（raw.items 优先 + 追加 DEFAULT 里有但 raw 没有的）
    base.groups = base.groups.map((baseGroup) => {
      const rawGroup = rawGroups.find((g) => g.key === baseGroup.key);
      if (!rawGroup) return baseGroup;
      const rawItemKeys = new Set(rawGroup.items.map((i) => i.key));
      const mergedItems: MobileMenuItemConfig[] = [
        ...rawGroup.items,
        ...baseGroup.items.filter((i) => !rawItemKeys.has(i.key)),
      ];
      return {
        ...baseGroup,
        ...rawGroup,
        items: mergedItems,
      };
    });
    // raw 里独有的分组也保留
    for (const rawGroup of rawGroups) {
      if (!base.groups.find((g) => g.key === rawGroup.key)) {
        base.groups.push(rawGroup as MobileMenuGroupConfig);
      }
    }
  }
  if (isRecord(raw.extras)) {
    base.extras = {
      ...base.extras,
      ...(raw.extras as MobileMenuConfig["extras"]),
    };
  }
  if (isRecord(raw.hierarchy)) {
    base.hierarchy = mergeMobileEntryPromotions(raw.hierarchy);
  }
  if (raw.version === 1) base.version = 1;
  return base;
}

/** 同步读取本地默认（首屏/离线） */
export function getMobileMenuConfig(): MobileMenuConfig {
  return DEFAULT_MOBILE_MENU_CONFIG;
}

/**
 * 拉取后端移动菜单配置；失败回退本地默认。
 * GET /administration/mobile-menu/config
 */
export async function fetchMobileMenuConfig(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<MobileMenuConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.mobileMenu}/config`);
    const payload = (result as { data?: unknown }).data ?? result;
    return mergeMobileMenuConfig(payload);
  } catch {
    return DEFAULT_MOBILE_MENU_CONFIG;
  }
}
