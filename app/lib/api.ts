// dev 走相对路径，由 vite.config.ts 的 server.proxy 反代到 127.0.0.1:8080（与 xb-ui 一致）
const DEVELOPMENT_API_BASE = "/prod-api";
const isDevelopment = import.meta.env.DEV;

export const API_BASE = import.meta.env.VITE_API_BASE ||
  (isDevelopment ? DEVELOPMENT_API_BASE : "https://gooop.top/prod-api");
export const PUBLIC_API_BASE = import.meta.env.VITE_PUBLIC_API_BASE ||
  (isDevelopment ? DEVELOPMENT_API_BASE : "https://m.gooop.top/prod-api");

export class ApiError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

// 登录过期的统一处理入口：清 token + 写 flash + 派发事件 + 抛 401 错误。
// 调用方在 HTTP 401 和 业务层 code:401 两条路径上复用，避免「认证失败」时仍停留在原页。
function handleSessionExpired(): never {
  if (getStoredToken()) {
    // 已有 token 才需要清；没有说明已经退到登录页，不再重派事件，避免 LoginScreen 上方弹陈旧的过期提示
    window.sessionStorage.setItem("xb-mobile-flash", "登录已过期，请重新登录");
    clearStoredToken();
    window.dispatchEvent(new Event("xb-session-expired"));
  }
  throw new ApiError("登录状态已过期，请重新登录", 401);
}

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("xb-mobile-token") || "";
}

export function setStoredToken(token: string) {
  window.localStorage.setItem("xb-mobile-token", token);
}

export function clearStoredToken() {
  window.localStorage.removeItem("xb-mobile-token");
}

const CUSTOMER_TOKEN_KEY = "xb-customer-token";

export function getCustomerToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
}

export function setCustomerToken(token: string) {
  window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
}

