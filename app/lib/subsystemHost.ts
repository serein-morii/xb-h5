/**
 * 子系统独立域名约定：{子系统}.gooop.top 对应路由前缀 /{子系统}
 *
 * 完整说明（nginx 模板 / 保留名 / 如何新增）：docs/subsystem-host.md
 * nginx 只做整站反代到主站根路径（不要拼 /otp、/lab），前端按主机名补前缀。
 */

const RESERVED_HOSTS = new Set([
  "www", "m", "api", "admin", "uat", "dev", "stage", "test",
  "mail", "img", "cdn", "static", "localhost",
]);

/** 跨子系统仍按原路径打开的全局前缀（OTP 分享链等） */
const GLOBAL_PATHS = new Set(["s"]);

export function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function collectSubsystemPrefixes(routePaths: string[]) {
  const prefixes = new Set<string>();
  for (const path of routePaths) {
    const seg = path.split("/").filter(Boolean)[0];
    if (seg) prefixes.add(seg.toLowerCase());
  }
  return prefixes;
}

function hostLabel(hostname: string) {
  return (hostname.split(".")[0] || "").toLowerCase();
}

/** OTP 独立入口：otp 子域、/otp、分享链 /s/，启动时不加载主站 App */
export function isOtpSurface(hostname = window.location.hostname, pathname = window.location.pathname) {
  const host = hostname.toLowerCase();
  const path = normalizePath(pathname);
  if (host === "otp.gooop.top" || host.startsWith("otp.")) return true;
  if (path === "/otp" || path.startsWith("/otp/")) return true;
  if (/^\/s\/[A-Za-z0-9_-]{5,}$/.test(path)) return true;
  return false;
}

/**
 * 把独立域名上的 pathname 还原成主站路由。
 * @param subsystemPrefixes 已注册的一级路由（/otp /lab /tools …）
 */
export function resolveSubsystemPath(pathname: string, hostname: string, subsystemPrefixes: Set<string> | string[]) {
  const path = normalizePath(pathname);
  const prefixes = subsystemPrefixes instanceof Set ? subsystemPrefixes : new Set(subsystemPrefixes);
  const sub = hostLabel(hostname);
  if (!sub || RESERVED_HOSTS.has(sub) || !prefixes.has(sub)) return path;
  if (path === `/${sub}` || path.startsWith(`/${sub}/`)) return path;
  if (path === "/") return `/${sub}`;
  const first = path.split("/").filter(Boolean)[0] || "";
  if (GLOBAL_PATHS.has(first)) return path;
  return `/${sub}${path}`;
}
