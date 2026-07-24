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
