import { BookOpen, Camera, Check, ChevronRight, Clock3, Copy, Eye, EyeOff, ExternalLink, FileUp, KeyRound, Layers3, LayoutGrid, Link2, LoaderCircle, LockKeyhole, LogOut, Moon, Pencil, Plus, ScanLine, Search, Settings2, Share2, ShieldAlert, ShieldCheck, Star, Sun, SunMoon, Trash2, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
	createVaultShare, deleteVaultCredential, deleteVaultShare, getVaultCredential, getVaultShare, importLegacyVault, listVaultCredentials, listVaultShares,
	listVaultRecipients, getVaultPreferences, revokeVaultShare, saveVaultCredential, saveVaultPreferences, syncVaultCredentialShares, type VaultCredential, type VaultPrefs, type VaultRecipient, type VaultShare,
	nextVaultHotp, clearOtpStepUpToken, updateVaultShare,
} from "./vaultApi";
import VaultAccountSetup from "./VaultAccountSetup";
import VaultSecurityCenter from "./VaultSecurityCenter";
import VaultStepUpDialog from "./VaultStepUpDialog";
import { decryptZeroKnowledgeValue, encryptZeroKnowledgeValue, generateOfflineCode } from "./vaultCrypto";
import { APP_ROUTES } from "../../lib/pathConventions";
import { readThemePreference, setThemePreference, type ThemePreference } from "../../lib/theme";
import { issuerStyle } from "./issuerStyle";
import "./otp-vault.css";

type JsQrFn = (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: string }) => { data: string; location: { topLeftCorner: { x: number; y: number }; topRightCorner: { x: number; y: number }; bottomRightCorner: { x: number; y: number }; bottomLeftCorner: { x: number; y: number } } } | null;
let jsQR: JsQrFn | null = null;
async function loadJsQR() {
  if (!jsQR) jsQR = (await import("jsqr")).default as JsQrFn;
  return jsQR;
}

type Modal = "credential" | "scanner" | "detail" | "import" | "share" | "shareDetail" | "shareEdit" | "deleteConfirm" | "revokeConfirm" | "shareDeleteConfirm" | "created" | "username" | "password" | "syncShares" | null;
type VaultView = "all" | "favorite" | "shares" | "security" | "settings";
type BarcodeDetectorLike = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorConstructor = new (init?: { formats?: string[] }) => BarcodeDetectorLike;
const LAST_USED_KEY = "otp-vault-last-used";
const CONCEAL_KEY = "otp-vault-conceal-otp";
const SORT_KEY = "otp-vault-sort";
const CLIPBOARD_CLEAR_MS = 30_000;
function readLastUsed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LAST_USED_KEY) || "{}"); } catch { return {}; }
}
function concealOtpEnabled() {
  return localStorage.getItem(CONCEAL_KEY) === "1";
}
function canUseSystemShare() {
  return typeof navigator.share === "function" && window.matchMedia("(max-width: 820px), (pointer: coarse) and (hover: none)").matches;
}
const emptyCredential = { issuer: "", accountName: "", otpSecret: "", password: "", otpType: "TOTP", hotpCounter: 0, algorithm: "SHA1", digits: 6, periodSeconds: 30, loginUrl: "", note: "", favorite: false, sensitivityLevel: "STANDARD" };
const defaultPrefs: VaultPrefs = { masked: false, compact: true, grouped: true, showShared: true, autoRefresh: true, autoLockMinutes: 5, stepUpEnabled: false, securityAlerts: true, theme: "system" };
type ScannedCredential = Partial<typeof emptyCredential>;
type ScannedPayload = { items: ScannedCredential[]; batchSize: number; batchIndex: number; batchId: string };

function parseOtpPayload(raw: string): ScannedPayload {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error("二维码内容不是有效的 OTP 地址"); }
  if (url.protocol === "otpauth:") return { items: [parseOtpUrl(url)], batchSize: 1, batchIndex: 0, batchId: "" };
  if (url.protocol === "otpauth-migration:") return parseGoogleMigration(url);
  throw new Error("仅支持 Google Authenticator 或标准 OTP 二维码");
}

function parseOtpUrl(url: URL): ScannedCredential {
	const host = url.hostname.toLowerCase();
	if (host !== "totp" && host !== "hotp") throw new Error("仅支持 TOTP 或 HOTP");
  const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const colon = label.indexOf(":");
  const issuer = (url.searchParams.get("issuer") || (colon >= 0 ? label.slice(0, colon) : "") || "未分类").trim();
  const accountName = (colon >= 0 ? label.slice(colon + 1) : label).trim();
  const otpSecret = normalizeScannedSecret(url.searchParams.get("secret") || "");
  if (!accountName) throw new Error("二维码缺少账号名称");
  const algorithm = normalizeScannedAlgorithm(url.searchParams.get("algorithm"));
  const digitsValue = Number(url.searchParams.get("digits") || 6);
  const periodValue = Number(url.searchParams.get("period") || 30);
	const otpType = host === "hotp" ? "HOTP" : issuer.toLowerCase() === "steam" ? "STEAM" : "TOTP";
	return { issuer: issuer.slice(0, 80), accountName: accountName.slice(0, 160), otpSecret, otpType, hotpCounter: Math.max(0, Number(url.searchParams.get("counter") || 0)), algorithm, digits: otpType === "STEAM" ? 5 : digitsValue === 8 ? 8 : 6, periodSeconds: periodValue >= 15 && periodValue <= 120 ? periodValue : 30 };
}

