import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLOCK_DRIFT_WARN_MS,
  CLIPBOARD_CLEAR_MS,
  INSTALL_DISMISS_KEY,
  duplicateImportCount,
  findSameAccountCredential,
  installCoachCopy,
  installCoachKind,
  iosInstallHint,
  iosVersionFromUa,
  isMobileLikeDevice,
  measureClockDriftMs,
  scheduleClipboardClear,
  shouldConfirmDuplicateAdd,
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

test("install hint hides on PC, standalone and after dismiss", () => {
  assert.equal(INSTALL_DISMISS_KEY, "otp-vault-install-coach-v3");
  assert.equal(isMobileLikeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"), false);
  assert.equal(isMobileLikeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1"), false);
  assert.equal(isMobileLikeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"), true);
  assert.equal(isMobileLikeDevice("Mozilla/5.0 (Linux; Android 14) Chrome/120"), true);
  assert.equal(shouldShowInstallHint({ standalone: true, dismissed: false, mobile: true }), false);
  assert.equal(shouldShowInstallHint({ standalone: false, dismissed: true, mobile: true }), false);
  assert.equal(shouldShowInstallHint({ standalone: false, dismissed: false, mobile: false }), false);
  assert.equal(shouldShowInstallHint({ standalone: false, dismissed: false, mobile: true }), true);
  assert.match(iosInstallHint, /添加到桌面/);
});

test("install coach copy is explicit for iOS, WeChat and browsers", () => {
  assert.equal(installCoachKind("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"), "ios");
  assert.equal(installCoachKind("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0.0.0"), "browser");
  assert.equal(installCoachKind("Mozilla/5.0 MicroMessenger/8.0.5"), "wechat");
  assert.equal(installCoachKind("Mozilla/5.0 (Linux; Android 14) Chrome/120"), "browser");
  assert.equal(iosVersionFromUa("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)"), 18);
  assert.equal(iosVersionFromUa("Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)"), 26);
  assert.equal(iosVersionFromUa("Mozilla/5.0 (iPad; CPU OS 26_1 like Mac OS X)"), 26);
  const ios26 = installCoachCopy("ios", 26);
  assert.equal(ios26.title, "添加到桌面");
  assert.match(ios26.action, /指出分享按钮/);
  assert.equal(ios26.steps.length, 3);
  assert.match(ios26.steps[0], /右下角/);
  assert.match(ios26.steps[0], /三个点/);
  const ios18 = installCoachCopy("ios", 18);
  assert.match(ios18.steps[0], /中间/);
  assert.match(ios18.steps.join(""), /分享/);
  assert.doesNotMatch(ios18.steps[0], /三个点/);
  const wechat = installCoachCopy("wechat");
  assert.match(wechat.detail, /Safari|Chrome/);
  assert.match(wechat.steps.join(""), /Safari/);
  const browser = installCoachCopy("browser");
  assert.match(browser.action, /立即安装|指出分享按钮|怎么添加/);
  assert.match(browser.steps[0], /右上角/);
  assert.match(browser.steps.join(""), /分享/);
  assert.match(browser.steps.join(""), /添加到桌面|添加到主屏幕/);
});

test("same system and account can be added again after confirm", () => {
  const existing = [
    { id: 1, issuer: "GitHub", accountName: "me@example.com" },
    { id: 2, issuer: "微信", accountName: "work" },
  ];
  const hit = findSameAccountCredential(existing, "github", "ME@example.com");
  assert.equal(hit?.id, 1);
  assert.equal(findSameAccountCredential(existing, "GitHub", "me@example.com", 1), undefined);
  assert.equal(findSameAccountCredential(existing, "Other", "me@example.com"), undefined);
  assert.equal(shouldConfirmDuplicateAdd(Boolean(hit), false), true);
  assert.equal(shouldConfirmDuplicateAdd(Boolean(hit), true), false);
  assert.equal(shouldConfirmDuplicateAdd(false, false), false);
  assert.equal(duplicateImportCount(existing, [
    { issuer: "GitHub", accountName: "me@example.com" },
    { issuer: "New", accountName: "a" },
    { issuer: "微信", accountName: "work" },
  ]), 2);
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
  assert.match(css, /\.otp-install-hint[\s\S]{0,280}bottom:\s*max\(/);
  assert.doesNotMatch(css, /body:has\(\.otp-auth-page\) \.otp-install-hint/);
  assert.doesNotMatch(css, /body:has\(\.otp-guide-page\) \.otp-install-hint/);
  assert.match(css, /body:has\(\.otp-install-hint\)[\s\S]{0,220}padding-bottom/);
  assert.match(css, /otp-install-steps/);
  const hint = await source("app/systems/otp/OtpInstallHint.tsx");
  assert.match(hint, /installCoachCopy/);
  assert.match(hint, /iosVersionFromUa/);
  assert.match(hint, /isMobileLikeDevice/);
  assert.match(hint, /mobile:/);
  assert.match(hint, /怎么添加/);
  assert.match(hint, /kind === "ios" \|\| kind === "wechat"/);
  assert.match(hint, /otp-install-steps/);
  assert.doesNotMatch(hint, /otp-install-spotlight/);
  assert.doesNotMatch(css, /otp-install-spotlight/);
  assert.match(css, /vault-clock-banner/);
  assert.match(controller, /\/backup\/local-sync/);
  assert.match(controller, /require\(/);
  assert.doesNotMatch(controller, /local-sync[\s\S]{0,400}requireFresh/);
  assert.match(app, /OtpInstallHint/);
});
