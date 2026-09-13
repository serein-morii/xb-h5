import type { VaultTransferItem } from "./vaultApi";

export type PasswordGeneratorOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

export const DEFAULT_PASSWORD_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

const SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}:,.?",
};

const AMBIGUOUS = /[Il1O0|`'"\\/]/g;

function randomIndex(max: number) {
  if (!Number.isInteger(max) || max < 1 || max > 256) throw new Error("密码字符集无效");
  const limit = 256 - (256 % max);
  const bytes = new Uint8Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % max;
}

function pick(value: string) {
  return value[randomIndex(value.length)];
}

export function generateStrongPassword(options: PasswordGeneratorOptions = DEFAULT_PASSWORD_OPTIONS) {
  const length = Math.max(8, Math.min(64, Math.round(options.length || 20)));
  const selected = (Object.keys(SETS) as Array<keyof typeof SETS>)
    .filter((key) => options[key])
    .map((key) => options.avoidAmbiguous ? SETS[key].replace(AMBIGUOUS, "") : SETS[key]);
  if (!selected.length) throw new Error("至少选择一种密码字符");
  const pool = selected.join("");
  const output = selected.map(pick);
  while (output.length < length) output.push(pick(pool));
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output.join("");
}

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "很弱" | "偏弱" | "一般" | "较强" | "很强";
  percent: number;
  entropyBits: number;
};

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "很弱", percent: 0, entropyBits: 0 };
  const groups = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  const poolSize = (/[a-z]/.test(password) ? 26 : 0) + (/[A-Z]/.test(password) ? 26 : 0)
    + (/\d/.test(password) ? 10 : 0) + (/[^A-Za-z0-9]/.test(password) ? 28 : 0);
  let entropyBits = Math.round(password.length * Math.log2(Math.max(1, poolSize)));
  if (/^(password|qwerty|admin|letmein|welcome|123456|abc123)/i.test(password)) entropyBits = Math.min(entropyBits, 18);
  if (/(.)\1{3,}|(.{1,4})\2{2,}/.test(password)) entropyBits = Math.max(0, entropyBits - 22);
  if (/0123|1234|2345|3456|4567|5678|6789|abcd|qwer/i.test(password)) entropyBits = Math.max(0, entropyBits - 16);
  let score: PasswordStrength["score"] = 0;
  if (password.length >= 8 && entropyBits >= 34) score = 1;
  if (password.length >= 10 && groups >= 2 && entropyBits >= 48) score = 2;
  if (password.length >= 12 && groups >= 3 && entropyBits >= 64) score = 3;
  if (password.length >= 16 && groups >= 3 && entropyBits >= 82) score = 4;
  const labels: PasswordStrength["label"][] = ["很弱", "偏弱", "一般", "较强", "很强"];
  return { score, label: labels[score], percent: score === 0 ? 12 : score * 25, entropyBits };
}

export type PasswordHealthIssue = {
  issuer: string;
  accountName: string;
  reasons: Array<"weak" | "reused" | "missingOtp">;
  strength: PasswordStrength["label"];
};

export type PasswordHealthReport = {
  score: number;
  total: number;
  strong: number;
  weak: number;
  reused: number;
  missingOtp: number;
  issues: PasswordHealthIssue[];
};

/** 只返回风险标签和数量，调用结束后不保留任何密码明文。 */
export function auditVaultPasswords(items: VaultTransferItem[]): PasswordHealthReport {
  const entries = items.filter((item) => Boolean(item.password)).map((item) => ({ item, password: item.password || "", strength: passwordStrength(item.password || "") }));
  const occurrences = new Map<string, number>();
  entries.forEach(({ password }) => occurrences.set(password, (occurrences.get(password) || 0) + 1));
  let weak = 0;
  let reused = 0;
  let missingOtp = 0;
  let strong = 0;
  const issues: PasswordHealthIssue[] = [];
  for (const entry of entries) {
    const reasons: PasswordHealthIssue["reasons"] = [];
    if (entry.strength.score < 3) { reasons.push("weak"); weak += 1; } else strong += 1;
    if ((occurrences.get(entry.password) || 0) > 1) { reasons.push("reused"); reused += 1; }
    if (!entry.item.otpSecret && !entry.item.clientOtpSecretCiphertext) { reasons.push("missingOtp"); missingOtp += 1; }
    if (reasons.length) issues.push({ issuer: entry.item.issuer, accountName: entry.item.accountName, reasons, strength: entry.strength.label });
  }
  const total = entries.length;
  const penalty = weak * 22 + reused * 18 + missingOtp * 7;
  const score = total ? Math.max(0, Math.round(100 - penalty / total)) : 100;
  return { score, total, strong, weak, reused, missingOtp, issues };
}
