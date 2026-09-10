import { KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { getStartupConfig, type StartupSystem } from "../lib/startup";

let holdCount = 0;

function overlay() {
  return document.getElementById("app-startup");
}

function setCopy(node: Element | null, text: string) {
  if (!node || node.textContent === text) return;
  node.textContent = text;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const copy = node as HTMLElement;
  copy.classList.remove("app-startup-copy");
  void copy.offsetWidth;
  copy.classList.add("app-startup-copy");
}

export function showAppStartup(system?: StartupSystem, message?: string) {
  const el = overlay();
  if (!el) return false;
  const config = getStartupConfig(system);
  el.hidden = false;
  setCopy(el.querySelector("[data-startup-eyebrow]"), config.eyebrow);
  setCopy(el.querySelector("[data-startup-title]"), config.title);
  setCopy(el.querySelector("[data-startup-message]"), message || config.message);
  setCopy(el.querySelector("[data-startup-status]"), config.status);
  const mark = el.querySelector("[data-startup-mark]");
  if (mark && config.mark !== "KEY") mark.textContent = config.mark;
  el.style.setProperty("--startup-accent", config.accent);
  return true;
}

export function hideAppStartup() {
  overlay()?.setAttribute("hidden", "");
}

export function AppStartup({ system, message }: { system?: StartupSystem; message?: string }) {
  const config = getStartupConfig(system);
  useEffect(() => {
    holdCount += 1;
    showAppStartup(system, message);
    return () => {
      holdCount = Math.max(0, holdCount - 1);
      if (holdCount > 0) return;
      queueMicrotask(() => {
        if (holdCount > 0) return;
        hideAppStartup();
      });
    };
  }, [system, message]);
  if (overlay()) return null;
  return <main className="app-startup" role="status" aria-live="polite" style={{ "--startup-accent": config.accent } as CSSProperties}>
    <section className="app-startup-card">
      <span className="app-startup-mark">{config.mark === "KEY" ? <KeyRound size={29} /> : <b>{config.mark}</b>}</span>
      <small>{config.eyebrow}</small>
      <strong>{config.title}</strong>
      <div className="app-startup-progress" aria-hidden="true"><i /></div>
      <p>{message || config.message}</p>
      <em><ShieldCheck size={12} />{config.status}</em>
    </section>
  </main>;
}
