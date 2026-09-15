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
