import { ShieldAlert } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AppStartup } from "../../components/AppStartup";
import { clearOtpToken, getOtpToken, otpApiRequest, setOtpToken } from "./vaultApi";
import { API_PATHS } from "../../lib/pathConventions";
import OtpAuthScreen from "./OtpAuthScreen";
import { VaultOnboardingPage } from "./VaultAccountSetup";
import { hasOfflineVault } from "./vaultCrypto";
import "./otp-vault.css";

const OtpVaultWorkspace = lazy(() => import("./OtpVaultWorkspace"));
const OtpOfflineVault = lazy(() => import("./OtpOfflineVault"));

export default function OtpVaultPage() {
  const [access, setAccess] = useState<"loading" | "login" | "allowed" | "denied" | "offline">("loading");
  const [onboard, setOnboard] = useState<{ username: string } | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const finishOnboard = (result: { username?: string }) => {
    if (result.username) {
      setAccountName(result.username);
      localStorage.setItem("otp-vault-username", result.username);
    }
    setOnboard(null);
  };
  const checkAccess = useCallback(async () => {
    if (!getOtpToken()) return setAccess("login");
    try {
      const result = await otpApiRequest<Record<string, unknown>>(API_PATHS.auth.getInfo);
      const permissions = Array.isArray(result.permissions) ? result.permissions.map(String) : [];
      const roles = Array.isArray(result.roles) ? result.roles.map(String) : [];
      const user = (result.user || {}) as { userName?: string; email?: string };
      setAccountName(String(user.userName || ""));
      setAccountEmail(String(user.email || ""));
      setAccess(permissions.includes("*:*:*") || permissions.includes("otp:vault:view") || roles.includes("otp_user") || roles.includes("admin") ? "allowed" : "denied");
    } catch { setAccess(!navigator.onLine && hasOfflineVault() ? "offline" : "login"); }
  }, []);
  useEffect(() => { void checkAccess(); }, [checkAccess]);
  useEffect(() => { const expired = () => setAccess("login"); window.addEventListener("otp-session-expired", expired); return () => window.removeEventListener("otp-session-expired", expired); }, []);
  if (access === "loading") return <AppStartup system="otp" message="正在验证访问权限" />;
  if (access === "offline") return <Suspense fallback={null}><OtpOfflineVault onExit={() => setAccess("login")} /></Suspense>;
  if (access === "login") return <OtpAuthScreen onAuthenticated={(token, registration) => { setOtpToken(token); if (registration?.username) setOnboard({ username: registration.username }); setAccess("loading"); void checkAccess(); }} />;
  if (access === "denied") return <div className="vault-auth-state"><ShieldAlert size={30} /><h1>没有 OTP Vault 权限</h1><p>当前账号不能访问这个保险库。</p><button type="button" onClick={() => { clearOtpToken(); setAccess("login"); }}>换一个账号</button></div>;
  if (onboard) return <VaultOnboardingPage username={onboard.username} onDone={finishOnboard} />;
  return <Suspense fallback={<AppStartup system="otp" message="正在打开保险库" />}><OtpVaultWorkspace onLogout={() => { clearOtpToken(); setAccess("login"); }} accountName={accountName} accountEmail={accountEmail} onAccountNameChange={setAccountName} /></Suspense>;
}