export function clearCustomerToken() {
  window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export function customerHeaders(headers?: HeadersInit) {
  const result = new Headers(headers);
  const token = getCustomerToken();
  if (token) result.set("X-Customer-Token", token);
  return result;
}

export function toQuery(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

/** 默认请求超时（毫秒） */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

type RequestOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  query?: Record<string, unknown>;
  body?: BodyInit | Record<string, unknown> | unknown[];
  /** 超时毫秒，默认 30000；传 0 关闭超时 */
  timeoutMs?: number;
};

/**
 * 带超时的 fetch：timeoutMs 到期后 abort；若调用方传入 signal，则合并两者。
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // 调用方主动 abort 时仍抛 AbortError；超时则包装为可读错误
      if (init.signal?.aborted) throw error;
      throw new ApiError("请求超时，请检查网络后重试", 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    init.signal?.removeEventListener("abort", onAbort);
  }
}

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, query, headers, body, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...rest } = options;
  const requestHeaders = new Headers(headers);
  if (auth) {
    const token = getStoredToken();
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  }
  let requestBody: BodyInit | undefined = body as BodyInit | undefined;
  if (
    requestBody &&
    typeof requestBody === "object" &&
    !(requestBody instanceof FormData) &&
    !(requestBody instanceof Blob)
  ) {
    requestHeaders.set("Content-Type", "application/json;charset=utf-8");
    requestBody = JSON.stringify(requestBody);
  }

  const response = await fetchWithTimeout(
    `${API_BASE}${path}${toQuery(query)}`,
    {
      ...rest,
      headers: requestHeaders,
      body: requestBody,
      cache: "no-store",
    },
    timeoutMs,
  );

  if (response.status === 401) {
    if (auth) handleSessionExpired();
    throw new ApiError("登录凭证已失效，请重新登录", 401);
  }
  if (!response.ok) {
    throw new ApiError(`请求失败（${response.status}）`, response.status);
  }
  const result = (await response.json()) as Record<string, unknown>;
  const code = Number(result.code ?? 200);
  // 业务层 401：Spring Security 在 body 里返回 {code:401,msg:"请求访问：/xxx，认证失败"}，
  // 与 HTTP 401 等价 —— 视为登录过期，提示并跳登录页。
  if (code === 401) {
    if (auth) handleSessionExpired();
    throw new ApiError(String(result.msg || "登录凭证已失效，请重新登录"), 401);
  }
  if (code !== 200) {
    throw new ApiError(String(result.msg || "接口返回异常"), code);
  }
  return result as T;
}

/**
 * 邮箱验证码 type 取值
 *  - login：邮箱登录
 *  - reset：忘记密码重置
 *  - change：已登录用户用邮箱改密
 *  - bind：已登录用户绑定/更换邮箱
 */
export type EmailCodeType = "login" | "reset" | "change" | "bind" | "otp-login" | "otp-register";

/**
 * 发送邮箱验证码（公开接口）
 */
export function sendEmailCode(email: string, type: EmailCodeType) {
  return apiRequest("/sendEmailCode", {
    auth: false,
    method: "POST",
    body: { email: email.trim(), type },
  });
}

/**
 * 邮箱登录（公开接口）：返回与 /login 同结构的结果（含 token）
 */
export function loginByEmail(email: string, code: string, type: "login" | "otp-login" = "login", longSession = false) {
  return apiRequest<{ token: string }>("/loginByEmail", {
    auth: false,
    method: "POST",
    body: { email: email.trim(), code: code.trim(), type, longSession: String(longSession) },
  });
}

/**
 * 忘记密码重置（公开接口）
 */
export function resetPasswordByEmail(email: string, code: string, newPassword: string) {
  return apiRequest("/resetPasswordByEmail", {
    auth: false,
    method: "POST",
    body: { email: email.trim(), code: code.trim(), newPassword },
  });
}

/**
 * 已登录用户用「邮箱验证码」改密（需要 token）
 * 前置：用户必须已绑定邮箱；email 必须与当前账号一致（后端强校验）。
 */
export function changePwdByEmail(email: string, code: string, newPassword: string) {
  return apiRequest("/system/user/profile/changePwdByEmail", {
    method: "PUT",
    body: { email: email.trim(), code: code.trim(), newPassword },
  });
}

/**
 * 已登录用户修改自己的基本信息（昵称 / 手机号 / 邮箱 / 性别）
 * 后端强制 userName / userId / password 不变，部门/岗位/角色由其他接口管理，这里也只透传可编辑字段。
 */
export function updateProfile(payload: {
  nickName?: string;
  phonenumber?: string;
  email?: string;
  sex?: string;
}) {
  const body: Record<string, string> = {};
  if (payload.nickName !== undefined) body.nickName = payload.nickName.trim();
  if (payload.phonenumber !== undefined) body.phonenumber = payload.phonenumber.trim();
  if (payload.email !== undefined) body.email = payload.email.trim();
  if (payload.sex !== undefined) body.sex = payload.sex;
  return apiRequest("/system/user/profile", {
    method: "PUT",
    body,
  });
}

/**
 * 已登录用户绑定/更换邮箱（需要 token，依赖邮箱验证码）
 * 与 updateProfile 的差异：邮箱绑定需要先校验 type=bind 的验证码，
 * 且新邮箱不能与当前邮箱相同、不能被其他账号占用。
 */
export function bindEmail(email: string, code: string) {
  return apiRequest("/system/user/profile/email", {
    method: "PUT",
    body: { email: email.trim(), code: code.trim() },
  });
}

// ============================================================
// 物流轨迹刷新额度（移动端）
// ============================================================

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
  /** 全局还能再分配的剩余额度（= remainingQuota） */
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

/** 自助：可见店铺的额度 + 开关 + 今日用量列表 */
export function listMyLogisticsQuota() {
  return apiRequest<LogisticsQuotaStatus[]>("/system/logistics-quota/my");
}

/** 全局额度（admin 可编辑，非 admin 只读） */
export function getLogisticsGlobalQuota() {
  return apiRequest<LogisticsGlobalQuotaStatus>("/system/logistics-quota/global");
}

/** admin：设置全局总额度 / 总开关 / 备注 */
export function adminUpdateLogisticsGlobalQuota(payload: {
  totalQuota?: number;
  enabled?: 0 | 1;
  remark?: string;
}) {
  return apiRequest("/system/logistics-quota/updateGlobal", {
    method: "PUT",
    body: payload,
  });
}

/** 自助：改某店铺的某分开关 */
export function updateMyLogisticsSwitch(
  storeCode: string,
  switchType: LogisticsSwitchType,
  enabled: boolean,
) {
  return apiRequest("/system/logistics-quota/my/switch", {
    method: "PUT",
    body: { storeCode, switchType, enabled: enabled ? 1 : 0 },
  });
}

/** admin：所有店铺额度 + 开关一览 */
export function listAllLogisticsQuota() {
  return apiRequest<LogisticsQuotaStatus[]>("/system/logistics-quota/list");
}

/** admin：设置某店铺的总额度 / 总开关 / 备注 */
export function adminUpdateLogisticsQuota(payload: {
  storeCode: string;
  totalQuota?: number;
  enabled?: 0 | 1;
  remark?: string;
}) {
  return apiRequest("/system/logistics-quota/update", {
    method: "PUT",
    body: payload,
  });
}

/** admin / 自助：用量日志（分页） */
export function listLogisticsUsage(query: {
  pageNum: number;
  pageSize: number;
  storeCode?: string;
  switchType?: LogisticsSwitchType;
  startTime?: string;
  endTime?: string;
} = { pageNum: 1, pageSize: 20 }) {
  return apiRequest<{ rows: LogisticsUsageRow[]; total: number }>(
    "/system/logistics-quota/usage",
    { query },
  );
}

// ─── 短链管理 ────────────────────────────────────────────────
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

// 本地路由白名单：与后端 SearchController.localRoutes 保持一致。
// 创建短链时 path 不允许与这些冲突。
export const LOCAL_ROUTES: string[] = [
  "/", "/order",
  "/tools", "/tools/order-search", "/tools/order",
  "/tools/order-link", "/tools/place-order", "/tools/purchasers",
  "/tools/store-query",
  "/tools/freight-calculator", "/tools/freight-compare",
  "/lab", "/lab/video-extract",
];
// path 命名约束：跟后端 ShortLinkServiceImpl.createShortLink 同步
export const SHORT_LINK_PATH_RULE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** 短链列表（带 dataScope 过滤） */
export function listShortLinks(params: { path?: string; targetType?: ShortLinkType } = {}) {
  return apiRequest<{ data?: ShortLinkRow[] } | ShortLinkRow[]>("/biz/short-link/list", { query: params });
}

/** 新建短链 */
export function createShortLink(payload: { path: string; targetType: ShortLinkType; target: string; remark?: string; expireTime?: string | null }) {
  return apiRequest("/biz/short-link", { method: "POST", body: payload });
}

/** 编辑短链（改 targetType/target/remark/expireTime；path 不可改） */
export function updateShortLink(id: number, payload: { targetType: ShortLinkType; target: string; remark?: string; expireTime?: string | null }) {
  return apiRequest(`/biz/short-link/${id}`, { method: "PUT", body: payload });
}

/** 删除短链（软删） */
export function deleteShortLink(id: number) {
  return apiRequest(`/biz/short-link/${id}`, { method: "DELETE" });
}

/** 最近 N 条访问日志（默认 20，上限 100） */
export function listShortLinkVisits(id: number, limit = 20) {
  return apiRequest<{ data?: ShortLinkVisitRow[] } | ShortLinkVisitRow[]>(`/biz/short-link/${id}/visits`, { query: { limit } });
}

/** 公开解析短链（SPA 启动时 catch-all 调用） */
export function resolveShortLink(path: string) {
  return publicApiRequest<{ data?: { id: number; path: string; targetType: ShortLinkType; target: string; expireTime?: string | null; visitCount?: number; lastVisitTime?: string | null } }>(
    `/search/short-link/${encodeURIComponent(path)}`,
  );
}

// ─── 公开店铺 ────────────────────────────────────────────────

/**
 * 公开店铺下拉 VO。
 * 与后端 StoreInfoVO 同结构：code 是店铺编码（= 订单 store 字段），
 * value/text 是店铺名（前端展示用）。
 */
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

/**
 * 公开查询店铺列表/单店。
 * 「专属查询」入口会用 code 查单个店铺做头部展示；列表页则不带任何过滤拿全量。
 * 与 storeInfoService.store() 同后端，但走 publicApiRequest 走免登录域名。
 */
export function listPublicStores(params: { code?: string; name?: string; createBy?: string } = {}) {
  return publicApiRequest<{ data?: PublicStoreRow[] } | PublicStoreRow[]>("/search/store", params);
}

export async function publicApiRequest<T = Record<string, unknown>>(
  path: string,
  query: Record<string, unknown> = {},
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetchWithTimeout(
    `${PUBLIC_API_BASE}${path}${toQuery(query)}`,
    {
      headers: { isToken: "false" },
      cache: "no-store",
      signal: options.signal,
    },
    options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );
  if (!response.ok) throw new ApiError(`请求失败（${response.status}）`, response.status);
  const result = (await response.json()) as Record<string, unknown>;
  const code = Number(result.code ?? 200);
  if (code !== 200) throw new ApiError(String(result.msg || "订单查询失败"), code);
  return result as T;
}

export async function downloadFile(
  path: string,
  params: Record<string, unknown>,
  filename: string,
) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]),
    ),
  });
  if (!response.ok) throw new ApiError("导出失败");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function uploadFile(
  path: string,
  file: File,
  query: Record<string, unknown> = {},
) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest(path, {
    method: "POST",
    query,
    body: form,
  });
}

