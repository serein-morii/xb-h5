export const CLOCK_DRIFT_WARN_MS = 2000;
export const CLIPBOARD_CLEAR_MS = 30_000;
export const INSTALL_DISMISS_KEY = "otp-vault-install-coach-v2";
export const iosInstallHint = "点右下角三个点打开分享，选择「添加到桌面」";

export type InstallCoachKind = "ios" | "wechat" | "browser";

export function installCoachKind(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): InstallCoachKind {
  if (/MicroMessenger/i.test(ua)) return "wechat";
  if (/CriOS|FxiOS|EdgiOS|Chrome|Edg|OPR|SamsungBrowser/i.test(ua)) return "browser";
  if (isIosDevice(ua)) return "ios";
  return "browser";
}

export function installCoachCopy(kind: InstallCoachKind) {
  if (kind === "ios") {
    return {
      title: "添加到桌面",
      detail: "装到主屏幕后，像 App 一样打开，不用再找浏览器。",
      action: "指出分享按钮",
      steps: [
        "点右下角三个点，打开分享",
        "在分享里选择「添加到桌面」",
        "确认添加，之后从桌面图标打开",
      ],
    };
  }
  if (kind === "wechat") {
    return {
      title: "添加到桌面",
      detail: "微信里无法安装。请用 Safari 或 Chrome 打开后再添加到桌面。",
      action: "怎么添加",
      steps: [
        "点右上角 ···，选择在 Safari 或 Chrome 中打开",
        "Safari：右下角三个点打开分享，选「添加到桌面」",
        "Chrome：右上角分享里选「添加到桌面」",
      ],
    };
  }
  return {
    title: "添加到桌面",
    detail: "安装后可从桌面直接打开保险库，不必每次打开浏览器。",
    action: "指出分享按钮",
    steps: [
      "点右上角分享",
      "在分享里选择「添加到桌面」",
      "确认添加，之后从桌面图标打开",
    ],
  };
}

export function measureClockDriftMs(clientSent: number, clientReceived: number, serverTime: number) {
  const rtt = Math.max(0, clientReceived - clientSent);
  return serverTime + rtt / 2 - clientReceived;
}

export function shouldWarnClockDrift(driftMs: number) {
  return Math.abs(driftMs) >= CLOCK_DRIFT_WARN_MS;
}

export function isStandaloneDisplay(win: Window = window) {
  return win.matchMedia("(display-mode: standalone)").matches
    || Boolean((win.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isIosDevice(ua = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function shouldShowInstallHint({ standalone, dismissed }: { standalone: boolean; dismissed: boolean }) {
  return !standalone && !dismissed;
}

export function readInstallDismissed() {
  try { return localStorage.getItem(INSTALL_DISMISS_KEY) === "1"; } catch { return false; }
}

export function dismissInstallHint() {
  try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch { /* ignore quota */ }
}

type ClipboardWriter = (value: string) => Promise<unknown>;
type ClipboardReader = () => Promise<string>;
type TimerApi = { setTimeout: (fn: () => void, delay: number) => number; clearTimeout: (id: number) => void };

export function scheduleClipboardClear(
  value: string,
  writeText: ClipboardWriter,
  readText: ClipboardReader,
  delay = CLIPBOARD_CLEAR_MS,
  timerApi: TimerApi = window,
) {
  const id = timerApi.setTimeout(() => {
    void readText()
      .then((current) => { if (current === value) return writeText(""); })
      .catch(() => undefined);
  }, delay);
  return () => timerApi.clearTimeout(id);
}

export async function copyAndScheduleClear(value: string) {
  await navigator.clipboard.writeText(value);
  scheduleClipboardClear(
    value,
    (next) => navigator.clipboard.writeText(next),
    () => navigator.clipboard.readText(),
  );
}
