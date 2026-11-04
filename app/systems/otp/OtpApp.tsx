import { lazy, Suspense, useEffect, useState } from "react";
import { AppStartup, hideAppStartup } from "../../components/AppStartup";
import ErrorBoundary from "../../components/ErrorBoundary";
import { applyOpenGraph } from "../../lib/openGraph";
import { APP_ROUTES } from "../../lib/pathConventions";
import { resolveSubsystemPath } from "../../lib/subsystemHost";
import OtpInstallHint from "./OtpInstallHint";
import VaultSharePage from "./VaultSharePage";
import VaultTextSharePage from "./VaultTextSharePage";
import "./otp-vault.css";
import "./otp-auth.css";

const OtpVaultPage = lazy(() => import("./OtpVaultPage"));
const OtpVaultGuidePage = lazy(() => import("./OtpVaultGuidePage"));
const OtpVaultChangelogPage = lazy(() => import("./OtpVaultChangelogPage"));

function Fallback() {
  return <AppStartup system="otp" message="正在加载安全组件" />;
}

/** 发现新版本时提示手动刷新：自动 reload 会打断正在查看的凭据/笔记 */
function UpdateBanner() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    const onUpdate = (event: Event) => {
      const worker = (event.target as ServiceWorkerRegistration).installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // 新 SW 就绪并处于 waiting：说明有可用更新
        if (worker.state === "installed" && navigator.serviceWorker.controller) setReady(true);
      });
    };
    navigator.serviceWorker.register("/otp-sw.js", { updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        reg.addEventListener("updatefound", onUpdate);
        if (reg.waiting && navigator.serviceWorker.controller) setReady(true);
        // 每 30 分钟静默查一次更新
        const timer = window.setInterval(() => void reg.update(), 30 * 60 * 1000);
        return () => window.clearInterval(timer);
      })
      .catch(() => undefined);
    return () => registration?.removeEventListener("updatefound", onUpdate);
  }, []);
  if (!ready) return null;
  const apply = () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.waiting?.postMessage({ type: "SKIP_WAITING" }));
      window.setTimeout(() => window.location.reload(), 300);
    });
  };
  return <div className="sw-update-banner" role="status">
    <span>OTP Vault 有新版本</span>
    <button type="button" onClick={apply}>立即更新</button>
    <button type="button" aria-label="关闭" onClick={() => setReady(false)}>×</button>
  </div>;
}

/** OTP 独立壳：不经过主站 App，避免订单/黄桃/工具箱一起进来 */
export default function OtpApp() {
  const pathname = resolveSubsystemPath(window.location.pathname, window.location.hostname, ["otp"]);
  const share = pathname.match(/^\/s\/([A-Za-z0-9]{5}|[A-Za-z0-9_-]{10})$/);
  const textShare = pathname.match(/^\/t\/([A-Za-z0-9]{5}|[A-Za-z0-9_-]{10})$/);
  const guide = pathname === APP_ROUTES.otpGuide;
  const changelog = pathname === APP_ROUTES.otpChangelog;

  useEffect(() => {
    const title = changelog ? "更新日志｜OTP Vault" : guide ? "使用指南｜OTP Vault" : textShare ? "临时文本分享｜OTP Vault" : share ? "临时凭据授权｜OTP Vault" : "OTP Vault｜私人身份保险库";
    const description = changelog ? "查看 OTP Vault 最近功能更新。" : guide ? "了解 OTP Vault 的添加、使用、分享、安全保护与备份恢复。" : textShare ? "安全查看限时分享的普通文本、Markdown、代码或 HTML。" : share ? "通过访问码查看限时授权凭据。" : "独立管理 OTP 凭据并创建限时访问授权。";
    applyOpenGraph(title, description, "otp");
  }, [changelog, guide, share, textShare]);
  useEffect(() => {
    if (share || textShare || guide || changelog) hideAppStartup();
  }, [changelog, guide, share, textShare]);
  useEffect(() => {
    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) { manifest = document.createElement("link"); manifest.rel = "manifest"; document.head.appendChild(manifest); }
    manifest.href = "/manifest.webmanifest";
    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIcon) { appleIcon = document.createElement("link"); appleIcon.rel = "apple-touch-icon"; document.head.appendChild(appleIcon); }
    appleIcon.href = "/otp-icon-180.png";
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      const upgrading = Boolean(navigator.serviceWorker.controller);
      let reloading = false;
      const reloadOnUpgrade = () => {
        // 非分享页直接静默换版；分享/保险库页交给 UpdateBanner 让用户自己选时机
        if (!upgrading || reloading || share || textShare) return;
        reloading = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", reloadOnUpgrade);
      void navigator.serviceWorker.register("/otp-sw.js", { updateViaCache: "none" }).then((registration) => registration.update());
      return () => navigator.serviceWorker.removeEventListener("controllerchange", reloadOnUpgrade);
    }
  }, [share, textShare]);

  return (
    <Suspense fallback={<Fallback />}>
      {textShare ? <ErrorBoundary label="text-share"><VaultTextSharePage token={textShare[1]} /></ErrorBoundary> : share ? <ErrorBoundary label="share"><VaultSharePage token={share[1]} /></ErrorBoundary> : <>
        <OtpInstallHint />
        <ErrorBoundary label="vault">{guide ? <OtpVaultGuidePage /> : changelog ? <OtpVaultChangelogPage /> : <OtpVaultPage />}</ErrorBoundary>
      </>}
      <UpdateBanner />
    </Suspense>
  );
}