/**
 * 跨环境复制文本到剪贴板。
 * 优先用 navigator.clipboard（需要 secure context：HTTPS / localhost / 127.0.0.1），
 * 失败时回退到 document.execCommand('copy') + 隐藏 textarea，覆盖内网 HTTP / 部分 WebView。
 * 返回 true 表示复制成功，false 表示两条路都不通（调用方一般可以弹个 toast）。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  // 1) 现代 API（仅 secure context 可用）
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 某些 WebView 写权限被拒，下面的 execCommand 兜底
    }
  }
  // 2) 兜底：textarea + execCommand
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 跨环境读取剪贴板文本。
 * 优先用 navigator.clipboard.readText（需要 secure context：HTTPS / localhost / 127.0.0.1），
 * 失败或不可用时回退到 window.prompt 让用户手动 Cmd+V。返回用户粘贴的文本；
 * 用户取消时抛 ApiError("已取消粘贴")，调用方一般 catch 一下不要吓到用户。
 */
export async function readFromClipboard(): Promise<string> {
  if (typeof window === "undefined") throw new ApiError("当前环境无法读取剪贴板");
  if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
    try {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    } catch {
      // 权限被拒或非 secure context，下面的 prompt 兜底
    }
  }
  const value = window.prompt("请粘贴文本（Cmd / Ctrl + V），确认后会识别内容：");
  if (value === null) throw new ApiError("已取消粘贴");
  return value;
}
