export type StartupSystem = "order" | "otp" | "lab";
export type StartupConfig = { eyebrow: string; title: string; message: string; status: string; mark: string; accent: string; minimumMs: number };

const fallback: Record<StartupSystem, StartupConfig> = {
  order: { eyebrow: "ORDER WORKSPACE", title: "喜八工作台", message: "正在启动订单系统", status: "安全连接已就绪", mark: "XB", accent: "#18815b", minimumMs: 700 },
  otp: { eyebrow: "PRIVATE VAULT", title: "OTP Vault", message: "正在打开身份保险库", status: "安全通道已就绪", mark: "KEY", accent: "#6674cf", minimumMs: 0 },
  lab: { eyebrow: "HANDY LAB", title: "实验室", message: "正在准备工具", status: "运行环境已就绪", mark: "LAB", accent: "#c87545", minimumMs: 300 },
};

export function currentStartupSystem(): StartupSystem {
  const value = document.documentElement.dataset.startupSystem;
  return value === "otp" || value === "lab" ? value : "order";
}

export function getStartupConfig(system = currentStartupSystem()): StartupConfig {
  try {
    const source = document.getElementById("app-startup-config")?.textContent;
    const parsed = source ? JSON.parse(source) as Partial<Record<StartupSystem, Partial<StartupConfig>>> : {};
    return { ...fallback[system], ...parsed[system] };
  } catch { return fallback[system]; }
}
