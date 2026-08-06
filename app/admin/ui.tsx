import {
  Box,
  Check,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";
import type { DataRow, FieldConfig, ToastState } from "./core";

export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark"><span /></span>
      <span><b>喜八</b><small>XB MOBILE</small></span>
    </div>
  );
}

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`} role="status">
      {toast.type === "success" ? <Check size={17} /> : toast.type === "error" ? <X size={17} /> : <Sparkles size={17} />}
      {toast.message}
    </div>
  );
}

/* 数字滚动 hook：从 from 平滑过渡到 to，时长 duration ms */
export function useCountUp(to: number, duration = 600): number {
  const [value, setValue] = useState(to);
  const previous = useRef(to);
  useEffect(() => {
    const from = previous.current;
    if (from === to) return;
    const startedAt = performance.now();
    let frame = 0;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const current = from + (to - from) * easeOutCubic(progress);
      setValue(Math.round(current));
      if (progress < 1) frame = requestAnimationFrame(step);
      else previous.current = to;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);
  return value;
}

export function Sheet({
  open,
  title,
  children,
  onClose,
  headerAction,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  headerAction?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    document.body.classList.add("sheet-open");
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.classList.remove("sheet-open");
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`sheet ${wide ? "sheet-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grabber" />
        <header className="sheet-header">
          <div><span className="eyebrow">XB MOBILE</span><h2>{title}</h2></div>
          <div className="sheet-header-actions">
            <button className="sheet-header-cancel" type="button" onClick={onClose}>
              关闭
            </button>
            {headerAction}
          </div>
        </header>
        <div className="sheet-content">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmDialog({
  state,
  onClose,
}: {
  state: { title: string; message: string; danger?: boolean; action: () => Promise<void> } | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  return (
    <div className="confirm-backdrop">
      <div className="confirm-card" role="alertdialog" aria-modal="true">
        <div className={`confirm-icon ${state.danger ? "danger" : ""}`}>
          {state.danger ? <Trash2 size={22} /> : <ShieldCheck size={22} />}
        </div>
        <h3>{state.title}</h3>
        <p>{state.message}</p>
        <div className="confirm-actions">
          <button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>取消</button>
          <button
            className={`button ${state.danger ? "button-danger" : "button-primary"}`}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await state.action(); onClose(); } finally { setBusy(false); }
            }}
          >{busy ? <LoaderCircle className="spin" size={17} /> : null}确认</button>
        </div>
      </div>
    </div>
  );
}

export function StoreStatusBadge({ row }: { row: DataRow }) {
  const value = Number(row.isDelete);
  const text = value === 1 ? "开业中" : value === 2 ? "已关闭" : "状态未知";
  return <span className={`status ${value === 1 ? "status-success" : value === 2 ? "status-danger" : "status-neutral"}`}><span />{text}</span>;
}

export function EmptyState({ loading, label }: { loading: boolean; label: string }) {
  return <div className="empty-state">{loading ? <LoaderCircle className="spin" size={28} /> : <Box size={30} />}<h3>{loading ? "正在加载" : `暂无${label}`}</h3><p>{loading ? "请稍候…" : "试试调整筛选条件"}</p></div>;
}

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const normalizedValue = typeof value === "string" || typeof value === "number" ? value : "";
  const common = { id: field.key, value: normalizedValue, required: field.required, disabled: field.readonly, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value) };
  if (field.type === "textarea") return <textarea {...common} rows={3} placeholder={field.placeholder || `请输入${field.label}`} />;
  if (field.type === "select") return <select {...common}><option value="">请选择</option>{field.options?.map((item) => <option key={String(item.value)} value={String(item.value)}>{item.label}</option>)}</select>;
  return <input {...common} type={field.type || "text"} step={field.type === "number" ? "0.01" : undefined} placeholder={field.placeholder || `请输入${field.label}`} />;
}
