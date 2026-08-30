import { API_PATHS, APP_ROUTES } from "../../../lib/pathConventions";
/**
 * 订单复制菜单（OrderCopyMenu）配置
 *
 * 每项有：
 * - label / desc / icon / tone / message：直接展示
 * - textTemplate：用 {fieldName} 占位，运行时由 row + 计算字段（orderLink / purchaserLink / orderTime）填充
 *
 * 模板支持的字段：
 *   {orderCode} {orderNameDesc} {orderTypeDesc} {orderNum} {customer}
 *   {phone} {address} {expComDesc} {expCode} {purchaser} {signId}
 *   {orderTime}            —— 后端 raw 字符串
 *   {orderDate}            —— shortDate 格式化（YYYY-MM-DD）
 *   {orderLink}            —— 查单页链接（/tools/order#<signId>）
 *   {purchaserLink}        —— 下单人订单列表（/tools/order#v-<signId>）
 */
import { ReceiptText, type LucideIcon } from "lucide-react";
import { resolveMobileIcon } from "./mobileMenu.config";
import { shortDate } from "./core";

export type OrderCopyItem = {
  key: string;
  label: string;
  desc?: string;
  /** desc 模板，运行时用 row 字段填充（不支持 link/date 这类计算字段） */
  descTemplate?: string;
  icon: string;
  /** 卡片色：green / blue / amber / peach */
  tone: string;
  /** 复制内容模板，占位 {field} 会被替换 */
  textTemplate: string;
  message: string;
  hidden?: boolean;
};

export type OrderCopyMenuConfig = {
  version: 1;
  items: OrderCopyItem[];
};

export const DEFAULT_ORDER_COPY_MENU: OrderCopyMenuConfig = {
  version: 1,
  items: [
    {
      key: "orderDetail",
      label: "订单详情",
      desc: "完整订单、快递及查询链接",
      icon: "receipt",
      tone: "green",
      message: "订单详情已复制",
      textTemplate: "【订单详情】\n订单号: {orderCode}\n下单时间: {orderDate}\n商品: {orderNameDesc} {orderTypeDesc} × {orderNum}\n收件人: {customer}\n手机号: {phone}\n地址: {address}\n快递: {expComDesc} {expCode}\n查看更多: {orderLink}",
    },
    {
      key: "purchaserLink",
      label: "下单人链接",
      descTemplate: "{purchaser}的订单列表",
      icon: "user",
      tone: "blue",
      message: "下单人查询链接已复制",
      textTemplate: "【{purchaser}】的订单列表：\n{purchaserLink}",
    },
    {
      key: "customerLink",
      label: "收件人链接",
      descTemplate: "{customer}的订单查询",
      icon: "external-link",
      tone: "amber",
      message: "收件人查询链接已复制",
      textTemplate: "【{customer}】的订单：\n{orderLink}",
    },
    {
      key: "expressInfo",
      label: "发货识别信息",
      desc: "商品、收件人、手机和地址",
      icon: "truck",
      tone: "peach",
      message: "快递识别信息已复制",
      textTemplate: "{orderNameDesc}   {orderTypeDesc}   {expComDesc}\n\n收件人: {customer}\n手机号: {phone}\n地址: {address}",
    },
  ],
};

export type ResolvedOrderCopyItem = {
  key: string;
  label: string;
  desc: (row: Record<string, unknown>) => string;
  icon: LucideIcon;
  tone: string;
  text: (row: Record<string, unknown>) => string;
  message: string;
};

const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

function fillPlaceholders(template: string, ctx: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (match, key) => ctx[key] ?? match);
}

function buildRowContext(row: Record<string, unknown>): Record<string, string> {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const signId = String(row.signId || "");
  const orderLink = `${origin}${APP_ROUTES.toolOrderDetail}#${encodeURIComponent(signId)}`;
  const purchaserLink = `${origin}${APP_ROUTES.toolOrderDetail}#${encodeURIComponent(`v-${signId}`)}`;
  return {
    orderCode: String(row.orderCode || ""),
    orderNameDesc: String(row.orderNameDesc || ""),
    orderTypeDesc: String(row.orderTypeDesc || ""),
    orderNum: String(row.orderNum || 1),
    customer: String(row.customer || ""),
    phone: String(row.phone || ""),
    address: String(row.address || ""),
    expComDesc: String(row.expComDesc || ""),
    expCode: String(row.expCode || ""),
    purchaser: String(row.purchaser || ""),
    signId,
    orderTime: String(row.orderTime || ""),
    orderDate: shortDate(row.orderTime),
    orderLink,
    purchaserLink,
  };
}

export function resolveOrderCopyMenu(config: OrderCopyMenuConfig): ResolvedOrderCopyItem[] {
  return config.items
    .filter((item) => !item.hidden)
    .map((item) => {
      const ctxCache = new WeakMap<Record<string, unknown>, Record<string, string>>();
      return {
        key: item.key,
        label: item.label,
        desc: (row: Record<string, unknown>) => {
          const ctx = buildRowContext(row);
          return fillPlaceholders(item.descTemplate || item.desc || "", ctx);
        },
        icon: resolveMobileIcon(item.icon, ReceiptText),
        tone: item.tone,
        message: item.message,
        text: (row: Record<string, unknown>) => {
          let ctx = ctxCache.get(row);
          if (!ctx) {
            ctx = buildRowContext(row);
            ctxCache.set(row, ctx);
          }
          return fillPlaceholders(item.textTemplate, ctx);
        },
      };
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeOrderCopyMenu(raw: unknown): OrderCopyMenuConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_ORDER_COPY_MENU)) as OrderCopyMenuConfig;
  if (!isRecord(raw)) return base;
  if (Array.isArray(raw.items) && raw.items.length) base.items = raw.items as OrderCopyItem[];
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getOrderCopyMenu(): OrderCopyMenuConfig {
  return DEFAULT_ORDER_COPY_MENU;
}

export async function fetchOrderCopyMenu(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<OrderCopyMenuConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.root}/order-copy-menu/config`);
    return mergeOrderCopyMenu((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_ORDER_COPY_MENU;
  }
}
