import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps the OTP guide public and reachable before and after login", async () => {
  const [routes, shell, auth, workspace, guide, styles, share, changelog] = await Promise.all([
    source("app/lib/pathConventions.ts"),
    source("app/systems/otp/OtpApp.tsx"),
    source("app/systems/otp/OtpAuthScreen.tsx"),
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/OtpVaultGuidePage.tsx"),
    source("app/systems/otp/otp-guide.css"),
    source("app/systems/otp/VaultSharePage.tsx"),
    source("app/systems/otp/OtpVaultChangelogPage.tsx"),
  ]);

  assert.match(routes, /otpGuide: "\/otp\/guide"/);
  assert.match(routes, /otpChangelog: "\/otp\/changelog"/);
  assert.match(shell, /guide \? <OtpVaultGuidePage \/>/);
  assert.match(shell, /changelog \? <OtpVaultChangelogPage \/>/);
  assert.match(auth, /href=\{APP_ROUTES\.otpGuide\}/);
  assert.match(auth, /const \[longSession, setLongSession\] = useState\(true\)/);
  assert.match(share, /setThemePreference/);
  assert.match(share, /验证码已复制/);
  assert.match(share, /aria-label="查看"/);
  assert.doesNotMatch(auth, /RSA 加密传输/);
  assert.match(workspace, /vault-guide-action/);
  assert.match(workspace, /formatShareText/);
  assert.match(workspace, /copyShareInfo/);
  assert.match(workspace, /share\.name\?\.trim\(\) \|\| "临时凭据授权"/);
  assert.match(workspace, /placeholder="例如 给同事的临时访问，不填则为临时凭据授权"/);
  assert.match(workspace, /给这次授权起个名字/);
  assert.match(share, /status\?\.name \|\| "临时凭据授权"/);
  for (const id of ["quick-start", "add", "use", "share", "security", "faq"]) assert.match(guide, new RegExp(`id="${id}"`));
  assert.doesNotMatch(guide, /id="changelog"/);
  assert.doesNotMatch(guide, /\["changelog", "更新日志"\]/);
  assert.match(guide, /授权名称/);
  assert.match(guide, /给同事的临时访问/);
  assert.match(guide, /验证码一直不正确/);
  assert.match(guide, /设备与回收站/);
  assert.match(guide, /otp-guide-chapter/);
  assert.match(guide, /otp-guide-toc/);
  assert.match(guide, /otp-guide-prose/);
  assert.doesNotMatch(guide, /otp-guide-hero-visual/);
  assert.doesNotMatch(guide, /otp-guide-lifecycle/);
  assert.match(guide, /从添加第一条凭据开始/);
  assert.match(guide, /邮箱还没有注册/);
  assert.match(guide, /我发出的/);
  assert.match(guide, /我收到的/);
  assert.match(guide, /转存/);
  assert.match(guide, /添加到桌面/);
  assert.match(changelog, /同一系统和账号可以重复添加/);
  assert.match(changelog, /OTP_VAULT_VERSION/);
  assert.match(changelog, /vault-page/);
  assert.match(changelog, /vault-changelog-page/);
  assert.match(changelog, /vault-settings-group/);
  assert.doesNotMatch(changelog, /otp-guide-page/);
  assert.doesNotMatch(changelog, /otp-guide-hero/);
  assert.doesNotMatch(changelog, /otp-guide-timeline/);
  assert.match(changelog, /aria-label="更新记录"/);
  assert.match(changelog, /2026-09-07/);
  assert.match(changelog, /2026-09-06/);
  assert.match(changelog, /2026-09-02/);
  assert.match(changelog, /2026-09-01/);
  assert.match(changelog, /2026-08-31/);
  assert.match(changelog, /2026-08-25/);
  assert.match(changelog, /首次上线/);
  assert.match(changelog, /加密备份/);
  assert.match(changelog, /使用指南/);
  assert.match(changelog, /APP_ROUTES\.otpGuide/);
  assert.match(changelog, /查看使用指南|使用指南/);
  assert.match(styles, /\.otp-guide-chapter/);
  assert.match(styles, /\.otp-guide-toc/);
  assert.match(styles, /\.otp-guide-prose/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /safe-area-inset-top/);
  assert.match(styles, /otp-guide-toc a[\s\S]{0,200}border-radius:\s*999px/);
  assert.doesNotMatch(guide, /无需登录即可阅读|公开指南/);
  assert.doesNotMatch(guide, /gooop\.top\/s\//);
  assert.doesNotMatch(guide, /dCOxR|W9KKQR/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.doesNotMatch(guide, /—/);
});
