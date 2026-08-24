import { Camera, Check, Clock3, Copy, Eye, EyeOff, ExternalLink, FileUp, KeyRound, Layers3, LayoutGrid, Link2, LoaderCircle, LogOut, Pencil, Plus, ScanLine, Search, Settings2, Share2, ShieldAlert, ShieldCheck, Star, Trash2, User, X } from "lucide-react";
import jsQR from "jsqr";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
	createVaultShare, deleteVaultCredential, getVaultCredential, getVaultShare, importLegacyVault, listVaultCredentials, listVaultShares,
	listVaultRecipients, getVaultPreferences, revokeVaultShare, saveVaultCredential, saveVaultPreferences, clearOtpToken, getOtpToken, otpApiRequest, setOtpToken, type VaultCredential, type VaultPrefs, type VaultRecipient, type VaultShare,
} from "./vaultApi";
import OtpAuthScreen from "./OtpAuthScreen";
import "./otp-vault.css";

type Modal = "credential" | "scanner" | "detail" | "import" | "share" | "shareDetail" | "deleteConfirm" | "created" | null;
type VaultView = "all" | "favorite" | "shares" | "settings";
type BarcodeDetectorLike = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorConstructor = new (init?: { formats?: string[] }) => BarcodeDetectorLike;
const emptyCredential = { issuer: "", accountName: "", otpSecret: "", password: "", algorithm: "SHA1", digits: 6, periodSeconds: 30, loginUrl: "", note: "", favorite: false, sensitivityLevel: "STANDARD" };
const defaultPrefs: VaultPrefs = { masked: false, compact: false, grouped: true, showShared: true, autoRefresh: true };
type ScannedCredential = Partial<typeof emptyCredential>;
type ScannedPayload = { items: ScannedCredential[]; batchSize: number; batchIndex: number; batchId: string };

export default function OtpVaultPage() {
  const [access, setAccess] = useState<"loading" | "login" | "allowed" | "denied">("loading");
  const checkAccess = useCallback(async () => {
    if (!getOtpToken()) return setAccess("login");
    try {
      const result = await otpApiRequest<Record<string, unknown>>("/getInfo");
      const permissions = Array.isArray(result.permissions) ? result.permissions.map(String) : [];
      const roles = Array.isArray(result.roles) ? result.roles.map(String) : [];
      setAccess(permissions.includes("*:*:*") || permissions.includes("otp:vault:view") || roles.includes("otp_user") || roles.includes("admin") ? "allowed" : "denied");
    } catch { setAccess("login"); }
  }, []);
  useEffect(() => { void checkAccess(); }, [checkAccess]);
  useEffect(() => { const expired = () => setAccess("login"); window.addEventListener("otp-session-expired", expired); return () => window.removeEventListener("otp-session-expired", expired); }, []);
  if (access === "loading") return <div className="vault-auth-state"><LoaderCircle className="spin" size={24} /><p>正在验证 OTP Vault 权限…</p></div>;
  if (access === "login") return <OtpAuthScreen onAuthenticated={(token) => { setOtpToken(token); setAccess("loading"); void checkAccess(); }} />;
  if (access === "denied") return <div className="vault-auth-state"><ShieldAlert size={30} /><h1>没有 OTP Vault 权限</h1><p>当前账号不能访问这个保险库。</p><button type="button" onClick={() => { clearOtpToken(); setAccess("login"); }}>换一个账号</button></div>;
  return <OtpVaultContent onLogout={() => { clearOtpToken(); setAccess("login"); }} />;
}

function parseOtpPayload(raw: string): ScannedPayload {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error("二维码内容不是有效的 OTP 地址"); }
  if (url.protocol === "otpauth:") return { items: [parseOtpUrl(url)], batchSize: 1, batchIndex: 0, batchId: "" };
  if (url.protocol === "otpauth-migration:") return parseGoogleMigration(url);
  throw new Error("仅支持 Google Authenticator 或标准 OTP 二维码");
}

