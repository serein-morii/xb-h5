import { ApiError, apiRequest, copyToClipboard, getStoredToken, readFromClipboard } from "../lib/api";

export type LabPlatformId = "DOUYIN" | "XIAOHONGSHU" | "BILIBILI";

export type LabExtractResult = {
  platform: LabPlatformId;
  videoId?: string | null;
  title?: string | null;
  description?: string | null;
  originalUrl: string;
  resolvedUrl?: string | null;
  author?: { id?: string | null; nickname?: string | null; avatarUrl?: string | null } | null;
  media?: {
    mediaType?: "VIDEO" | "IMAGE" | string | null;
    coverUrl?: string | null;
    videoUrl?: string | null;
    videoUrls?: string[] | null;
    imageUrls?: string[] | null;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
  } | null;
  cached?: boolean;
  extractedAt?: string | null;
  historyId?: number | null;
};

export const LAB_PLATFORMS: Array<{
  id: LabPlatformId;
  name: string;
  pattern: RegExp;
  placeholder: string;
}> = [
  { id: "DOUYIN", name: "抖音", pattern: /douyin\.com|iesdouyin\.com/i, placeholder: "粘贴抖音分享口令或链接" },
  { id: "XIAOHONGSHU", name: "小红书", pattern: /xiaohongshu\.com|xhslink\.com|xhslink\.cn|xhscdn\.com/i, placeholder: "粘贴小红书笔记或分享链接" },
  { id: "BILIBILI", name: "哔哩哔哩", pattern: /bilibili\.com|b23\.tv|bili2233\.cn/i, placeholder: "粘贴哔哩哔哩视频或分享链接" },
];

export function extractShareUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch {
    const match = trimmed.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
    return match?.[0] || "";
  }
}

export function detectLabPlatform(url: string) {
  return LAB_PLATFORMS.find((item) => item.pattern.test(url)) || null;
}

export function extractLabVideo(url: string, forceRefresh = false) {
  return apiRequest<{ data?: LabExtractResult }>("/lab/video/extract", {
    auth: Boolean(getStoredToken()),
    method: "POST",
    body: { url, forceRefresh },
    timeoutMs: 45_000,
  });
}

export function listLabExtractHistory(limit = 20) {
  return apiRequest<{ data?: LabExtractResult[] }>("/lab/video/history", { query: { limit } });
}

export function deleteLabExtractHistory(id: number) {
  return apiRequest(`/lab/video/history/${id}`, { method: "DELETE" });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

function safeName(value?: string | null) {
  return (value || "media").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "media";
}

async function fetchDirect(url: string) {
  const response = await fetch(url, { method: "GET", headers: { Accept: "*/*" }, referrerPolicy: "no-referrer" });
  if (!response.ok) throw new ApiError(`下载失败（${response.status}）`, response.status);
  const blob = await response.blob();
  if (!blob.size) throw new ApiError("下载内容为空");
  return blob;
}

export async function downloadDirectFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadDirectFiles(urls: string[], zipName: string, singleName: string) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) throw new ApiError("没有可下载的地址");
  for (const [index, url] of unique.entries()) {
    const name = unique.length === 1 ? singleName : `${safeName(singleName.replace(/\.[^.]+$/, ""))}-${String(index + 1).padStart(2, "0")}`;
    await downloadDirectFile(url, name);
  }
}

function createStoredZip(entries: Array<{ name: string; data: Uint8Array }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localParts.push(local);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralParts.reduce((sum, part) => sum + part.length, 0), true);
  endView.setUint32(16, offset, true);
  const total = localParts.concat(centralParts, [end]).reduce((sum, part) => sum + part.length, 0);
  const zip = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    zip.set(part, cursor);
    cursor += part.length;
  }
  return new Blob([zip], { type: "application/zip" });
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

export function mediaFileName(result: LabExtractResult, ext = "mp4") {
  return `${safeName(result.title || result.videoId)}.${ext}`;
}

export { copyToClipboard, readFromClipboard };
