import assert from "node:assert/strict";
import test from "node:test";
import { parseVaultImportText } from "../app/systems/otp/vaultImport.ts";

test("parses otpauth lines and keeps later JSON tags", () => {
  const items = parseVaultImportText(`
# comment
otpauth://totp/GitHub:demo@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
`);
  assert.equal(items.length, 1);
  assert.equal(items[0].issuer, "GitHub");
  assert.equal(items[0].accountName, "demo@example.com");
  assert.equal(items[0].otpSecret, "JBSWY3DPEHPK3PXP");
});

test("parses unencrypted Aegis JSON groups as tags", () => {
  const items = parseVaultImportText(JSON.stringify({
    db: {
      entries: [{
        type: "totp",
        issuer: "GitHub",
        name: "demo",
        groups: ["work", "prod"],
        info: { secret: "JBSWY3DPEHPK3PXP", algo: "SHA1", digits: 6, period: 30 },
      }],
    },
  }));
  assert.equal(items[0].tags, "work prod");
});

test("parses andOTP JSON tags", () => {
  const items = parseVaultImportText(JSON.stringify([{
    issuer: "Mail",
    label: "ops",
    secret: "JBSWY3DPEHPK3PXP",
    type: "TOTP",
    tags: ["infra"],
  }]));
  assert.equal(items[0].issuer, "Mail");
  assert.equal(items[0].tags, "infra");
});