function parseOtpUrl(url: URL): ScannedCredential {
  if (url.hostname.toLowerCase() !== "totp") throw new Error("暂不支持计数器型 HOTP");
  const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const colon = label.indexOf(":");
  const issuer = (url.searchParams.get("issuer") || (colon >= 0 ? label.slice(0, colon) : "") || "未分类").trim();
  const accountName = (colon >= 0 ? label.slice(colon + 1) : label).trim();
  const otpSecret = normalizeScannedSecret(url.searchParams.get("secret") || "");
  if (!accountName) throw new Error("二维码缺少账号名称");
  const algorithm = normalizeScannedAlgorithm(url.searchParams.get("algorithm"));
  const digitsValue = Number(url.searchParams.get("digits") || 6);
  const periodValue = Number(url.searchParams.get("period") || 30);
  return { issuer: issuer.slice(0, 80), accountName: accountName.slice(0, 160), otpSecret, algorithm, digits: digitsValue === 8 ? 8 : 6, periodSeconds: periodValue >= 15 && periodValue <= 120 ? periodValue : 30 };
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
    if (typeValue === 1) throw new Error("暂不支持计数器型 HOTP");
    if (!secret.length) throw new Error("Google Authenticator 数据缺少 Secret");
    const colon = name.indexOf(":");
    if (!issuer && colon >= 0) issuer = name.slice(0, colon);
    const accountName = (colon >= 0 ? name.slice(colon + 1) : name).trim();
    if (!accountName) throw new Error("Google Authenticator 数据缺少账号名称");
    return {
      issuer: (issuer.trim() || "未分类").slice(0, 80), accountName: accountName.slice(0, 160),
      otpSecret: toBase32(secret), algorithm: algorithmValue === 2 ? "SHA256" : algorithmValue === 3 ? "SHA512" : "SHA1",
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

function decodeQrsWithCanvas(source: CanvasImageSource) {
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
    const code = jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" });
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

function OtpVaultContent({ onLogout }: { onLogout: () => void }) {
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [shares, setShares] = useState<VaultShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<VaultView>("all");
  const [issuer, setIssuer] = useState("");
  const [sort, setSort] = useState("name");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [prefs, setPrefs] = useState<VaultPrefs>(() => { try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem("handy-vault-prefs") || "{}") }; } catch { return defaultPrefs; } });
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState<Modal>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<VaultCredential | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VaultCredential | null>(null);
  const [shareDetail, setShareDetail] = useState<VaultShare | null>(null);
  const [shareDetailLoading, setShareDetailLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({ ...emptyCredential });
  const [scanText, setScanText] = useState("");
  const [scanError, setScanError] = useState("");
  const [legacyText, setLegacyText] = useState("");
	const [selected, setSelected] = useState<number[]>([]);
	const [shareForm, setShareForm] = useState({ shareMode: "LINK", recipientUsername: "", durationSeconds: 86400, accessCodeEnabled: true, accessCodeMode: "AUTO", accessCode: "", showAccount: true, showPassword: false, showOtp: true, showLoginUrl: false, showNote: false, allowCopy: true, oneTime: false, maxAccessCount: "" });
	const [recipients, setRecipients] = useState<VaultRecipient[]>([]);
	const [recipientLoading, setRecipientLoading] = useState(false);
	const [created, setCreated] = useState<{ shareMode: "LINK" | "DIRECT"; recipientUsername?: string; shareUrl?: string; accessCode?: string; autoFillAllowed: boolean; expireTime: string } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
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
      setCredentials(credentialResult.data || []);
      setShares(shareResult.data || []);
    } catch (error) { notify(error instanceof Error ? error.message : "加载失败", true); }
    finally { if (!quiet) setLoading(false); }
  }, []);
  useEffect(() => { void load(); void getVaultPreferences().then((result) => setPrefs({ ...defaultPrefs, ...(result.data || {}) })).catch(() => undefined); }, [load]);
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
    void listVaultCredentials().then((result) => setCredentials(result.data || [])).catch(() => undefined);
  }, [credentials, now]);
  useEffect(() => { localStorage.setItem("handy-vault-prefs", JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => () => stopScanner(), []);

	const updatePrefs = (next: VaultPrefs) => {
		setPrefs(next);
		void saveVaultPreferences(next).then((result) => setPrefs({ ...defaultPrefs, ...(result.data || {}) })).catch((error) => notify(error instanceof Error ? error.message : "偏好保存失败", true));
	};

  const changeView = (next: VaultView) => {
    setView(next); setFiltersOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const result = credentials.filter((item) => (!value || `${item.issuer} ${item.accountName}`.toLowerCase().includes(value)) && (!issuer || item.issuer === issuer) && (view !== "favorite" || item.favorite) && (prefs.showShared || !item.shared));
    result.sort((a, b) => sort === "account" ? a.accountName.localeCompare(b.accountName, "zh-CN") : sort === "favorite" ? Number(b.favorite) - Number(a.favorite) || a.issuer.localeCompare(b.issuer, "zh-CN") : a.issuer.localeCompare(b.issuer, "zh-CN") || a.accountName.localeCompare(b.accountName, "zh-CN"));
    return result;
  }, [credentials, issuer, prefs.showShared, query, sort, view]);
  const issuers = useMemo(() => [...new Set(credentials.map((item) => item.issuer))].sort((a, b) => a.localeCompare(b, "zh-CN")), [credentials]);
  const ownCredentials = useMemo(() => credentials.filter((item) => !item.shared), [credentials]);
  const groups = useMemo(() => prefs.grouped ? [...new Set(filtered.map((item) => item.issuer))].map((name) => [name, filtered.filter((item) => item.issuer === name)] as const) : [["", filtered] as const], [filtered, prefs.grouped]);

  const stopScanner = () => {
    window.cancelAnimationFrame(scanFrameRef.current);
    scanStreamRef.current?.getTracks().forEach((track) => track.stop());
    scanStreamRef.current = null;
  };
  const closeModal = () => { if (!busy) { stopScanner(); setModal(null); } };
  const openCredential = (item?: VaultCredential) => {
    setEditingId(item?.id || null);
    setForm(item ? { issuer: item.issuer, accountName: item.accountName, otpSecret: "", password: "", algorithm: item.algorithm || "SHA1", digits: item.digits || 6, periodSeconds: item.periodSeconds || 30, loginUrl: item.loginUrl || "", note: item.note || "", favorite: item.favorite, sensitivityLevel: item.sensitivityLevel || "STANDARD" } : { ...emptyCredential });
    setModal("credential");
  };
  const importScannedItems = async (items: ScannedCredential[]) => {
    if (!items.length) throw new Error("二维码中没有可导入的验证器数据");
    setBusy(true);
    try {
      await Promise.all(items.map((item) => saveVaultCredential(null, { ...emptyCredential, ...item })));
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
          const raws = [...new Set([...result.map((item) => item.rawValue).filter(Boolean), ...decodeQrsWithCanvas(scanVideoRef.current)])];
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
      const raws = [...new Set([...result.map((item) => item.rawValue).filter(Boolean), ...decodeQrsWithCanvas(bitmap)])];
      bitmap.close();
      if (!raws.length) throw new Error("图片中没有识别到二维码");
      await applyScannedPayloads(raws);
    } catch (error) { setScanError(error instanceof Error ? error.message : "二维码图片识别失败"); }
  };
  const openDetail = async (item: VaultCredential) => {
    setModal("detail"); setDetail(null); setDetailLoading(true); setPasswordVisible(false);
    try { setDetail((await getVaultCredential(item.id)).data); }
    catch (error) { setModal(null); notify(error instanceof Error ? error.message : "详情加载失败", true); }
    finally { setDetailLoading(false); }
  };
  async function submitCredential(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await saveVaultCredential(editingId, form); notify(editingId ? "凭据已更新" : "凭据已添加"); setModal(null); await load(true); }
    catch (error) { notify(error instanceof Error ? error.message : "保存失败", true); }
    finally { setBusy(false); }
  }
  async function removeCredential() {
    if (!pendingDelete) return;
    setBusy(true);
    try { await deleteVaultCredential(pendingDelete.id); notify("凭据已删除，相关授权已撤回"); setPendingDelete(null); setModal(null); await load(true); } catch (error) { notify(error instanceof Error ? error.message : "删除失败", true); }
    finally { setBusy(false); }
  }
  async function toggleFavorite(item: VaultCredential) {
    try { await saveVaultCredential(item.id, { issuer: item.issuer, accountName: item.accountName, favorite: !item.favorite, loginUrl: item.loginUrl, note: item.note, sensitivityLevel: item.sensitivityLevel }); await load(true); }
    catch (error) { notify(error instanceof Error ? error.message : "更新失败", true); }
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
  const openShare = (credentialId?: number) => { setSelected(credentialId ? [credentialId] : []); setModal("share"); };
  const openShareDetail = async (share: VaultShare) => {
    setModal("shareDetail"); setShareDetail(null); setShareDetailLoading(true);
    try { setShareDetail((await getVaultShare(share.id)).data); }
    catch (error) { setModal(null); notify(error instanceof Error ? error.message : "授权详情加载失败", true); }
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
  const copy = async (value: string, message = "已复制") => { await navigator.clipboard.writeText(value); notify(message); };
  const accountClass = prefs.masked ? "vault-account is-blurred" : "vault-account";
  const renderCredential = (item: VaultCredential) => {
    const left = item.otpValidUntil ? Math.max(0, Math.ceil((item.otpValidUntil - now) / 1000)) : 0;
    const progress = item.periodSeconds ? Math.max(0, Math.min(100, left / item.periodSeconds * 100)) : 0;
    return <article className={`vault-card${prefs.compact ? " is-compact" : ""}${item.shared ? " is-shared" : ""}`} key={item.id} role="button" tabIndex={0} onClick={() => void openDetail(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openDetail(item); } }}>
      <div className="vault-card-top"><span className="vault-service-mark">{item.issuer.slice(0, 2).toUpperCase()}</span><div><b>{item.issuer}</b><small className={accountClass}>{item.accountName}</small></div>{item.shared ? <span className="vault-shared-badge">共享</span> : <button type="button" className={item.favorite ? "is-favorite" : ""} onClick={(event) => { event.stopPropagation(); void toggleFavorite(item); }} aria-label={item.favorite ? "取消收藏" : "收藏"}><Star size={16} fill={item.favorite ? "currentColor" : "none"} /></button>}</div>
      {item.currentOtp ? item.shared && !item.allowCopy ? <div className="vault-code is-readonly"><span>{item.currentOtp.replace(/(.{3})/, "$1 ")}</span></div> : <button type="button" className="vault-code" onClick={(event) => { event.stopPropagation(); void copy(item.currentOtp || "", "验证码已复制"); }}><span>{item.currentOtp.replace(/(.{3})/, "$1 ")}</span><Copy size={15} /></button> : <div className="vault-no-code"><KeyRound size={16} />{item.shared ? "共享账号密码" : "已保存账号密码"}</div>}
      <div className="vault-progress"><i style={{ width: `${progress}%` }} /></div><div className="vault-card-foot"><span>{item.shared ? `来自 ${item.sharedBy}` : `${item.algorithm} · ${item.digits} 位`}</span><span>{item.shared && item.shareExpireTime ? formatRemaining(item.shareExpireTime, now) : item.currentOtp ? `${left}s` : "无 OTP"}</span></div>
      <div className="vault-card-actions"><button type="button" onClick={(event) => { event.stopPropagation(); void openDetail(item); }} aria-label="查看"><Eye size={13} /><span>查看</span></button>{!item.shared ? <><button type="button" className={`vault-compact-favorite${item.favorite ? " is-favorite" : ""}`} onClick={(event) => { event.stopPropagation(); void toggleFavorite(item); }} aria-label={item.favorite ? "取消收藏" : "收藏"}><Star size={13} fill={item.favorite ? "currentColor" : "none"} /><span>收藏</span></button><button type="button" onClick={(event) => { event.stopPropagation(); openShare(item.id); }} aria-label="分享"><Share2 size={13} /><span>分享</span></button><button type="button" onClick={(event) => { event.stopPropagation(); openCredential(item); }} aria-label="编辑"><Pencil size={13} /><span>编辑</span></button><button type="button" onClick={(event) => { event.stopPropagation(); setPendingDelete(item); setModal("deleteConfirm"); }} aria-label="删除"><Trash2 size={13} /><span>删除</span></button></> : <span className="vault-shared-expiry"><Clock3 size={12} />{item.shareExpireTime ? `有效至 ${new Date(normalizeDateTime(item.shareExpireTime)).toLocaleDateString("zh-CN")}` : "临时共享"}</span>}</div>
    </article>;
  };
  const liveDetail = detail ? { ...detail, ...(credentials.find((item) => item.id === detail.id) || {}), password: detail.password } : null;
  const fullShareText = created?.shareUrl ? `临时凭据授权\n\n${created.shareUrl}${created.accessCode ? `\n\n访问码：${created.accessCode}` : ""}\n\n有效期：${new Date(created.expireTime).toLocaleString("zh-CN", { hour12: false })}` : "";
  const autoFillUrl = created?.shareUrl && created.accessCode ? `${created.shareUrl}#k=${created.accessCode}` : created?.shareUrl || "";

  return <div className="vault-page">
    <section className="vault-head">
      <div className="vault-brand"><span className="vault-brand-mark"><KeyRound size={20} /></span><div><span className="vault-kicker">PRIVATE VAULT</span><h1>OTP Vault</h1><p>你的私人身份保险库</p></div></div>
      <div className="vault-head-actions"><button type="button" className="vault-ghost vault-import-action" onClick={() => { setLegacyText(""); setModal("import"); }} aria-label="导入文件"><FileUp size={20} /><span>导入</span></button><button type="button" className="vault-primary vault-add-action" onClick={() => openCredential()} aria-label="添加凭据"><Plus size={21} /><span>添加</span></button><button type="button" className="vault-ghost vault-logout" onClick={onLogout} aria-label="退出登录"><LogOut size={13} /><span>退出</span></button></div>
    </section>

    <nav className="vault-tabs" aria-label="密钥管理导航">
      {([['all', KeyRound, '全部'], ['favorite', Star, '收藏'], ['shares', Link2, '授权'], ['settings', Settings2, '设置']] as const).map(([key, Icon, label]) => <button type="button" className={view === key ? "is-active" : ""} onClick={() => changeView(key)} key={key}><Icon size={15} />{label}</button>)}
    </nav>

    {view === "all" || view === "favorite" ? <section className="vault-panel">
      <header className="vault-panel-head"><div><h2>{view === "favorite" ? "收藏" : "验证码"}</h2><p>点开卡片查看账号、密码和更多信息</p></div><div className="vault-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索服务或账号" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="清空搜索"><X size={14} /></button> : null}<button type="button" className="vault-filter-trigger" onClick={() => setFiltersOpen(!filtersOpen)} aria-label="筛选"><Settings2 size={15} /></button></div></header>
      <div className={`vault-filters${filtersOpen ? " is-open" : ""}`}><label><span>系统</span><select value={issuer} onChange={(event) => setIssuer(event.target.value)}><option value="">全部系统</option>{issuers.map((name) => <option value={name} key={name}>{name}</option>)}</select></label><label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">系统名称</option><option value="account">账号名称</option><option value="favorite">收藏优先</option></select></label>{issuer ? <button type="button" onClick={() => setIssuer("")}>清除筛选</button> : null}</div>
      {loading ? <div className="vault-empty"><LoaderCircle className="spin" size={24} />正在加载安全数据…</div> : filtered.length ? <div className="vault-groups">{groups.map(([name, items]) => <section className="vault-group" key={name || "all"}>{name ? <header><b>{name}</b><span>{items.length}</span></header> : null}<div className="vault-grid">{items.map(renderCredential)}</div></section>)}</div> : <div className="vault-empty"><KeyRound size={28} /><b>{view === "favorite" ? "还没有收藏凭据" : "没有找到凭据"}</b><p>{view === "favorite" ? "点击凭据右上角的星标即可收藏。" : "可以添加一项，或导入文件。"}</p></div>}
    </section> : null}

    {view === "shares" ? <section className="vault-panel">
      <header className="vault-panel-head"><div><h2>临时授权</h2><p>链接分享或指定用户，均可随时撤销</p></div><button type="button" className="vault-create-share" onClick={() => openShare()} disabled={!ownCredentials.length} aria-label="创建授权"><Share2 size={14} /><span>创建授权</span></button></header>
      <div className="vault-share-list">{shares.length ? shares.map((share) => <article key={share.id} role="button" tabIndex={0} onClick={() => void openShareDetail(share)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openShareDetail(share); } }}>
        <span className={`vault-status is-${share.status.toLowerCase()}`}>{share.status === "ACTIVE" ? "有效" : share.status === "EXPIRED" ? "已过期" : share.status === "LIMIT_REACHED" ? "次数已用完" : "已撤销"}</span>
        <div><b>{share.itemCount} 个凭据 · {share.shareMode === "DIRECT" ? `指定给 ${share.recipientUsername}` : share.accessCodeEnabled ? "访问码保护" : "链接访问"}</b><small><Clock3 size={12} />{share.status === "ACTIVE" ? `剩余 ${formatRemaining(share.expireTime, now)}` : new Date(normalizeDateTime(share.expireTime)).toLocaleString("zh-CN", { hour12: false })}{share.shareMode === "LINK" ? ` · 已访问 ${share.accessCount}${share.maxAccessCount ? `/${share.maxAccessCount}` : ""}` : ""}</small></div>
        <div className="vault-share-actions"><button type="button" onClick={(event) => { event.stopPropagation(); void openShareDetail(share); }}><Eye size={14} />详情</button>{share.status === "ACTIVE" && share.sharePath ? <button type="button" onClick={(event) => { event.stopPropagation(); void copy(`${location.origin}${share.sharePath}`, "授权链接已复制"); }}><Copy size={14} />复制</button> : null}{share.status === "ACTIVE" ? <button type="button" onClick={async (event) => { event.stopPropagation(); await revokeVaultShare(share.id); notify("授权已撤销"); await load(true); }}><X size={14} />撤销</button> : null}</div>
      </article>) : <div className="vault-empty compact">还没有创建临时授权</div>}</div>
    </section> : null}

    {view === "settings" ? <section className="vault-settings"><header className="vault-panel-head"><div><h2>设置</h2><p>这些偏好会跟随当前账号保存</p></div></header><div className="vault-settings-group"><header><div><b>界面显示</b><small>验证码与账号列表</small></div><span>5 项</span></header>{([['masked', EyeOff, '隐藏账号', '在列表中遮住账号主体', 'violet'], ['compact', LayoutGrid, '紧凑卡片', '缩小留白，一屏看到更多内容', 'blue'], ['grouped', Layers3, '按系统分组', '将同一系统的凭据排列在一起', 'green'], ['showShared', User, '显示共享', '在全部列表中展示别人分享给我的凭据', 'blue'], ['autoRefresh', Clock3, '自动刷新', '定时同步授权状态和新增共享', 'green']] as const).map(([key, Icon, title, detail, tone]) => <label className="vault-setting-row" key={key}><span className={`vault-setting-icon is-${tone}`}><Icon size={17} /></span><span className="vault-setting-copy"><b>{title}</b><small>{detail}</small></span><input type="checkbox" checked={prefs[key]} onChange={(event) => updatePrefs({ ...prefs, [key]: event.target.checked })} /><i /></label>)}</div><footer className="vault-settings-note"><ShieldCheck size={15} /><span><b>账号偏好</b><small>换设备登录后会自动同步。</small></span></footer></section> : null}

    <nav className="vault-mobile-nav" aria-label="密钥管理导航">
      {([['all', KeyRound, '全部'], ['favorite', Star, '收藏'], ['shares', Link2, '授权'], ['settings', Settings2, '设置']] as const).map(([key, Icon, label]) => <button type="button" className={view === key ? "is-active" : ""} onClick={() => changeView(key)} key={key}><Icon size={18} /><span>{label}</span></button>)}
    </nav>

    {modal === "detail" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="vault-modal share vault-share-form vault-detail">
      <header><div><small>CREDENTIAL DETAIL</small><h2>凭据详情</h2><p>{liveDetail ? <>{liveDetail.issuer} · <span className={accountClass}>{liveDetail.accountName}</span></> : "正在安全读取"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header>
      {detailLoading || !liveDetail ? <div className="vault-share-scroll"><div className="vault-detail-loading"><LoaderCircle className="spin" size={22} />正在安全读取…</div></div> : <>
        <div className="vault-share-scroll">
          <section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>凭据身份</h3></div>{liveDetail.shared ? <span className="vault-shared-badge">共享</span> : null}</div><div className="vault-detail-identity"><span className="vault-service-mark">{liveDetail.issuer.slice(0, 2).toUpperCase()}</span><div><b>{liveDetail.issuer}</b><small>{liveDetail.shared ? `${liveDetail.sharedBy} 分享 · ${liveDetail.shareExpireTime ? formatRemaining(liveDetail.shareExpireTime, now) : "临时有效"}` : `${liveDetail.sensitivityLevel === "HIGH" ? "高敏感" : liveDetail.sensitivityLevel === "SAFE" ? "敏感" : "普通"}标记`}</small></div></div></section>
          <section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>账号与验证码</h3></div></div><div className="vault-detail-values">
            <section><span>账号</span><div><b>{liveDetail.accountName}</b>{!liveDetail.shared || liveDetail.allowCopy ? <button type="button" onClick={() => void copy(liveDetail.accountName, "账号已复制")} aria-label="复制账号"><Copy size={15} /></button> : null}</div></section>
            {liveDetail.passwordConfigured ? <section><span>密码</span><div><b className={passwordVisible ? "" : "is-secret"}>{passwordVisible ? liveDetail.password : "••••••••••••"}</b><button type="button" onClick={() => setPasswordVisible(!passwordVisible)} aria-label={passwordVisible ? "隐藏密码" : "显示密码"}>{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button>{liveDetail.password && (!liveDetail.shared || liveDetail.allowCopy) ? <button type="button" onClick={() => void copy(liveDetail.password || "", "密码已复制")} aria-label="复制密码"><Copy size={15} /></button> : null}</div></section> : null}
            {liveDetail.currentOtp ? <section className="is-otp"><span>动态验证码</span><div><b>{liveDetail.currentOtp.replace(/(.{3})/, "$1 ")}</b>{!liveDetail.shared || liveDetail.allowCopy ? <button type="button" onClick={() => void copy(liveDetail.currentOtp || "", "验证码已复制")} aria-label="复制验证码"><Copy size={15} /></button> : null}</div></section> : null}
          </div></section>
          {liveDetail.loginUrl || liveDetail.note ? <section className="vault-share-section"><div className="vault-section-title"><div><span>03</span><h3>补充信息</h3></div></div>{liveDetail.loginUrl ? <a className="vault-detail-link" href={liveDetail.loginUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /><span>{liveDetail.loginUrl}</span></a> : null}{liveDetail.note ? <p className="vault-detail-note">{liveDetail.note}</p> : null}</section> : null}
        </div>
        <footer><span>{liveDetail.shared ? "共享凭据只允许查看" : "可继续分享或编辑这条凭据"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>关闭</button>{!liveDetail.shared ? <><button type="button" className="vault-ghost" onClick={() => openShare(liveDetail.id)}><Share2 size={15} />分享</button><button type="button" className="vault-primary" onClick={() => openCredential(liveDetail)}>编辑</button></> : null}</div></footer>
      </>}
    </section></div> : null}

    {modal === "scanner" ? <div className="vault-modal-mask"><section className="vault-modal small vault-scanner"><header><div><small>QR SCANNER</small><h2>扫描验证器二维码</h2></div><button type="button" onClick={() => { stopScanner(); setModal("credential"); }} aria-label="关闭"><X size={18} /></button></header>
      <div className="vault-scanner-view"><video ref={scanVideoRef} autoPlay muted playsInline /><span><ScanLine size={25} /></span></div>
      <p className="vault-modal-note">支持标准 OTP 二维码和 Google Authenticator 单条导出二维码。</p>
      <div className="vault-scan-files"><label className="vault-file vault-scan-file"><Camera size={19} /><span>拍照识别</span><input type="file" accept="image/*" capture="environment" onChange={(event) => void scanImage(event.target.files?.[0])} /></label><label className="vault-file vault-scan-file"><FileUp size={19} /><span>读取本地图片</span><input type="file" accept="image/*" onChange={(event) => void scanImage(event.target.files?.[0])} /></label></div>
      <label><span>或粘贴二维码内容</span><textarea rows={3} value={scanText} onChange={(event) => setScanText(event.target.value)} placeholder="otpauth:// 或 otpauth-migration://" /></label>
      {scanError ? <p className="vault-scan-error" role="alert">{scanError}</p> : null}
      <footer><button type="button" className="vault-ghost" onClick={() => { stopScanner(); setModal("credential"); }}>返回</button><button type="button" className="vault-primary" disabled={!scanText.trim() || busy} onClick={() => void applyScannedCredential(scanText).catch((error) => setScanError(error instanceof Error ? error.message : "二维码内容无效"))}>{busy ? "导入中" : "识别内容"}</button></footer>
    </section></div> : null}

    {modal === "credential" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><form className="vault-modal share vault-share-form" onSubmit={submitCredential}><header><div><small>CREDENTIAL</small><h2>{editingId ? "编辑凭据" : "添加凭据"}</h2><p>{editingId ? "修改后立即同步到当前凭据" : "扫码或手动录入一条新的验证器数据"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll">{!editingId ? <section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>快捷录入</h3></div></div><button type="button" className="vault-scan-entry" onClick={() => void openScanner()}><ScanLine size={18} /><span><b>扫描验证器二维码</b><small>自动识别 Google Authenticator 和标准 OTP 数据</small></span></button></section> : null}<section className="vault-share-section"><div className="vault-section-title"><div><span>{editingId ? "01" : "02"}</span><h3>凭据信息</h3></div></div><div className="vault-form-grid">
      <label><span>系统名称</span><input required maxLength={80} value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="例如 GitHub" /></label>
      <label><span>账号</span><input required maxLength={160} value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="邮箱或用户名" /></label>
      <label className="wide"><span>OTP Secret {editingId ? "（留空不修改）" : ""}</span><input value={form.otpSecret} onChange={(e) => setForm({ ...form, otpSecret: e.target.value.toUpperCase().replace(/[^A-Z2-7=\s-]/g, "") })} autoComplete="off" placeholder="Base32 Secret" /></label>
      <label><span>算法</span><select value={form.algorithm} onChange={(e) => setForm({ ...form, algorithm: e.target.value })}><option value="SHA1">SHA1</option><option value="SHA256">SHA256</option><option value="SHA512">SHA512</option></select></label>
      <label><span>验证码位数</span><select value={form.digits} onChange={(e) => setForm({ ...form, digits: Number(e.target.value) })}><option value={6}>6 位</option><option value={8}>8 位</option></select></label>
      <label><span>更新周期（秒）</span><input type="number" min={15} max={120} value={form.periodSeconds} onChange={(e) => setForm({ ...form, periodSeconds: Number(e.target.value) })} /></label>
      <label><span>密码 {editingId ? "（留空不修改）" : "（可选）"}</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></label>
      <label className="wide"><span>登录地址</span><input type="url" value={form.loginUrl} onChange={(e) => setForm({ ...form, loginUrl: e.target.value })} placeholder="https://" /></label>
      <label className="wide"><span>备注</span><textarea rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      <label><span>敏感标记</span><select value={form.sensitivityLevel} onChange={(e) => setForm({ ...form, sensitivityLevel: e.target.value })}><option value="STANDARD">普通</option><option value="SAFE">敏感</option><option value="HIGH">高敏感</option></select></label>
      <label className="vault-check"><input type="checkbox" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} /><span>加入收藏</span></label>
    </div></section></div><footer><span>{editingId ? "保存后会更新这条凭据" : "请确认系统、账号和 Secret 无误"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>取消</button><button className="vault-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{busy ? "保存中" : "保存凭据"}</button></div></footer></form></div> : null}

    {modal === "import" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><form className="vault-modal share vault-share-form vault-import-form" onSubmit={submitImport}><header><div><small>IMPORT</small><h2>导入文件</h2><p>选择文件或直接粘贴文件内容，确认后加密保存到当前账号</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>选择文件</h3></div></div><p className="vault-section-help">支持包含 OTP 地址的文本文件</p><label className="vault-file"><FileUp size={20} /><span>{legacyText ? "文件已读取" : "选择文件"}</span><input type="file" accept=".txt,text/plain" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setLegacyText(await file.text()); }} /></label></section><section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>粘贴文件内容</h3></div></div><label><span>文件内容</span><textarea rows={7} value={legacyText} onChange={(event) => setLegacyText(event.target.value)} placeholder="把文件内容粘贴到这里，也可以直接选择文件自动填充" /></label></section></div><footer><span>{legacyText.trim() ? "内容已准备好，可以开始导入" : "请选择文件或粘贴文件内容"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>取消</button><button className="vault-primary" disabled={busy || !legacyText.trim()}>{busy ? "导入中" : "确认导入"}</button></div></footer></form></div> : null}

    {modal === "shareDetail" ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="vault-modal share vault-share-form vault-share-detail">
      <header><div><small>AUTHORIZATION DETAIL</small><h2>临时授权详情</h2><p>{shareDetail ? `${shareDetail.itemCount} 个凭据 · ${shareDetail.shareMode === "DIRECT" ? "指定用户" : "链接分享"}` : "正在读取授权配置"}</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header>
      {shareDetailLoading || !shareDetail ? <div className="vault-share-scroll"><div className="vault-detail-loading"><LoaderCircle className="spin" size={22} />正在读取授权配置…</div></div> : <>
        <div className="vault-share-scroll">
          <section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>授权状态</h3></div><span className={`vault-status is-${shareDetail.status.toLowerCase()}`}>{shareDetail.status === "ACTIVE" ? "有效" : shareDetail.status === "EXPIRED" ? "已过期" : shareDetail.status === "LIMIT_REACHED" ? "次数已用完" : "已撤销"}</span></div><div className="vault-share-detail-hero"><div><small>剩余有效时间</small><b>{shareDetail.status === "ACTIVE" ? formatRemaining(shareDetail.expireTime, now) : "授权已结束"}</b></div></div><div className="vault-share-detail-grid"><section><span>授权内容</span><b>{shareDetail.itemCount} 个凭据</b></section><section><span>{shareDetail.shareMode === "DIRECT" ? "接收人" : "访问次数"}</span><b>{shareDetail.shareMode === "DIRECT" ? shareDetail.recipientUsername : `${shareDetail.accessCount}${shareDetail.maxAccessCount ? ` / ${shareDetail.maxAccessCount}` : " / 不限"}`}</b></section><section><span>访问方式</span><b>{shareDetail.shareMode === "DIRECT" ? "指定用户" : shareDetail.accessCodeEnabled ? "访问码验证" : "链接直达"}</b></section><section><span>复制权限</span><b>{shareDetail.allowCopy ? "允许复制" : "仅查看"}</b></section></div></section>
          <section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>访问内容</h3></div></div><div className="vault-permission-tags">{([["showAccount", "账号"], ["showPassword", "密码"], ["showOtp", "OTP"], ["showLoginUrl", "登录地址"], ["showNote", "备注"]] as const).filter(([key]) => shareDetail[key]).map(([, label]) => <b key={label}>{label}</b>)}</div>{shareDetail.sharePath ? <label><span>授权链接</span><div className="vault-copy-row"><input readOnly value={`${location.origin}${shareDetail.sharePath}`} /><button type="button" onClick={() => void copy(`${location.origin}${shareDetail.sharePath}`, "授权链接已复制")} aria-label="复制授权链接"><Copy size={15} /></button></div></label> : null}{shareDetail.shareMode === "DIRECT" ? <p className="vault-modal-note">该授权只会显示在 {shareDetail.recipientUsername} 的 OTP Vault 中，到期或撤销后自动消失。</p> : shareDetail.accessCodeEnabled ? <label><span>访问码</span>{shareDetail.accessCode ? <button type="button" className="vault-access-code vault-access-code-button is-detail" onClick={() => void copy(shareDetail.accessCode || "", "访问码已复制")}>{shareDetail.accessCode}<Copy size={15} /></button> : <p className="vault-modal-note">这是升级前创建的授权，当时只保存了不可逆哈希，无法还原访问码。请重新创建授权。</p>}</label> : <p className="vault-modal-note">此授权未启用访问码，获得链接即可访问。</p>}</section>
          {shareDetail.shareMode === "LINK" ? <section className="vault-share-section"><div className="vault-section-title"><div><span>03</span><h3>访问记录</h3></div><button type="button">{shareDetail.accessRecords?.length || 0} 条</button></div><div className="vault-access-records">{shareDetail.accessRecords?.length ? <div>{shareDetail.accessRecords.map((record, index) => <article key={`${record.createTime}-${index}`} className={record.success ? "is-success" : "is-failed"}><span>{record.success ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}</span><div><b>{accessActionLabel(record.action, record.success)}</b><small>{record.ipAddress || "未知 IP"} · {deviceLabel(record.userAgent)}</small>{record.detail ? <em>{record.detail}</em> : null}</div><time>{new Date(normalizeDateTime(record.createTime)).toLocaleString("zh-CN", { hour12: false })}</time></article>)}</div> : <p>还没有访问记录</p>}</div></section> : null}
        </div>
        <footer><span>{shareDetail.status === "ACTIVE" ? "授权仍在有效期内" : "授权已结束"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>关闭</button>{shareDetail.status === "ACTIVE" ? <button type="button" className="vault-danger" onClick={async () => { await revokeVaultShare(shareDetail.id); notify("授权已撤销"); setModal(null); await load(true); }}>撤销授权</button> : null}</div></footer>
      </>}
    </section></div> : null}

    {modal === "share" ? <div className="vault-modal-mask"><form className="vault-modal share vault-share-form" onSubmit={submitShare}>
      <header><div><small>TEMPORARY ACCESS</small><h2>创建临时授权</h2><p>已选择 {selected.length} 项，配置完成后立即生成</p></div><button type="button" onClick={closeModal} aria-label="关闭"><X size={18} /></button></header>
      <div className="vault-share-scroll">
        <section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>选择授权凭据</h3></div><button type="button" onClick={() => setSelected(selected.length === ownCredentials.length ? [] : ownCredentials.map((item) => item.id))}>{selected.length === ownCredentials.length ? "取消全选" : "全部选择"}</button></div><div className="vault-select-list">{ownCredentials.map((item) => <label className={selected.includes(item.id) ? "is-selected" : ""} key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span><b>{item.issuer}</b><small>{item.accountName}</small></span><Check size={15} /></label>)}</div></section>
        <section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>接收方式与有效期</h3></div></div><div className="vault-share-mode"><button type="button" className={shareForm.shareMode === "LINK" ? "is-active" : ""} onClick={() => setShareForm({ ...shareForm, shareMode: "LINK" })}><Link2 size={15} /><span><b>分享链接</b><small>任何获得链接的人</small></span></button><button type="button" className={shareForm.shareMode === "DIRECT" ? "is-active" : ""} onClick={() => setShareForm({ ...shareForm, shareMode: "DIRECT" })}><User size={15} /><span><b>指定用户</b><small>显示在对方的全部列表</small></span></button></div>{shareForm.shareMode === "DIRECT" ? <div className="vault-recipient-input"><span>接收人账号</span><label className="vault-recipient-field"><Search size={15} /><input required maxLength={30} value={shareForm.recipientUsername} onChange={(e) => setShareForm({ ...shareForm, recipientUsername: e.target.value.trimStart() })} placeholder="搜索账号、昵称或邮箱" />{recipientLoading ? <LoaderCircle className="spin" size={14} /> : null}</label>{recipients.length ? <div className="vault-recipient-list">{recipients.map((user) => <button type="button" key={user.userId} onClick={() => { setShareForm({ ...shareForm, recipientUsername: user.userName }); setRecipients([]); }}><User size={14} /><span><b>{user.nickName || user.userName}</b><small>{user.userName}{user.email ? ` · ${user.email}` : ""}</small></span></button>)}</div> : shareForm.recipientUsername.trim().length >= 2 && !recipientLoading ? <p>没有匹配账号</p> : null}</div> : null}<div className="vault-form-grid vault-single-field"><label><span>有效天数</span><input type="number" min={1} max={365} value={shareForm.durationSeconds / 86400} onChange={(e) => setShareForm({ ...shareForm, durationSeconds: Number(e.target.value) * 86400 })} /></label></div>{shareForm.shareMode === "LINK" ? <div className="vault-toggle-row"><label className="vault-check"><input type="checkbox" checked={shareForm.accessCodeEnabled} onChange={(e) => setShareForm({ ...shareForm, accessCodeEnabled: e.target.checked })} /><span><b>访问码保护</b><small>{shareForm.accessCodeEnabled ? "生成 5 位短链接，访问时再次验证" : "关闭后使用 10 位安全链接"}</small></span></label>{shareForm.accessCodeEnabled ? <div className="vault-inline"><label className="vault-check"><input type="radio" checked={shareForm.accessCodeMode === "AUTO"} onChange={() => setShareForm({ ...shareForm, accessCodeMode: "AUTO" })} /><span>自动生成</span></label><label className="vault-check"><input type="radio" checked={shareForm.accessCodeMode === "CUSTOM"} onChange={() => setShareForm({ ...shareForm, accessCodeMode: "CUSTOM" })} /><span>自定义</span></label>{shareForm.accessCodeMode === "CUSTOM" ? <input required minLength={4} maxLength={12} value={shareForm.accessCode} onChange={(e) => setShareForm({ ...shareForm, accessCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="4-12 位" /> : null}</div> : null}</div> : <p className="vault-modal-note">对方登录后即可在“全部”中查看，到期或撤销后自动移除。</p>}</section>
        <section className="vault-share-section"><div className="vault-section-title"><div><span>03</span><h3>访问权限</h3></div></div><p className="vault-section-help">只勾选对方确实需要查看的内容</p><div className="vault-option-grid">{([['showAccount','账号'],['showPassword','密码'],['showOtp','动态验证码'],['showLoginUrl','登录地址'],['showNote','备注']] as const).map(([key, label]) => <label className={shareForm[key] ? "is-selected" : ""} key={key}><input type="checkbox" checked={Boolean(shareForm[key])} onChange={(e) => setShareForm({ ...shareForm, [key]: e.target.checked })} /><Check size={14} /><span>{label}</span></label>)}</div><div className="vault-form-grid vault-access-options"><label className="vault-check"><input type="checkbox" checked={shareForm.allowCopy} onChange={(e) => setShareForm({ ...shareForm, allowCopy: e.target.checked })} /><span><b>允许复制</b><small>否则只能在页面中查看</small></span></label>{shareForm.shareMode === "LINK" ? <><label className="vault-check"><input type="checkbox" checked={shareForm.oneTime} onChange={(e) => setShareForm({ ...shareForm, oneTime: e.target.checked })} /><span><b>一次性访问</b><small>成功访问一次后立即失效</small></span></label><label><span>最大访问次数（可选）</span><input type="number" min={1} max={1000} disabled={shareForm.oneTime} value={shareForm.oneTime ? "1" : shareForm.maxAccessCount} onChange={(e) => setShareForm({ ...shareForm, maxAccessCount: e.target.value })} placeholder="不填则不限" /></label></> : null}</div></section>
      </div>
      <footer><span>{selected.length ? `将授权 ${selected.length} 个凭据 · ${shareForm.shareMode === "DIRECT" ? `指定给 ${shareForm.recipientUsername || "用户"}` : shareForm.accessCodeEnabled ? "访问码保护" : "链接直达"}` : "请先选择授权凭据"}</span><div><button type="button" className="vault-ghost" onClick={closeModal}>取消</button><button className="vault-primary" disabled={busy || !selected.length}>{busy ? "生成中" : "生成授权"}</button></div></footer>
    </form></div> : null}

    {modal === "deleteConfirm" && pendingDelete ? <div className="vault-modal-mask" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) { setPendingDelete(null); closeModal(); } }}><section className="vault-modal share vault-share-form vault-delete-modal"><header><div><small>DELETE CREDENTIAL</small><h2>删除凭据</h2><p>这项操作会同步撤回相关临时授权</p></div><button type="button" onClick={() => { setPendingDelete(null); closeModal(); }} aria-label="关闭"><X size={18} /></button></header><div className="vault-share-scroll"><section className="vault-share-section"><div className="vault-section-title"><div><span>01</span><h3>将要删除</h3></div></div><div className="vault-delete-summary"><span className="vault-delete-icon"><Trash2 size={21} /></span><div><b>{pendingDelete.issuer}</b><small>{pendingDelete.accountName}</small></div></div></section><section className="vault-share-section"><div className="vault-section-title"><div><span>02</span><h3>影响范围</h3></div></div><p className="vault-section-help">删除后会从你的保险库中移除，包含它的临时授权也会一起失效。</p></section></div><footer><span>确认后立即生效</span><div><button type="button" className="vault-ghost" disabled={busy} onClick={() => { setPendingDelete(null); closeModal(); }}>取消</button><button type="button" className="vault-danger" disabled={busy} onClick={() => void removeCredential()}>{busy ? "删除中" : "确认删除"}</button></div></footer></section></div> : null}

    {modal === "created" && created ? <div className="vault-modal-mask"><section className="vault-modal small vault-created"><header><div><small>READY</small><h2>授权已创建</h2></div><button type="button" onClick={closeModal}><X size={18} /></button></header><span className="vault-created-icon"><Check size={24} /></span><div className="vault-created-countdown"><Clock3 size={15} /><span><small>剩余有效时间</small><b>{formatRemaining(created.expireTime, now)}</b></span></div>{created.shareMode === "DIRECT" ? <div className="vault-direct-created"><User size={20} /><span><small>已授权给</small><b>{created.recipientUsername}</b><p>对方登录后可在“全部”中查看，到期或撤销后自动移除。</p></span></div> : <><label><span>授权链接</span><div className="vault-copy-row"><input readOnly value={created.shareUrl || ""} /><button type="button" onClick={() => void copy(created.shareUrl || "")}><Copy size={15} /></button></div></label>{created.accessCode ? <label><span>访问码</span><button type="button" className="vault-access-code vault-access-code-button" onClick={() => void copy(created.accessCode || "", "访问码已复制")}>{created.accessCode}<Copy size={15} /></button></label> : null}<div className="vault-created-actions"><button type="button" className="vault-ghost" onClick={() => void copy(fullShareText, "完整分享信息已复制")}>复制链接和访问码</button>{created.autoFillAllowed ? <button type="button" className="vault-primary" onClick={() => void copy(autoFillUrl, "自动填充链接已复制")}>复制自动填充链接</button> : null}</div><p>访问码以后仍可从临时授权详情查看，访问结果也会记录在详情中。</p></>}</section></div> : null}

    {notice ? <div className={`vault-toast${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.error ? <X size={15} /> : <Check size={15} />}{notice.text}</div> : null}
  </div>;
}

function normalizeDateTime(value: string) {
  return value.includes("T") ? value : value.replace(" ", "T");
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
