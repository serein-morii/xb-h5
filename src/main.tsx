import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../app/App";
import { initializeTheme } from "../app/lib/theme";
import "../app/globals.css";
import "../app/unified-theme.css";

const root = document.getElementById("root");

if (!root) throw new Error("应用挂载节点不存在");

initializeTheme();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
