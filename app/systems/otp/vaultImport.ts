export type ImportedCredential = {
  issuer: string;
  accountName: string;
  password?: string;
  otpSecret?: string;
  otpType: "TOTP" | "HOTP" | "STEAM";
  hotpCounter: number;
  algorithm: string;
  digits: number;
  periodSeconds: number;
  loginUrl?: string;
  note?: string;
  tags?: string;
  favorite?: boolean;
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

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function safeLoginUrl(value: string) {
  const text = value.trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? text : "";
  } catch { return ""; }
}

function issuerFromUrl(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, "") || "未分类"; }
  catch { return "未分类"; }
}

function passwordCsvItems(source: string): ImportedCredential[] | null {
  const rows = parseCsv(source);
  if (rows.length < 2) return null;
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[ _-]/g, ""));
  if (!headers.includes("password") || !headers.some((value) => ["name", "title", "url", "username"].includes(value))) return null;
  const field = (row: string[], ...names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? (row[index] || "").trim() : "";
  };
  const items: ImportedCredential[] = [];
  for (const row of rows.slice(1)) {
    if (/^(1|true|yes)$/i.test(field(row, "archived"))) continue;
    const password = field(row, "password");
    const loginUrl = safeLoginUrl(field(row, "url", "website", "loginurl"));
    const username = field(row, "username", "user", "email");
    const title = field(row, "name", "title");
    const rawOtp = field(row, "otpauth", "totp", "otp");
    let otp: ImportedCredential | null = null;
    if (rawOtp) {
      try {
        otp = rawOtp.toLowerCase().startsWith("otpauth://") ? fromOtpAuth(rawOtp) : {
          issuer: title || issuerFromUrl(loginUrl), accountName: username || "未命名账号", otpSecret: normalizeSecret(rawOtp),
          otpType: "TOTP", hotpCounter: 0, algorithm: "SHA1", digits: 6, periodSeconds: 30,
        };
      } catch { otp = null; }
    }
    if (!password && !otp?.otpSecret) continue;
    items.push({
      issuer: title || otp?.issuer || issuerFromUrl(loginUrl),
      accountName: username || otp?.accountName || "未命名账号",
      password: password || undefined,
      otpSecret: otp?.otpSecret,
      otpType: otp?.otpType || "TOTP",
      hotpCounter: otp?.hotpCounter || 0,
      algorithm: otp?.algorithm || "SHA1",
      digits: otp?.digits || 6,
      periodSeconds: otp?.periodSeconds || 30,
      loginUrl: loginUrl || undefined,
      note: field(row, "note", "notes") || undefined,
      tags: field(row, "tags", "folder") || undefined,
      favorite: /^(1|true|yes)$/i.test(field(row, "favorite", "favourite")),
    });
  }
  if (!items.length) throw new Error("密码 CSV 中没有可导入的登录账号");
  return items;
}

function bitwardenItems(root: Record<string, unknown>): ImportedCredential[] | null {
  if (root.encrypted === true) throw new Error("请从 Bitwarden 导出未加密 JSON 后再导入");
  if (!Array.isArray(root.items)) return null;
  const folders = new Map((Array.isArray(root.folders) ? root.folders : []).map((folder) => {
    const value = (folder || {}) as Record<string, unknown>;
    return [String(value.id || ""), String(value.name || "")] as const;
  }));
  const items: ImportedCredential[] = [];
  for (const raw of root.items) {
    const item = (raw || {}) as Record<string, unknown>;
    if (Number(item.type || 1) !== 1 || !item.login || typeof item.login !== "object") continue;
    const login = item.login as Record<string, unknown>;
    const password = String(login.password || "");
    const username = String(login.username || "");
    const uris = Array.isArray(login.uris) ? login.uris : [];
    const firstUri = (uris[0] && typeof uris[0] === "object" ? uris[0] : {}) as Record<string, unknown>;
    const loginUrl = safeLoginUrl(String(firstUri.uri || ""));
    const title = String(item.name || "").trim();
    const rawOtp = String(login.totp || "").trim();
    let otp: ImportedCredential | null = null;
    if (rawOtp) {
      try {
        otp = rawOtp.toLowerCase().startsWith("otpauth://") ? fromOtpAuth(rawOtp) : {
          issuer: title || issuerFromUrl(loginUrl), accountName: username || "未命名账号", otpSecret: normalizeSecret(rawOtp),
          otpType: "TOTP", hotpCounter: 0, algorithm: "SHA1", digits: 6, periodSeconds: 30,
        };
      } catch { otp = null; }
    }
    if (!password && !otp?.otpSecret) continue;
    items.push({
      issuer: title || otp?.issuer || issuerFromUrl(loginUrl),
      accountName: username || otp?.accountName || "未命名账号",
      password: password || undefined,
      otpSecret: otp?.otpSecret,
      otpType: otp?.otpType || "TOTP",
      hotpCounter: otp?.hotpCounter || 0,
      algorithm: otp?.algorithm || "SHA1",
      digits: otp?.digits || 6,
      periodSeconds: otp?.periodSeconds || 30,
      loginUrl: loginUrl || undefined,
      note: String(item.notes || "") || undefined,
      tags: folders.get(String(item.folderId || "")) || undefined,
      favorite: Boolean(item.favorite),
    });
  }
  if (!items.length) throw new Error("Bitwarden 文件中没有可导入的登录账号");
  return items;
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
      const passwords = bitwardenItems(root);
      if (passwords) return passwords;
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
  const passwords = passwordCsvItems(source);
  if (passwords) return passwords;
  const items: ImportedCredential[] = [];
  for (const line of source.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    if (!value.toLowerCase().startsWith("otpauth://")) continue;
    items.push(fromOtpAuth(value));
  }
  if (!items.length) throw new Error("文件中没有可识别的 OTP、浏览器密码或密码管理器数据");
  return items;
}
