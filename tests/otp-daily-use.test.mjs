import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLOCK_DRIFT_WARN_MS,
  CLIPBOARD_CLEAR_MS,
  INSTALL_DISMISS_KEY,
  installCoachCopy,
  installCoachKind,
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
  assert.equal(INSTALL_DISMISS_KEY, "otp-vault-install-coach-v2");
  assert.equal(shouldShowInstallHint({ standalone: true, dismissed: false }), false);
  assert.equal(shouldShowInstallHint({ standalone: false, dismissed: true }), false);
  assert.equal(shouldShowInstallHint({ standalone: false, dismissed: false }), true);
  assert.match(iosInstallHint, /添加到主屏幕/);
});

test("install coach copy is explicit for iOS, WeChat and browsers", () => {
  assert.equal(installCoachKind("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "ios");
  assert.equal(installCoachKind("Mozilla/5.0 MicroMessenger/8.0.5"), "wechat");
  assert.equal(installCoachKind("Mozilla/5.0 (Linux; Android 14) Chrome/120"), "browser");
  const ios = installCoachCopy("ios");
  assert.equal(ios.title, "添加到桌面");
  assert.match(ios.action, /指出分享按钮/);
  assert.equal(ios.steps.length, 3);
  assert.match(ios.steps[0], /分享/);
  assert.match(ios.steps[1], /添加到主屏幕/);
  const wechat = installCoachCopy("wechat");
  assert.match(wechat.detail, /Safari|Chrome/);
  assert.match(wechat.steps.join(""), /Safari/);
  const browser = installCoachCopy("browser");
  assert.match(browser.action, /立即安装|怎么添加/);
  assert.match(browser.steps.join(""), /安装|主屏幕|桌面/);
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
  assert.doesNotMatch(auth, /OtpInstallHint/);
  assert.doesNotMatch(workspace, /OtpInstallHint/);
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
  assert.match(css, /\.otp-install-hint[\s\S]{0,220}position:\s*fixed/);
  assert.match(css, /body:has\(\.otp-auth-page\) \.otp-install-hint/);
  assert.match(css, /:has\(\.otp-auth-page\)[\s\S]{0,120}position:\s*(static|relative)/);
  assert.match(css, /otp-install-steps/);
  const hint = await source("app/systems/otp/OtpInstallHint.tsx");
  assert.match(hint, /installCoachCopy/);
  assert.match(hint, /otp-install-spotlight/);
  assert.match(hint, /指出分享按钮/);
  assert.match(hint, /otp-install-steps/);
  assert.match(css, /otp-install-spotlight/);
  assert.match(css, /vault-clock-banner/);
  assert.match(controller, /\/backup\/local-sync/);
  assert.match(controller, /require\(/);
  assert.doesNotMatch(controller, /local-sync[\s\S]{0,400}requireFresh/);
  assert.match(app, /OtpInstallHint/);
});
