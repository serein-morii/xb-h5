import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../app/App";
import ThemeSettings from "../app/components/ThemeSettings";
import { initializeTheme } from "../app/lib/theme";
import { installViewportZoomLock } from "../app/lib/viewport";
import "../app/globals.css";
import "../app/unified-theme.css";

const root = document.getElementById("root");

if (!root) throw new Error("应用挂载节点不存在");

initializeTheme();
const uninstallViewportZoomLock = installViewportZoomLock();

if (import.meta.hot) {
  import.meta.hot.dispose(uninstallViewportZoomLock);
}

createRoot(root).render(
  <StrictMode>
    <App />
    <ThemeSettings />
  </StrictMode>,
);
