import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLOCK_DRIFT_WARN_MS,
  CLIPBOARD_CLEAR_MS,
  INSTALL_DISMISS_KEY,
  iosInstallHint,
  measureClockDriftMs,
  scheduleClipboardClear,
  shouldShowInstallHint,
  shouldWarnClockDrift,
} from "../app/systems/otp/otpDailyUse.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("clock drift uses RTT midpoint and warns at 2 seconds", () => {
  assert.equal(CLOCK_DRIFT_WARN_MS, 2000);
  assert.equal(measureClockDriftMs(1000, 1100, 1050), 0);
  assert.equal(measureClockDriftMs(1000, 1100, 4050), 3000);
  assert.equal(shouldWarnClockDrift(1999), false);
  assert.equal(shouldWarnClockDrift(2000), true);
  assert.equal(shouldWarnClockDrift(-2500), true);
});

test("install hint hides in standalone and after dismiss", () => {
  assert.equal(INSTALL_DISMISS_KEY, "otp-vault-install-dismissed");
  assert.equal(shouldShowInstallHint({ standalone: true, dismissed: false }), false);
  assert.equal(shouldShowInstallHint({ standalone: false, dismissed: true }), false);
  assert.equal(shouldShowInstallHint({ standalone: false, dismissed: false }), true);
  assert.match(iosInstallHint, /添加到主屏幕/);
});

test("clipboard clear only wipes if the copied value is still there", async () => {
  assert.equal(CLIPBOARD_CLEAR_MS, 30_000);
  const timers = [];
  const timerApi = {
    setTimeout(fn, delay) {
      timers.push({ fn, delay });
      return timers.length;
    },
    clearTimeout() {},
  };
  let clipboard = "123456";
  scheduleClipboardClear("123456", async (next) => { clipboard = next; }, async () => clipboard, 30_000, timerApi);
  assert.equal(timers[0].delay, 30_000);
  await timers[0].fn();
  assert.equal(clipboard, "");

  clipboard = "other";
  scheduleClipboardClear("123456", async (next) => { clipboard = next; }, async () => clipboard, 30_000, timerApi);
  await timers[1].fn();
  assert.equal(clipboard, "other");
});

test("vault wires install hint, clock banner, local offline sync and clipboard clear", async () => {
  const [, app, auth, workspace, share, offline, security, api, crypto, css, controller] = await Promise.all([
    source("app/systems/otp/otpDailyUse.ts"),
    source("app/systems/otp/OtpApp.tsx"),
    source("app/systems/otp/OtpAuthScreen.tsx"),
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/VaultSharePage.tsx"),
    source("app/systems/otp/OtpOfflineVault.tsx"),
    source("app/systems/otp/VaultSecurityCenter.tsx"),
    source("app/systems/otp/vaultApi.ts"),
    source("app/systems/otp/vaultCrypto.ts"),
    source("app/systems/otp/otp-vault.css"),
    source("../xb/src/main/java/com/xb/modules/otp/api/OtpVaultController.java"),
  ]);
  assert.match(auth, /OtpInstallHint/);
  assert.match(workspace, /OtpInstallHint/);
  assert.match(workspace, /shouldWarnClockDrift/);
  assert.match(workspace, /请打开自动时间/);
  assert.match(share, /scheduleClipboardClear/);
  assert.match(offline, /scheduleClipboardClear/);
  assert.match(offline, /tryUnlockOfflineVault/);
  assert.match(security, /saveOfflineDeviceCopy/);
  assert.match(workspace, /refreshOfflineVault/);
  assert.match(api, /backup\/local-sync/);
  assert.match(crypto, /otp-vault-offline-device/);
  assert.match(css, /otp-install-hint/);
  assert.match(css, /vault-clock-banner/);
  assert.match(controller, /\/backup\/local-sync/);
  assert.match(controller, /require\(/);
  assert.doesNotMatch(controller, /local-sync[\s\S]{0,400}requireFresh/);
  assert.match(app, /OtpInstallHint/);
});
