import { lazy } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import type { RouteConfig } from "../types";

const OtpVaultPage = lazy(() => import("./OtpVaultPage"));

export const otpRoutes: Record<string, RouteConfig> = {
  [APP_ROUTES.otp]: {
    title: "OTP Vault｜私人身份保险库",
    description: "独立管理 OTP 凭据并创建限时访问授权。",
    content: <OtpVaultPage />,
  },
};
