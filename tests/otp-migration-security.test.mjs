import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("requires fresh verification and requests only OTP migration data", async () => {
  const [api, securityCenter, qr] = await Promise.all([
    source("app/systems/otp/vaultApi.ts"),
    source("app/systems/otp/VaultSecurityCenter.tsx"),
    source("app/systems/otp/vaultQr.ts"),
  ]);

  assert.match(api, /exportWithFreshVerification/);
  assert.match(api, /clearOtpStepUpToken\(\);[\s\S]*finally \{ clearOtpStepUpToken\(\); \}/);
  assert.match(api, /exportVaultMigration.*`\$\{vault\}\/migration`/);
  assert.match(securityCenter, /const result = await exportVaultMigration\(\)/);
  assert.doesNotMatch(securityCenter, /const exportQr[\s\S]{0,160}exportVaultBackup\(\)/);
  assert.match(securityCenter, /生成前会重新验证身份，只读取 OTP 迁移所需字段/);
  assert.doesNotMatch(qr, /return \{ index: batchIndex \+ 1, total: groups\.length, uri,/);
});
