import { createContext } from "react";
import {
  BadgeDollarSign,
  FileSpreadsheet,
  Gauge,
  House,
  Link2,
  SearchCheck,
  ShoppingBag,
  Store as StoreIcon,
  Truck,
  User,
  ReceiptText,
} from "lucide-react";
import { apiRequest } from "../lib/api";

/** 通用业务行：接口字段随模块变化 */
export type DataRow = Record<string, any>;

export type MenuKey =
  | "home"
  | "orders"
  | "orderEntry"
  | "batchOrder"
  | "bills"
  | "express"
  | "prices"
  | "stores"
  | "orderLink"
  | "purchasers"
  | "tracking"
  | "logistics"
  | "shortLinks";

export const ALL_MENU_KEYS: MenuKey[] = [
  "home", "orders", "orderEntry", "batchOrder", "bills", "express", "prices",
  "stores", "orderLink", "purchasers", "tracking", "logistics", "shortLinks",
];

const ACTIVE_PAGE_CACHE_KEY = "xb-h5-active-page";

/** 优先读 ?page= 深链，其次 localStorage */
export function readCachedActivePage(): MenuKey {
  if (typeof window === "undefined") return "home";
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("page");
    if (fromQuery && (ALL_MENU_KEYS as string[]).includes(fromQuery)) {
      return fromQuery as MenuKey;
    }
    const raw = window.localStorage.getItem(ACTIVE_PAGE_CACHE_KEY);
    if (raw && (ALL_MENU_KEYS as string[]).includes(raw)) return raw as MenuKey;
  } catch { /* 读不到就当首次访问 */ }
  return "home";
}

/** 写 localStorage，并同步 URL ?page=（home 时去掉参数） */
export function writeCachedActivePage(key: MenuKey) {
  try {
    window.localStorage.setItem(ACTIVE_PAGE_CACHE_KEY, key);
    const url = new URL(window.location.href);
    if (key === "home") url.searchParams.delete("page");
    else url.searchParams.set("page", key);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* 写失败忽略 */ }
}

export type ToastState = { message: string; type: "success" | "error" | "info" } | null;
export type DictOption = { value: string; label: string };
export type Dictionaries = {
  products: DictOption[];
  sizes: DictOption[];
  yesNo: DictOption[];
  expressCompanies: DictOption[];
  provinces: DictOption[];
  platforms: DictOption[];
  orderStatuses: DictOption[];
};

export const EMPTY_DICTIONARIES: Dictionaries = {
  products: [], sizes: [], yesNo: [], expressCompanies: [], provinces: [], platforms: [], orderStatuses: [],
};
const DICTIONARY_TYPES: Record<keyof Dictionaries, string> = {
  products: "sys_order_name",
  sizes: "sys_order_type",
  yesNo: "sys_is_not",
  expressCompanies: "sys_exp_com",
  provinces: "sys_area_province",
  platforms: "sys_platform_type",
  orderStatuses: "sys_order_status",
};
export const DictionaryContext = createContext<Dictionaries>(EMPTY_DICTIONARIES);
export const EXPRESS_STATUS_OPTIONS = [
  { value: "DFH", label: "待发货" },
  { value: "YFH", label: "已发货" },
  { value: "YSJ", label: "已收寄" },
  { value: "YSZ", label: "运输中" },
  { value: "YSD", label: "已送达" },
  { value: "YWC", label: "已完成" },
];
export const STORE_STATUS_OPTIONS = [
  { value: 1, label: "开业中" },
  { value: 2, label: "已关闭" },
];

export async function fetchDictionaries(): Promise<Dictionaries> {
  const entries = await Promise.all(Object.entries(DICTIONARY_TYPES).map(async ([key, type]) => {
    const result = await apiRequest<DataRow>(`/system/dict/data/type/${type}`);
    const data = Array.isArray(result.data) ? (result.data as DataRow[]) : [];
    const options = data
      .filter((item) => String(item.status ?? "0") === "0")
      .map((item) => ({ value: String(item.dictValue), label: String(item.dictLabel) }));
    return [key, options] as const;
  }));
  return Object.fromEntries(entries) as Dictionaries;
}

export function optionLabel(value: unknown, options?: Array<{ value: string | number; label: string }>) {
  if (value === null || value === undefined || value === "") return "--";
  return options?.find((item) => String(item.value) === String(value))?.label || String(value);
}

export function shortDate(value: unknown, withTime = false) {
  if (!value) return "--";
  const normalized = String(value).replace("T", " ");
  return normalized.slice(0, withTime ? 19 : 10);
}

export function maskPhone(value: string) {
  if (!value || value.length < 7) return value || "--";
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

export function maskEmail(value: string) {
  if (!value || !value.includes("@")) return value || "--";
  const [user, domain] = value.split("@");
  if (!user || !domain || user.length <= 1) return value;
  return `${user[0]}****@${domain}`;
}

export function sexLabel(sex: unknown) {
  const value = String(sex);
  if (value === "0") return "男";
  if (value === "1") return "女";
  return "未设置";
}

export const NAV_ITEMS: Array<{
  key: MenuKey;
  label: string;
  description: string;
  icon: typeof ShoppingBag;
}> = [
  { key: "home", label: "工作台", description: "订单与物流概览", icon: House },
  { key: "orders", label: "订单管理", description: "订单、发货与物流", icon: ShoppingBag },
  { key: "orderEntry", label: "订单录入", description: "选买家、识别地址建单", icon: FileSpreadsheet },
  { key: "bills", label: "账单管理", description: "成本与盈利核算", icon: ReceiptText },
  { key: "express", label: "快递管理", description: "物流节点维护", icon: Truck },
  { key: "prices", label: "价格管理", description: "商品与快递计价", icon: BadgeDollarSign },
  { key: "stores", label: "店铺管理", description: "店铺与通知配置", icon: StoreIcon },
  { key: "orderLink", label: "生成链接", description: "买家专属下单链接", icon: ShoppingBag },
  { key: "batchOrder", label: "批量录单", description: "Excel 粘贴批量下单", icon: FileSpreadsheet },
  { key: "purchasers", label: "买家管理", description: "买家与店铺绑定", icon: User },
  { key: "tracking", label: "快递查询", description: "快递100、顺丰、EMS", icon: SearchCheck },
  { key: "logistics", label: "物流用量", description: "额度、开关与用量记录", icon: Gauge },
  { key: "shortLinks", label: "短链管理", description: "自定义域名短链接跳转", icon: Link2 },
];

export type FieldConfig = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "textarea" | "select";
  required?: boolean;
  readonly?: boolean;
  placeholder?: string;
  options?: Array<{ value: string | number; label: string }>;
};
