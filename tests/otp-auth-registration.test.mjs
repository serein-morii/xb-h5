import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("offers the existing registration flow after an unregistered email login", async () => {
  const auth = await source("app/systems/otp/OtpAuthScreen.tsx");
  assert.match(auth, /error\.message === "该邮箱未注册"/);
  assert.match(auth, /setEmailCode\(""\); setCountdown\(0\); setRegistrationPrompt\(true\)/);
  assert.match(auth, /className="otp-register-modal" role="alertdialog" aria-modal="true"/);
  assert.match(auth, /onClick=\{\(\) => switchMode\("register"\)\}>创建账户/);
  assert.match(auth, /是否使用 <b>\{email\.trim\(\)\.toLowerCase\(\)\}<\/b> 创建 OTP Vault 账户/);
  assert.doesNotMatch(auth, /className="otp-register-prompt"/);
});

test("aligns the persistent login control to the right", async () => {
  const [auth, styles] = await Promise.all([
    source("app/systems/otp/OtpAuthScreen.tsx"),
    source("app/systems/otp/otp-auth.css"),
  ]);

  assert.match(auth, /className="otp-long-session"/);
  assert.match(styles, /\.otp-long-session\s*\{[^}]*width:\s*100%;[^}]*justify-content:\s*flex-end;/s);
});
