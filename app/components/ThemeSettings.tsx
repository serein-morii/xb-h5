import { Check, Moon, Palette, Sun, SunMoon, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  readThemePalette,
  readThemePreference,
  setThemePalette,
  setThemePreference,
  type ThemePalette,
  type ThemePreference,
} from "../lib/theme";

const PALETTES: Array<{ value: ThemePalette; label: string; detail: string }> = [
  { value: "ocean", label: "海蓝", detail: "专属下单页同款" },
  { value: "emerald", label: "青绿", detail: "清爽自然" },
  { value: "amber", label: "暖橙", detail: "温暖醒目" },
  { value: "berry", label: "莓红", detail: "柔和有活力" },
];

const MODES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "亮色", icon: Sun },
  { value: "dark", label: "暗色", icon: Moon },
  { value: "system", label: "跟随系统", icon: SunMoon },
];

export default function ThemeSettings() {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>(() => readThemePalette());
  const [mode, setMode] = useState<ThemePreference>(() => readThemePreference());

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function choosePalette(value: ThemePalette) {
    setPalette(value);
    setThemePalette(value);
  }

  function chooseMode(value: ThemePreference) {
    setMode(value);
    setThemePreference(value);
  }

  return <>
    <button
      type="button"
      className="theme-settings-trigger"
      onClick={() => setOpen(true)}
      aria-label="打开主题设置"
      title="主题设置"
    >
      <Palette size={18} />
    </button>

    {open ? <div className="theme-settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="theme-settings-panel" role="dialog" aria-modal="true" aria-labelledby="theme-settings-title">
        <header>
          <span><Palette size={19} /></span>
          <div>
            <h2 id="theme-settings-title">主题设置</h2>
            <p>设置只保存在当前浏览器，不经过后台。</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="关闭主题设置"><X size={18} /></button>
        </header>

        <div className="theme-settings-section">
          <div className="theme-settings-label"><b>主题色</b><small>全站组件同步切换</small></div>
          <div className="theme-palette-grid">
            {PALETTES.map((item) => <button
              type="button"
              key={item.value}
              className={`theme-palette-option theme-palette-${item.value}${palette === item.value ? " active" : ""}`}
              onClick={() => choosePalette(item.value)}
              aria-pressed={palette === item.value}
            >
              <span><i /><i /><i /></span>
              <span><b>{item.label}</b><small>{item.detail}</small></span>
              {palette === item.value ? <Check size={15} /> : null}
            </button>)}
          </div>
        </div>

        <div className="theme-settings-section">
          <div className="theme-settings-label"><b>显示模式</b><small>支持跟随系统自动切换</small></div>
          <div className="theme-mode-grid">
            {MODES.map((item) => {
              const Icon = item.icon;
              return <button
                type="button"
                key={item.value}
                className={mode === item.value ? "active" : ""}
                onClick={() => chooseMode(item.value)}
                aria-pressed={mode === item.value}
              >
                <Icon size={17} /><span>{item.label}</span>
              </button>;
            })}
          </div>
        </div>

        <p className="theme-settings-footnote">刷新页面后会自动恢复本次选择。</p>
      </section>
    </div> : null}
  </>;
}
