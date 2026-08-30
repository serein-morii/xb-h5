import { ApiError, apiRequest, copyToClipboard, getStoredToken, readFromClipboard } from "../../lib/api";
import { API_PATHS } from "../../lib/pathConventions";

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
  return apiRequest<{ data?: LabExtractResult }>(`${API_PATHS.lab.video}/extract`, {
    auth: Boolean(getStoredToken()),
    method: "POST",
    body: { url, forceRefresh },
    timeoutMs: 45_000,
  });
}

export function listLabExtractHistory(limit = 20) {
  return apiRequest<{ data?: LabExtractResult[] }>(`${API_PATHS.lab.video}/history`, { query: { limit } });
}

export function deleteLabExtractHistory(id: number) {
  return apiRequest(`${API_PATHS.lab.video}/history/${id}`, { method: "DELETE" });
}

function safeName(value?: string | null) {
  return (value || "media").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "media";
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


export function mediaFileName(result: LabExtractResult, ext = "mp4") {
  return `${safeName(result.title || result.videoId)}.${ext}`;
}

export { copyToClipboard, readFromClipboard };
