import { apiRequest, publicApiRequest } from "../../lib/api";
import { API_PATHS, LOCAL_ROUTES as LOCAL_APP_ROUTES } from "../../lib/pathConventions";

export type LogisticsSwitchType = "manual" | "scheduled" | "query";

export type LogisticsQuotaStatus = {
  storeCode: string;
  storeName?: string;
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
  enabled: number;
  remark?: string;
  switches: Array<{ type: LogisticsSwitchType; label: string; enabled: number }>;
  todayUsage: number;
  updateTime?: string;
};

export type LogisticsGlobalQuotaStatus = {
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
  enabled: number;
  remark?: string;
  distributable: number;
  updateTime?: string;
};

export type LogisticsUsageRow = {
  id: number;
  storeCode?: string;
  storeName?: string;
  userId: number;
  userName?: string;
  nickName?: string;
  switchType: LogisticsSwitchType;
  orderCode?: string;
  expCode?: string;
  success: number;
  cost: number;
  source?: string;
  remark?: string;
  createTime?: string;
};

export const listMyLogisticsQuota = () =>
  apiRequest<LogisticsQuotaStatus[]>(`${API_PATHS.logistics.quotas}/my`);

export const getLogisticsGlobalQuota = () =>
  apiRequest<LogisticsGlobalQuotaStatus>(`${API_PATHS.logistics.quotas}/global`);

export function adminUpdateLogisticsGlobalQuota(payload: { totalQuota?: number; enabled?: 0 | 1; remark?: string }) {
  return apiRequest(`${API_PATHS.logistics.quotas}/global`, { method: "PUT", body: payload });
}

export function updateMyLogisticsSwitch(storeCode: string, switchType: LogisticsSwitchType, enabled: boolean) {
  return apiRequest(`${API_PATHS.logistics.quotas}/my/switch`, {
    method: "PUT",
    body: { storeCode, switchType, enabled: enabled ? 1 : 0 },
  });
}

export const listAllLogisticsQuota = () =>
  apiRequest<LogisticsQuotaStatus[]>(API_PATHS.logistics.quotas);

export function adminUpdateLogisticsQuota(payload: { storeCode: string; totalQuota?: number; enabled?: 0 | 1; remark?: string }) {
  return apiRequest(`${API_PATHS.logistics.quotas}/update`, { method: "PUT", body: payload });
}

export function listLogisticsUsage(query: {
  pageNum: number;
  pageSize: number;
  storeCode?: string;
  switchType?: LogisticsSwitchType;
  startTime?: string;
  endTime?: string;
} = { pageNum: 1, pageSize: 20 }) {
  return apiRequest<{ rows: LogisticsUsageRow[]; total: number }>(`${API_PATHS.logistics.quotas}/usage`, { query });
}

export type ShortLinkType = "internal" | "external";

export type ShortLinkRow = {
  id: number;
  path: string;
  targetType: ShortLinkType;
  target: string;
  expireTime?: string | null;
  visitCount?: number;
  lastVisitTime?: string | null;
  lastVisitIp?: string | null;
  remark?: string;
  createBy: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
};

export type ShortLinkVisitRow = {
  id: number;
  linkId: number;
  visitIp?: string;
  visitTime?: string;
};

export const LOCAL_ROUTES: string[] = [...LOCAL_APP_ROUTES];
export const SHORT_LINK_PATH_RULE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const listShortLinks = (params: { path?: string; targetType?: ShortLinkType } = {}) =>
  apiRequest<{ data?: ShortLinkRow[] } | ShortLinkRow[]>(API_PATHS.content.shortLinks, { query: params });

export const createShortLink = (payload: { path: string; targetType: ShortLinkType; target: string; remark?: string; expireTime?: string | null }) =>
  apiRequest(API_PATHS.content.shortLinks, { method: "POST", body: payload });

export const updateShortLink = (id: number, payload: { targetType: ShortLinkType; target: string; remark?: string; expireTime?: string | null }) =>
  apiRequest(`${API_PATHS.content.shortLinks}/${id}`, { method: "PUT", body: payload });

export const deleteShortLink = (id: number) =>
  apiRequest(`${API_PATHS.content.shortLinks}/${id}`, { method: "DELETE" });

export const listShortLinkVisits = (id: number, limit = 20) =>
  apiRequest<{ data?: ShortLinkVisitRow[] } | ShortLinkVisitRow[]>(`${API_PATHS.content.shortLinks}/${id}/visits`, { query: { limit } });

export const resolveShortLink = (path: string) =>
  publicApiRequest<{ data?: { id: number; path: string; targetType: ShortLinkType; target: string; expireTime?: string | null; visitCount?: number; lastVisitTime?: string | null } }>(
    `${API_PATHS.content.search}/short-link/${encodeURIComponent(path)}`,
  );

export type PublicStoreRow = {
  code?: string;
  value?: string;
  text?: string;
  notice?: string;
  defPurchaser?: string;
  blockOrder?: number;
  blockQuery?: number;
  blockDisplayType?: string;
};

export const listPublicStores = (params: { code?: string; name?: string; createBy?: string } = {}) =>
  publicApiRequest<{ data?: PublicStoreRow[] } | PublicStoreRow[]>(`${API_PATHS.content.search}/store`, params);
