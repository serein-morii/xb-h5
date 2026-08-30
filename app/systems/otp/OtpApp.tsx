import { lazy, Suspense, useEffect } from "react";
import { resolveSubsystemPath } from "../../lib/subsystemHost";
import "./otp-auth.css";

const OtpVaultPage = lazy(() => import("./OtpVaultPage"));
const VaultSharePage = lazy(() => import("./VaultSharePage"));

function Fallback() {
  return <main className="otp-auth-page"><div className="otp-boot"><span className="otp-boot-mark" /><p>正在打开 OTP Vault…</p></div></main>;
}

/** OTP 独立壳：不经过主站 App，避免订单/黄桃/工具箱一起进来 */
export default function OtpApp() {
  const pathname = resolveSubsystemPath(window.location.pathname, window.location.hostname, ["otp"]);
  const share = pathname.match(/^\/s\/([A-Za-z0-9]{5}|[A-Za-z0-9_-]{10})$/);

  useEffect(() => {
    document.title = share ? "临时凭据授权｜OTP Vault" : "OTP Vault｜私人身份保险库";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = share ? "通过访问码查看限时授权凭据。" : "独立管理 OTP 凭据并创建限时访问授权。";
  }, [share]);
  useEffect(() => {
    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) { manifest = document.createElement("link"); manifest.rel = "manifest"; document.head.appendChild(manifest); }
    manifest.href = "/manifest.webmanifest";
    if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("/otp-sw.js");
  }, []);

  return (
    <Suspense fallback={<Fallback />}>
      {share ? <VaultSharePage token={share[1]} /> : <OtpVaultPage />}
    </Suspense>
  );
}
