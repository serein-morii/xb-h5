import type { VaultBackup, VaultTransferItem } from "./vaultApi";

const OFFLINE_KEY = "otp-vault-offline-backup";
const ITERATIONS = 250_000;
const encoder = new TextEncoder();
const ZK_CHECK = "OTP Vault zero knowledge key";

type EncryptedBackup = { format: "xb-otp-encrypted"; version: 1; iterations: number; salt: string; iv: string; data: string; createdAt: string };

const encode64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  if (password.length < 8) throw new Error("恢复密码至少需要 8 位");
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/**
 * 零知识密文只在浏览器内解密。服务端保存 salt、校验密文和 zk:v1 密文，
 * 既不接收保护密码，也无法恢复其中的密码或 OTP Secret。
 */
export async function createZeroKnowledgeKey(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, ITERATIONS);
  return { key, salt: encode64(salt), verifier: await encryptZeroKnowledgeValue(ZK_CHECK, key) };
}

export async function unlockZeroKnowledgeKey(password: string, salt: string, verifier: string) {
  const key = await deriveKey(password, decode64(salt), ITERATIONS);
  if (await decryptZeroKnowledgeValue(verifier, key) !== ZK_CHECK) throw new Error("零知识保护密码不正确");
  return key;
}

export async function encryptZeroKnowledgeValue(value: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, encoder.encode(value));
  return `zk:v1:${encode64(iv)}:${encode64(new Uint8Array(encrypted))}`;
}

export async function decryptZeroKnowledgeValue(value: string, key: CryptoKey) {
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "zk" || parts[1] !== "v1") throw new Error("零知识密文格式无效");
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode64(parts[2]) as BufferSource }, key, decode64(parts[3]) as BufferSource);
    return new TextDecoder().decode(plain);
  } catch { throw new Error("零知识保护密码不正确或密文已经损坏"); }
}

export async function encryptVaultBackup(backup: VaultBackup, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, encoder.encode(JSON.stringify(backup)));
  return JSON.stringify({ format: "xb-otp-encrypted", version: 1, iterations: ITERATIONS, salt: encode64(salt), iv: encode64(iv), data: encode64(new Uint8Array(encrypted)), createdAt: new Date().toISOString() } satisfies EncryptedBackup);
}

export async function decryptVaultBackup(text: string, password: string): Promise<VaultBackup> {
  let envelope: EncryptedBackup;
  try { envelope = JSON.parse(text) as EncryptedBackup; } catch { throw new Error("备份文件格式无效"); }
  if (envelope.format !== "xb-otp-encrypted" || envelope.version !== 1) throw new Error("不支持的备份文件版本");
  try {
    const salt = decode64(envelope.salt), iv = decode64(envelope.iv);
    const key = await deriveKey(password, salt, envelope.iterations);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, decode64(envelope.data) as BufferSource);
    const backup = JSON.parse(new TextDecoder().decode(plain)) as VaultBackup;
    if (backup.format !== "xb-otp-vault" || !Array.isArray(backup.items)) throw new Error("invalid payload");
    return backup;
  } catch { throw new Error("恢复密码不正确或备份文件已经损坏"); }
}

export const saveOfflineVault = (encrypted: string) => localStorage.setItem(OFFLINE_KEY, encrypted);
export const readOfflineVault = () => localStorage.getItem(OFFLINE_KEY) || "";
export const hasOfflineVault = () => Boolean(readOfflineVault());
export const removeOfflineVault = () => localStorage.removeItem(OFFLINE_KEY);

export async function generateOfflineCode(item: VaultTransferItem, now = Date.now()) {
  if (!item.otpSecret) return "";
  const type = item.otpType || "TOTP";
  const period = item.periodSeconds || 30;
  const counter = type === "HOTP" ? item.hotpCounter || 0 : Math.floor(now / 1000 / period);
  const key = await crypto.subtle.importKey("raw", decodeBase32(item.otpSecret), { name: "HMAC", hash: `SHA-${String(item.algorithm || "SHA1").replace(/\D/g, "") || "1"}` }, false, ["sign"]);
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(4, counter >>> 0);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  const hash = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = hash[hash.length - 1] & 15;
  let binary = ((hash[offset] & 127) << 24) | ((hash[offset + 1] & 255) << 16) | ((hash[offset + 2] & 255) << 8) | (hash[offset + 3] & 255);
  if (type === "STEAM") {
    const alphabet = "23456789BCDFGHJKMNPQRTVWXY";
    let code = "";
    for (let index = 0; index < 5; index++) { code += alphabet[binary % alphabet.length]; binary = Math.floor(binary / alphabet.length); }
    return code;
  }
  // 与后端 normalizeDigits 对齐：支持 6-8 位，非法值回落 6
  const digits = Math.min(8, Math.max(6, item.digits || 6));
  return String((binary >>> 0) % 10 ** digits).padStart(digits, "0");
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0, buffer = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("OTP Secret 不是有效的 Base32 数据");
    buffer = (buffer << 5) | index; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); buffer &= (1 << bits) - 1; }
  }
  return new Uint8Array(bytes);
}
