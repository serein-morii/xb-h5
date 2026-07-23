import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    // 监听所有网卡，便于手机扫码访问（dev 模式下后端仍在 127.0.0.1:8080，
    // 由下方 proxy 反代，避免浏览器 CORS，也避免手机端 loopback 不可达问题）
    host: true,
    proxy: {
      "/prod-api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/prod-api/, ""),
      },
    },
  },
});
