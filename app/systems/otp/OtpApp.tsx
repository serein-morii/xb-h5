import { lazy, Suspense, useEffect } from "react";
import { AppStartup } from "../../components/AppStartup";
import { APP_ROUTES } from "../../lib/pathConventions";
import { resolveSubsystemPath } from "../../lib/subsystemHost";
import VaultSharePage from "./VaultSharePage";
import "./otp-vault.css";
import "./otp-auth.css";

const OtpVaultPage = lazy(() => import("./OtpVaultPage"));
const OtpVaultGuidePage = lazy(() => import("./OtpVaultGuidePage"));

function Fallback() {
  return <AppStartup system="otp" message="正在加载安全组件" />;
}

/** OTP 独立壳：不经过主站 App，避免订单/黄桃/工具箱一起进来 */
export default function OtpApp() {
  const pathname = resolveSubsystemPath(window.location.pathname, window.location.hostname, ["otp"]);
  const share = pathname.match(/^\/s\/([A-Za-z0-9]{5}|[A-Za-z0-9_-]{10})$/);
  const guide = pathname === APP_ROUTES.otpGuide;

  useEffect(() => {
    document.title = guide ? "使用指南｜OTP Vault" : share ? "临时凭据授权｜OTP Vault" : "OTP Vault｜私人身份保险库";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = guide ? "了解 OTP Vault 的添加、使用、分享、安全保护与备份恢复。" : share ? "通过访问码查看限时授权凭据。" : "独立管理 OTP 凭据并创建限时访问授权。";
  }, [guide, share]);
  useEffect(() => {
    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) { manifest = document.createElement("link"); manifest.rel = "manifest"; document.head.appendChild(manifest); }
    manifest.href = "/manifest.webmanifest";
    if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("/otp-sw.js");
  }, []);

  return (
    <Suspense fallback={<Fallback />}>
      {guide ? <OtpVaultGuidePage /> : share ? <VaultSharePage token={share[1]} /> : <OtpVaultPage />}
    </Suspense>
  );
}
