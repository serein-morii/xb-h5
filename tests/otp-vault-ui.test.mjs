import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { issuerStyle } from "../app/systems/otp/issuerStyle.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("maps common issuers to local brand colors without network icons", () => {
  assert.equal(issuerStyle("GitHub").background, "#24292f");
  assert.equal(issuerStyle("微信").background, "#07c160");
  assert.equal(issuerStyle("Demo", "https://gitlab.com/account").background, "#fc6d26");
  assert.match(issuerStyle("Unknown Bank").background, /^hsl\(/);
  assert.doesNotMatch(JSON.stringify(issuerStyle("GitHub")), /https?:\/\//);
});

test("keeps conceal, recent sort, duplicate guard and system share in the vault", async () => {
  const workspace = await source("app/systems/otp/OtpVaultWorkspace.tsx");
  assert.match(workspace, /concealOtp/);
  assert.match(workspace, /点按显示并复制/);
  assert.match(workspace, /最近使用/);
  assert.match(workspace, /已存在相同系统和账号的凭据/);
  assert.match(workspace, /navigator\.share/);
  assert.match(workspace, /CLIPBOARD_CLEAR_MS/);
  assert.match(workspace, /issuerStyle\(item\.issuer, item.loginUrl\)/);
});
