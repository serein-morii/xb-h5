import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useOnboarding } from "./OnboardingContext";

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;
const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 288;
const TOOLTIP_ESTIMATED_HEIGHT = 140;
const EDGE_THRESHOLD = 120;

function getRect(selector: string | undefined): Rect | null {
  if (typeof document === "undefined" || !selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Popover 风格的定位：
 * - 目标在屏幕顶部 120px 内 → tooltip 紧贴目标下方（避免挡住目标）
 * - 目标在屏幕底部 120px 内 → tooltip 紧贴目标上方
 * - 目标在中间 → tooltip 固定在屏幕顶部 60px
 *
 * tooltip 不画方向箭头，靠 spotlight（高亮框）来指明当前讲的是哪个元素。
 */
function computeTooltipStyle(target: Rect | null, _placement: string | undefined, vw: number, vh: number) {
  if (!target) {
    return {
      left: Math.max(16, (vw - TOOLTIP_WIDTH) / 2),
      top: 80,
      width: TOOLTIP_WIDTH,
    };
  }
  const expanded = {
    top: target.top - PADDING,
    left: target.left - PADDING,
    width: target.width + PADDING * 2,
    height: target.height + PADDING * 2,
  };

  const targetBottom = target.top + target.height;
  let top: number;

  if (target.top < EDGE_THRESHOLD) {
    // 目标太靠上 → tooltip 紧贴目标下方
    top = targetBottom + TOOLTIP_GAP + 16;
  } else if (targetBottom > vh - EDGE_THRESHOLD) {
    // 目标太靠下 → tooltip 紧贴目标上方
    top = target.top - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP - 16;
  } else {
    // 目标在中间 → tooltip 靠屏幕上部，往下靠到尽量贴近目标但不盖住 spotlight
    // (tooltip 高 ~140，结束位置 ≈ top+140；菜单分组顶部 ≈ 192，所以 top 最多给到 50)
    top = 50;
  }

  // 边界保护
  top = Math.max(8, Math.min(top, vh - TOOLTIP_ESTIMATED_HEIGHT - 8));
  // 水平居中于目标
  let left = target.left + target.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.max(16, Math.min(left, vw - TOOLTIP_WIDTH - 16));

  return { left, top, width: TOOLTIP_WIDTH, expanded };
}

export default function OnboardingOverlay() {
  const { current, total, index, next, prev, skip } = useOnboarding();
  const [tick, setTick] = useState(0);

  // 监听窗口尺寸变化、滚动，触发重渲染 → rect 会跟着重算
  useEffect(() => {
    if (!current) return;
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [current]);

  // 直接在 render 算 rect，配合 tick 保证 resize/scroll 后位置是最新的
  const rect = useMemo(() => {
    if (!current?.target) return null;
    return getRect(current.target);
  }, [current?.target, current?.id, tick]);

  // 进入新步骤时，把目标滚到视野里（只滚一次）
  useLayoutEffect(() => {
    if (!current?.target) return;
    const el = document.querySelector(current.target) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current?.id, current?.target]);

  if (!current) return null;
  const vw = typeof window === "undefined" ? 360 : window.innerWidth;
  const vh = typeof window === "undefined" ? 640 : window.innerHeight;
  const style = computeTooltipStyle(rect, current.placement, vw, vh);
  const isCenter = !rect;
  const isLast = index === total - 1;
  const isFirst = index === 0;
  const isSystemWelcome = current.id === "__system-welcome" || current.id === "__system-done";
  const awaitClick = current.awaitClick === true;

  // 4 个 mask 矩形：top / left / right / bottom（围绕 spotlight 拼合）
  const expanded = "expanded" in style ? (style as { expanded: Rect }).expanded : null;
  const box = expanded ?? { top: 0, left: 0, width: 0, height: 0 };
  const masks = [
    { key: "top", rect: { top: 0, left: 0, width: vw, height: Math.max(0, box.top) } },
    { key: "left", rect: { top: box.top, left: 0, width: Math.max(0, box.left), height: box.height } },
    { key: "right", rect: { top: box.top, left: box.left + box.width, width: Math.max(0, vw - (box.left + box.width)), height: box.height } },
    { key: "bottom", rect: { top: box.top + box.height, left: 0, width: vw, height: Math.max(0, vh - (box.top + box.height)) } },
  ];

  return (
    <div className="onboarding-root" data-tick={tick} role="dialog" aria-modal="true" aria-label="新手引导">
      {/* 4 块暗色遮罩：awaitClick 时点击遮罩不关闭，避免误触 */}
      {masks.map((m) => (
        <div
          key={m.key}
          className="onboarding-mask"
          style={{ top: m.rect.top, left: m.rect.left, width: m.rect.width, height: m.rect.height }}
          onClick={awaitClick ? undefined : skip}
        />
      ))}

      {/* spotlight 高亮描边：awaitClick 时透传给目标，点击目标不会被遮罩吞掉 */}
      {expanded ? (
        <div
          className={`onboarding-spotlight${awaitClick ? " is-clickable" : ""}`}
          style={{ top: expanded.top, left: expanded.left, width: expanded.width, height: expanded.height }}
          onClick={awaitClick ? undefined : skip}
        />
      ) : null}

      {/* 提示卡 */}
      <section
        className={`onboarding-tooltip ${isCenter ? "is-center" : ""}${awaitClick ? " is-awaiting-click" : ""}`}
        style={{ left: style.left, top: style.top, width: style.width }}
      >
        <header>
          <span className="onboarding-badge"><Sparkles size={12} />引导 · {index + 1}/{total}</span>
          <button type="button" className="onboarding-close" onClick={skip} aria-label="关闭引导"><X size={16} /></button>
        </header>
        <h3>{current.title}</h3>
        <p>{current.body}</p>
        {awaitClick ? (
          <div className="onboarding-await-hint">
            <span className="onboarding-await-dot" />
            {current.clickHint ?? "请按上方高亮处的提示操作"}
          </div>
        ) : null}
        <footer>
          {!isSystemWelcome ? (
            <button type="button" className="onboarding-btn ghost" onClick={skip}>跳过</button>
          ) : (
            <span />
          )}
          <div className="onboarding-step-actions">
            {!isFirst ? (
              <button type="button" className="onboarding-btn ghost" onClick={prev} aria-label="上一步"><ChevronLeft size={14} />上一步</button>
            ) : null}
            {awaitClick ? null : (
              <button type="button" className="onboarding-btn primary" onClick={() => void next()}>
                {isLast ? "完成" : isSystemWelcome && index === 0 ? "开始" : "下一步"}
                {!isLast && <ChevronRight size={14} />}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
