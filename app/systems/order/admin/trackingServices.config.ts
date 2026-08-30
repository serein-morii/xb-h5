import { API_PATHS } from "../../../lib/pathConventions";
/**
 * 快递查询服务列表配置（H5 / Tools 复用）
 */
export type TrackingServiceItem = {
  key: string;
  name: string;
  desc: string;
  url: string;
  /** 卡片色调：orange / green / blue / peach / amber */
  color: string;
  hidden?: boolean;
};

export type TrackingServicesConfig = {
  version: 1;
  items: TrackingServiceItem[];
};

export const DEFAULT_TRACKING_SERVICES: TrackingServicesConfig = {
  version: 1,
  items: [
    { key: "kuaidi100", name: "快递100", desc: "支持多家快递公司查询", url: "https://m.kuaidi100.com/", color: "orange" },
    { key: "sf", name: "顺丰速运", desc: "顺丰官方运单跟踪", url: "https://www.sf-express.com/we/ow/chn/sc/waybill/list", color: "green" },
    { key: "ems", name: "EMS", desc: "中国邮政 EMS 邮件查询", url: "https://www.ems.com.cn/queryList", color: "blue" },
  ],
};

export type ResolvedTrackingService = TrackingServiceItem;

export function resolveTrackingServices(config: TrackingServicesConfig): ResolvedTrackingService[] {
  return config.items.filter((item) => !item.hidden);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeTrackingServices(raw: unknown): TrackingServicesConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_TRACKING_SERVICES)) as TrackingServicesConfig;
  if (!isRecord(raw)) return base;
  if (Array.isArray(raw.items) && raw.items.length) base.items = raw.items as TrackingServiceItem[];
  if (raw.version === 1) base.version = 1;
  return base;
}

export function getTrackingServices(): TrackingServicesConfig {
  return DEFAULT_TRACKING_SERVICES;
}

export async function fetchTrackingServices(
  request: <T = Record<string, unknown>>(path: string, options?: { auth?: boolean }) => Promise<T>,
): Promise<TrackingServicesConfig> {
  try {
    const result = await request<Record<string, unknown>>(`${API_PATHS.administration.root}/tracking-services/config`);
    return mergeTrackingServices((result as { data?: unknown }).data ?? result);
  } catch {
    return DEFAULT_TRACKING_SERVICES;
  }
}
