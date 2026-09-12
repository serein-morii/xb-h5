export function decodeWebPushPublicKey(value: string) {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("服务器返回的 Web Push 公钥无效");
  }
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    throw new Error("服务器返回的 Web Push 公钥无效");
  }
}

export function webPushKeyMatchesSubscription(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options.applicationServerKey;
  if (!current) return true;
  const expected = decodeWebPushPublicKey(publicKey);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function webPushSubscriptionBody(subscription: PushSubscription, userAgent = navigator.userAgent) {
  const json = subscription.toJSON();
  const p256dh = String(json.keys?.p256dh || "");
  const auth = String(json.keys?.auth || "");
  if (!p256dh || !auth) throw new Error("浏览器返回的推送订阅不完整");
  return { endpoint: subscription.endpoint, p256dh, auth, userAgent };
}
