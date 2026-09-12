import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_SHARE_DAYS,
  DEFAULT_SHARE_SECONDS,
  PENDING_SAVE_KEY,
  SHARE_ITEM_LIMIT,
  clipboardReadBlocked,
  defaultShareName,
  groupCredentials,
  groupReceivedBySource,
  listSharedByOptions,
  matchesCredentialKind,
  matchesCredentialTab,
  matchesSharedByFilter,
  parseShareClipboard,
  receivedAvatarText,
  receivedGroupLabel,
  receivedGroupMeta,
  receivedShareSourceLabel,
  shareDetailCredentials,
  SHARED_BY_SELF,
  sharedByFilterLabel,
  sharerDisplay,
  selectShareItems,
  shareHandoffAfterRestore,
  shareLoginNext,
  splitCredentialTags,
  shareReturnPath,
  shouldOfferClipboardShare,
  shouldShowShareHandoff,
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

test("credential kind filter separates otp, password and notes", () => {
  const otp = { otpConfigured: true, passwordConfigured: false };
  const both = { otpConfigured: true, passwordConfigured: true };
  const password = { otpConfigured: false, passwordConfigured: true };
  const note = { otpConfigured: false, passwordConfigured: false };
  const liveOtp = { currentOtp: "123456", passwordConfigured: false };
  assert.equal(matchesCredentialKind(otp, "all"), true);
  assert.equal(matchesCredentialKind(otp, "otp"), true);
  assert.equal(matchesCredentialKind(both, "otp"), true);
  assert.equal(matchesCredentialKind(both, "password"), true);
  assert.equal(matchesCredentialKind(password, "otp"), false);
  assert.equal(matchesCredentialKind(password, "password"), true);
  assert.equal(matchesCredentialKind(password, "note"), false);
  assert.equal(matchesCredentialKind(note, "note"), true);
  assert.equal(matchesCredentialKind(liveOtp, "otp"), true);
  assert.deepEqual(splitCredentialTags("工作, 家庭  家庭，银行"), ["工作", "家庭", "银行"]);
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
  assert.match(workspace, /groupCredentials\(filtered, credentialTab, prefs\.grouped\)/);
  assert.match(workspace, /groupReceivedBySource/);
  assert.match(workspace, /renderReceivedList/);
  assert.match(workspace, /is-received-source/);
  assert.match(workspace, /vault-received-group-head/);
  assert.doesNotMatch(workspace, /toggleGroupBySource/);
  assert.match(workspace, /sharedByFilter/);
  assert.match(workspace, /listSharedByOptions/);
  assert.match(workspace, /matchesSharedByFilter/);
  assert.doesNotMatch(workspace, /optgroup/);
  assert.match(workspace, /<span>来自<\/span>/);
  assert.match(workspace, /SHARED_BY_SELF/);
  assert.match(workspace, />我的</);
  assert.doesNotMatch(workspace, /<span>来源<\/span>/);
  assert.doesNotMatch(workspace, /vault-sharer-toggle/);
  assert.match(workspace, /sharerDisplay\(section\)/);
  assert.match(workspace, /来自 \$\{sharerDisplay\(item\)\}/);
  assert.match(workspace, /aria-label="分享详情"/);
  assert.match(workspace, /分享配置/);
  assert.equal(DEFAULT_SHARE_DAYS, 30);
  assert.equal(DEFAULT_SHARE_SECONDS, 30 * 86400);
  assert.equal(defaultShareName("爱丽丝", ["GitHub"]), "爱丽丝的GitHub临时凭据授权");
  assert.equal(defaultShareName("爱丽丝", ["GitHub", "GitHub"]), "爱丽丝的GitHub临时凭据授权");
  assert.equal(defaultShareName("爱丽丝", ["GitHub", "Google"]), "爱丽丝的临时凭据授权");
  assert.match(workspace, /defaultShareName/);
  assert.match(workspace, /DEFAULT_SHARE_SECONDS/);
  assert.match(workspace, /vault-view-toggles/);
  assert.match(workspace, /vault-share-compose/);
  assert.match(sharePage, /vault-view-toggles/);
  assert.match(workspace, /shareCreateConfirm/);
  assert.match(workspace, /requestShareCreate/);
  assert.match(workspace, /confirmShareCreate/);
  assert.match(workspace, /vault-share-confirm-duration/);
  assert.match(workspace, /核对有效期、内容和平台后再生成/);
  assert.match(workspace, /<span>01<\/span><h3>有效期<\/h3>[\s\S]*<span>02<\/span><h3>分享内容<\/h3>[\s\S]*<span>03<\/span><h3>平台<\/h3>/);
  assert.match(workspace, /确认生成/);
  assert.match(workspace, /shareDetailCredentials/);
  assert.match(workspace, /item.shareId === shareDetail.id/);
  assert.match(workspace, /shareConfigItems/);
  assert.match(workspace, /!shareDetail.inbound \? <>/);
  assert.match(workspace, /未授权/);
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

test("received credentials group by share batch not issuer", () => {
  assert.equal(receivedGroupLabel({ shareName: "给同事", sharedBy: "alice" }), "给同事 · 来自 alice");
  assert.equal(receivedGroupLabel({ sharedBy: "bob" }), "来自 bob");
  assert.deepEqual(receivedGroupMeta({ shareName: "给同事", sharedBy: "alice" }), {
    label: "给同事 · 来自 alice",
    title: "给同事",
    subtitle: "来自 alice",
    sharedBy: "alice",
    shareName: "给同事",
    avatar: "AL",
  });
  assert.equal(receivedAvatarText("张三"), "张三");
  assert.equal(receivedAvatarText("alice"), "AL");
  const items = [
    { issuer: "GitHub", shareId: 2, shareName: "一批", sharedBy: "alice", shared: true },
    { issuer: "GitHub", shareId: 3, shareName: "另一批", sharedBy: "bob", shared: true },
    { issuer: "Google", shareId: 2, shareName: "一批", sharedBy: "alice", shared: true },
    { issuer: "Own", shared: false },
  ];
  const receivedOnly = items.filter((item) => item.shared);
  const groups = groupCredentials(receivedOnly, "received", true, false);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].key, "share:2");
  assert.equal(groups[0].title, "一批");
  assert.equal(groups[0].subtitle, "来自 alice");
  assert.equal(groups[0].avatar, "AL");
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].key, "share:3");
  assert.equal(groups[1].title, "另一批");
  assert.equal(groups[1].items.length, 1);
  const sections = groupReceivedBySource(receivedOnly);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].sharedBy, "alice");
  assert.equal(sections[0].batches.length, 1);
  assert.equal(sections[0].items.length, 2);
  assert.equal(sections[1].sharedBy, "bob");
  assert.equal(sections[1].batches[0].title, "另一批");
  const nickItems = [
    { issuer: "GitHub", shareId: 2, sharedBy: "张三", sharedByAccount: "zhangsan", shared: true },
    { issuer: "Google", shareId: 2, sharedBy: "张三", sharedByAccount: "zhangsan", shared: true },
    { issuer: "Slack", shareId: 4, sharedBy: "张三", sharedByAccount: "zhangsan2", shared: true },
  ];
  const nickSections = groupReceivedBySource(nickItems);
  assert.equal(nickSections.length, 2);
  assert.equal(nickSections[0].sharedBy, "张三");
  assert.equal(nickSections[0].sharedByAccount, "zhangsan");
  assert.equal(nickSections[0].label, "来自 张三 · zhangsan");
  assert.equal(nickSections[0].items.length, 2);
  assert.equal(nickSections[1].sharedByAccount, "zhangsan2");
  assert.equal(sharerDisplay({ sharedBy: "张三", sharedByAccount: "zhangsan" }), "张三 · zhangsan");
  assert.equal(sharerDisplay({ sharedBy: "alice", sharedByAccount: "alice" }), "alice");
  assert.equal(sharerDisplay({ sharedBy: "bob" }), "bob");
  assert.deepEqual(
    shareDetailCredentials([2, 9], [{ id: 2, issuer: "GitHub", accountName: "octo" }]),
    [{ id: 2, issuer: "GitHub", accountName: "octo" }, { id: 9, issuer: "已移除的凭据", accountName: "#9" }],
  );
  const issuerGroups = groupCredentials(items, "all", true);
  assert.equal(issuerGroups.length, 3);
  assert.equal(issuerGroups[0].label, "GitHub");
  assert.deepEqual(listSharedByOptions(items), ["alice", "bob"]);
  assert.equal(matchesSharedByFilter(items[0], ""), true);
  assert.equal(matchesSharedByFilter(items[0], "alice"), true);
  assert.equal(matchesSharedByFilter(items[1], "alice"), false);
  assert.equal(matchesSharedByFilter(items[3], "alice"), false);
  assert.equal(matchesSharedByFilter(items[3], SHARED_BY_SELF), true);
  assert.equal(matchesSharedByFilter(items[0], SHARED_BY_SELF), false);
  assert.equal(sharedByFilterLabel(SHARED_BY_SELF), "我的");
  assert.equal(sharedByFilterLabel("alice"), "alice");
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
  assert.match(sharePage, /status\?\.name\?\.trim\(\)/);
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
  assert.match(workspace, /clipboardOffer\.name/);
  assert.match(workspace, /忽略/);
  assert.doesNotMatch(workspace, /识别剪贴板/);
  assert.match(workspace, /clipboardReadBlocked/);
  assert.match(workspace, /pointerdown/);
  const saveFn = workspace.slice(workspace.indexOf("const saveClipboardOffer"), workspace.indexOf("const syncOfflineCopy"));
  assert.doesNotMatch(saveFn, /persistClipboardIgnored/);
  assert.match(saveFn, /alreadySaved/);
  assert.match(workspace, /persistClipboardIgnored\(clipboardOffer\.token\)/);
});

test("second access-code open does not stay on verifying handoff when a session already exists", () => {
  assert.equal(shouldShowShareHandoff(true, false), true);
  assert.equal(shouldShowShareHandoff(true, true), false);
  assert.equal(shouldShowShareHandoff(false, false), false);
  assert.equal(shareHandoffAfterRestore(true), "show-content");
  assert.equal(shareHandoffAfterRestore(false), "reopen");
});

test("share page leaves 验证授权 after a restored session loads", async () => {
  const sharePage = await source("app/systems/otp/VaultSharePage.tsx");
  assert.match(sharePage, /shouldShowShareHandoff/);
  assert.match(sharePage, /shareHandoffAfterRestore\(ok\) === "show-content"/);
  assert.match(sharePage, /setAutoOpening\(false\)/);
});
