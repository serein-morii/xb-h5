import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const api = fs.readFileSync(new URL("../app/systems/otp/vaultApi.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../app/systems/otp/OtpVaultWorkspace.tsx", import.meta.url), "utf8");
const share = fs.readFileSync(new URL("../app/systems/otp/VaultSharePage.tsx", import.meta.url), "utf8");
const history = fs.readFileSync(new URL("../app/systems/otp/InboundCodeHistory.tsx", import.meta.url), "utf8");

test("credential and public share details paginate inbound code history five at a time", () => {
  assert.match(api, /dynamic-codes\?page=\$\{page\}&pageSize=5/);
  assert.match(workspace, /InboundCodeHistory/);
  assert.match(workspace, /detailCodeHistoryPage \+ 1/);
  assert.match(share, /listSharedDynamicCodes/);
  assert.match(share, /detailCodeHistoryPage \+ 1/);
  assert.match(history, /加密保留 30 天 · 每次 5 条/);
  assert.match(history, /加载更多/);
});

test("received-code countdown uses received and expiry timestamps", () => {
  assert.match(history, /expires - received/);
  assert.match(history, /left \/ total \* 100/);
  assert.match(workspace, /dynamicCodeExpireTime/);
  assert.match(share, /shareDetailInboundTiming\.progress/);
});

test("countdowns read as Chinese minutes and seconds in every code slot", () => {
  assert.match(history, /`\$\{minutes\}分\$\{rest \? `\$\{rest\}秒` : ""\}`/);
  assert.match(history, /`\$\{Math\.floor\(minutes \/ 60\)}小时/);
  assert.match(history, /`\$\{rest\}秒`/);
  assert.match(workspace, /`\$\{left\}秒`/);
  assert.match(workspace, /\{detailOtpLeft\}秒<\//);
  assert.match(workspace, /秒后启用/);
  assert.match(share, /`\$\{left\}秒`/);
  assert.match(share, /秒后启用/);
  assert.doesNotMatch(workspace, /vault-code-timer/);
  assert.match(workspace, /prefs\.compact && !item\.dynamicCodeUsed \? <em>新<\/em> : null/);
  assert.match(workspace, /!prefs\.compact && !item\.dynamicCodeUsed \? <em>新<\/em> : null/);
  assert.match(workspace, /!prefs\.compact && item\.dynamicCode \? <span>\{formatCodeTime\(inboundTiming\.left\)\}<\/span> : null/);
  assert.match(share, /\{!compact && item\.dynamicCode \? <span>\{formatCodeTime\(inboundTiming\.left\)\}<\/span> : null\}/);
});

test("creating a source group stays on the workspace instead of native-submitting into splash", () => {
  assert.match(workspace, /const submitCodeBinding = async \(\) => \{/);
  assert.match(workspace, /onClick=\{\(\) => void submitCodeBinding\(\)\}/);
  assert.doesNotMatch(workspace, /onSubmit=\{submitCodeBinding\}/);
  assert.match(workspace, /<section className="vault-modal share vault-share-form vault-binding-modal">/);
  assert.match(workspace, /const renderChannelForm = \(afterCreate\?: \(channel: VaultInboundChannel\) => void\) => <div className="vault-channel-create">/);
  assert.match(workspace, /onClick=\{\(\) => void submitInboundChannel\(\)/);
});

test("inbound channels can be renamed in place and bindings follow the new name", () => {
  assert.match(workspace, /const renameInboundChannel = async \(channel: VaultInboundChannel\) => \{/);
  assert.match(workspace, /updateVaultInboundChannel\(channel\.id, \{ name \}\)/);
  assert.match(workspace, /setRenamingChannelId\(channel\.id\); setChannelNameDraft\(channel\.name\)/);
  assert.match(workspace, /className="vault-channel-rename"/);
  assert.match(workspace, /通道名称已更新/);
  assert.match(workspace, /channelId === channel\.id \? \{ \.\.\.binding, channelName: updated\.name \}/);
  assert.match(fs.readFileSync(new URL("../app/systems/otp/otp-vault.css", import.meta.url), "utf8"), /\.vault-channel-rename \{ display: flex/);
});

test("credential detail shows inbound codes like authenticator OTP and keeps visit URL in login info", async () => {
  const styles = fs.readFileSync(new URL("../app/systems/otp/otp-vault.css", import.meta.url), "utf8");
  assert.match(workspace, /className="is-otp is-inbound"/);
  assert.match(workspace, /className="is-otp is-inbound is-waiting"/);
  assert.match(workspace, /<div className="vault-detail-next"><span>来源<\/span>/);
  assert.match(workspace, /className="is-login-url"/);
  assert.match(workspace, /className="vault-detail-login-url"/);
  assert.match(workspace, /step=\{liveDetail\.fields\?\.length \? "04" : liveDetail\.note \|\| liveDetail\.tags \? "03" : "02"\}/);
  assert.ok(workspace.indexOf('className="is-otp"><span className="vault-otp-label">{liveDetail.otpType') < workspace.indexOf('className="is-otp is-inbound"><span'), "authenticator OTP renders above inbound codes");
  assert.ok(workspace.indexOf("vault-detail-open-url") < workspace.indexOf('aria-label="复制访问地址"'), "visit button precedes copy on the login-url row");
  assert.match(share, /className="is-otp is-inbound"/);
  assert.match(share, /className="vault-detail-login-url"/);
  assert.ok(share.indexOf('className="is-otp"><span className="vault-otp-label">动态验证码') < share.indexOf('className="is-otp is-inbound"><span'), "share authenticator OTP renders above inbound codes");
  assert.ok(share.indexOf("vault-detail-open-url") < share.indexOf('aria-label="复制访问地址"'), "share visit button precedes copy on the login-url row");
  assert.match(styles, /\.vault-detail-values section\.is-otp b \{ font-size: 26px/);
  assert.match(styles, /\.vault-code-history-list article > div > b \{ font-size: 12px/);
  assert.match(styles, /\.vault-detail-login-url \{/);
});
