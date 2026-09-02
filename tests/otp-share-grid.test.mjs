import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("renders public shared credentials as responsive summary cards", async () => {
  const [workspace, sharePage, styles] = await Promise.all([
    readFile(new URL("app/systems/otp/OtpVaultWorkspace.tsx", root), "utf8"),
    readFile(new URL("app/systems/otp/VaultSharePage.tsx", root), "utf8"),
    readFile(new URL("app/systems/otp/otp-vault.css", root), "utf8"),
  ]);

  assert.doesNotMatch(workspace, /className="vault-share-card"/);
  assert.match(sharePage, /share-credential-card/);
  assert.match(sharePage, /share-login-summary/);
  assert.match(sharePage, /item\.password \? "账号与密码" : "账号信息"/);
  assert.match(styles, /\.share-page\.is-open \.share-brand,\.share-content \{ max-width: 1120px; \}/);
  assert.match(styles, /\.share-item-list,\.share-item-list\.is-compact \{ grid-template-columns: repeat\(3,minmax\(0,1fr\)\);/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.share-item-list,\.share-item-list\.is-compact \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.share-item-list,\.share-item-list\.is-compact \{ grid-template-columns: 1fr; \}/);
});
