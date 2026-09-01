import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps the OTP guide public and reachable before and after login", async () => {
  const [routes, shell, auth, workspace, guide, styles] = await Promise.all([
    source("app/lib/pathConventions.ts"),
    source("app/systems/otp/OtpApp.tsx"),
    source("app/systems/otp/OtpAuthScreen.tsx"),
    source("app/systems/otp/OtpVaultWorkspace.tsx"),
    source("app/systems/otp/OtpVaultGuidePage.tsx"),
    source("app/systems/otp/otp-guide.css"),
  ]);

  assert.match(routes, /otpGuide: "\/otp\/guide"/);
  assert.match(shell, /guide \? <OtpVaultGuidePage \/>/);
  assert.match(auth, /href=\{APP_ROUTES\.otpGuide\}/);
  assert.doesNotMatch(auth, /RSA 加密传输/);
  assert.match(workspace, /vault-guide-action/);
  for (const id of ["quick-start", "add", "use", "share", "security", "faq"]) assert.match(guide, new RegExp(`id="${id}"`));
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.doesNotMatch(guide, /—/);
});
