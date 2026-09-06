import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PENDING_SAVE_KEY,
  SHARE_ITEM_LIMIT,
  clipboardReadBlocked,
  matchesCredentialTab,
  parseShareClipboard,
  receivedShareSourceLabel,
  selectShareItems,
  shareLoginNext,
  shareReturnPath,
  shouldOfferClipboardShare,
  toggleShareSelection,
} from "../app/systems/otp/otpVaultShare.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("share authorization caps at 50 items", () => {
  assert.equal(SHARE_ITEM_LIMIT, 50);
  const ids = Array.from({ length: 60 }, (_, index) => index + 1);
  assert.deepEqual(selectShareItems(ids), ids.slice(0, 50));
  assert.deepEqual(toggleShareSelection([], 8), { selected: [8], limited: false });
  const full = Array.from({ length: 50 }, (_, index) => index + 1);
  const blocked = toggleShareSelection(full, 99);
  assert.equal(blocked.limited, true);
  assert.deepEqual(blocked.selected, full);
});

test("credential tabs keep received items in all and favorites", () => {
  const own = { shared: false, favorite: false };
  const received = { shared: true, favorite: false };
  const receivedFav = { shared: true, favorite: true };
  assert.equal(matchesCredentialTab(own, "all", true), true);
  assert.equal(matchesCredentialTab(received, "all", true), true);
  assert.equal(matchesCredentialTab(received, "all", false), false);
  assert.equal(matchesCredentialTab(received, "received", false), true);
  assert.equal(matchesCredentialTab(own, "received", true), false);
  assert.equal(matchesCredentialTab(receivedFav, "favorite", true), true);
  assert.equal(matchesCredentialTab(received, "favorite", true), false);
});

test("unauthenticated save returns to the share link after login", () => {
  assert.equal(PENDING_SAVE_KEY, "otp-vault-pending-save");
  assert.equal(shareLoginNext("Ab3De"), "/otp?next=%2Fs%2FAb3De");
  assert.equal(shareLoginNext("Ab3De", "A1B2C"), `/otp?next=${encodeURIComponent("/s/Ab3De#k=A1B2C")}`);
  assert.equal(shareReturnPath("/s/Ab3De"), "/s/Ab3De");
  assert.equal(shareReturnPath("/s/Ab3De#k=A1B2C"), "/s/Ab3De#k=A1B2C");
  assert.equal(shareReturnPath("/otp"), "");
});

test("vault UI exposes received tab, 50-item cap and save-to-inbox", async () => {
  const [workspace, sharePage, vaultPage] = await Promise.all([
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/VaultSharePage.tsx"),
    source("app/systems/otp/OtpVaultPage.tsx"),
  ]);
  assert.match(workspace, /我收到的/);
  assert.match(workspace, /我发出的/);
  assert.match(workspace, /SHARE_ITEM_LIMIT/);
  assert.match(workspace, /单次最多(?:授权|选择) \$\{SHARE_ITEM_LIMIT\}/);
  assert.match(workspace, /credentialTab === "received"/);
  assert.match(workspace, /shareTab === "received"/);
  assert.match(workspace, /确认解除/);
  assert.match(workspace, /listReceivedVaultShares/);
  assert.match(workspace, /releaseReceivedVaultShare/);
  assert.match(sharePage, /PENDING_SAVE_KEY/);
  assert.match(sharePage, /shareLoginNext\(token, accessCode\)/);
  assert.match(sharePage, /rememberShareAccessCode/);
  assert.match(sharePage, /已经转存过了，无需再次转存/);
  assert.match(vaultPage, /shareReturnPath/);
});

test("received share source labels distinguish direct grants and saved links", () => {
  assert.equal(receivedShareSourceLabel("DIRECT"), "指定授权");
  assert.equal(receivedShareSourceLabel("SAVE", "LINK"), "链接转存");
  assert.equal(receivedShareSourceLabel(undefined, "DIRECT"), "指定授权");
});

test("share detail lists save records with kick and ban, and share form can forbid saving", async () => {
  const [workspace, api] = await Promise.all([
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/vaultApi.ts"),
  ]);
  assert.match(workspace, /转存列表/);
  assert.doesNotMatch(workspace, /转存操作列表/);
  assert.match(workspace, /移除/);
  assert.doesNotMatch(workspace, /踢掉/);
  assert.match(workspace, /移除后对方可再次转存/);
  assert.match(workspace, /禁止后对方不能自行转存/);
  assert.match(workspace, /禁止/);
  assert.match(workspace, /该链接已被分享者禁止转存/);
  assert.match(workspace, /禁止转存/);
  assert.match(workspace, /forbidSave/);
  assert.match(workspace, /kickVaultShareSave/);
  assert.match(workspace, /banVaultShareSave/);
  assert.match(workspace, /restoreVaultShareSave/);
  assert.match(workspace, />恢复</);
  assert.match(workspace, /record.status === "ACTIVE" \? .*移除.* : .*恢复/);
  assert.match(workspace, /<b>\{record\.nickname \|\| record\.username \|\| "未知用户"\}<\/b><time>/);
  assert.match(workspace, /className="vault-save-actions"/);
  assert.match(workspace, /saveActionConfirm/);
  assert.match(workspace, /确认移除/);
  assert.match(workspace, /确认禁止/);
  assert.match(workspace, /setPendingSaveAction/);
  assert.doesNotMatch(workspace, /onClick=\{\(\) => void manageShareSave\(record\.id, "kick"\)\}/);
  assert.doesNotMatch(workspace, /onClick=\{\(\) => void manageShareSave\(record\.id, "ban"\)\}/);
  assert.match(api, /saveRecords\?: VaultShareSaveRecord\[\]/);
  assert.match(api, /forbidSave\?: boolean/);
  assert.match(api, /\/saves\/\$\{saveId\}\/kick/);
  assert.match(api, /\/saves\/\$\{saveId\}\/ban/);
  assert.match(api, /\/saves\/\$\{saveId\}\/restore/);
});