function parseGoogleMigration(url: URL): ScannedPayload {
  const encoded = url.searchParams.get("data");
  if (!encoded) throw new Error("Google Authenticator 导出码缺少数据");
  const normalized = encoded.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
  let binary: string;
  try { binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")); }
  catch { throw new Error("Google Authenticator 导出数据无效"); }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const entries: Uint8Array[] = [];
  let batchSize = 1, batchIndex = 0, batchId = "";
  readProtoFields(bytes, (field, wire, value) => {
    if (field === 1 && wire === 2 && value instanceof Uint8Array) entries.push(value);
    else if (field === 3 && wire === 0 && typeof value === "number") batchSize = value;
    else if (field === 4 && wire === 0 && typeof value === "number") batchIndex = value;
    else if (field === 5 && wire === 0 && typeof value === "number") batchId = String(value);
  });
  if (!entries.length) throw new Error("二维码中没有可用的验证器账号");

  const items = entries.map((entry) => {
    let secret: Uint8Array = new Uint8Array(0), name = "", issuer = "", algorithmValue = 1, digitsValue = 1, typeValue = 2;
    readProtoFields(entry, (field, wire, value) => {
      if (field === 1 && wire === 2 && value instanceof Uint8Array) secret = value;
      else if (field === 2 && wire === 2 && value instanceof Uint8Array) name = new TextDecoder().decode(value);
      else if (field === 3 && wire === 2 && value instanceof Uint8Array) issuer = new TextDecoder().decode(value);
      else if (field === 4 && wire === 0 && typeof value === "number") algorithmValue = value;
      else if (field === 5 && wire === 0 && typeof value === "number") digitsValue = value;
      else if (field === 6 && wire === 0 && typeof value === "number") typeValue = value;
    });
		if (!secret.length) throw new Error("Google Authenticator 数据缺少 Secret");
    const colon = name.indexOf(":");
    if (!issuer && colon >= 0) issuer = name.slice(0, colon);
    const accountName = (colon >= 0 ? name.slice(colon + 1) : name).trim();
    if (!accountName) throw new Error("Google Authenticator 数据缺少账号名称");
    return {
      issuer: (issuer.trim() || "未分类").slice(0, 80), accountName: accountName.slice(0, 160),
			otpSecret: toBase32(secret), otpType: typeValue === 1 ? "HOTP" : "TOTP", hotpCounter: 0,
			algorithm: algorithmValue === 2 ? "SHA256" : algorithmValue === 3 ? "SHA512" : "SHA1",
			digits: digitsValue === 2 ? 8 : 6, periodSeconds: 30,
    };
  });
  return { items, batchSize: Math.max(1, batchSize), batchIndex: Math.max(0, batchIndex), batchId };
}

function readProtoFields(bytes: Uint8Array, visit: (field: number, wire: number, value: number | Uint8Array) => void) {
  const state = { offset: 0 };
  while (state.offset < bytes.length) {
    const tag = readVarint(bytes, state), field = Math.floor(tag / 8), wire = tag % 8;
    if (!field) throw new Error("Google Authenticator 数据结构无效");
    if (wire === 0) visit(field, wire, readVarint(bytes, state));
    else if (wire === 2) {
      const length = readVarint(bytes, state), end = state.offset + length;
      if (end > bytes.length) throw new Error("Google Authenticator 数据不完整");
      visit(field, wire, bytes.slice(state.offset, end)); state.offset = end;
    } else if (wire === 1) state.offset += 8;
    else if (wire === 5) state.offset += 4;
    else throw new Error("Google Authenticator 数据类型不受支持");
    if (state.offset > bytes.length) throw new Error("Google Authenticator 数据不完整");
  }
}

function readVarint(bytes: Uint8Array, state: { offset: number }) {
  let value = 0, shift = 0;
  while (state.offset < bytes.length && shift <= 56) {
    const byte = bytes[state.offset++]; value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return value;
    shift += 7;
  }
  throw new Error("Google Authenticator 数据不完整");
}

function toBase32(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let output = "", value = 0, bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function normalizeScannedSecret(value: string) {
  const secret = value.replace(/[\s=-]/g, "").toUpperCase();
  if (!secret || !/^[A-Z2-7]+$/.test(secret)) throw new Error("OTP Secret 不是有效的 Base32 数据");
  return secret;
}

function normalizeScannedAlgorithm(value: string | null) {
  const algorithm = (value || "SHA1").replace(/-/g, "").toUpperCase();
  return algorithm === "SHA256" || algorithm === "SHA512" ? algorithm : "SHA1";
}

async function hydrateClientCredential(item: VaultCredential, key: CryptoKey | null) {
  if (!item.zeroKnowledge || !key) return item;
  const next = { ...item };
  if (item.clientPasswordCiphertext) next.password = await decryptZeroKnowledgeValue(item.clientPasswordCiphertext, key);
  if (item.clientOtpSecretCiphertext) {
    const otpSecret = await decryptZeroKnowledgeValue(item.clientOtpSecretCiphertext, key);
    next.currentOtp = await generateOfflineCode({ ...item, otpSecret });
    next.otpValidUntil = item.otpType === "HOTP" ? 0 : (Math.floor(Date.now() / 1000 / (item.periodSeconds || 30)) + 1) * (item.periodSeconds || 30) * 1000;
  }
  return next;
}

async function decodeQrsWithCanvas(source: CanvasImageSource) {
  const decode = await loadJsQR();
  const size = source as { width?: number; height?: number; displayWidth?: number; displayHeight?: number };
  const width = source instanceof HTMLVideoElement ? source.videoWidth : Number(size.width || size.displayWidth);
  const height = source instanceof HTMLVideoElement ? source.videoHeight : Number(size.height || size.displayHeight);
  if (!width || !height) return [];
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(source, 0, 0, width, height);
  const found: string[] = [];
  for (let i = 0; i < 20; i++) {
    const image = context.getImageData(0, 0, width, height);
    const code = decode(image.data, width, height, { inversionAttempts: "attemptBoth" });
    if (!code?.data || found.includes(code.data)) break;
    found.push(code.data);
    const points = [code.location.topLeftCorner, code.location.topRightCorner, code.location.bottomRightCorner, code.location.bottomLeftCorner];
    context.save();
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.closePath();
    context.lineWidth = Math.max(width, height) * 0.04;
    context.strokeStyle = "#fff";
    context.fillStyle = "#fff";
    context.stroke();
    context.fill();
    context.restore();
  }
  return found;
}

export default function OtpVaultWorkspace({ onLogout, accountName, accountEmail, onAccountNameChange }: { onLogout: () => void; accountName: string; accountEmail: string; onAccountNameChange: (name: string) => void }) {
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [shares, setShares] = useState<VaultShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<VaultView>("all");
  const [issuer, setIssuer] = useState("");
  const [sort, setSort] = useState(() => localStorage.getItem(SORT_KEY) || "name");
  const [filtersOpen, setFiltersOpen] = useState(false);
	const [prefs, setPrefs] = useState<VaultPrefs>(() => { try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem("handy-vault-prefs") || "{}") }; } catch { return defaultPrefs; } });
	const [zeroKnowledgeKey, setZeroKnowledgeKey] = useState<CryptoKey | null>(null);
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState<Modal>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<VaultCredential | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VaultCredential | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<{ share: VaultShare; from: "list" | "detail" } | null>(null);
  const [pendingShareDelete, setPendingShareDelete] = useState<VaultShare | null>(null);
  const [pendingSync, setPendingSync] = useState<{ id: number; issuer: string; accountName: string; count: number } | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [shareDetail, setShareDetail] = useState<VaultShare | null>(null);
  const [shareDetailLoading, setShareDetailLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({ ...emptyCredential });
  const [scanText, setScanText] = useState("");
  const [scanError, setScanError] = useState("");
  const [legacyText, setLegacyText] = useState("");
	const [selected, setSelected] = useState<number[]>([]);
	const [sharePickerOpen, setSharePickerOpen] = useState(false);
	const [shareForm, setShareForm] = useState({ name: "", shareMode: "LINK", recipientUsername: "", durationSeconds: 86400, accessCodeEnabled: true, accessCodeMode: "AUTO", accessCode: "", showAccount: true, showPassword: true, showOtp: true, showLoginUrl: true, showNote: true, allowCopy: true, oneTime: false, maxAccessCount: "" });
	const [recipients, setRecipients] = useState<VaultRecipient[]>([]);
	const [recipientLoading, setRecipientLoading] = useState(false);
	const [created, setCreated] = useState<{ name?: string; shareMode: "LINK" | "DIRECT"; recipientUsername?: string; shareUrl?: string; accessCode?: string; autoFillAllowed: boolean; expireTime: string } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [concealOtp, setConcealOtp] = useState(concealOtpEnabled);
  const [revealedOtp, setRevealedOtp] = useState<number | null>(null);
  const [lastUsed, setLastUsed] = useState(readLastUsed);
  const otpRefreshAt = useRef(0);
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef(0);
  const scanBatchRef = useRef(new Map<string, { total: number; parts: Map<number, ScannedCredential[]> }>());
  const modalOpen = modal !== null;

  const notify = (text: string, error = false) => { setNotice({ text, error }); window.setTimeout(() => setNotice(null), 3200); };
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [credentialResult, shareResult] = await Promise.all([listVaultCredentials(), listVaultShares()]);
			setCredentials(await Promise.all((credentialResult.data || []).map((item) => hydrateClientCredential(item, zeroKnowledgeKey))));
      setShares(shareResult.data || []);
    } catch (error) { notify(error instanceof Error ? error.message : "加载失败", true); }
    finally { if (!quiet) setLoading(false); }
	  }, [zeroKnowledgeKey]);
  useEffect(() => { void load(); void getVaultPreferences().then((result) => {
    const next = { ...defaultPrefs, ...(result.data || {}) };
    setPrefs(next);
    setThemePreference(next.theme || "system");
  }).catch(() => undefined); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
	useEffect(() => { if (!prefs.autoRefresh) return; const timer = window.setInterval(() => void load(true), 10_000); return () => window.clearInterval(timer); }, [load, prefs.autoRefresh]);
	useEffect(() => {
		const keyword = shareForm.recipientUsername.trim();
		if (modal !== "share" || shareForm.shareMode !== "DIRECT" || keyword.length < 2) {
			setRecipients([]);
			setRecipientLoading(false);
			return;
		}
		let cancelled = false;
		setRecipientLoading(true);
		const timer = window.setTimeout(() => {
			void listVaultRecipients(keyword)
				.then((result) => { if (!cancelled) setRecipients(result.data || []); })
				.catch(() => { if (!cancelled) setRecipients([]); })
				.finally(() => { if (!cancelled) setRecipientLoading(false); });
		}, 220);
		return () => { cancelled = true; window.clearTimeout(timer); };
  }, [modal, shareForm.recipientUsername, shareForm.shareMode]);
	useEffect(() => {
		if (!modalOpen) return;
		const scrollY = window.scrollY;
		const { body, documentElement } = document;
		const previous = { bodyOverflow: body.style.overflow, bodyPosition: body.style.position, bodyTop: body.style.top, bodyWidth: body.style.width, htmlOverflow: documentElement.style.overflow };
		body.style.overflow = "hidden";
		body.style.position = "fixed";
		body.style.top = `-${scrollY}px`;
		body.style.width = "100%";
		documentElement.style.overflow = "hidden";
		return () => {
			body.style.overflow = previous.bodyOverflow;
			body.style.position = previous.bodyPosition;
			body.style.top = previous.bodyTop;
			body.style.width = previous.bodyWidth;
			documentElement.style.overflow = previous.htmlOverflow;
			window.scrollTo(0, scrollY);
		};
	}, [modalOpen]);
	useEffect(() => {
    if (!credentials.some((item) => item.otpValidUntil && item.otpValidUntil <= now) || now - otpRefreshAt.current < 1000) return;
    otpRefreshAt.current = now;
	    void load(true);
	  }, [credentials, load, now]);
	useEffect(() => { localStorage.setItem("handy-vault-prefs", JSON.stringify(prefs)); }, [prefs]);
	useEffect(() => { localStorage.setItem(SORT_KEY, sort); }, [sort]);
	useEffect(() => {
		let timer = 0;
		const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(clearOtpStepUpToken, Math.max(1, prefs.autoLockMinutes) * 60_000); };
		const events = ["pointerdown", "keydown", "touchstart"] as const;
		events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
		const visibility = () => { if (document.hidden) clearOtpStepUpToken(); else reset(); };
		document.addEventListener("visibilitychange", visibility); reset();
		return () => { window.clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, reset)); document.removeEventListener("visibilitychange", visibility); };
	}, [prefs.autoLockMinutes]);
  useEffect(() => () => stopScanner(), []);

	const updatePrefs = async (next: VaultPrefs) => {
		if (next.theme) setThemePreference(next.theme);
		setPrefs(next);
		try {
			const result = await saveVaultPreferences(next);
			setPrefs({ ...defaultPrefs, ...(result.data || {}) });
		} catch (error) {
			notify(error instanceof Error ? error.message : "偏好保存失败", true);
			throw error;
		}
	};
	const protectCredential = async (value: Record<string, unknown>) => {
		if (!prefs.zeroKnowledgeEnabled) return value;
		if (!zeroKnowledgeKey) throw new Error("请先到安全中心解锁零知识保护");
		const body = { ...value };
		if (typeof body.password === "string" && body.password) body.clientPasswordCiphertext = await encryptZeroKnowledgeValue(body.password, zeroKnowledgeKey);
		if (typeof body.otpSecret === "string" && body.otpSecret) body.clientOtpSecretCiphertext = await encryptZeroKnowledgeValue(body.otpSecret, zeroKnowledgeKey);
		delete body.password; delete body.otpSecret;
		return body;
	};

  const changeView = (next: VaultView) => {
    setView(next); setFiltersOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const result = credentials.filter((item) => (!value || `${item.issuer} ${item.accountName} ${item.note || ""}`.toLowerCase().includes(value)) && (!issuer || item.issuer === issuer) && (view !== "favorite" || item.favorite) && (prefs.showShared || !item.shared));
    result.sort((a, b) => {
      if (sort === "account") return a.accountName.localeCompare(b.accountName, "zh-CN");
      if (sort === "favorite") return Number(b.favorite) - Number(a.favorite) || a.issuer.localeCompare(b.issuer, "zh-CN");
      if (sort === "recent") return (lastUsed[String(b.id)] || 0) - (lastUsed[String(a.id)] || 0) || a.issuer.localeCompare(b.issuer, "zh-CN");
      if (sort === "newest") return String(b.updateTime || "").localeCompare(String(a.updateTime || "")) || a.issuer.localeCompare(b.issuer, "zh-CN");
      return a.issuer.localeCompare(b.issuer, "zh-CN") || a.accountName.localeCompare(b.accountName, "zh-CN");
    });
    return result;
  }, [credentials, issuer, lastUsed, prefs.showShared, query, sort, view]);
  const issuers = useMemo(() => [...new Set(credentials.map((item) => item.issuer))].sort((a, b) => a.localeCompare(b, "zh-CN")), [credentials]);
  const ownCredentials = useMemo(() => credentials.filter((item) => !item.shared), [credentials]);
  const groups = useMemo(() => prefs.grouped ? [...new Set(filtered.map((item) => item.issuer))].map((name) => [name, filtered.filter((item) => item.issuer === name)] as const) : [["", filtered] as const], [filtered, prefs.grouped]);
  const editingCredential = editingId ? credentials.find((item) => item.id === editingId) : null;

  const stopScanner = () => {
    window.cancelAnimationFrame(scanFrameRef.current);
    scanStreamRef.current?.getTracks().forEach((track) => track.stop());
    scanStreamRef.current = null;
  };
  const closeModal = () => { if (!busy) { stopScanner(); setModal(null); } };
  const openCredential = (item?: VaultCredential) => {
    setEditingId(item?.id || null);
		setForm(item ? { issuer: item.issuer, accountName: item.accountName, otpSecret: "", password: "", otpType: item.otpType || "TOTP", hotpCounter: item.hotpCounter || 0, algorithm: item.algorithm || "SHA1", digits: item.digits || 6, periodSeconds: item.periodSeconds || 30, loginUrl: item.loginUrl || "", note: item.note || "", favorite: item.favorite, sensitivityLevel: item.sensitivityLevel || "STANDARD" } : { ...emptyCredential });
    setModal("credential");
  };
  const importScannedItems = async (items: ScannedCredential[]) => {
    if (!items.length) throw new Error("二维码中没有可导入的验证器数据");
    setBusy(true);
    try {
	      await Promise.all(items.map(async (item) => saveVaultCredential(null, await protectCredential({ ...emptyCredential, ...item }))));
      scanBatchRef.current.clear();
      stopScanner(); setScanText(""); setScanError(""); setModal(null);
      notify(`已批量导入 ${items.length} 条验证器数据`);
      await load(true);
    } finally {
      setBusy(false);
    }
  };
  const applyScannedCredential = async (raw: string, forceImport = false) => {
    const parsed = parseOtpPayload(raw);
    if (!forceImport && parsed.batchSize === 1 && parsed.items.length === 1) {
      setForm((current) => ({ ...current, ...parsed.items[0] }));
      stopScanner(); setScanText(""); setScanError(""); setModal("credential");
      notify("二维码识别成功，请确认后保存");
      return;
    }
    await importScannedItems(parsed.items);
  };
  const applyScannedPayloads = async (raws: string[]) => {
    const unique = [...new Set(raws.map((item) => item.trim()).filter(Boolean))];
    const payloads = unique.map(parseOtpPayload);
    if (payloads.length === 1 && payloads[0].batchSize === 1 && payloads[0].items.length === 1) return applyScannedCredential(unique[0]);
    const standalone = payloads.filter((payload) => payload.batchSize === 1).flatMap((payload) => payload.items);
    const batches = payloads.filter((payload) => payload.batchSize > 1);
    if (!batches.length) return importScannedItems(standalone);
    const ready: ScannedCredential[] = [];
    for (const payload of batches) {
      const key = payload.batchId || "default";
      const batch = scanBatchRef.current.get(key) || { total: payload.batchSize, parts: new Map<number, ScannedCredential[]>() };
      batch.total = Math.max(batch.total, payload.batchSize);
      batch.parts.set(payload.batchIndex, payload.items);
      scanBatchRef.current.set(key, batch);
      if (batch.parts.size >= batch.total) {
        ready.push(...[...batch.parts.entries()].sort(([a], [b]) => a - b).flatMap(([, items]) => items));
        scanBatchRef.current.delete(key);
      }
    }
    if (standalone.length || ready.length) return importScannedItems([...standalone, ...ready]);
    const first = scanBatchRef.current.values().next().value as { total: number; parts: Map<number, ScannedCredential[]> } | undefined;
    setScanError(first ? `已识别 ${first.parts.size}/${first.total} 张批量二维码，请继续扫描剩余二维码` : "");
  };
  const openScanner = async () => {
    stopScanner(); scanBatchRef.current.clear(); setScanText(""); setScanError(""); setModal("scanner");
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("当前浏览器不支持实时扫码，请拍照或选择二维码图片");
      return;
    }
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      scanStreamRef.current = stream;
      const video = scanVideoRef.current;
      if (!video) throw new Error("相机画面初始化失败");
      video.srcObject = stream; await video.play();
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const scan = async () => {
        if (!scanStreamRef.current || !scanVideoRef.current) return;
        try {
          const result = detector ? await detector.detect(scanVideoRef.current) : [];
          const raws = [...new Set([...result.map((item) => item.rawValue).filter(Boolean), ...(await decodeQrsWithCanvas(scanVideoRef.current))])];
          if (raws.length) return void applyScannedPayloads(raws).catch((error) => setScanError(error instanceof Error ? error.message : "二维码内容无效"));
        } catch { /* keep scanning */ }
        scanFrameRef.current = window.requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch (error) {
      stopScanner(); setScanError(error instanceof Error ? error.message : "无法打开系统相机");
    }
  };
  const scanImage = async (file?: File) => {
    if (!file) return;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    try {
      const bitmap = await createImageBitmap(file);
      const result = Detector ? await new Detector({ formats: ["qr_code"] }).detect(bitmap).catch(() => []) : [];
      const raws = [...new Set([...result.map((item) => item.rawValue).filter(Boolean), ...(await decodeQrsWithCanvas(bitmap))])];
      bitmap.close();
      if (!raws.length) throw new Error("图片中没有识别到二维码");
      await applyScannedPayloads(raws);
    } catch (error) { setScanError(error instanceof Error ? error.message : "二维码图片识别失败"); }
  };
  const openDetail = async (item: VaultCredential) => {
    setModal("detail"); setDetail(null); setDetailLoading(true); setPasswordVisible(false);
	    try { setDetail(await hydrateClientCredential((await getVaultCredential(item.id)).data, zeroKnowledgeKey)); }
    catch (error) { setModal(null); notify(error instanceof Error ? error.message : "详情加载失败", true); }
    finally { setDetailLoading(false); }
  };
  async function submitCredential(event: FormEvent) {
    event.preventDefault();
    const issuerName = form.issuer.trim().toLowerCase();
    const account = form.accountName.trim().toLowerCase();
    const duplicate = ownCredentials.find((item) => item.id !== editingId && item.issuer.trim().toLowerCase() === issuerName && item.accountName.trim().toLowerCase() === account);
    if (duplicate) return notify("已存在相同系统和账号的凭据", true);
    setBusy(true);
    try {
      const result = await saveVaultCredential(editingId, await protectCredential(form));
      if (editingId && (result.data.activeShareCount || 0) > 0) {
        setPendingSync({ id: editingId, issuer: form.issuer, accountName: form.accountName, count: result.data.activeShareCount || 0 });
        setModal("syncShares");
        await load(true);
        return;
      }
      notify(editingId ? "凭据已更新" : "凭据已添加"); setModal(null); await load(true);
    }
    catch (error) { notify(error instanceof Error ? error.message : "保存失败", true); }
    finally { setBusy(false); }
  }
  async function removeCredential() {
    if (!pendingDelete) return;
    setBusy(true);
    try { await deleteVaultCredential(pendingDelete.id); notify("凭据已删除，相关授权已撤回"); setPendingDelete(null); setModal(null); await load(true); } catch (error) { notify(error instanceof Error ? error.message : "删除失败", true); }
    finally { setBusy(false); }
  }
  async function confirmRevoke() {
    if (!pendingRevoke) return;
    setBusy(true);
    try { await revokeVaultShare(pendingRevoke.share.id); notify("授权已撤销"); setPendingRevoke(null); setShareDetail(null); setModal(null); await load(true); }
    catch (error) { notify(error instanceof Error ? error.message : "撤销失败", true); }
    finally { setBusy(false); }
  }
	async function confirmShareDelete() {
		if (!pendingShareDelete) return;
		setBusy(true);
		try { await deleteVaultShare(pendingShareDelete.id); notify("授权记录已删除"); setPendingShareDelete(null); setShareDetail(null); setModal(null); await load(true); }
		catch (error) { notify(error instanceof Error ? error.message : "删除失败", true); }
		finally { setBusy(false); }
	}
  const cancelRevoke = () => {
    if (busy) return;
    const from = pendingRevoke?.from;
    setPendingRevoke(null);
    setModal(from === "detail" ? "shareDetail" : null);
  }
  async function toggleFavorite(item: VaultCredential) {
    try { await saveVaultCredential(item.id, { issuer: item.issuer, accountName: item.accountName, favorite: !item.favorite, loginUrl: item.loginUrl, note: item.note, sensitivityLevel: item.sensitivityLevel }); await load(true); }
    catch (error) { notify(error instanceof Error ? error.message : "更新失败", true); }
  }
  async function advanceHotp(id: number) {
    setBusy(true);
    try {
			const current = credentials.find((item) => item.id === id);
			const result = current?.zeroKnowledge
				? await saveVaultCredential(id, { issuer: current.issuer, accountName: current.accountName, hotpCounter: (current.hotpCounter || 0) + 1, favorite: current.favorite, loginUrl: current.loginUrl, note: current.note, sensitivityLevel: current.sensitivityLevel })
				: await nextVaultHotp(id);
			const hydrated = await hydrateClientCredential(result.data, zeroKnowledgeKey);
	      setDetail(hydrated);
	      setCredentials((items) => items.map((item) => item.id === id ? hydrated : item));
      notify("已生成下一个 HOTP 验证码");
    } catch (error) { notify(error instanceof Error ? error.message : "生成失败", true); }
    finally { setBusy(false); }
  }
  async function submitImport(event: FormEvent) {
    event.preventDefault(); if (!legacyText) return notify("请选择导入文件", true);
    setBusy(true);
    try {
      const result = await importLegacyVault(legacyText);
      notify(`已导入 ${result.data.total} 项到 ${result.data.ownerUsername}`); setModal(null); setLegacyText(""); await load(true);
    } catch (error) { notify(error instanceof Error ? error.message : "导入失败", true); }
    finally { setBusy(false); }
  }
  const openShare = (credentialId?: number) => { setSelected(credentialId ? [credentialId] : []); setSharePickerOpen(!credentialId); setShareForm((current) => ({ ...current, name: "" })); setModal("share"); };
  const openShareDetail = async (share: VaultShare) => {
    setModal("shareDetail"); setShareDetail(null); setShareDetailLoading(true);
    try { setShareDetail((await getVaultShare(share.id)).data); }
    catch (error) { setModal(null); notify(error instanceof Error ? error.message : "授权详情加载失败", true); }
    finally { setShareDetailLoading(false); }
  };
	const openShareEdit = async (share: VaultShare) => {
		setShareDetailLoading(true);
		try {
			const detail = (await getVaultShare(share.id)).data;
			const days = Math.max(1, Math.ceil((new Date(normalizeDateTime(detail.expireTime)).getTime() - Date.now()) / 86400000));
			setShareDetail(detail); setSelected(detail.credentialIds || []); setSharePickerOpen(false);
			setShareForm((current) => ({ ...current, name: detail.name || "", shareMode: detail.shareMode, recipientUsername: detail.recipientUsername || "", durationSeconds: days * 86400, accessCodeEnabled: detail.accessCodeEnabled, accessCodeMode: "CUSTOM", accessCode: detail.accessCode || "", showAccount: detail.showAccount, showPassword: detail.showPassword, showOtp: detail.showOtp, showLoginUrl: detail.showLoginUrl, showNote: detail.showNote, allowCopy: detail.allowCopy, oneTime: detail.oneTime, maxAccessCount: detail.maxAccessCount ? String(detail.maxAccessCount) : "" }));
			setModal("shareEdit");
		} catch (error) { notify(error instanceof Error ? error.message : "授权详情加载失败", true); }
		finally { setShareDetailLoading(false); }
	};
  async function submitShare(event: FormEvent) {
    event.preventDefault(); if (!selected.length) return notify("至少选择一个凭据", true);
    if (shareForm.shareMode === "DIRECT" && !shareForm.recipientUsername.trim()) return notify("请输入接收人账号", true);
    setBusy(true);
    try {
      const result = await createVaultShare({ ...shareForm, credentialIds: selected, maxAccessCount: shareForm.maxAccessCount ? Number(shareForm.maxAccessCount) : null });
      setCreated(result.data); setModal("created"); await load(true);
    } catch (error) { notify(error instanceof Error ? error.message : "创建授权失败", true); }
    finally { setBusy(false); }
  }
	async function submitShareEdit(event: FormEvent) {
		event.preventDefault(); if (!shareDetail || !selected.length) return notify("至少选择一个凭据", true);
		setBusy(true);
		try {
			const result = await updateVaultShare(shareDetail.id, { name: shareForm.name, credentialIds: selected, durationSeconds: shareForm.durationSeconds, showAccount: shareForm.showAccount, showPassword: shareForm.showPassword, showOtp: shareForm.showOtp, showLoginUrl: shareForm.showLoginUrl, showNote: shareForm.showNote, allowCopy: shareForm.allowCopy, oneTime: shareForm.oneTime, maxAccessCount: shareForm.maxAccessCount ? Number(shareForm.maxAccessCount) : null });
			setShareDetail(result.data); setModal("shareDetail"); notify("授权已更新"); await load(true);
		} catch (error) { notify(error instanceof Error ? error.message : "更新授权失败", true); }
		finally { setBusy(false); }
	}
  const copy = async (value: string, message = "已复制") => {
    await navigator.clipboard.writeText(value);
    notify(message);
    window.clearTimeout((copy as { timer?: number }).timer);
    (copy as { timer?: number }).timer = window.setTimeout(() => {
      void navigator.clipboard.readText().then((current) => { if (current === value) return navigator.clipboard.writeText(""); }).catch(() => undefined);
    }, CLIPBOARD_CLEAR_MS);
  };
  const copyOtp = async (item: VaultCredential) => {
    if (!item.currentOtp || (item.shared && !item.allowCopy)) return;
    setLastUsed((current) => {
      const next = { ...current, [String(item.id)]: Date.now() };
      localStorage.setItem(LAST_USED_KEY, JSON.stringify(next));
      return next;
    });
    setRevealedOtp(item.id);
    await copy(item.currentOtp, "验证码已复制");
  };
  const shareOrCopy = async (text: string) => {
    if (canUseSystemShare()) {
      try { await navigator.share({ title: "OTP Vault 授权", text }); return; }
      catch (error) { if (error instanceof Error && error.name === "AbortError") return; }
    }
    await copy(text, "完整分享信息已复制");
  };
  const copyShareInfo = async (share: VaultShare) => {
    let detail = share;
    if (share.accessCodeEnabled && !share.accessCode) {
      try { detail = (await getVaultShare(share.id)).data; }
      catch (error) { notify(error instanceof Error ? error.message : "复制失败", true); return; }
    }
    const text = formatShareText(detail);
    await shareOrCopy(text);
  };
  const accountClass = prefs.masked ? "vault-account is-blurred" : "vault-account";
  const renderCredential = (item: VaultCredential) => {
    const left = item.otpValidUntil ? Math.max(0, Math.ceil((item.otpValidUntil - now) / 1000)) : 0;
    const progress = item.periodSeconds ? Math.max(0, Math.min(100, left / item.periodSeconds * 100)) : 0;
    const mark = issuerStyle(item.issuer, item.loginUrl);
    const concealed = concealOtp && revealedOtp !== item.id;
    const otpLabel = item.currentOtp ? item.currentOtp.replace(/(.{3})/, "$1 ") : "";
    return <article className={`vault-card${prefs.compact ? " is-compact" : ""}${item.shared ? " is-shared" : ""}`} key={item.id} role="button" tabIndex={0} onClick={() => void openDetail(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openDetail(item); } }}>
      <div className="vault-card-top"><span className="vault-service-mark" style={{ background: mark.background }}>{mark.letters}</span><div><b>{item.issuer}</b><small className={accountClass}>{item.accountName}</small></div>{item.shared ? <span className="vault-shared-badge">共享</span> : <button type="button" className={item.favorite ? "is-favorite" : ""} onClick={(event) => { event.stopPropagation(); void toggleFavorite(item); }} aria-label={item.favorite ? "取消收藏" : "收藏"}><Star size={16} fill={item.favorite ? "currentColor" : "none"} /></button>}</div>
      {item.requiresStepUp ? <button type="button" className="vault-no-code vault-unlock-code" onClick={(event) => { event.stopPropagation(); void openDetail(item); }}><LockKeyhole size={16} />验证身份后查看</button> : item.currentOtp ? item.shared && !item.allowCopy ? <div className="vault-code is-readonly"><span>{concealed ? "••• •••" : otpLabel}</span></div> : <button type="button" className={`vault-code${concealed ? " is-concealed" : ""}`} onClick={(event) => { event.stopPropagation(); void copyOtp(item); }}><span>{concealed ? "••• •••" : otpLabel}</span>{concealed ? <small>点按显示并复制</small> : <Copy size={15} />}</button> : <div className="vault-no-code"><KeyRound size={16} />{item.shared ? "共享账号密码" : "已保存账号密码"}</div>}
      <div className="vault-progress"><i style={{ width: `${progress}%` }} /></div><div className="vault-card-foot"><span>{item.shared ? `来自 ${item.sharedBy}` : `${item.otpType || "TOTP"} · ${item.algorithm} · ${item.digits} 位`}</span><span>{item.shared && item.shareExpireTime ? formatRemaining(item.shareExpireTime, now) : item.requiresStepUp ? "已锁定" : item.otpType === "HOTP" ? `计数 ${item.hotpCounter || 0}` : item.currentOtp ? `${left}s` : "无 OTP"}</span></div>
      <div className="vault-card-actions"><button type="button" onClick={(event) => { event.stopPropagation(); void openDetail(item); }} aria-label="查看"><Eye size={13} /><span>查看</span></button>{!item.shared ? <><button type="button" className={`vault-compact-favorite${item.favorite ? " is-favorite" : ""}`} onClick={(event) => { event.stopPropagation(); void toggleFavorite(item); }} aria-label={item.favorite ? "取消收藏" : "收藏"}><Star size={13} fill={item.favorite ? "currentColor" : "none"} /><span>收藏</span></button><button type="button" onClick={(event) => { event.stopPropagation(); openShare(item.id); }} aria-label="分享"><Share2 size={13} /><span>分享</span></button><button type="button" onClick={(event) => { event.stopPropagation(); openCredential(item); }} aria-label="编辑"><Pencil size={13} /><span>编辑</span></button><button type="button" onClick={(event) => { event.stopPropagation(); setPendingDelete(item); setModal("deleteConfirm"); }} aria-label="删除"><Trash2 size={13} /><span>删除</span></button></> : <span className="vault-shared-expiry"><Clock3 size={12} />{item.shareExpireTime ? `有效至 ${new Date(normalizeDateTime(item.shareExpireTime)).toLocaleDateString("zh-CN")}` : "临时共享"}</span>}</div>
    </article>;
  };
  const liveDetail = detail ? { ...detail, ...(credentials.find((item) => item.id === detail.id) || {}), password: detail.password } : null;
  const selectedCredentials = ownCredentials.filter((item) => selected.includes(item.id));
  const autoFillUrl = created?.shareUrl && created.accessCode ? `${created.shareUrl}#k=${created.accessCode}` : created?.shareUrl || "";
  const fullShareText = created ? formatShareText(created) : "";

  return <div className="vault-page">
    <section className="vault-head">
      <div className="vault-brand"><span className="vault-brand-mark"><KeyRound size={20} /></span><div><span className="vault-kicker">PRIVATE VAULT</span><h1>OTP Vault</h1><p>你的私人身份保险库</p></div></div>
      <div className="vault-head-actions"><div className="vault-theme-wrap"><button type="button" className="vault-ghost vault-guide-action" onClick={() => setThemeMenuOpen(!themeMenuOpen)} aria-label="外观">{prefs.theme === "dark" ? <Moon size={18} /> : prefs.theme === "light" ? <Sun size={18} /> : <SunMoon size={18} />}<span>外观</span></button>{themeMenuOpen ? <div className="vault-theme-menu">{([["system", "跟随系统", SunMoon], ["light", "亮色", Sun], ["dark", "暗色", Moon]] as const).map(([value, label, Icon]) => <button type="button" key={value} className={prefs.theme === value ? "is-active" : ""} onClick={() => { void updatePrefs({ ...prefs, theme: value }); setThemeMenuOpen(false); }}><Icon size={15} />{label}</button>)}</div> : null}</div><a className="vault-ghost vault-guide-action" href={APP_ROUTES.otpGuide} aria-label="打开使用指南"><BookOpen size={18} /><span>指南</span></a><button type="button" className="vault-ghost vault-import-action" onClick={() => { setLegacyText(""); setModal("import"); }} aria-label="导入文件"><FileUp size={20} /><span>导入</span></button><button type="button" className="vault-primary vault-add-action" onClick={() => openCredential()} aria-label="添加凭据"><Plus size={21} /><span>添加</span></button><button type="button" className="vault-ghost vault-logout" onClick={onLogout} aria-label="退出登录"><LogOut size={13} /><span>退出</span></button></div>
    </section>

    <nav className="vault-tabs" aria-label="密钥管理导航">
      {([['all', KeyRound, '全部'], ['favorite', Star, '收藏'], ['shares', Link2, '授权'], ['security', ShieldCheck, '安全'], ['settings', Settings2, '设置']] as const).map(([key, Icon, label]) => <button type="button" className={view === key ? "is-active" : ""} onClick={() => changeView(key)} key={key}><Icon size={15} />{label}</button>)}
    </nav>

    {view === "all" || view === "favorite" ? <section className="vault-panel">
      <header className="vault-panel-head"><div><h2>{view === "favorite" ? "收藏" : "验证码"}</h2><p>点开卡片查看账号、密码和更多信息</p></div><div className="vault-panel-tools"><label className="vault-view-toggle"><Layers3 size={14} /><span>分组</span><input type="checkbox" checked={prefs.grouped} onChange={(event) => void updatePrefs({ ...prefs, grouped: event.target.checked })} /><i /></label><label className="vault-view-toggle"><LayoutGrid size={14} /><span>紧凑</span><input type="checkbox" checked={prefs.compact} onChange={(event) => void updatePrefs({ ...prefs, compact: event.target.checked })} /><i /></label><div className="vault-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务或账号" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="清空搜索"><X size={14} /></button> : null}<button type="button" className="vault-filter-trigger" onClick={() => setFiltersOpen(!filtersOpen)} aria-label="筛选"><Settings2 size={15} /></button></div></div></header>
      <div className={`vault-filters${filtersOpen ? " is-open" : ""}`}><label><span>系统</span><select value={issuer} onChange={(event) => setIssuer(event.target.value)}><option value="">全部系统</option>{issuers.map((name) => <option value={name} key={name}>{name}</option>)}</select></label><label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">系统名称</option><option value="account">账号名称</option><option value="favorite">收藏优先</option><option value="recent">最近使用</option><option value="newest">最近添加</option></select></label>{issuer ? <button type="button" onClick={() => setIssuer("")}>清除筛选</button> : null}</div>
      {loading ? <div className="vault-empty"><LoaderCircle className="spin" size={24} />正在加载安全数据…</div> : filtered.length ? <div className="vault-groups">{groups.map(([name, items]) => <section className="vault-group" key={name || "all"}>{name ? <header><b>{name}</b><span>{items.length}</span></header> : null}<div className={`vault-grid${prefs.compact ? " is-compact" : ""}`}>{items.map(renderCredential)}</div></section>)}</div> : <div className="vault-empty"><KeyRound size={28} /><b>{view === "favorite" ? "还没有收藏凭据" : "没有找到凭据"}</b><p>{view === "favorite" ? "点击凭据右上角的星标即可收藏。" : "可以添加一项，或导入文件。"}</p></div>}
    </section> : null}

    {view === "shares" ? <section className="vault-panel">
      <header className="vault-panel-head"><div><h2>临时授权</h2><p>链接分享或指定用户，均可随时撤销</p></div><button type="button" className="vault-create-share" onClick={() => openShare()} disabled={!ownCredentials.length} aria-label="创建授权"><Share2 size={14} /><span>创建授权</span></button></header>
      <div className="vault-share-list">{shares.length ? shares.map((share) => <article key={share.id} role="button" tabIndex={0} onClick={() => void openShareDetail(share)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openShareDetail(share); } }}>
        <span className={`vault-status is-${share.status.toLowerCase()}`}>{share.status === "ACTIVE" ? "有效" : share.status === "EXPIRED" ? "已过期" : share.status === "LIMIT_REACHED" ? "次数已用完" : "已撤销"}</span>
        <div><b>{share.name?.trim() || "临时凭据授权"}</b><small><Clock3 size={12} />{share.itemCount} 个凭据 · {share.shareMode === "DIRECT" ? `指定给 ${share.recipientUsername}` : share.accessCodeEnabled ? "访问码保护" : "链接访问"} · {share.status === "ACTIVE" ? `剩余 ${formatRemaining(share.expireTime, now)}` : new Date(normalizeDateTime(share.expireTime)).toLocaleString("zh-CN", { hour12: false })}{share.shareMode === "LINK" ? ` · 已访问 ${share.accessCount}${share.maxAccessCount ? `/${share.maxAccessCount}` : ""}` : ""}</small></div>
        <div className="vault-share-actions"><button type="button" onClick={(event) => { event.stopPropagation(); void openShareDetail(share); }}><Eye size={14} />详情</button>{share.status === "ACTIVE" ? <button type="button" onClick={(event) => { event.stopPropagation(); void openShareEdit(share); }}><Pencil size={14} />编辑</button> : null}{share.status === "ACTIVE" && share.sharePath ? <button type="button" onClick={(event) => { event.stopPropagation(); void copyShareInfo(share); }}><Copy size={14} />复制</button> : null}{share.status !== "REVOKED" ? <button type="button" onClick={(event) => { event.stopPropagation(); setPendingRevoke({ share, from: "list" }); setModal("revokeConfirm"); }}><X size={14} />撤销</button> : <button type="button" onClick={(event) => { event.stopPropagation(); setPendingShareDelete(share); setModal("shareDeleteConfirm"); }}><Trash2 size={14} />删除</button>}</div>
      </article>) : <div className="vault-empty compact">还没有创建临时授权</div>}</div>
    </section> : null}

	    {view === "security" ? <section className="vault-security-page"><VaultSecurityCenter prefs={prefs} updatePrefs={updatePrefs} zeroKnowledgeKey={zeroKnowledgeKey} onZeroKnowledgeKey={setZeroKnowledgeKey} /></section> : null}

    {view === "settings" ? <section className="vault-settings"><header className="vault-panel-head"><div><h2>设置</h2><p>账号资料和显示偏好会跟随当前账号</p></div></header>
      <div className="vault-settings-group"><header><div><b>账号与登录</b><small>分开修改用户名或登录密码</small></div></header>
        <button type="button" className="vault-setting-row is-nav" onClick={() => setModal("username")}><span className="vault-setting-icon is-blue"><User size={17} /></span><span className="vault-setting-copy"><b>用户名</b><small>{accountName || "未设置"}</small></span><ChevronRight size={16} /></button>
        <button type="button" className="vault-setting-row is-nav" onClick={() => setModal("password")}><span className="vault-setting-icon is-violet"><LockKeyhole size={17} /></span><span className="vault-setting-copy"><b>登录密码</b><small>用于账号密码登录</small></span><ChevronRight size={16} /></button>
      </div>
      <div className="vault-settings-group"><header><div><b>外观</b><small>保存在当前账号</small></div></header>
        <div className="vault-theme-options">{([["system", "跟随系统", SunMoon], ["light", "亮色", Sun], ["dark", "暗色", Moon]] as const).map(([value, label, Icon]) => <button type="button" key={value} className={prefs.theme === value ? "is-active" : ""} onClick={() => void updatePrefs({ ...prefs, theme: value })}><Icon size={16} />{label}</button>)}</div>
      </div>
      <div className="vault-settings-group"><header><div><b>界面显示</b><small>验证码与账号列表</small></div><span>6 项</span></header>{([['masked', EyeOff, '隐藏账号', '在列表中遮住账号主体', 'violet'], ['compact', LayoutGrid, '紧凑卡片', '缩小留白，一屏看到更多内容', 'blue'], ['grouped', Layers3, '按系统分组', '将同一系统的凭据排列在一起', 'green'], ['showShared', User, '显示共享', '在全部列表中展示别人分享给我的凭据', 'blue'], ['autoRefresh', Clock3, '自动刷新', '定时同步授权状态和新增共享', 'green']] as const).map(([key, Icon, title, detail, tone]) => <label className="vault-setting-row" key={key}><span className={`vault-setting-icon is-${tone}`}><Icon size={17} /></span><span className="vault-setting-copy"><b>{title}</b><small>{detail}</small></span><input type="checkbox" checked={prefs[key]} onChange={(event) => updatePrefs({ ...prefs, [key]: event.target.checked })} /><i /></label>)}<label className="vault-setting-row"><span className="vault-setting-icon is-violet"><EyeOff size={17} /></span><span className="vault-setting-copy"><b>隐蔽验证码</b><small>列表中先显示掩码，点按后再显示并复制</small></span><input type="checkbox" checked={concealOtp} onChange={(event) => { const next = event.target.checked; setConcealOtp(next); setRevealedOtp(null); localStorage.setItem(CONCEAL_KEY, next ? "1" : "0"); }} /><i /></label></div>
    </section> : null}

    <nav className="vault-mobile-nav" aria-label="密钥管理导航">
      {([['all', KeyRound, '全部'], ['favorite', Star, '收藏'], ['shares', Link2, '授权'], ['security', ShieldCheck, '安全'], ['settings', Settings2, '设置']] as const).map(([key, Icon, label]) => <button type="button" className={view === key ? "is-active" : ""} onClick={() => changeView(key)} key={key}><Icon size={18} /><span>{label}</span></button>)}
    </nav>

    {modal === "detail" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="vault-modal share vault-share-form vault-detail">
      <header><div><small>CREDENTIAL DETAIL</small><h2>凭据详情</h2><p>{liveDetail ? "安全查看账号、密码和动态验证码" : "正在安全读取"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header>
      {detailLoading || !liveDetail ? <div className="vault-share-scroll"><div className="vault-detail-loading"><LoaderCircle className="spin" size={22} />正在安全读取…</div></div> : <>
        <div className="vault-share-scroll">
          <section className="vault-detail-overview"><span className="vault-service-mark" style={{ background: issuerStyle(liveDetail.issuer, liveDetail.loginUrl).background }}>{issuerStyle(liveDetail.issuer, liveDetail.loginUrl).letters}</span><div><small>{liveDetail.shared ? "SHARED CREDENTIAL" : "PRIVATE CREDENTIAL"}</small><b>{liveDetail.issuer}</b><p className={accountClass}>{liveDetail.accountName}</p></div><em>{liveDetail.shared ? "共享" : liveDetail.sensitivityLevel === "CRITICAL" ? "严格保护" : liveDetail.sensitivityLevel === "SENSITIVE" ? "再次验证" : "常规保护"}</em></section>
          <section className="vault-share-section vault-detail-section"><div className="vault-section-title"><div><span>01</span><h3>登录信息</h3></div><small>{liveDetail.shared ? `${liveDetail.sharedBy} 分享 · ${liveDetail.shareExpireTime ? formatRemaining(liveDetail.shareExpireTime, now) : "临时有效"}` : "敏感信息仅在需要时显示"}</small></div><div className="vault-detail-values">
            <section><span>账号</span><div><b>{liveDetail.accountName}</b>{!liveDetail.shared || liveDetail.allowCopy ? <button type="button" onClick={() => void copy(liveDetail.accountName, "账号已复制")} aria-label="复制账号"><Copy size={15} /></button> : null}</div></section>
            {liveDetail.passwordConfigured ? <section><span>密码</span><div><b className={passwordVisible ? "" : "is-secret"}>{passwordVisible ? liveDetail.password : "••••••••••••"}</b><button type="button" onClick={() => setPasswordVisible(!passwordVisible)} aria-label={passwordVisible ? "隐藏密码" : "显示密码"}>{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button>{liveDetail.password && (!liveDetail.shared || liveDetail.allowCopy) ? <button type="button" onClick={() => void copy(liveDetail.password || "", "密码已复制")} aria-label="复制密码"><Copy size={15} /></button> : null}</div></section> : null}
            {liveDetail.currentOtp ? <section className="is-otp"><span>{liveDetail.otpType === "HOTP" ? `HOTP 验证码 · 计数 ${liveDetail.hotpCounter || 0}` : "动态验证码"}</span><div><b>{liveDetail.currentOtp.replace(/(.{3})/, "$1 ")}</b>{!liveDetail.shared || liveDetail.allowCopy ? <button type="button" onClick={() => void copyOtp(liveDetail)} aria-label="复制验证码"><Copy size={15} /></button> : null}{!liveDetail.shared && liveDetail.otpType === "HOTP" ? <button type="button" disabled={busy} onClick={() => void advanceHotp(liveDetail.id)}>下一个</button> : null}</div></section> : null}
          </div></section>
          {liveDetail.loginUrl || liveDetail.note ? <section className="vault-share-section vault-detail-section"><div className="vault-section-title"><div><span>02</span><h3>补充信息</h3></div></div>{liveDetail.loginUrl ? <a className="vault-detail-link" href={liveDetail.loginUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /><span>{liveDetail.loginUrl}</span></a> : null}{liveDetail.note ? <p className="vault-detail-note">{liveDetail.note}</p> : null}</section> : null}
        </div>
        <footer><span>{liveDetail.shared ? "共享凭据只允许查看" : "可继续分享或编辑这条凭据"}</span><div>{liveDetail.shared ? <button type="button" className="vault-primary" onClick={closeModal}>完成</button> : <><button type="button" className="vault-ghost" onClick={() => openShare(liveDetail.id)}><Share2 size={15} />分享</button><button type="button" className="vault-primary" onClick={() => openCredential(liveDetail)}><Pencil size={15} />编辑</button></>}</div></footer>
      </>}
    </section></div> : null}

    {modal === "scanner" ? <div className="vault-modal-mask"><section className="vault-modal share vault-share-form vault-scanner">
      <header><div><small>QR SCANNER</small><h2>扫描验证器二维码</h2><p>支持标准 OTP 二维码和 Google Authenticator 导出码</p></div><button type="button" onClick={() => { stopScanner(); setModal("credential"); }} aria-label="关闭"><X size={18} /></button></header>
      <div className="vault-share-scroll">
        <section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>实时扫描</h3></div></div><div className="vault-scanner-view"><video ref={scanVideoRef} autoPlay muted playsInline /><span><ScanLine size={25} /></span></div><p className="vault-section-help">对准验证器二维码后会自动识别，也可改用图片或粘贴内容。</p></section>
        <section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>图片识别</h3></div></div><div className="vault-scan-files"><label className="vault-file vault-scan-file"><Camera size={19} /><span>拍照识别</span><input type="file" accept="image/*" capture="environment" onChange={(event) => void scanImage(event.target.files?.[0])} /></label><label className="vault-file vault-scan-file"><FileUp size={19} /><span>读取本地图片</span><input type="file" accept="image/*" onChange={(event) => void scanImage(event.target.files?.[0])} /></label></div></section>
        <section className="vault-share-section"><div className="vault-section-title"><div><span>03</span><h3>粘贴内容</h3></div></div><label><span>二维码内容</span><textarea rows={3} value={scanText} onChange={(event) => setScanText(event.target.value)} placeholder="otpauth:// 或 otpauth-migration://" /></label>{scanError ? <p className="vault-scan-error" role="alert">{scanError}</p> : null}</section>
      </div>
      <footer><span>{scanText.trim() ? "内容已准备好，可以开始识别" : "扫描成功后会自动带入凭据"}</span><div><button type="button" className="vault-ghost" onClick={() => { stopScanner(); setModal("credential"); }}>返回</button><button type="button" className="vault-primary" disabled={!scanText.trim() || busy} onClick={() => void applyScannedCredential(scanText).catch((error) => setScanError(error instanceof Error ? error.message : "二维码内容无效"))}>{busy ? "导入中" : "识别内容"}</button></div></footer>
    </section></div> : null}

    {modal === "credential" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><form className="vault-modal share vault-share-form vault-credential-form" onSubmit={submitCredential}>
      <header><div><small>CREDENTIAL</small><h2>{editingId ? "编辑凭据" : "添加凭据"}</h2><p>{editingId ? "调整账号信息；敏感内容留空时保持不变" : "扫码或手动录入验证器数据"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={17} /></button></header>
      <div className="vault-share-scroll">
        {!editingId ? <button type="button" className="vault-scan-entry vault-credential-scan" onClick={() => void openScanner()}><ScanLine size={17} /><span><b>扫描二维码录入</b><small>支持标准 OTP 与 Google Authenticator</small></span></button> : null}
        <section className="vault-share-section vault-credential-section"><div className="vault-section-title"><div><h3>账号信息</h3></div></div><div className="vault-form-grid">
      <label><span>系统名称</span><input required maxLength={80} value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="例如 GitHub" /></label>
      <label><span>账号</span><input required maxLength={160} value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="邮箱或用户名" /></label>
        </div></section>
        <section className="vault-share-section vault-credential-section"><div className="vault-section-title"><div><h3>敏感信息</h3></div></div>{editingCredential ? <div className="vault-maintained-status"><span><ShieldCheck size={14} /><b>已加密保存</b></span><div><em className={editingCredential.otpConfigured ? "is-ready" : ""}>{editingCredential.otpConfigured ? "OTP 密钥" : "无 OTP 密钥"}</em><em className={editingCredential.passwordConfigured ? "is-ready" : ""}>{editingCredential.passwordConfigured ? "登录密码" : "无登录密码"}</em></div><small>输入框留空不会清除原内容</small></div> : null}<div className="vault-form-grid vault-sensitive-fields">
          <label><span>OTP Secret</span><input value={form.otpSecret} onChange={(e) => setForm({ ...form, otpSecret: e.target.value.toUpperCase().replace(/[^A-Z2-7=\s-]/g, "") })} autoComplete="off" placeholder={editingCredential?.otpConfigured ? "已保存，填写可替换" : "Base32 Secret"} /></label>
          <label><span>登录密码（可选）</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" placeholder={editingCredential?.passwordConfigured ? "已保存，填写可替换" : "可保存登录密码"} /></label>
        </div></section>
        <details className="vault-credential-advanced"><summary><span><Settings2 size={15} /><span><b>验证器参数</b><small>{form.otpType} · {form.algorithm} · {form.digits} 位</small></span></span><em>调整</em></summary><div className="vault-form-grid">
          <label><span>验证码类型</span><select value={form.otpType} onChange={(e) => setForm({ ...form, otpType: e.target.value, digits: e.target.value === "STEAM" ? 5 : form.digits === 5 ? 6 : form.digits })}><option value="TOTP">TOTP · 定时刷新</option><option value="HOTP">HOTP · 计数器</option><option value="STEAM">Steam Guard</option></select></label>
          {form.otpType === "HOTP" ? <label><span>HOTP 计数器</span><input type="number" min={0} value={form.hotpCounter} onChange={(e) => setForm({ ...form, hotpCounter: Math.max(0, Number(e.target.value)) })} /></label> : null}
          <label><span>算法</span><select value={form.algorithm} onChange={(e) => setForm({ ...form, algorithm: e.target.value })}><option value="SHA1">SHA1</option><option value="SHA256">SHA256</option><option value="SHA512">SHA512</option></select></label>
          <label><span>验证码位数</span><select disabled={form.otpType === "STEAM"} value={form.digits} onChange={(e) => setForm({ ...form, digits: Number(e.target.value) })}>{form.otpType === "STEAM" ? <option value={5}>5 位</option> : <><option value={6}>6 位</option><option value={8}>8 位</option></>}</select></label>
          {form.otpType !== "HOTP" ? <label><span>更新周期（秒）</span><input type="number" min={15} max={120} value={form.periodSeconds} onChange={(e) => setForm({ ...form, periodSeconds: Number(e.target.value) })} /></label> : null}
        </div></details>
        <details className="vault-credential-advanced"><summary><span><Layers3 size={15} /><span><b>更多信息</b><small>登录地址、备注与查看保护</small></span></span><em>展开</em></summary><div className="vault-form-grid">
          <label className="wide"><span>登录地址</span><input type="url" value={form.loginUrl} onChange={(e) => setForm({ ...form, loginUrl: e.target.value })} placeholder="https://" /></label>
          <label className="wide"><span>备注</span><textarea rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <label><span>查看保护</span><select value={form.sensitivityLevel} onChange={(e) => setForm({ ...form, sensitivityLevel: e.target.value })}><option value="STANDARD">常规 · 登录后可查看</option><option value="SENSITIVE">验证 · 查看前再次验证</option><option value="CRITICAL">严格 · 验证且仅可指定用户</option></select></label>
          <label><span>收藏</span><select value={form.favorite ? "1" : "0"} onChange={(e) => setForm({ ...form, favorite: e.target.value === "1" })}><option value="0">不收藏</option><option value="1">加入收藏</option></select></label>
        </div></details>
      </div>
      <footer><span>{editingId ? "敏感值留空即保持不变" : "确认信息后加密保存"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>取消</button><button className="vault-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{busy ? "保存中" : "保存"}</button></div></footer>
    </form></div> : null}

    {modal === "import" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><form className="vault-modal share vault-share-form vault-import-form" onSubmit={submitImport}><header><div><small>IMPORT</small><h2>导入文件</h2><p>选择文件或直接粘贴文件内容，确认后加密保存到当前账号</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>选择文件</h3></div></div><p className="vault-section-help">支持包含 OTP 地址的文本文件</p><label className="vault-file"><FileUp size={20} /><span>{legacyText ? "文件已读取" : "选择文件"}</span><input type="file" accept=".txt,text/plain" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setLegacyText(await file.text()); }} /></label></section><section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>粘贴文件内容</h3></div></div><label><span>文件内容</span><textarea rows={7} value={legacyText} onChange={(event) => setLegacyText(event.target.value)} placeholder="把文件内容粘贴到这里，也可以直接选择文件自动填充" /></label></section></div><footer><span>{legacyText.trim() ? "内容已准备好，可以开始导入" : "请选择文件或粘贴文件内容"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>取消</button><button className="vault-primary" disabled={busy || !legacyText.trim()}>{busy ? "导入中" : "确认导入"}</button></div></footer></form></div> : null}

    {modal === "shareDetail" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="vault-modal share vault-share-form vault-share-detail">
      <header><div><small>AUTHORIZATION DETAIL</small><h2>{shareDetail?.name?.trim() || "临时授权详情"}</h2><p>{shareDetail ? `${shareDetail.itemCount} 个凭据 · ${shareDetail.shareMode === "DIRECT" ? "指定用户" : "链接分享"}` : "正在读取授权配置"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header>
      {shareDetailLoading || !shareDetail ? <div className="vault-share-scroll"><div className="vault-detail-loading"><LoaderCircle className="spin" size={22} />正在读取授权配置…</div></div> : <>
        <div className="vault-share-scroll">
          <section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>授权状态</h3></div><span className={`vault-status is-${shareDetail.status.toLowerCase()}`}>{shareDetail.status === "ACTIVE" ? "有效" : shareDetail.status === "EXPIRED" ? "已过期" : shareDetail.status === "LIMIT_REACHED" ? "次数已用完" : "已撤销"}</span></div><div className="vault-share-detail-hero"><div><small>剩余有效时间</small><b>{shareDetail.status === "ACTIVE" ? formatRemaining(shareDetail.expireTime, now) : "授权已结束"}</b></div></div><div className="vault-share-detail-grid"><section><span>授权内容</span><b>{shareDetail.itemCount} 个凭据</b></section><section><span>{shareDetail.shareMode === "DIRECT" ? "接收人" : "访问次数"}</span><b>{shareDetail.shareMode === "DIRECT" ? shareDetail.recipientUsername : `${shareDetail.accessCount}${shareDetail.maxAccessCount ? ` / ${shareDetail.maxAccessCount}` : " / 不限"}`}</b></section><section><span>访问方式</span><b>{shareDetail.shareMode === "DIRECT" ? "指定用户" : shareDetail.accessCodeEnabled ? "访问码验证" : "链接直达"}</b></section><section><span>复制权限</span><b>{shareDetail.allowCopy ? "允许复制" : "仅查看"}</b></section></div></section>
          <section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>访问内容</h3></div></div><div className="vault-permission-tags">{([["showAccount", "账号"], ["showPassword", "密码"], ["showOtp", "OTP"], ["showLoginUrl", "登录地址"], ["showNote", "备注"]] as const).filter(([key]) => shareDetail[key]).map(([, label]) => <b key={label}>{label}</b>)}</div>{shareDetail.sharePath ? <label><span>授权链接</span><div className="vault-copy-row"><input readOnly value={`${location.origin}${shareDetail.sharePath}`} /><button type="button" onClick={() => void copyShareInfo(shareDetail)} aria-label="复制完整分享信息"><Copy size={15} /></button></div></label> : null}{shareDetail.shareMode === "DIRECT" ? <p className="vault-modal-note">该授权只会显示在 {shareDetail.recipientUsername} 的 OTP Vault 中，到期或撤销后自动消失。</p> : shareDetail.accessCodeEnabled ? <label><span>访问码</span>{shareDetail.accessCode ? <button type="button" className="vault-access-code vault-access-code-button is-detail" onClick={() => void copy(shareDetail.accessCode || "", "访问码已复制")}>{shareDetail.accessCode}<Copy size={15} /></button> : <p className="vault-modal-note">这是升级前创建的授权，当时只保存了不可逆哈希，无法还原访问码。请重新创建授权。</p>}</label> : <p className="vault-modal-note">此授权未启用访问码，获得链接即可访问。</p>}</section>
          {shareDetail.shareMode === "LINK" ? <section className="vault-share-section"><div className="vault-section-title"><div><span>03</span><h3>访问记录</h3></div><button type="button">{shareDetail.accessRecords?.length || 0} 条</button></div><div className="vault-access-records">{shareDetail.accessRecords?.length ? <div>{shareDetail.accessRecords.map((record, index) => <article key={`${record.createTime}-${index}`} className={record.success ? "is-success" : "is-failed"}><span>{record.success ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}</span><div><b>{accessActionLabel(record.action, record.success)}</b><small>{record.ipAddress || "未知 IP"} · {deviceLabel(record.userAgent)}</small>{record.detail ? <em>{record.detail}</em> : null}</div><time>{new Date(normalizeDateTime(record.createTime)).toLocaleString("zh-CN", { hour12: false })}</time></article>)}</div> : <p>还没有访问记录</p>}</div></section> : null}
        </div>
        <footer><span>{shareDetail.status === "ACTIVE" ? "授权仍在有效期内" : "授权已结束"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>关闭</button>{shareDetail.status === "ACTIVE" ? <button type="button" className="vault-primary" onClick={() => void openShareEdit(shareDetail)}><Pencil size={14} />编辑授权</button> : null}{shareDetail.status !== "REVOKED" ? <button type="button" className="vault-danger" onClick={() => { setPendingRevoke({ share: shareDetail, from: "detail" }); setModal("revokeConfirm"); }}>撤销授权</button> : <button type="button" className="vault-danger" onClick={() => { setPendingShareDelete(shareDetail); setModal("shareDeleteConfirm"); }}>删除记录</button>}</div></footer>
      </>}
    </section></div> : null}

    {modal === "share" ? <div className="vault-modal-mask"><form className="vault-modal share vault-share-form" onSubmit={submitShare}>
      <header><div><small>TEMPORARY ACCESS</small><h2>创建临时授权</h2><p>已选择 {selected.length} 项，配置完成后立即生成</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header>
      <div className="vault-share-scroll">
        <section className="vault-share-section vault-share-picker-section"><div className="vault-section-title"><div><span>01</span><h3>授权凭据</h3></div><button type="button" onClick={() => setSelected(selected.length === ownCredentials.length ? [] : ownCredentials.map((item) => item.id))}>{selected.length === ownCredentials.length ? "取消全选" : "全部选择"}</button></div><details className="vault-credential-picker" open={sharePickerOpen} onToggle={(event) => setSharePickerOpen(event.currentTarget.open)}><summary><span><b>{selected.length ? `已选择 ${selected.length} 个凭据` : "请选择要授权的凭据"}</b><small>{selected.length ? `${selectedCredentials.slice(0, 2).map((item) => item.issuer).join("、")}${selected.length > 2 ? ` 等 ${selected.length} 项` : ""}` : "展开后可多选"}</small></span><em>{sharePickerOpen ? "收起" : selected.length ? "调整" : "展开选择"}</em></summary><div className="vault-select-list">{ownCredentials.map((item) => <label className={selected.includes(item.id) ? "is-selected" : ""} key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span><b>{item.issuer}</b><small>{item.accountName}</small></span><Check size={15} /></label>)}</div></details></section>
        <section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>授权名称</h3></div></div><div className="vault-form-grid vault-single-field"><label className="wide"><span>给这次授权起个名字</span><input maxLength={40} value={shareForm.name} onChange={(e) => setShareForm({ ...shareForm, name: e.target.value })} placeholder="例如 给同事的临时访问，不填则为临时凭据授权" /></label></div><p className="vault-section-help">会出现在授权列表、对方打开的页面，以及复制文案第一行</p></section>
	        <section className="vault-share-section"><div className="vault-section-title"><div><span>03</span><h3>接收方式与有效期</h3></div></div><div className="vault-share-mode"><button type="button" className={shareForm.shareMode === "LINK" ? "is-active" : ""} onClick={() => setShareForm({ ...shareForm, shareMode: "LINK" })}><Link2 size={15} /><span><b>分享链接</b><small>任何获得链接的人</small></span></button><button type="button" className={shareForm.shareMode === "DIRECT" ? "is-active" : ""} onClick={() => setShareForm({ ...shareForm, shareMode: "DIRECT" })}><User size={15} /><span><b>指定用户</b><small>显示在对方的全部列表</small></span></button></div>{shareForm.shareMode === "DIRECT" ? <div className="vault-recipient-input"><span>接收人账号</span><label className="vault-recipient-field"><Search size={15} /><input required maxLength={30} value={shareForm.recipientUsername} onChange={(e) => setShareForm({ ...shareForm, recipientUsername: e.target.value.trimStart() })} placeholder="搜索账号、昵称或邮箱" />{recipientLoading ? <LoaderCircle className="spin" size={14} /> : null}</label>{recipients.length ? <div className="vault-recipient-list">{recipients.map((user) => <button type="button" key={user.userId} onClick={() => { setShareForm({ ...shareForm, recipientUsername: user.userName }); setRecipients([]); }}><User size={14} /><span><b>{user.nickName || user.userName}</b><small>{user.userName}{user.email ? ` · ${user.email}` : ""}</small></span></button>)}</div> : shareForm.recipientUsername.trim().length >= 2 && !recipientLoading ? <p>没有匹配账号</p> : null}</div> : null}<div className="vault-duration"><div className="vault-duration-head"><span><Clock3 size={15} /></span><div><small>授权有效时间</small><b>{shareForm.durationSeconds / 86400} 天</b></div></div><div className="vault-duration-presets">{[1, 3, 7, 30].map((days) => <button type="button" className={shareForm.durationSeconds === days * 86400 ? "is-active" : ""} onClick={() => setShareForm({ ...shareForm, durationSeconds: days * 86400 })} key={days}>{days} 天</button>)}</div><label><span>自定义</span><input type="number" min={1} max={365} value={shareForm.durationSeconds / 86400} onChange={(e) => setShareForm({ ...shareForm, durationSeconds: Number(e.target.value) * 86400 })} /><em>天</em></label></div>{shareForm.shareMode === "LINK" ? <div className="vault-toggle-row"><label className="vault-check"><input type="checkbox" checked={shareForm.accessCodeEnabled} onChange={(e) => setShareForm({ ...shareForm, accessCodeEnabled: e.target.checked })} /><span><b>访问码保护</b><small>{shareForm.accessCodeEnabled ? "生成 5 位短链接，访问时再次验证" : "关闭后使用 10 位安全链接"}</small></span></label>{shareForm.accessCodeEnabled ? <div className="vault-inline"><label className="vault-check"><input type="radio" checked={shareForm.accessCodeMode === "AUTO"} onChange={() => setShareForm({ ...shareForm, accessCodeMode: "AUTO" })} /><span>自动生成</span></label><label className="vault-check"><input type="radio" checked={shareForm.accessCodeMode === "CUSTOM"} onChange={() => setShareForm({ ...shareForm, accessCodeMode: "CUSTOM" })} /><span>自定义</span></label>{shareForm.accessCodeMode === "CUSTOM" ? <input required minLength={4} maxLength={12} value={shareForm.accessCode} onChange={(e) => setShareForm({ ...shareForm, accessCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="4-12 位" /> : null}</div> : null}</div> : <p className="vault-modal-note">对方登录后即可在“全部”中查看，到期或撤销后自动移除。</p>}</section>
        <section className="vault-share-section"><div className="vault-section-title"><div><span>04</span><h3>访问权限</h3></div></div><p className="vault-section-help">默认全部授权，不需要给对方看的请点掉</p><div className="vault-option-grid">{([['showAccount','账号'],['showPassword','密码'],['showOtp','动态验证码'],['showLoginUrl','登录地址'],['showNote','备注']] as const).map(([key, label]) => <label className={shareForm[key] ? "is-selected" : "is-off"} key={key}><input type="checkbox" checked={Boolean(shareForm[key])} onChange={(e) => setShareForm({ ...shareForm, [key]: e.target.checked })} /><Check size={14} /><span>{label}</span><small>{shareForm[key] ? "已授权" : "未授权"}</small></label>)}</div><div className="vault-form-grid vault-access-options"><label className="vault-check"><input type="checkbox" checked={shareForm.allowCopy} onChange={(e) => setShareForm({ ...shareForm, allowCopy: e.target.checked })} /><span><b>允许复制</b><small>否则只能在页面中查看</small></span></label>{shareForm.shareMode === "LINK" ? <><label className="vault-check"><input type="checkbox" checked={shareForm.oneTime} onChange={(e) => setShareForm({ ...shareForm, oneTime: e.target.checked })} /><span><b>一次性访问</b><small>成功访问一次后立即失效</small></span></label><label><span>最大访问次数（可选）</span><input type="number" min={1} max={1000} disabled={shareForm.oneTime} value={shareForm.oneTime ? "1" : shareForm.maxAccessCount} onChange={(e) => setShareForm({ ...shareForm, maxAccessCount: e.target.value })} placeholder="不填则不限" /></label></> : null}</div></section>
      </div>
      <footer><span>{selected.length ? `将授权 ${selected.length} 个凭据 · ${shareForm.shareMode === "DIRECT" ? `指定给 ${shareForm.recipientUsername || "用户"}` : shareForm.accessCodeEnabled ? "访问码保护" : "链接直达"}` : "请先选择授权凭据"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>取消</button><button className="vault-primary" disabled={busy || !selected.length}>{busy ? "生成中" : "生成授权"}</button></div></footer>
    </form></div> : null}

	{modal === "shareEdit" && shareDetail ? <div className="vault-modal-mask"><form className="vault-modal share vault-share-form" onSubmit={submitShareEdit}>
		<header><div><small>EDIT TEMPORARY ACCESS</small><h2>编辑临时授权</h2><p>{shareDetail.shareMode === "DIRECT" ? `接收人 ${shareDetail.recipientUsername} 保持不变` : "原授权链接和访问码保持不变"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header>
		<div className="vault-share-scroll">
			<section className="vault-share-section vault-share-picker-section"><div className="vault-section-title"><div><span>01</span><h3>授权凭据</h3></div><button type="button" onClick={() => setSelected(selected.length === ownCredentials.length ? [] : ownCredentials.map((item) => item.id))}>{selected.length === ownCredentials.length ? "取消全选" : "全部选择"}</button></div><details className="vault-credential-picker" open={sharePickerOpen} onToggle={(event) => setSharePickerOpen(event.currentTarget.open)}><summary><span><b>{selected.length ? `已选择 ${selected.length} 个凭据` : "请选择要授权的凭据"}</b><small>{selected.length ? `${selectedCredentials.slice(0, 2).map((item) => item.issuer).join("、")}${selected.length > 2 ? ` 等 ${selected.length} 项` : ""}` : "展开后可多选"}</small></span><em>{sharePickerOpen ? "收起" : "调整"}</em></summary><div className="vault-select-list">{ownCredentials.map((item) => <label className={selected.includes(item.id) ? "is-selected" : ""} key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((credentialId) => credentialId !== item.id))} /><span><b>{item.issuer}</b><small>{item.accountName}</small></span><Check size={15} /></label>)}</div></details></section>
			<section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>名称与剩余有效期</h3></div></div><div className="vault-form-grid vault-single-field"><label className="wide"><span>授权名称</span><input maxLength={40} value={shareForm.name} onChange={(event) => setShareForm({ ...shareForm, name: event.target.value })} placeholder="例如 给同事的临时访问，不填则为临时凭据授权" /></label></div><p className="vault-section-help">保存后从当前时间重新计算，原链接不会变化</p><div className="vault-duration"><div className="vault-duration-head"><span><Clock3 size={15} /></span><div><small>从现在起</small><b>{shareForm.durationSeconds / 86400} 天</b></div></div><div className="vault-duration-presets">{[1, 3, 7, 30].map((days) => <button type="button" className={shareForm.durationSeconds === days * 86400 ? "is-active" : ""} onClick={() => setShareForm({ ...shareForm, durationSeconds: days * 86400 })} key={days}>{days} 天</button>)}</div><label><span>自定义</span><input type="number" min={1} max={365} value={shareForm.durationSeconds / 86400} onChange={(event) => setShareForm({ ...shareForm, durationSeconds: Number(event.target.value) * 86400 })} /><em>天</em></label></div></section>
			<section className="vault-share-section"><div className="vault-section-title"><div><span>03</span><h3>访问权限</h3></div></div><p className="vault-section-help">保存后立即应用到现有链接和已登录接收人</p><div className="vault-option-grid">{([['showAccount','账号'],['showPassword','密码'],['showOtp','动态验证码'],['showLoginUrl','登录地址'],['showNote','备注']] as const).map(([key, label]) => <label className={shareForm[key] ? "is-selected" : "is-off"} key={key}><input type="checkbox" checked={Boolean(shareForm[key])} onChange={(event) => setShareForm({ ...shareForm, [key]: event.target.checked })} /><Check size={14} /><span>{label}</span><small>{shareForm[key] ? "已授权" : "未授权"}</small></label>)}</div><div className="vault-form-grid vault-access-options"><label className="vault-check"><input type="checkbox" checked={shareForm.allowCopy} onChange={(event) => setShareForm({ ...shareForm, allowCopy: event.target.checked })} /><span><b>允许复制</b><small>关闭后只能在页面中查看</small></span></label>{shareDetail.shareMode === "LINK" ? <><label className="vault-check"><input type="checkbox" disabled={shareDetail.accessCount > 1} checked={shareForm.oneTime} onChange={(event) => setShareForm({ ...shareForm, oneTime: event.target.checked })} /><span><b>一次性访问</b><small>{shareDetail.accessCount > 1 ? "已访问多次，不能改为一次性" : "成功访问一次后立即失效"}</small></span></label><label><span>最大访问次数（已访问 {shareDetail.accessCount} 次）</span><input type="number" min={Math.max(1, shareDetail.accessCount)} max={1000} disabled={shareForm.oneTime} value={shareForm.oneTime ? "1" : shareForm.maxAccessCount} onChange={(event) => setShareForm({ ...shareForm, maxAccessCount: event.target.value })} placeholder="不填则不限" /></label></> : null}</div></section>
		</div>
		<footer><span>分享方式、接收人、链接和访问码不会变化</span><div><button type="button" className="vault-ghost" onClick={closeModal}>取消</button><button className="vault-primary" disabled={busy || !selected.length}>{busy ? "保存中" : "保存修改"}</button></div></footer>
	</form></div> : null}

    {modal === "deleteConfirm" && pendingDelete ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setPendingDelete(null); closeModal(); } }}><section className="vault-modal share vault-share-form vault-delete-modal"><header><div><small>DELETE CREDENTIAL</small><h2>删除凭据</h2><p>这项操作会同步撤回相关临时授权</p></div><button type="button" onClick={() => { setPendingDelete(null); closeModal(); }} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>将要删除</h3></div></div><div className="vault-delete-summary"><span className="vault-delete-icon"><Trash2 size={21} /></span><div><b>{pendingDelete.issuer}</b><small>{pendingDelete.accountName}</small></div></div></section><section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>影响范围</h3></div></div><p className="vault-section-help">删除后会从你的保险库中移除，包含它的临时授权也会一起失效。</p></section></div><footer><span>确认后立即生效</span><div><button type="button" className="vault-ghost" disabled={busy} onClick={() => { setPendingDelete(null); closeModal(); }}>取消</button><button type="button" className="vault-danger" disabled={busy} onClick={() => void removeCredential()}>{busy ? "删除中" : "确认删除"}</button></div></footer></section></div> : null}

    {modal === "revokeConfirm" && pendingRevoke ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) cancelRevoke(); }}><section className="vault-modal share vault-share-form vault-delete-modal"><header><div><small>REVOKE ACCESS</small><h2>撤销授权</h2><p>撤销后对方将立刻无法继续访问</p></div><button type="button" onClick={cancelRevoke} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>将要撤销</h3></div></div><div className="vault-delete-summary"><span className="vault-delete-icon"><X size={21} /></span><div><b>{pendingRevoke.share.name?.trim() || "临时凭据授权"}</b><small>{pendingRevoke.share.itemCount} 个凭据 · {pendingRevoke.share.shareMode === "DIRECT" ? `指定给 ${pendingRevoke.share.recipientUsername}` : pendingRevoke.share.accessCodeEnabled ? "访问码保护" : "链接访问"} · {pendingRevoke.share.status === "ACTIVE" ? `剩余 ${formatRemaining(pendingRevoke.share.expireTime, now)}` : "授权已结束"}</small></div></div></section><section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>影响范围</h3></div></div><p className="vault-section-help">撤销后链接立即失效，指定用户列表中的共享凭据也会一起消失。</p></section></div><footer><span>确认后立即生效</span><div><button type="button" className="vault-ghost" disabled={busy} onClick={cancelRevoke}>取消</button><button type="button" className="vault-danger" disabled={busy} onClick={() => void confirmRevoke()}>{busy ? "撤销中" : "确认撤销"}</button></div></footer></section></div> : null}

    {modal === "shareDeleteConfirm" && pendingShareDelete ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setPendingShareDelete(null); setModal(null); } }}><section className="vault-modal share vault-share-form vault-delete-modal"><header><div><small>DELETE AUTHORIZATION</small><h2>删除授权记录</h2><p>删除后将不再显示在临时授权列表</p></div><button type="button" onClick={() => { setPendingShareDelete(null); setModal(null); }} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><section className="vault-share-section"><div className="vault-delete-summary"><span className="vault-delete-icon"><Trash2 size={21} /></span><div><b>{pendingShareDelete.name?.trim() || "临时凭据授权"}</b><small>{pendingShareDelete.itemCount} 个凭据 · {pendingShareDelete.shareMode === "DIRECT" ? `指定给 ${pendingShareDelete.recipientUsername}` : pendingShareDelete.accessCodeEnabled ? "访问码保护" : "链接访问"} · 该授权已撤销，访问记录会继续保留</small></div></div></section></div><footer><span>删除后无法从列表恢复</span><div><button type="button" className="vault-ghost" disabled={busy} onClick={() => { setPendingShareDelete(null); setModal(null); }}>取消</button><button type="button" className="vault-danger" disabled={busy} onClick={() => void confirmShareDelete()}>{busy ? "删除中" : "确认删除"}</button></div></footer></section></div> : null}

    {modal === "created" && created ? <div className="vault-modal-mask"><section className="vault-modal small vault-created"><header><div><small>READY</small><h2>{created.name?.trim() || "授权已创建"}</h2></div><button type="button" onClick={closeModal}><X size={18} /></button></header><span className="vault-created-icon"><Check size={24} /></span><div className="vault-created-countdown"><Clock3 size={15} /><span><small>剩余有效时间</small><b>{formatRemaining(created.expireTime, now)}</b></span></div>{created.shareMode === "DIRECT" ? <div className="vault-direct-created"><User size={20} /><span><small>已授权给</small><b>{created.recipientUsername}</b><p>对方登录后可在“全部”中查看，到期或撤销后自动移除。</p></span></div> : <><label><span>授权链接</span><div className="vault-copy-row"><input readOnly value={created.shareUrl || ""} /><button type="button" onClick={() => void copy(created.shareUrl || "")}><Copy size={15} /></button></div></label>{created.accessCode ? <label><span>访问码</span><button type="button" className="vault-access-code vault-access-code-button" onClick={() => void copy(created.accessCode || "", "访问码已复制")}>{created.accessCode}<Copy size={15} /></button></label> : null}<div className="vault-created-actions">{canUseSystemShare() ? <button type="button" className="vault-primary" onClick={() => void shareOrCopy(fullShareText)}>系统分享</button> : created.autoFillAllowed ? <button type="button" className="vault-ghost" onClick={() => void copy(autoFillUrl, "自动填充链接已复制")}>复制自动填充链接</button> : null}<button type="button" className="vault-primary" onClick={() => void copy(fullShareText, "完整分享信息已复制")}>复制链接和访问码</button></div><p>访问码以后仍可从临时授权详情查看，访问结果也会记录在详情中。</p></>}</section></div> : null}

    {modal === "syncShares" && pendingSync ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setPendingSync(null); setModal(null); } }}><section className="vault-modal share vault-share-form vault-delete-modal"><header><div><small>SYNC AUTHORIZATION</small><h2>同步已有授权</h2><p>该账号已存在有效授权</p></div><button type="button" onClick={() => { setPendingSync(null); setModal(null); }} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><section className="vault-share-section"><div className="vault-delete-summary"><span className="vault-delete-icon"><Share2 size={21} /></span><div><b>{pendingSync.issuer}</b><small>{pendingSync.accountName} · {pendingSync.count} 个有效授权</small></div></div></section><section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>是否同步更新</h3></div></div><p className="vault-section-help">选择同步后，对方看到的账号、密码、验证码等内容会改成刚才保存的版本。不需要同步可直接关闭。</p></section></div><footer><span>凭据本身已经保存</span><div><button type="button" className="vault-ghost" disabled={busy} onClick={() => { setPendingSync(null); setModal(null); }}>不同步</button><button type="button" className="vault-primary" disabled={busy} onClick={() => void (async () => { setBusy(true); try { const result = await syncVaultCredentialShares(pendingSync.id); notify(`已同步 ${result.data.synced} 个授权`); setPendingSync(null); setModal(null); await load(true); } catch (error) { notify(error instanceof Error ? error.message : "同步失败", true); } finally { setBusy(false); } })()}>{busy ? "同步中" : "同步更新"}</button></div></footer></section></div> : null}

    {modal === "username" ? <div className="vault-modal-mask"><section className="vault-modal share vault-share-form vault-account-modal"><header><div><small>USERNAME</small><h2>用户名</h2><p>当前：{accountName || "未设置"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><VaultAccountSetup initialUsername={accountName} email={accountEmail} only="username" cancellable onCancel={closeModal} onFinish={(result) => { setModal(null); if (result.username) { onAccountNameChange(result.username); localStorage.setItem("otp-vault-username", result.username); } notify("用户名已更新"); }} /></div></section></div> : null}

    {modal === "password" ? <div className="vault-modal-mask"><section className="vault-modal share vault-share-form vault-account-modal"><header><div><small>PASSWORD</small><h2>登录密码</h2><p>验证身份后立即生效</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><VaultAccountSetup initialUsername={accountName} email={accountEmail} only="password" requireVerify cancellable onCancel={closeModal} onFinish={() => { setModal(null); notify("密码已更新，下次可用账号密码登录"); }} /></div></section></div> : null}

    <VaultStepUpDialog email={accountEmail} />
    {notice ? <div className={`vault-toast${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"} aria-live={notice.error ? "assertive" : "polite"}>{notice.error ? <ShieldAlert size={15} /> : <Check size={15} />}<span>{notice.text}</span></div> : null}
  </div>;
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : value.replace(" ", "T");
}

function formatShareText(share: { name?: string; sharePath?: string; shareUrl?: string; accessCode?: string; expireTime: string }) {
  const title = share.name?.trim() || "临时凭据授权";
  const baseUrl = share.shareUrl || (share.sharePath ? `${location.origin}${share.sharePath}` : "");
  if (!baseUrl) return "";
  const url = share.accessCode ? `${baseUrl}#k=${share.accessCode}` : baseUrl;
  return [title, url, ...(share.accessCode ? [`访问码：${share.accessCode}`] : []), `有效期：${new Date(normalizeDateTime(share.expireTime)).toLocaleString("zh-CN", { hour12: false })}`].join("\n");
}

function accessActionLabel(action: string, success: boolean) {
  if (success) return "访问成功";
  return action === "LOCKED" ? "访问已锁定" : "访问码错误";
}

function deviceLabel(userAgent?: string) {
  if (!userAgent) return "未知设备";
  if (/iPhone|iPad/i.test(userAgent)) return "iPhone / iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh/i.test(userAgent)) return "Mac";
  return "其他设备";
}

function formatRemaining(expireTime: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(normalizeDateTime(expireTime)).getTime() - now) / 1000));
  if (!Number.isFinite(seconds) || seconds <= 0) return "已到期";
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
  return days ? `${days}天 ${hours}时 ${minutes}分 ${rest}秒` : hours ? `${hours}时 ${minutes}分 ${rest}秒` : minutes ? `${minutes}分 ${rest}秒` : `${rest}秒`;
}
