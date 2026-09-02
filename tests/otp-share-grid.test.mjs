import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("renders temporary authorizations as responsive summary cards", async () => {
  const [workspace, styles] = await Promise.all([
    readFile(new URL("app/systems/otp/OtpVaultWorkspace.tsx", root), "utf8"),
    readFile(new URL("app/systems/otp/otp-vault.css", root), "utf8"),
  ]);

  assert.match(workspace, /className="vault-share-card"/);
  assert.match(workspace, /className="vault-share-card-meta"/);
  assert.match(workspace, /授权内容/);
  assert.match(workspace, /剩余有效期/);
  assert.match(styles, /\.vault-share-list \{ grid-template-columns: repeat\(3,minmax\(0,1fr\)\);/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.vault-share-list \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.vault-share-list \{ grid-template-columns: 1fr; \}/);
});
