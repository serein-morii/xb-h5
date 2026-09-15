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

test("creating a source group stays on the workspace instead of native-submitting into splash", () => {
  assert.match(workspace, /const submitCodeBinding = async \(\) => \{/);
  assert.match(workspace, /onClick=\{\(\) => void submitCodeBinding\(\)\}/);
  assert.doesNotMatch(workspace, /onSubmit=\{submitCodeBinding\}/);
  assert.match(workspace, /<section className="vault-modal share vault-share-form vault-binding-modal">/);
  assert.match(workspace, /const renderChannelForm = \(afterCreate\?: \(channel: VaultInboundChannel\) => void\) => <div className="vault-channel-create">/);
  assert.match(workspace, /onClick=\{\(\) => void submitInboundChannel\(\)/);
});

test("credential detail shows inbound codes like authenticator OTP and keeps visit URL in login info", async () => {
  const styles = fs.readFileSync(new URL("../app/systems/otp/otp-vault.css", import.meta.url), "utf8");
  assert.match(workspace, /className="is-otp is-inbound"/);
  assert.match(workspace, /className="is-otp is-inbound is-waiting"/);
  assert.match(workspace, /<div className="vault-detail-next"><span>来源<\/span>/);
  assert.match(workspace, /className="is-login-url"/);
  assert.match(workspace, /className="vault-detail-login-url"/);
  assert.match(workspace, /step=\{liveDetail\.note \|\| liveDetail\.tags \? "03" : "02"\}/);
  assert.match(share, /className="is-otp is-inbound"/);
  assert.match(share, /className="vault-detail-login-url"/);
  assert.match(styles, /\.vault-detail-values section\.is-otp b \{ font-size: 26px/);
  assert.match(styles, /\.vault-code-history-list article > div > b \{ font-size: 12px/);
  assert.match(styles, /\.vault-detail-login-url \{/);
});
