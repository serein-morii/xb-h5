import { lazy } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import type { RouteConfig } from "../types";

const OtpVaultPage = lazy(() => import("./OtpVaultPage"));
const VaultSharePage = lazy(() => import("./VaultSharePage"));

export const otpRoutes: Record<string, RouteConfig> = {
  [APP_ROUTES.otp]: {
    title: "OTP Vault｜私人身份保险库",
    description: "独立管理 OTP 凭据并创建限时访问授权。",
    content: <OtpVaultPage />,
  },
};

export function resolveOtpDynamicRoute(pathname: string) {
  const share = pathname.match(/^\/s\/([A-Za-z0-9]{5}|[A-Za-z0-9_-]{10})$/);
  if (!share) return null;
  return {
    title: "临时凭据授权｜OTP Vault",
    description: "通过访问码查看限时授权凭据。",
    content: <VaultSharePage token={share[1]} />,
  } satisfies RouteConfig;
}
