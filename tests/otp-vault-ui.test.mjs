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

test("puts a lock control beside theme switch and wires screen lock setup", async () => {
  const workspace = await source("app/systems/otp/OtpVaultWorkspace.tsx");
  const lockPage = await source("app/systems/otp/VaultScreenLock.tsx");
  const security = await source("app/systems/otp/VaultSecurityCenter.tsx");
  assert.match(workspace, /vault-lock-action/);
  assert.match(workspace, /锁定保险库/);
  assert.match(workspace, /设置锁屏密码/);
  assert.match(workspace, /<Lock size=\{18\} \/>/);
  assert.match(workspace, /VaultScreenLock/);
  assert.match(lockPage, /我的 → 安全中心/);
  assert.match(lockPage, /必须先有锁屏密码/);
  assert.match(security, /无操作自动锁屏/);
  assert.match(security, /仍可手动锁屏/);
});

test("keeps conceal, recent sort, duplicate guard and system share in the vault", async () => {
  const workspace = await source("app/systems/otp/OtpVaultWorkspace.tsx");
  assert.match(workspace, /readDeviceDisplayPrefs/);
  assert.match(workspace, /concealOtp: device.concealOtp \?\? remote.concealOtp/);
  assert.match(workspace, /listSort: device.listSort \|\| remote.listSort/);
  assert.match(workspace, /Boolean\(prefs.concealOtp\)/);
  assert.match(workspace, /prefs.listSort \|\| "name"/);
  assert.match(workspace, /点按显示并复制/);
  assert.match(workspace, /最近使用/);
  assert.match(workspace, /findSameAccountCredential/);
  assert.match(workspace, /shouldConfirmDuplicateAdd/);
  assert.match(workspace, /duplicateConfirm/);
  assert.match(workspace, /仍要添加/);
  assert.doesNotMatch(workspace, /if \(duplicate\) return notify\("已存在相同系统和账号的凭据"/);
  assert.match(workspace, /canUseSystemShare/);
  assert.match(workspace, /系统分享/);
  assert.match(workspace, /max-width: 820px/);
  assert.match(workspace, /CLIPBOARD_CLEAR_MS/);
  assert.match(workspace, /issuerStyle\(item\.issuer, item.loginUrl\)/);
  assert.match(workspace, /className="vault-ghost vault-import-action"/);
  assert.match(workspace, /aria-label="添加或导入凭据"><Plus size=\{18\}/);
  assert.doesNotMatch(workspace, /vault-primary vault-import-action/);
});

test("keeps credential and share filter tabs right-aligned beside the titles", async () => {
  const workspace = await source("app/systems/otp/OtpVaultWorkspace.tsx");
  const styles = await source("app/systems/otp/otp-vault.css");
  assert.match(workspace, /vault-panel-title-row/);
  assert.match(workspace, /aria-label="凭据筛选"/);
  assert.match(workspace, /aria-label="授权筛选"/);
  assert.match(styles, /\.vault-panel-title-row[\s\S]{0,180}justify-content:\s*space-between/);
  assert.match(styles, /\.vault-fav-switch[\s\S]{0,220}margin-left:\s*auto/);
  assert.match(styles, /\.vault-fav-switch[\s\S]{0,220}justify-content:\s*flex-end/);
  assert.match(styles, /\.vault-fav-switch[\s\S]{0,280}border-radius:\s*999px/);
});

test("floats credential add and share create actions on PC", async () => {
  const styles = await source("app/systems/otp/otp-vault.css");
  assert.match(styles, /\.vault-panel-head > \.vault-import-action,[\s\S]{0,80}\.vault-panel-head > \.vault-create-share \{[\s\S]{0,120}position:\s*fixed/);
  assert.match(styles, /\.vault-panel-head > \.vault-create-share \{[\s\S]{0,360}right:\s*calc\(max\(24px, \(100vw - 1120px\) \/ 2\) \+ 24px\)/);
  assert.match(styles, /\.vault-panel-head > \.vault-create-share \{[\s\S]{0,420}bottom:\s*28px/);
});

test("shows a dedicated secure handoff while opening an auto-filled share", async () => {
  const sharePage = await source("app/systems/otp/VaultSharePage.tsx");
  const styles = await source("app/systems/otp/otp-vault.css");
  assert.match(sharePage, /autoFillRef/);
  assert.match(sharePage, /正在安全打开授权/);
  assert.match(sharePage, /访问码验证后会立即从地址栏移除/);
  assert.match(styles, /\.share-handoff-card/);
  assert.match(styles, /@keyframes share-handoff-travel/);
});