test("forbidden save toast uses a warning icon", async () => {
  const toast = await source("app/systems/otp/VaultToastMessage.tsx");
  assert.match(toast, /禁止/);
  assert.match(toast, /TriangleAlert/);
  assert.match(toast, /ERROR_TEXT\.test\(message\)/);
});

test("share save sits in a collapsible bottom dock named 转存", async () => {
  const [sharePage, styles] = await Promise.all([
    source("app/systems/otp/VaultSharePage.tsx"),
    source("app/systems/otp/otp-vault.css"),
  ]);
  assert.doesNotMatch(sharePage, /转存到我收到的/);
  assert.doesNotMatch(sharePage, /已转存到我收到的/);
  assert.match(sharePage, /className=\{`share-save-dock\$\{saveCollapsed \? " is-collapsed" : ""\}`\}/);
  assert.match(sharePage, /aria-label=\{saved \? "已转存" : "转存"\}/);
  assert.match(sharePage, /aria-label="收起"/);
  assert.match(sharePage, /\{saved \? "已转存" : "转存"\}/);
  assert.match(sharePage, /保存到「我收到的」/);
  assert.match(sharePage, /登录后转存/);
  assert.match(styles, /\.share-save-dock\s*\{[^}]*position:\s*fixed;/s);
  assert.match(styles, /\.share-save-fab\s*\{[^}]*width:\s*44px;/s);
});

test("clipboard parser extracts share token and access code from urls and copied text", () => {
  assert.deepEqual(parseShareClipboard("https://otp.example/s/Ab3De"), { token: "Ab3De", accessCode: "" });
  assert.deepEqual(parseShareClipboard("https://otp.example/s/Ab3De#k=A1B2C"), { token: "Ab3De", accessCode: "A1B2C" });
  assert.deepEqual(parseShareClipboard("给同事的临时访问\nhttps://otp.example/s/Ab3De#k=A1B2C\n访问码：A1B2C\n有效期：2026/09/07 12:00:00"), { token: "Ab3De", accessCode: "A1B2C" });
  assert.deepEqual(parseShareClipboard("https://otp.example/s/Ab3De\n访问码：Xy9K2"), { token: "Ab3De", accessCode: "XY9K2" });
  assert.deepEqual(parseShareClipboard("\u200bhttps://otp.example/s/Ab3De#k=A1B2C"), { token: "Ab3De", accessCode: "A1B2C" });
  assert.equal(parseShareClipboard("https://example.com/blog"), null);
  assert.equal(parseShareClipboard("s/abc"), null);
});

test("clipboard read errors that need a tap are treated as blocked", () => {
  assert.equal(clipboardReadBlocked({ name: "NotAllowedError", message: "Write permission denied." }), true);
  assert.equal(clipboardReadBlocked({ name: "SecurityError", message: "The request is not allowed" }), true);
  assert.equal(clipboardReadBlocked({ name: "NotFoundError", message: "No valid data" }), false);
  assert.equal(clipboardReadBlocked(null), false);
});

test("clipboard share prompt skips ignored tokens and the share page already open", () => {
  const parsed = { token: "Ab3De", accessCode: "A1B2C" };
  assert.equal(shouldOfferClipboardShare(parsed, []), true);
  assert.equal(shouldOfferClipboardShare(null, []), false);
  assert.equal(shouldOfferClipboardShare(parsed, ["Ab3De"]), false);
  assert.equal(shouldOfferClipboardShare(parsed, [], "Ab3De"), false);
});

test("vault scans clipboard on focus visibility and paste, never on an interval", async () => {
  const [workspace, share] = await Promise.all([
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/otpVaultShare.ts"),
  ]);
  assert.match(share, /parseShareClipboard/);
  assert.match(workspace, /visibilitychange/);
  assert.match(workspace, /addEventListener\("focus"/);
  assert.match(workspace, /addEventListener\("paste"/);
  assert.match(workspace, /clipboard\.readText/);
  assert.doesNotMatch(workspace, /setInterval\([^)]*clipboard/);
  assert.match(workspace, /检测到授权/);
  assert.match(workspace, /忽略/);
  assert.match(workspace, /识别剪贴板/);
  assert.match(workspace, /clipboardReadBlocked/);
  assert.match(workspace, /scanClipboard\(true\)/);
});
