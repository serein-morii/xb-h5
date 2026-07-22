const DEVELOPMENT_API_BASE = "http://127.0.0.1:8080";
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

type RequestOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  query?: Record<string, unknown>;
  body?: BodyInit | Record<string, unknown>;
};

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, query, headers, body, ...rest } = options;
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

  const response = await fetch(`${API_BASE}${path}${toQuery(query)}`, {
    ...rest,
    headers: requestHeaders,
    body: requestBody,
    cache: "no-store",
  });

  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new Event("xb-session-expired"));
    throw new ApiError("登录状态已过期，请重新登录", 401);
  }
  if (!response.ok) {
    throw new ApiError(`请求失败（${response.status}）`, response.status);
  }
  const result = (await response.json()) as Record<string, unknown>;
  const code = Number(result.code ?? 200);
  if (code !== 200) {
    throw new ApiError(String(result.msg || "接口返回异常"), code);
  }
  return result as T;
}

export async function publicApiRequest<T = Record<string, unknown>>(
  path: string,
  query: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(`${PUBLIC_API_BASE}${path}${toQuery(query)}`, {
    headers: { isToken: "false" },
    cache: "no-store",
  });
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
