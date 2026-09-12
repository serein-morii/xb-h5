import assert from "node:assert/strict";
import test from "node:test";
import { decodeWebPushPublicKey, webPushKeyMatchesSubscription, webPushSubscriptionBody } from "../app/systems/otp/vaultPush.ts";

test("decodes an unpadded base64url VAPID public key", () => {
  assert.deepEqual([...decodeWebPushPublicKey("AQIDBAU")], [1, 2, 3, 4, 5]);
});

test("rejects malformed VAPID keys and incomplete subscriptions", () => {
  assert.throws(() => decodeWebPushPublicKey("***"), /公钥无效/);
  assert.throws(() => webPushSubscriptionBody({
    endpoint: "https://push.example/subscription",
    toJSON: () => ({ keys: { p256dh: "", auth: "auth" } }),
  }, "test-agent"), /订阅不完整/);
});

test("detects subscriptions created with a different VAPID key", () => {
  globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
  const first = Buffer.from([4, 1, 2, 3]).toString("base64url");
  const second = Buffer.from([4, 1, 2, 4]).toString("base64url");
  const subscription = { options: { applicationServerKey: Uint8Array.from([4, 1, 2, 3]).buffer } };
  assert.equal(webPushKeyMatchesSubscription(subscription, first), true);
  assert.equal(webPushKeyMatchesSubscription(subscription, second), false);
});

test("normalizes a browser subscription for the vault API", () => {
  assert.deepEqual(webPushSubscriptionBody({
    endpoint: "https://push.example/subscription",
    toJSON: () => ({ keys: { p256dh: "public", auth: "secret" } }),
  }, "test-agent"), {
    endpoint: "https://push.example/subscription",
    p256dh: "public",
    auth: "secret",
    userAgent: "test-agent",
  });
});
