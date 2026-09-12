export type ImportedCredential = {
  issuer: string;
  accountName: string;
  otpSecret: string;
  otpType: "TOTP" | "HOTP" | "STEAM";
  hotpCounter: number;
  algorithm: string;
  digits: number;
  periodSeconds: number;
  note?: string;
  tags?: string;
};

function normalizeAlgorithm(value?: string) {
  const algorithm = (value || "SHA1").toUpperCase().replace(/-/g, "");
  return algorithm === "SHA256" || algorithm === "SHA512" ? algorithm : "SHA1";
}

function normalizeDigits(type: string, value?: number) {
  if (type === "STEAM") return 5;
  return value === 8 ? 8 : 6;
}

function normalizePeriod(value?: number) {
  return value && value >= 15 && value <= 120 ? value : 30;
}

function normalizeSecret(value?: string) {
  const secret = (value || "").toUpperCase().replace(/[\s-]/g, "");
  if (!secret) throw new Error("缺少 OTP Secret");
  return secret;
}

function otpType(raw?: string): "TOTP" | "HOTP" | "STEAM" {
  const type = (raw || "totp").toLowerCase();
  if (type === "hotp") return "HOTP";
  if (type === "steam") return "STEAM";
  return "TOTP";
}

function fromOtpAuth(raw: string): ImportedCredential {
  const url = new URL(raw.trim());
  if (url.protocol !== "otpauth:") throw new Error("不是 otpauth 地址");
  const type = otpType(url.host);
  const label = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const issuerParam = url.searchParams.get("issuer") || "";
  let issuer = issuerParam;
  let account = label;
  const colon = label.indexOf(":");
  if (colon >= 0) {
    if (!issuer) issuer = label.slice(0, colon).trim();
    account = label.slice(colon + 1).trim();
  }
  return {
    issuer: issuer.trim() || "未分类",
    accountName: account || "未命名账号",
    otpSecret: normalizeSecret(url.searchParams.get("secret") || ""),
    otpType: type,
    hotpCounter: Math.max(0, Number(url.searchParams.get("counter") || 0)),
    algorithm: normalizeAlgorithm(url.searchParams.get("algorithm") || ""),
    digits: normalizeDigits(type, Number(url.searchParams.get("digits") || 6)),
    periodSeconds: normalizePeriod(Number(url.searchParams.get("period") || 30)),
  };
}

function fromAegis(entry: Record<string, unknown>): ImportedCredential | null {
  const type = otpType(String(entry.type || "totp"));
  const info = (entry.info && typeof entry.info === "object" ? entry.info : {}) as Record<string, unknown>;
  const secret = String(info.secret || "");
  if (!secret) return null;
  const tags = Array.isArray(entry.groups) ? entry.groups.map(String).join(" ") : "";
  return {
    issuer: String(entry.issuer || "未分类"),
    accountName: String(entry.name || entry.account || "未命名账号"),
    otpSecret: normalizeSecret(secret),
    otpType: type,
    hotpCounter: Math.max(0, Number(info.counter || 0)),
    algorithm: normalizeAlgorithm(String(info.algo || info.algorithm || "SHA1")),
    digits: normalizeDigits(type, Number(info.digits || 6)),
    periodSeconds: normalizePeriod(Number(info.period || 30)),
    note: String(entry.note || ""),
    tags,
  };
}

function fromAndOtp(entry: Record<string, unknown>): ImportedCredential | null {
  const secret = String(entry.secret || "");
  if (!secret) return null;
  const type = otpType(String(entry.type || "TOTP"));
  return {
    issuer: String(entry.issuer || "未分类"),
    accountName: String(entry.label || entry.name || "未命名账号"),
    otpSecret: normalizeSecret(secret),
    otpType: type,
    hotpCounter: Math.max(0, Number(entry.counter || 0)),
    algorithm: normalizeAlgorithm(String(entry.algorithm || "SHA1")),
    digits: normalizeDigits(type, Number(entry.digits || 6)),
    periodSeconds: normalizePeriod(Number(entry.period || 30)),
    tags: Array.isArray(entry.tags) ? entry.tags.map(String).join(" ") : "",
  };
}

export function parseVaultImportText(text: string): ImportedCredential[] {
  const source = text.trim();
  if (!source) throw new Error("导入文件为空");
  if (source.startsWith("{") || source.startsWith("[")) {
    let parsed: unknown;
    try { parsed = JSON.parse(source); }
    catch { throw new Error("JSON 文件无效"); }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const root = parsed as Record<string, unknown>;
      if (typeof root.db === "string") throw new Error("请导出未加密的 Aegis JSON 后再导入");
      const db = root.db && typeof root.db === "object" ? root.db as Record<string, unknown> : root;
      const entries = Array.isArray(db.entries) ? db.entries : Array.isArray(root.entries) ? root.entries : null;
      if (!entries) throw new Error("无法识别这个 JSON 备份");
      const items = entries.map((entry) => fromAegis((entry || {}) as Record<string, unknown>)).filter((item): item is ImportedCredential => Boolean(item));
      if (!items.length) throw new Error("Aegis 文件中没有可导入的账号");
      return items;
    }
    if (Array.isArray(parsed)) {
      const items = parsed.map((entry) => fromAndOtp((entry || {}) as Record<string, unknown>)).filter((item): item is ImportedCredential => Boolean(item));
      if (!items.length) throw new Error("JSON 文件中没有可导入的账号");
      return items;
    }
  }
  const items: ImportedCredential[] = [];
  for (const line of source.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    if (!value.toLowerCase().startsWith("otpauth://")) continue;
    items.push(fromOtpAuth(value));
  }
  if (!items.length) throw new Error("文件中没有 otpauth 地址或可识别的验证器备份");
  return items;
}
