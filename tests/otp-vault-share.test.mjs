import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PENDING_SAVE_KEY,
  SHARE_ITEM_LIMIT,
  matchesCredentialTab,
  selectShareItems,
  shareLoginNext,
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
});

test("vault UI exposes received tab, 50-item cap and save-to-inbox", async () => {
  const [workspace, sharePage, vaultPage] = await Promise.all([
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/VaultSharePage.tsx"),
    source("app/systems/otp/OtpVaultPage.tsx"),
  ]);
  assert.match(workspace, /我收到的/);
  assert.match(workspace, /SHARE_ITEM_LIMIT/);
  assert.match(workspace, /单次最多(?:授权|选择) \$\{SHARE_ITEM_LIMIT\}/);
  assert.match(workspace, /credentialTab === "received"/);
  assert.match(sharePage, /转存到我收到的/);
  assert.match(sharePage, /PENDING_SAVE_KEY/);
  assert.match(vaultPage, /next/);
});
