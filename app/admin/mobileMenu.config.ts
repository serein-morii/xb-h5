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
  FileSpreadsheet,
  Gauge,
  House,
  Link2,
  Menu,
  PackageOpen,
  Plus,
  ReceiptText,
  SearchCheck,
  Settings2,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import type { MenuKey } from "./core";

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
  systemCenter: { key: "systemCenter", label: "系统运行", description: "账号权限、监控日志与开发工具", icon: Settings2 },
  operationsCenter: { key: "operationsCenter", label: "系统运行", description: "账号权限、监控日志与开发工具", icon: Activity },
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
  link: Link2,
  link2: Link2,
  gauge: Gauge,
  search: SearchCheck,
  searchCheck: SearchCheck,
  settings: Settings2,
  settings2: Settings2,
  activity: Activity,
  file: FileSpreadsheet,
  fileSpreadsheet: FileSpreadsheet,
  dollar: BadgeDollarSign,
  badgeDollarSign: BadgeDollarSign,
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
    toolboxHref: "/tools",
  },
};

export type ResolvedMobileMenuItem = {
  key: MenuKey;
  label: string;
  description: string;
  icon: LucideIcon;
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

/**
 * 将配置 + 权限 解析为可渲染结构。
 * canOpen(key) 为 false 的项会被过滤（pinned Dock 除外）。
 */
export function resolveMobileMenu(
  config: MobileMenuConfig,
  canOpen: (key: MenuKey) => boolean,
): ResolvedMobileMenu {
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
    if (!item.pinned && !canOpen(pageKey)) continue;
    // pinned 但无权限：首页仍显示；其他 pinned 业务键若无权限则跳过
    if (item.pinned && pageKey !== "home" && !canOpen(pageKey)) continue;
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
    const items = group.items
      .map(resolveItem)
      .filter((entry): entry is ResolvedMobileMenuItem => !!entry && canOpen(entry.key));
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
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** 后端配置做宽松合并：缺字段时用本地默认兜底，避免后台半份 JSON 把 H5 打挂 */
export function mergeMobileMenuConfig(raw: unknown): MobileMenuConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_MOBILE_MENU_CONFIG)) as MobileMenuConfig;
  if (!isRecord(raw)) return base;

  if (Array.isArray(raw.dock) && raw.dock.length) {
    base.dock = raw.dock as MobileMenuConfig["dock"];
  }
  if (Array.isArray(raw.groups)) {
    base.groups = raw.groups as MobileMenuConfig["groups"];
  }
  if (isRecord(raw.extras)) {
    base.extras = {
      ...base.extras,
      ...(raw.extras as MobileMenuConfig["extras"]),
    };
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
 * GET /system/mobile-menu/config
 */
export async function fetchMobileMenuConfig(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<MobileMenuConfig> {
  try {
    const result = await request<Record<string, unknown>>("/system/mobile-menu/config");
    const payload = (result as { data?: unknown }).data ?? result;
    return mergeMobileMenuConfig(payload);
  } catch {
    return DEFAULT_MOBILE_MENU_CONFIG;
  }
}
