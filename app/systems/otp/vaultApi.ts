import { apiRequest } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";

const OTP_TOKEN_KEY = "otp-vault-token";
const OTP_STEP_UP_KEY = "otp-vault-step-up";
type ApiOptions = NonNullable<Parameters<typeof apiRequest>[1]>;

export const getOtpToken = () => localStorage.getItem(OTP_TOKEN_KEY) || "";
export const setOtpToken = (token: string) => localStorage.setItem(OTP_TOKEN_KEY, token);
export const clearOtpToken = () => localStorage.removeItem(OTP_TOKEN_KEY);
export const getOtpStepUpToken = () => sessionStorage.getItem(OTP_STEP_UP_KEY) || "";
export const setOtpStepUpToken = (token: string) => sessionStorage.setItem(OTP_STEP_UP_KEY, token);
export const clearOtpStepUpToken = () => sessionStorage.removeItem(OTP_STEP_UP_KEY);

type StepUpRequest = { resolve: () => void; reject: (reason?: unknown) => void };
function requestStepUp() {
  return new Promise<void>((resolve, reject) => window.dispatchEvent(new CustomEvent<StepUpRequest>("otp-step-up-required", { detail: { resolve, reject } })));
}

export async function otpApiRequest<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers);
  const token = getOtpToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const stepUp = getOtpStepUpToken();
  if (stepUp) headers.set("X-Otp-Step-Up", stepUp);
  try {
    return await apiRequest<T>(path, { ...options, auth: false, headers });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 401) {
      clearOtpToken();
      window.dispatchEvent(new Event("otp-session-expired"));
    }
    if (error && typeof error === "object" && "code" in error && error.code === 428) {
      clearOtpStepUpToken();
      await requestStepUp();
      const retryHeaders = new Headers(options.headers);
      if (token) retryHeaders.set("Authorization", `Bearer ${token}`);
      const retryStepUp = getOtpStepUpToken();
      if (retryStepUp) retryHeaders.set("X-Otp-Step-Up", retryStepUp);
      return apiRequest<T>(path, { ...options, auth: false, headers: retryHeaders });
    }
    throw error;
  }
}

export type VaultCredential = {
  id: number; issuer: string; accountName: string; passwordConfigured: boolean; otpConfigured: boolean;
  password?: string;
	clientPasswordCiphertext?: string; clientOtpSecretCiphertext?: string; zeroKnowledge?: boolean;
  currentOtp?: string; otpValidUntil?: number; periodSeconds: number; algorithm: string; digits: number;
  otpType: "TOTP" | "HOTP" | "STEAM"; hotpCounter?: number; requiresStepUp?: boolean;
  loginUrl?: string; note?: string; favorite: boolean; sensitivityLevel: string; updateTime?: string;
  shared?: boolean; shareId?: number; sharedBy?: string; allowCopy?: boolean; shareExpireTime?: string;
};

export type VaultShare = {
  id: number; name?: string; status: string; accessCodeEnabled: boolean; itemCount: number; accessCount: number;
  maxAccessCount?: number; oneTime: boolean; allowCopy: boolean;
  accessCode?: string; showAccount: boolean; showPassword: boolean; showOtp: boolean; showLoginUrl: boolean; showNote: boolean;
  credentialIds?: number[]; shareMode: "LINK" | "DIRECT"; recipientUsername?: string; sharePath?: string; expireTime: string; createTime: string; accessRecords?: VaultAccessRecord[];
};

export type VaultAccessRecord = {
  action: string; success: boolean; ipAddress?: string; userAgent?: string; detail?: string; createTime: string;
};

export type VaultRecipient = {
  userId: number; userName: string; nickName?: string; email?: string;
};

export type VaultPrefs = {
  masked: boolean; compact: boolean; grouped: boolean; showShared: boolean; autoRefresh: boolean;
  autoLockMinutes: number; stepUpEnabled: boolean; securityAlerts: boolean; zeroKnowledgeEnabled?: boolean;
  zeroKnowledgeSalt?: string; zeroKnowledgeVerifier?: string;
};

export type VaultSession = { id: string; deviceKey: string; displayName: string; current: boolean; trusted: boolean; sessionCount: number; longSession: boolean; ipAddress?: string; location?: string; browser?: string; os?: string; lastActiveTime: number; expireTime: number };
export type VaultActivity = { id: number; action: string; targetType?: string; targetId?: number; ipAddress?: string; userAgent?: string; detail?: string; createTime: string };
export type VaultSecurityStatus = { encryption: string; keyId: string; keyRotationNeeded: number; unlocked: boolean; stepUpExpiresIn: number; deviceCount: number; failedVerifications24h: number; lastBackupTime?: string; lastRecoveryCheckTime?: string; securityAlerts: boolean; zeroKnowledgeEnabled: boolean; credentialCount: number };
export type VaultPasskey = { id: number; displayName: string; backupEligible: boolean; backedUp: boolean; lastUsedTime?: string; createTime: string };
export type VaultTransferItem = { issuer: string; accountName: string; password?: string; otpSecret?: string; clientPasswordCiphertext?: string; clientOtpSecretCiphertext?: string; otpType?: "TOTP" | "HOTP" | "STEAM"; hotpCounter?: number; algorithm?: string; digits?: number; periodSeconds?: number; loginUrl?: string; note?: string; favorite?: boolean; sensitivityLevel?: string };
export type VaultBackup = { format: "xb-otp-vault"; version: number; createdAt: string; keyId: string; items: VaultTransferItem[] };

