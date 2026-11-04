import { StrictMode } from "react";
// createRoot 必须在模块顶层静态导入：此前动态选择 OtpApp/App 的写法依赖打包器的变量复用，
// 曾因 minifier 把 react-dom 绑定与 preloadError 处理器都命名成 i 而全站白屏（i.createRoot is not a function）。
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

// 静态导入两个外壳，运行时按入口选择：OTP 独立壳不加载订单/黄桃/工具箱，
// 主站壳不加载 OTP。两个都很小，全量引入的体积代价远小于再踩一次构建变量冲突。
import App from "../app/App";
import OtpApp from "../app/systems/otp/OtpApp";

async function boot() {
  if (isOtpSurface()) {
    createRoot(root!).render(<StrictMode><OtpApp /></StrictMode>);
    return;
  }
  createRoot(root!).render(<StrictMode><App /></StrictMode>);
}

void boot();
