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

test("parses Chrome and Edge password CSV including quoted notes", () => {
  const items = parseVaultImportText(`name,url,username,password,note\nGitHub,https://github.com,demo@example.com,S3cure!Pass,"work, primary"`);
  assert.equal(items.length, 1);
  assert.equal(items[0].issuer, "GitHub");
  assert.equal(items[0].password, "S3cure!Pass");
  assert.equal(items[0].loginUrl, "https://github.com");
  assert.equal(items[0].note, "work, primary");
});

test("parses 1Password and Safari CSV OTPAuth fields", () => {
  const items = parseVaultImportText(`Title,Url,Username,Password,OTPAuth,Favorite,Archived,Tags,Notes\nMail,https://mail.example.com,ops@example.com,Long!Password9,otpauth://totp/Mail:ops@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Mail,true,false,work,main`);
  assert.equal(items[0].otpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(items[0].password, "Long!Password9");
  assert.equal(items[0].favorite, true);
  assert.equal(items[0].tags, "work");
});

test("parses unencrypted Bitwarden JSON logins and folder tags", () => {
  const items = parseVaultImportText(JSON.stringify({
    encrypted: false,
    folders: [{ id: "folder-1", name: "工作" }],
    items: [{ type: 1, name: "GitLab", folderId: "folder-1", favorite: true, notes: "admin", login: {
      username: "dev@example.com", password: "S3cure!Pass", totp: "JBSWY3DPEHPK3PXP", uris: [{ uri: "https://gitlab.com" }],
    } }],
  }));
  assert.equal(items[0].issuer, "GitLab");
  assert.equal(items[0].accountName, "dev@example.com");
  assert.equal(items[0].password, "S3cure!Pass");
  assert.equal(items[0].otpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(items[0].tags, "工作");
});

test("rejects encrypted Bitwarden exports with an actionable message", () => {
  assert.throws(
    () => parseVaultImportText(JSON.stringify({ encrypted: true, data: "ciphertext" })),
    /Bitwarden.*未加密 JSON/,
  );
});
