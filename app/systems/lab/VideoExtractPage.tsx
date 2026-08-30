import { useEffect, useMemo, useState } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import { Check, ClipboardPaste, Download, ExternalLink, Link2, LoaderCircle, Trash2, X } from "lucide-react";
import { ApiError, getStoredToken } from "../../lib/api";
import {
  copyToClipboard,
  deleteLabExtractHistory,
  detectLabPlatform,
  downloadDirectFile,
  downloadDirectFiles,
  extractLabVideo,
  extractShareUrl,
  LAB_PLATFORMS,
  listLabExtractHistory,
  mediaFileName,
  readFromClipboard,
  type LabExtractResult,
  type LabPlatformId,
} from "./videoExtractApi";
import "./video-extract.css";

function platformName(id?: string | null) {
  return LAB_PLATFORMS.find((item) => item.id === id)?.name || id || "未知平台";
}

function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatExtractedAt(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const delta = Date.now() - date.getTime();
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export default function VideoExtractPage() {
  const [input, setInput] = useState("");
  const [highlight, setHighlight] = useState<LabPlatformId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LabExtractResult | null>(null);
  const [history, setHistory] = useState<LabExtractResult[]>([]);
  const [signedIn, setSignedIn] = useState(() => Boolean(getStoredToken()));
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [videoFailed, setVideoFailed] = useState(false);

  const detected = useMemo(() => detectLabPlatform(extractShareUrl(input) || input), [input]);
  const placeholder = LAB_PLATFORMS.find((item) => item.id === (highlight || detected?.id))?.placeholder
    || "粘贴抖音 / 小红书 / B 站分享口令或链接";
  const imageUrls = result?.media?.imageUrls?.filter(Boolean) || [];
  const videoUrl = result?.media?.videoUrl || "";
  const coverUrl = result?.media?.coverUrl || imageUrls[0] || "";
  const isImage = imageUrls.length > 0;
  const isVideo = Boolean(videoUrl);

  useEffect(() => {
    if (!signedIn) return;
    listLabExtractHistory(12)
      .then((payload) => setHistory(Array.isArray(payload.data) ? payload.data : []))
      .catch(() => setHistory([]));
  }, [signedIn, result?.historyId]);

  useEffect(() => {
    setVideoFailed(false);
  }, [videoUrl]);

  async function handleExtract(forceRefresh = false) {
    const url = extractShareUrl(input);
    if (!url) {
      setError("请先粘贴分享链接");
      return;
    }
    if (!detectLabPlatform(url)) {
      setError("目前只支持抖音、小红书、哔哩哔哩");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await extractLabVideo(url, forceRefresh);
      if (!payload.data) throw new ApiError("解析结果为空");
      setResult(payload.data);
      setSignedIn(Boolean(getStoredToken()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await readFromClipboard();
      setInput(text);
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.message === "已取消粘贴") return;
      setError(err instanceof Error ? err.message : "无法读取剪贴板");
    }
  }

  async function handleCopy(text?: string | null) {
    if (!text) return;
    const ok = await copyToClipboard(text);
    setBusy(ok ? "链接已复制" : "复制失败");
    window.setTimeout(() => setBusy(""), 1600);
  }

  async function handleDownloadVideo() {
    if (!videoUrl || !result) return;
    setBusy("正在下载视频…");
    try {
      await downloadDirectFile(videoUrl, mediaFileName(result));
      setBusy("已开始下载");
    } catch (err) {
      setBusy(err instanceof Error ? err.message : "下载失败");
    }
    window.setTimeout(() => setBusy(""), 2200);
  }

  async function handleDownloadImages() {
    const urls = imageUrls.length ? imageUrls : coverUrl ? [coverUrl] : [];
    if (!urls.length || !result) return;
    setBusy("正在打包图片…");
    try {
      await downloadDirectFiles(urls, mediaFileName(result, "zip"), mediaFileName(result, "jpg"));
      setBusy("已开始下载");
    } catch (err) {
      setBusy(err instanceof Error ? err.message : "打包失败");
    }
    window.setTimeout(() => setBusy(""), 2200);
  }

  async function handleDelete(id?: number | null) {
    if (!id) return;
    await deleteLabExtractHistory(id);
    setHistory((prev) => prev.filter((item) => item.historyId !== id));
    if (result?.historyId === id) setResult(null);
  }

  return <div className="vx">
    <header className="vx-head">
      <span className="vx-mark" aria-hidden="true">解</span>
      <div>
        <h1>视频提取工具</h1>
        <p>免费在线短视频提取，当前支持抖音、小红书、哔哩哔哩。无需登录即可解析，登录后台后会留下记录。</p>
      </div>
    </header>

    <ul className="vx-chips">
      <li>免费使用</li>
      <li>无需登录</li>
      <li>高清解析</li>
      <li>可扩展多平台</li>
    </ul>

    <section className="vx-panel">
      <label htmlFor="lab-extract-input"><em>*</em> 请输入短视频分享链接</label>
      <div className={`vx-field${error ? " is-error" : ""}`}>
        <Link2 size={18} />
        <input
          id="lab-extract-input"
          value={input}
          placeholder={placeholder}
          onChange={(event) => { setInput(event.target.value); setError(""); }}
          onKeyDown={(event) => { if (event.key === "Enter") void handleExtract(); }}
        />
        {input
          ? <button type="button" onClick={() => setInput("")} aria-label="清空"><X size={16} /></button>
          : <button type="button" onClick={() => void handlePaste()} aria-label="粘贴"><ClipboardPaste size={16} /></button>}
      </div>
      <div className="vx-platforms">
        {LAB_PLATFORMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={highlight === item.id || detected?.id === item.id ? "is-on" : ""}
            onClick={() => setHighlight(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="vx-actions">
        <button type="button" className="vx-primary" disabled={loading} onClick={() => void handleExtract()}>
          {loading ? <LoaderCircle size={16} className="vx-spin" /> : <Check size={16} />}
          {loading ? "提取中…" : "开始解析"}
        </button>
        {result ? <button type="button" className="vx-ghost" disabled={loading} onClick={() => void handleExtract(true)}>强制刷新</button> : null}
      </div>
      {error ? <p className="vx-error">{error}</p> : null}
      {busy ? <p className="vx-busy">{busy}</p> : null}
    </section>

    {result ? <section className="vx-result">
      <div className="vx-result-bar">
        <span>提取成功</span>
        <button type="button" onClick={() => setResult(null)} aria-label="关闭结果"><X size={16} /></button>
      </div>
      {isVideo ? (
        videoFailed
          ? <a className="vx-cover" href={videoUrl} target="_blank" rel="noreferrer">
              {coverUrl ? <img src={coverUrl} alt="" /> : null}
              <em>打开直链播放</em>
            </a>
          : <video className="vx-player" src={videoUrl} poster={coverUrl || undefined} controls playsInline preload="metadata" onError={() => setVideoFailed(true)} />
      ) : null}
      {isImage ? (
        <div className="vx-gallery">
          {imageUrls.map((url, index) => (
            <button key={url} type="button" onClick={() => setPreviewIndex(index)}>
              <img src={url} alt={`${result.title || "图片"} ${index + 1}`} referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="vx-info">
        <h2>{result.title || "未命名作品"}</h2>
        <div className="vx-author">
          {result.author?.avatarUrl && result.platform !== "BILIBILI" ? <img src={result.author.avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
          <div>
            <strong>{result.author?.nickname || "未知作者"}</strong>
            <small>ID: {result.videoId || "—"}</small>
          </div>
        </div>
        <div className="vx-meta">
          {result.media?.width && result.media?.height ? <span>{result.media.width} × {result.media.height}</span> : null}
          {isVideo && formatDuration(result.media?.durationMs) ? <span>{formatDuration(result.media?.durationMs)}</span> : null}
          {isImage ? <span>{imageUrls.length} 张图片</span> : null}
          <span>{platformName(result.platform)}</span>
          {result.cached ? <span className="is-cache">缓存</span> : null}
        </div>
        <p className="vx-time">提取于 {formatExtractedAt(result.extractedAt)}</p>
      </div>
      <div className="vx-toolbar">
        {videoUrl ? <button type="button" className="vx-primary" onClick={() => void handleDownloadVideo()}><Download size={15} />下载视频</button> : null}
        {imageUrls.length ? <button type="button" className="vx-primary" onClick={() => void handleDownloadImages()}><Download size={15} />下载图片包</button> : null}
        <button type="button" className="vx-ghost" onClick={() => void handleCopy(videoUrl || imageUrls[0])}><Link2 size={15} />复制链接</button>
        {result.originalUrl ? <a className="vx-ghost" href={result.originalUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />原始链接</a> : null}
      </div>
    </section> : null}

    <section className="vx-history">
      <header>
        <div><small>HISTORY</small><h2>我的记录</h2></div>
        {!signedIn ? <a href={APP_ROUTES.manage}>登录后台后自动保存</a> : <span>{history.length} 条</span>}
      </header>
      {signedIn && !history.length ? <p className="vx-empty">还没有解析记录。</p> : null}
      <div className="vx-history-list">
        {history.map((item) => (
          <article key={item.historyId || item.originalUrl}>
            <button type="button" onClick={() => { setResult(item); setInput(item.originalUrl); }}>
              <strong>{item.title || item.originalUrl}</strong>
              <small>{[platformName(item.platform), item.author?.nickname, formatExtractedAt(item.extractedAt)].filter(Boolean).join(" · ")}</small>
            </button>
            <button type="button" className="vx-del" onClick={() => void handleDelete(item.historyId)} aria-label="删除记录"><Trash2 size={15} /></button>
          </article>
        ))}
      </div>
    </section>

    {previewIndex !== null && imageUrls[previewIndex] ? (
      <div className="vx-lightbox" role="dialog" onClick={() => setPreviewIndex(null)}>
        <img src={imageUrls[previewIndex]} alt="" referrerPolicy="no-referrer" onClick={(event) => event.stopPropagation()} />
        <span>{previewIndex + 1} / {imageUrls.length}</span>
      </div>
    ) : null}
  </div>;
}
