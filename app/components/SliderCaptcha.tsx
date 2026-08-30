import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { API_PATHS } from "../lib/pathConventions";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { apiRequest } from "../lib/api";

type SliderCaptchaProps = {
  onVerified: (value: { uuid: string; token: string }) => void;
  onEnabledChange?: (enabled: boolean) => void;
  resetKey?: number;
  disabled?: boolean;
  className?: string;
};

type Challenge = {
  uuid: string;
  background: string;
  piece: string;
  pieceY: number;
  imageWidth: number;
  imageHeight: number;
  pieceSize: number;
};

export function SliderCaptcha({ onVerified, onEnabledChange, resetKey = 0, disabled = false, className = "" }: SliderCaptchaProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragValue = useRef(0);
  const mounted = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  const onEnabledChangeRef = useRef(onEnabledChange);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [x, setX] = useState(0);
  const [error, setError] = useState("");

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setError("");
    setVerified(false);
    setX(0);
    dragValue.current = 0;
    onVerifiedRef.current({ uuid: "", token: "" });
    try {
      const result = await apiRequest<Record<string, unknown>>(API_PATHS.auth.captchaImage, { auth: false });
      const enabled = result.captchaOnOff === undefined ? true : Boolean(result.captchaOnOff);
      onEnabledChangeRef.current?.(enabled);
      if (!enabled) {
        setChallenge(null);
        return;
      }
      setChallenge({
        uuid: String(result.uuid || ""),
        background: String(result.background || ""),
        piece: String(result.piece || ""),
        pieceY: Number(result.pieceY || 0),
        imageWidth: Number(result.imageWidth || 320),
        imageHeight: Number(result.imageHeight || 160),
        pieceSize: Number(result.pieceSize || 48),
      });
    } catch (loadError) {
      setChallenge(null);
      setError(loadError instanceof Error ? loadError.message : "验证组件加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onEnabledChangeRef.current = onEnabledChange;
  }, [onEnabledChange, onVerified]);

  useEffect(() => { void loadChallenge(); }, [loadChallenge]);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    void loadChallenge();
  }, [resetKey]);
  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape" && !verifying) setOpen(false); };
    document.body.classList.add("slider-captcha-open");
    window.addEventListener("keydown", close);
    return () => {
      document.body.classList.remove("slider-captcha-open");
      window.removeEventListener("keydown", close);
    };
  }, [open, verifying]);

  const updateFromClientX = (clientX: number) => {
    if (!trackRef.current || !challenge) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackRange = Math.max(1, rect.width - 42);
    const pixel = Math.min(trackRange, Math.max(0, clientX - rect.left - 21));
    const next = Math.round((pixel / trackRange) * (challenge.imageWidth - challenge.pieceSize));
    dragValue.current = next;
    setX(next);
  };

  const verify = async (value = dragValue.current) => {
    if (!challenge || verifying) return;
    setDragging(false);
    setVerifying(true);
    setError("");
    try {
      const result = await apiRequest<Record<string, unknown>>(API_PATHS.auth.sliderVerify, {
        auth: false,
        method: "POST",
        body: { uuid: challenge.uuid, x: Math.round(value) },
      });
      const token = String(result.token || "");
      if (!token) throw new Error("验证成功但未返回凭证");
      setVerified(true);
      onVerifiedRef.current({ uuid: String(result.uuid || challenge.uuid), token });
      window.setTimeout(() => setOpen(false), 280);
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : "验证失败，请重试";
      await loadChallenge();
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!challenge || loading || verifying) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromClientX(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => { if (dragging) updateFromClientX(event.clientX); };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    void verify();
  };
  const onSliderKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!challenge || verifying) return;
    const range = challenge.imageWidth - challenge.pieceSize;
    let next = dragValue.current;
    if (event.key === "ArrowLeft") next -= 3;
    else if (event.key === "ArrowRight") next += 3;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = range;
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void verify(); return; }
    else return;
    event.preventDefault();
    next = Math.min(range, Math.max(0, next));
    dragValue.current = next;
    setX(next);
  };

  return (
    <div className={`slider-captcha ${className}`.trim()}>
      <button type="button" className={`slider-captcha-trigger${verified ? " is-verified" : ""}`} disabled={disabled || loading || verified} onClick={() => { setOpen(true); if (!challenge) void loadChallenge(); }}>
        {loading ? <LoaderCircle className="spin" size={16} /> : verified ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
        <span>{loading ? "正在准备安全验证" : verified ? "滑块验证已通过" : error ? "验证加载失败，点击重试" : "点击完成滑块验证"}</span>
        <span className="slider-captcha-trigger-tail">{verified ? "已验证" : "验证"}</span>
      </button>
      {open ? (
        <div className="slider-captcha-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !verifying) setOpen(false); }}>
          <section className="slider-captcha-dialog" role="dialog" aria-modal="true" aria-label="拼图滑块验证">
            <header>
              <span className="slider-captcha-icon"><ShieldCheck size={17} /></span>
              <div><strong>安全验证</strong><small>拖动滑块完成拼图</small></div>
              <button type="button" className="slider-captcha-icon-button" onClick={() => setOpen(false)} aria-label="关闭" disabled={verifying}><X size={17} /></button>
            </header>
            {challenge ? (
              <>
                <div className="slider-captcha-picture" style={{ aspectRatio: `${challenge.imageWidth} / ${challenge.imageHeight}` }}>
                  <img src={`data:image/png;base64,${challenge.background}`} alt="滑块验证背景" draggable={false} />
                  <img className="slider-captcha-piece" src={`data:image/png;base64,${challenge.piece}`} alt="" draggable={false} style={{ width: `${(challenge.pieceSize / challenge.imageWidth) * 100}%`, top: `${(challenge.pieceY / challenge.imageHeight) * 100}%`, left: `${(x / challenge.imageWidth) * 100}%` }} />
                  <button type="button" className="slider-captcha-refresh" onClick={() => void loadChallenge()} aria-label="换一张验证图" disabled={loading || verifying}><RefreshCw className={loading ? "spin" : ""} size={15} /></button>
                </div>
                <div className={`slider-captcha-track${dragging ? " is-dragging" : ""}${verified ? " is-success" : ""}`} ref={trackRef}>
                  <span className="slider-captcha-progress" style={{ width: `calc(${(x / (challenge.imageWidth - challenge.pieceSize)) * 100}% + ${(1 - x / (challenge.imageWidth - challenge.pieceSize)) * 42}px)` }} />
                  <span className="slider-captcha-hint">{verifying ? "正在校验…" : verified ? "验证通过" : "按住滑块，向右拖动"}</span>
                  <button type="button" className="slider-captcha-thumb" style={{ left: `calc(${(x / (challenge.imageWidth - challenge.pieceSize)) * 100}% - ${(x / (challenge.imageWidth - challenge.pieceSize)) * 42}px)` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDragging(false)} onKeyDown={onSliderKeyDown} role="slider" aria-label="拼图滑块" aria-valuemin={0} aria-valuemax={challenge.imageWidth - challenge.pieceSize} aria-valuenow={x} disabled={verifying}>
                    {verifying ? <LoaderCircle className="spin" size={17} /> : verified ? <CheckCircle2 size={17} /> : <span>››</span>}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="slider-captcha-retry" onClick={() => void loadChallenge()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />}{loading ? "正在加载验证图" : "重新加载验证"}</button>
            )}
            {error ? <p className="slider-captcha-error">{error}</p> : <p className="slider-captcha-footnote">验证结果仅本次操作有效</p>}
          </section>
        </div>
      ) : null}
    </div>
  );
}
