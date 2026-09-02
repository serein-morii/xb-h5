import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shows and copies the next time-window code for private credentials", async () => {
  const [workspace, api, styles, sharePage] = await Promise.all([
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/vaultApi.ts"),
    source("app/systems/otp/otp-vault.css"),
    source("app/systems/otp/VaultSharePage.tsx"),
  ]);

  assert.match(api, /currentOtp\?: string; nextOtp\?: string/);
  assert.match(api, /otp\?: string; nextOtp\?: string/);
  assert.match(workspace, /now \+ period \* 1000/);
  assert.match(workspace, /item\.otpType !== "HOTP"/);
  assert.match(workspace, /!item\.shared/);
  assert.match(workspace, /className="vault-card-next"/);
  assert.match(workspace, /className="vault-detail-next"/);
  assert.equal(workspace.match(/className="vault-next-copy"/g)?.length, 2);
  assert.match(workspace, /copy\(item\.nextOtp \|\| "", "下一组验证码已复制"\)/);
  assert.match(workspace, /copy\(liveDetail\.nextOtp \|\| "", "下一组验证码已复制"\)/);
  assert.match(sharePage, /item\.nextOtp/);
  assert.equal(sharePage.match(/className="vault-next-copy"/g)?.length, 2);
  assert.match(sharePage, /onCopy\(item\.nextOtp \|\| "", nextOtpKey, "下一组验证码已复制"\)/);
  assert.match(sharePage, /copy\(liveShareDetail\.nextOtp \|\| "", "detail-next-otp", "下一组验证码已复制"\)/);
  assert.match(styles, /\.vault-card-next\s*\{[^}]*padding:[^}]*background:/s);
  assert.match(styles, /\.vault-card-next b\s*\{[^}]*font-size:\s*12px;/s);
  assert.match(styles, /\.vault-next-copy\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px;/s);
  assert.match(styles, /\.vault-detail-values section\.is-otp \.vault-detail-next \{[^}]*width: max-content;[^}]*margin: 9px 0 0 auto;/);
  assert.match(styles, /\.vault-detail-next b \{ margin-left: 0;/);
  assert.doesNotMatch(styles, /\.vault-card\.is-compact \.vault-card-next small \{ display: none; \}/);
  assert.match(styles, /\.vault-card\.is-compact \.vault-card-next \+ span \{ display: none; \}/);
  assert.doesNotMatch(styles, /\.vault-page \.vault-card\.is-compact \.vault-card-actions > button:first-child \{ display: none; \}/);
  assert.match(styles, /\.vault-card\.is-compact \.vault-card-actions \{[^}]*gap: 2px;/);
  assert.match(styles, /minmax\(255px,1fr\)/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.vault-card\.is-compact \.vault-card-actions button \{ width: 30px; height: 30px; \}/);
});
