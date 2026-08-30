import { KeyRound, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { getStartupConfig, type StartupSystem } from "../lib/startup";

export function AppStartup({ system, message }: { system?: StartupSystem; message?: string }) {
  const config = getStartupConfig(system);
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
