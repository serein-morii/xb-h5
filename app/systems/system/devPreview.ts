/**
 * DEV 预览桩：仅在 `npm run dev` 且 URL 带 ?devPreview=1 时生效。
 * 伪造登录态与接口数据，让开发者在无本地后端的情况下真实渲染系统中心各页面做视觉验收。
 * 生产构建中 import.meta.env.DEV 为 false，整段代码会被打包器移除。
 */
declare global {
  interface Window { __devPreviewInstalled?: boolean }
}

export function installDevPreview(): void {
  if (!import.meta.env.DEV) return;
  try {
    if (!new URLSearchParams(window.location.search).has("devPreview")) return;
  } catch { return; }
  if (window.__devPreviewInstalled) return;
  window.__devPreviewInstalled = true;

  window.localStorage.setItem("xb-mobile-token", "dev-preview-token");
  window.localStorage.setItem("xb-system-center-area", window.location.hash.replace("#", "") || "messages");

  const json = (data: unknown) => new Response(JSON.stringify({ code: 200, msg: "ok", data }), { status: 200, headers: { "Content-Type": "application/json" } });
  const realFetch = window.fetch.bind(window);

  const capabilities = [
    "nav.systemCenter", "nav.operationsCenter", "system.users.view", "system.roles.view", "system.depts.view",
    "system.posts.view", "system.menus.view", "system.dictTypes.view", "system.configs.view",
    "system.notices.view", "system.configs.view", "operations.online.view", "operations.jobs.view",
    "operations.operLogs.view", "operations.loginLogs.view", "operations.server.view", "operations.cache.view",
    "operations.codegen.view", "operations.messages.view", "system.mobileMenu.view",
  ];

  const broadcastRow = {
    groupKey: "dev1", title: "OTP Vault 3.2 版本上线：支持 Passkey 直接解锁",
    category: "OTP", contentType: "markdown", popup: true, link: "/otp",
    content: "## 新版本亮点\n- **Passkey 直接解锁**保险库\n- 分享授权支持访问码自动填充\n\n详情见使用指南。",
    targetRole: "OTP", createTime: "2026-09-06 01:30:00", recipientCount: 12,
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/identity/access/manifest")) {
      return json({ schemaVersion: 1, revision: "dev-preview", superAdmin: true, roles: ["admin"], subject: { userId: 1, username: "admin", nickname: "平台管理员" }, capabilities });
    }
    if (url.includes("/message/unread-count")) return json({ count: 3 });
    if (url.includes("/message/broadcast/list")) return json([broadcastRow, { ...broadcastRow, groupKey: "dev2", title: "订单系统维护通知：周日 02:00-04:00 例行维护", category: "SYSTEM", contentType: "text", popup: false, content: "周日 02:00-04:00 例行维护，期间订单系统可能短暂不可用。", targetRole: "ORDER", createTime: "2026-09-05 20:00:00", recipientCount: 34 }]);
    if (url.includes("/message/popup")) return json([{ id: 9001, category: "SYSTEM", type: "broadcast", title: "欢迎使用新版系统中心", content: "系统中心已升级：**站内信**、**账号恢复**与运行监控全部就位。\n\n- 点「确认」后不再弹出\n- 也可在通知中心查看历史通知", contentType: "markdown", popup: true, isRead: false, createTime: "2026-09-06 02:00:00" }]);
    if (/\/message\/\d+\/read/.test(url) || url.includes("/message/read-all")) return json({});
    if (/\/message\/\d+$/.test(url) && init?.method === "DELETE") return json({ deleted: 1 });
    if (/\/message\/broadcast\/[\w-]+$/.test(url) && init?.method === "PUT") return json({ updated: 12 });
    if (/\/message\/broadcast\/[\w-]+$/.test(url) && init?.method === "DELETE") return json({ deleted: 12 });
    if (url.includes("/otp/vault/account/admin/deleted")) {
      return json([
        { userId: 901, userName: "user8621", nickName: "张女士", email: "zhang****@qq.com", deleteTime: "2026-09-05 21:12:00" },
        { userId: 902, userName: "user9137", nickName: "", email: "li****@163.com", deleteTime: "2026-09-04 18:40:00" },
      ]);
    }
    if (url.includes("/otp/vault/account/admin/restore")) return json({ userId: 901, userName: "user8621", email: "zhang****@qq.com" });
    if (url.includes("/auth/logout")) { window.localStorage.removeItem("xb-mobile-token"); return json({}); }
    return realFetch(input, init);
  };
}
