import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PASSWORD_OPTIONS, auditVaultPasswords, generateStrongPassword, passwordStrength } from "../app/systems/otp/passwordTools.ts";

test("generates a cryptographically random password matching selected groups", () => {
  const password = generateStrongPassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 24 });
  assert.equal(password.length, 24);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /\d/);
  assert.match(password, /[^A-Za-z0-9]/);
  assert.doesNotMatch(password, /[Il1O0|`'"\\/]/);
});

test("rates long generated-style passwords above common and repeated passwords", () => {
  assert.equal(passwordStrength("password123").score < 3, true);
  assert.equal(passwordStrength("aaaaaaaaaaaaaaaa").score < 3, true);
  assert.equal(passwordStrength("Violet!River-92_Cedar").score >= 3, true);
});

test("audits weak, reused and missing-otp passwords without returning plaintext", () => {
  const report = auditVaultPasswords([
    { issuer: "GitHub", accountName: "one", password: "password123", otpSecret: "ABC" },
    { issuer: "Mail", accountName: "two", password: "password123" },
    { issuer: "Bank", accountName: "three", password: "Violet!River-92_Cedar", otpSecret: "DEF" },
  ]);
  assert.equal(report.total, 3);
  assert.equal(report.weak, 2);
  assert.equal(report.reused, 2);
  assert.equal(report.missingOtp, 1);
  assert.equal(report.strong, 1);
  assert.doesNotMatch(JSON.stringify(report), /password123|Violet!River/);
});
