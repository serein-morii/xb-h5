import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initializeTheme } from "../app/lib/theme";
import { installViewportZoomLock } from "../app/lib/viewport";
import { isOtpSurface } from "../app/lib/subsystemHost";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("应用挂载节点不存在");

initializeTheme();
const uninstallViewportZoomLock = installViewportZoomLock();
if (import.meta.hot) {
  import.meta.hot.dispose(uninstallViewportZoomLock);
}

async function boot() {
  if (isOtpSurface()) {
    const { default: OtpApp } = await import("../app/systems/otp/OtpApp");
    createRoot(root!).render(<StrictMode><OtpApp /></StrictMode>);
    return;
  }
  const [{ default: App }] = await Promise.all([
    import("../app/App"),
    import("../app/unified-theme.css"),
  ]);
  createRoot(root!).render(<StrictMode><App /></StrictMode>);
}

void boot();
