import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps the OTP guide public and reachable before and after login", async () => {
  const [routes, shell, auth, workspace, guide, styles, share] = await Promise.all([
    source("app/lib/pathConventions.ts"),
    source("app/systems/otp/OtpApp.tsx"),
    source("app/systems/otp/OtpAuthScreen.tsx"),
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/OtpVaultGuidePage.tsx"),
    source("app/systems/otp/otp-guide.css"),
    source("app/systems/otp/VaultSharePage.tsx"),
  ]);

  assert.match(routes, /otpGuide: "\/otp\/guide"/);
  assert.match(shell, /guide \? <OtpVaultGuidePage \/>/);
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
  assert.match(guide, /授权名称/);
  assert.match(guide, /给同事的临时访问/);
  assert.match(guide, /验证码一直不正确/);
  assert.match(guide, /设备与回收站/);
  assert.match(guide, /otp-guide-anatomy/);
  assert.match(guide, /otp-guide-methods/);
  assert.doesNotMatch(guide, /gooop\.top\/s\//);
  assert.doesNotMatch(guide, /dCOxR|W9KKQR/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.doesNotMatch(guide, /—/);
});
