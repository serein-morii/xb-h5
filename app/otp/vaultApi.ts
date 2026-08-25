import { apiRequest } from "../lib/api";

const OTP_TOKEN_KEY = "otp-vault-token";
type ApiOptions = NonNullable<Parameters<typeof apiRequest>[1]>;

export const getOtpToken = () => localStorage.getItem(OTP_TOKEN_KEY) || "";
export const setOtpToken = (token: string) => localStorage.setItem(OTP_TOKEN_KEY, token);
export const clearOtpToken = () => localStorage.removeItem(OTP_TOKEN_KEY);

export async function otpApiRequest<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers);
  const token = getOtpToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    return await apiRequest<T>(path, { ...options, auth: false, headers });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 401) {
      clearOtpToken();
      window.dispatchEvent(new Event("otp-session-expired"));
    }
    throw error;
  }
}

export type VaultCredential = {
  id: number; issuer: string; accountName: string; passwordConfigured: boolean; otpConfigured: boolean;
  password?: string;
  currentOtp?: string; otpValidUntil?: number; periodSeconds: number; algorithm: string; digits: number;
  loginUrl?: string; note?: string; favorite: boolean; sensitivityLevel: string; updateTime?: string;
  shared?: boolean; shareId?: number; sharedBy?: string; allowCopy?: boolean; shareExpireTime?: string;
};

export type VaultShare = {
  id: number; status: string; accessCodeEnabled: boolean; itemCount: number; accessCount: number;
  maxAccessCount?: number; oneTime: boolean; allowCopy: boolean;
  accessCode?: string; showAccount: boolean; showPassword: boolean; showOtp: boolean; showLoginUrl: boolean; showNote: boolean;
  shareMode: "LINK" | "DIRECT"; recipientUsername?: string; sharePath?: string; expireTime: string; createTime: string; accessRecords?: VaultAccessRecord[];
};

export type VaultAccessRecord = {
  action: string; success: boolean; ipAddress?: string; userAgent?: string; detail?: string; createTime: string;
};

export type VaultRecipient = {
  userId: number; userName: string; nickName?: string; email?: string;
};

export type VaultPrefs = {
  masked: boolean; compact: boolean; grouped: boolean; showShared: boolean; autoRefresh: boolean;
};

export type ShareStatus = {
  status: string; accessCodeRequired: boolean; expireTime: string;
  itemCount: number; remainingAccessCount?: number;
};

export type SharedItem = {
  issuer: string; accountName?: string; password?: string; otp?: string;
  otpValidUntil?: number; otpPeriodSeconds?: number; loginUrl?: string; note?: string;
};

export const listVaultCredentials = () => otpApiRequest<{ data: VaultCredential[] }>("/otp/vault/credentials");
export const getVaultCredential = (id: number) => otpApiRequest<{ data: VaultCredential }>(`/otp/vault/credentials/${id}`);
export const saveVaultCredential = (id: number | null, body: Record<string, unknown>) => otpApiRequest<{ data: VaultCredential }>(id ? `/otp/vault/credentials/${id}` : "/otp/vault/credentials", { method: id ? "PUT" : "POST", body });
export const deleteVaultCredential = (id: number) => otpApiRequest(`/otp/vault/credentials/${id}`, { method: "DELETE" });
export const importLegacyVault = (text: string, ownerUsername = "") => otpApiRequest<{ data: { total: number; created: number; updated: number; ownerUsername: string } }>("/otp/vault/import/legacy", { method: "POST", body: { text, ownerUsername } });
export const listVaultRecipients = (keyword: string) => otpApiRequest<{ data: VaultRecipient[] }>(`/otp/vault/recipients?keyword=${encodeURIComponent(keyword)}`);
export const getVaultPreferences = () => otpApiRequest<{ data: VaultPrefs }>("/otp/vault/preferences");
export const saveVaultPreferences = (body: VaultPrefs) => otpApiRequest<{ data: VaultPrefs }>("/otp/vault/preferences", { method: "PUT", body });
export const listVaultShares = () => otpApiRequest<{ data: VaultShare[] }>("/otp/vault/shares");
export const getVaultShare = (id: number) => otpApiRequest<{ data: VaultShare }>(`/otp/vault/shares/${id}`);
export const createVaultShare = (body: Record<string, unknown>) => otpApiRequest<{ data: { id: number; shareMode: "LINK" | "DIRECT"; recipientUsername?: string; sharePath?: string; shareUrl?: string; accessCode?: string; autoFillAllowed: boolean; expireTime: string; itemCount: number } }>("/otp/vault/shares", { method: "POST", body });
export const revokeVaultShare = (id: number) => otpApiRequest(`/otp/vault/shares/${id}`, { method: "DELETE" });

export const getShareStatus = (token: string) => apiRequest<{ data: ShareStatus }>(`/otp/share/${token}/status`, { auth: false });
export const openVaultShare = (token: string, accessCode: string) => apiRequest<{ data: { sessionToken: string; sessionExpiresIn: number } }>(`/otp/share/${token}/open`, { auth: false, method: "POST", body: { accessCode } });
export const getSharedContent = (token: string, sessionToken: string) => apiRequest<{ data: { items: SharedItem[]; allowCopy: boolean; expireTime: string; serverTime: number } }>(`/otp/share/${token}/content`, { auth: false, headers: { "X-Otp-Share-Session": sessionToken } });

// ─── 注册与账号自助 ───────────────────────────────────────────

/** 邮箱 + 验证码注册 OTP 账号，注册即登录：返回 token 与派生用户名 */
export const registerOtpAccount = (email: string, emailCode: string) =>
  apiRequest<{ token: string; username: string }>("/registerOtp", { auth: false, method: "POST", body: { email: email.trim(), emailCode: emailCode.trim() } });

/** 修改当前账号的用户名（注册引导 / 设置页共用） */
export const setVaultUsername = (username: string) =>
  otpApiRequest<{ data: string }>("/otp/vault/account/username", { method: "PUT", body: { username: username.trim() } });

/** 设置当前账号的登录密码（password / oldPassword 需为 RSA 公钥加密后的密文） */
export const setVaultPassword = (encryptedPassword: string, extra: { oldPassword?: string; emailCode?: string; setup?: boolean } = {}) =>
  otpApiRequest("/otp/vault/account/password", { method: "PUT", body: { password: encryptedPassword, oldPassword: extra.oldPassword || undefined, emailCode: extra.emailCode || undefined, setup: extra.setup ? "true" : undefined } });