export type ShareStatus = {
  status: string; name?: string; accessCodeRequired: boolean; expireTime: string;
  itemCount: number; remainingAccessCount?: number;
};

export type SharedItem = {
  issuer: string; accountName?: string; password?: string; otp?: string;
  otpValidUntil?: number; otpPeriodSeconds?: number; loginUrl?: string; note?: string;
};

const { vault, vaultAccount, share } = API_PATHS.otp;

export const listVaultCredentials = () => otpApiRequest<{ data: VaultCredential[] }>(`${vault}/credentials`);
export const getVaultCredential = (id: number) => otpApiRequest<{ data: VaultCredential }>(`${vault}/credentials/${id}`);
export const nextVaultHotp = (id: number) => otpApiRequest<{ data: VaultCredential }>(`${vault}/credentials/${id}/hotp/next`, { method: "POST" });
export const saveVaultCredential = (id: number | null, body: Record<string, unknown>) => otpApiRequest<{ data: VaultCredential }>(id ? `${vault}/credentials/${id}` : `${vault}/credentials`, { method: id ? "PUT" : "POST", body });
export const deleteVaultCredential = (id: number) => otpApiRequest(`${vault}/credentials/${id}`, { method: "DELETE" });
export const listDeletedVaultCredentials = () => otpApiRequest<{ data: VaultCredential[] }>(`${vault}/trash`);
export const restoreVaultCredential = (id: number) => otpApiRequest(`${vault}/trash/${id}/restore`, { method: "POST" });
export const purgeVaultCredential = (id: number) => otpApiRequest(`${vault}/trash/${id}`, { method: "DELETE" });
export const importLegacyVault = (text: string, ownerUsername = "") => otpApiRequest<{ data: { total: number; created: number; updated: number; ownerUsername: string } }>(`${vault}/import/legacy`, { method: "POST", body: { text, ownerUsername } });
export const listVaultRecipients = (keyword: string) => otpApiRequest<{ data: VaultRecipient[] }>(`${vault}/recipients?keyword=${encodeURIComponent(keyword)}`);
export const getVaultPreferences = () => otpApiRequest<{ data: VaultPrefs }>(`${vault}/preferences`);
export const saveVaultPreferences = (body: VaultPrefs) => otpApiRequest<{ data: VaultPrefs }>(`${vault}/preferences`, { method: "PUT", body });
export const exportVaultBackup = () => otpApiRequest<{ data: VaultBackup }>(`${vault}/backup`);
export const previewVaultImport = (items: VaultTransferItem[]) => otpApiRequest<{ data: { total: number; items: Array<{ issuer: string; accountName: string; status: "NEW" | "DUPLICATE" | "CONFLICT" }> } }>(`${vault}/import/preview`, { method: "POST", body: { items } });
export const commitVaultImport = (items: VaultTransferItem[], replaceExisting: boolean) => otpApiRequest<{ data: { total: number; created: number; updated: number; skipped: number } }>(`${vault}/import`, { method: "POST", body: { items, replaceExisting } });
export const listVaultActivities = (pageNum = 1) => otpApiRequest<{ rows: VaultActivity[]; total: number }>(`${vault}/activities?pageNum=${pageNum}&pageSize=20`);
export const listVaultSessions = () => otpApiRequest<{ data: VaultSession[] }>(`${vaultAccount}/sessions`);
export const revokeVaultSession = (id: string) => otpApiRequest(`${vaultAccount}/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
export const revokeVaultDevice = (deviceKey: string) => otpApiRequest(`${vaultAccount}/devices/${encodeURIComponent(deviceKey)}/sessions`, { method: "DELETE" });
export const revokeOtherVaultSessions = () => otpApiRequest<{ data: { revoked: number } }>(`${vaultAccount}/sessions/others`, { method: "DELETE" });
export const updateVaultDevice = (deviceKey: string, body: { displayName?: string; trusted?: boolean }) => otpApiRequest(`${vaultAccount}/devices/${encodeURIComponent(deviceKey)}`, { method: "PUT", body });
export const verifyVaultSecurity = (body: { password?: string; emailCode?: string }) => otpApiRequest<{ data: { token: string; expiresIn: number; keyId: string } }>(`${vaultAccount}/security/verify`, { method: "POST", body });
export const getVaultStepUpPasskeyOptions = () => otpApiRequest<{ data: { requestId: string; publicKey: Record<string, unknown> } }>(`${vaultAccount}/security/passkey/options`, { method: "POST" });
export const finishVaultStepUpPasskey = (requestId: string, credential: Record<string, unknown>) => otpApiRequest<{ data: { token: string; expiresIn: number; keyId: string } }>(`${vaultAccount}/security/passkey/finish`, { method: "POST", body: { requestId, credential } });
export const lockVaultSecurity = () => otpApiRequest(`${vaultAccount}/security/lock`, { method: "POST" });
export const getVaultSecurityStatus = () => otpApiRequest<{ data: VaultSecurityStatus }>(`${vaultAccount}/security/status`);
export const rotateVaultKey = () => otpApiRequest<{ data: { credentials: number; shares: number; shareItems: number; keyId: string } }>(`${vaultAccount}/security/key-rotation`, { method: "POST" });
export const recordVaultRecoveryCheck = (itemCount: number, createdAt: string) => otpApiRequest(`${vaultAccount}/security/recovery-check`, { method: "POST", body: { itemCount, createdAt } });
export const listVaultPasskeys = () => otpApiRequest<{ data: VaultPasskey[] }>(`${vaultAccount}/passkeys`);
export const getVaultPasskeyRegistrationOptions = () => otpApiRequest<{ data: { requestId: string; publicKey: Record<string, unknown> } }>(`${vaultAccount}/passkeys/options`, { method: "POST" });
export const finishVaultPasskeyRegistration = (requestId: string, credential: Record<string, unknown>, displayName: string) => otpApiRequest<{ data: VaultPasskey }>(`${vaultAccount}/passkeys`, { method: "POST", body: { requestId, credential, displayName } });
export const renameVaultPasskey = (id: number, displayName: string) => otpApiRequest(`${vaultAccount}/passkeys/${id}`, { method: "PUT", body: { displayName } });
export const deleteVaultPasskey = (id: number) => otpApiRequest(`${vaultAccount}/passkeys/${id}`, { method: "DELETE" });
export const getPasskeyLoginOptions = (identifier: string, longSession: boolean) => apiRequest<{ data: { requestId: string; publicKey: Record<string, unknown> } }>(`${API_PATHS.auth.passkeyLogin}/options`, { auth: false, method: "POST", body: { identifier, longSession } });
export const finishPasskeyLogin = (requestId: string, credential: Record<string, unknown>) => apiRequest<{ data: { token: string; username: string } }>(`${API_PATHS.auth.passkeyLogin}/finish`, { auth: false, method: "POST", body: { requestId, credential } });
export const listVaultShares = () => otpApiRequest<{ data: VaultShare[] }>(`${vault}/shares`);
export const getVaultShare = (id: number) => otpApiRequest<{ data: VaultShare }>(`${vault}/shares/${id}`);
export const createVaultShare = (body: Record<string, unknown>) => otpApiRequest<{ data: { id: number; name: string; shareMode: "LINK" | "DIRECT"; recipientUsername?: string; sharePath?: string; shareUrl?: string; accessCode?: string; autoFillAllowed: boolean; expireTime: string; itemCount: number } }>(`${vault}/shares`, { method: "POST", body });
export const updateVaultShare = (id: number, body: Record<string, unknown>) => otpApiRequest<{ data: VaultShare }>(`${vault}/shares/${id}`, { method: "PUT", body });
export const revokeVaultShare = (id: number) => otpApiRequest(`${vault}/shares/${id}/revoke`, { method: "POST" });
export const deleteVaultShare = (id: number) => otpApiRequest(`${vault}/shares/${id}`, { method: "DELETE" });

export const getShareStatus = (token: string) => apiRequest<{ data: ShareStatus }>(`${share}/${token}/status`, { auth: false });
export const openVaultShare = (token: string, accessCode: string) => apiRequest<{ data: { sessionToken: string; sessionExpiresIn: number } }>(`${share}/${token}/open`, { auth: false, method: "POST", body: { accessCode } });
export const getSharedContent = (token: string, sessionToken: string) => apiRequest<{ data: { items: SharedItem[]; name?: string; allowCopy: boolean; expireTime: string; serverTime: number } }>(`${share}/${token}/content`, { auth: false, headers: { "X-Otp-Share-Session": sessionToken } });

// ─── 注册与账号自助 ───────────────────────────────────────────

/** 邮箱 + 验证码注册 OTP 账号，注册即登录：返回 token 与派生用户名 */
export const registerOtpAccount = (email: string, emailCode: string) =>
  apiRequest<{ token: string; username: string }>(API_PATHS.auth.registerOtp, { auth: false, method: "POST", body: { email: email.trim(), emailCode: emailCode.trim() } });

/** 修改当前账号的用户名（注册引导 / 设置页共用） */
export const setVaultUsername = (username: string) =>
  otpApiRequest<{ data: string }>(`${vaultAccount}/username`, { method: "PUT", body: { username: username.trim() } });

/** 设置当前账号的登录密码（password / oldPassword 需为 RSA 公钥加密后的密文） */
export const setVaultPassword = (encryptedPassword: string, extra: { oldPassword?: string; emailCode?: string; setup?: boolean } = {}) =>
  otpApiRequest(`${vaultAccount}/password`, { method: "PUT", body: { password: encryptedPassword, oldPassword: extra.oldPassword || undefined, emailCode: extra.emailCode || undefined, setup: extra.setup ? "true" : undefined } });
