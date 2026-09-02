/* global self, caches, fetch, URL */
const CACHE_PREFIX = "otp-vault-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v2`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-v2`;
const CURRENT_CACHES = new Set([SHELL_CACHE, ASSET_CACHE]);
const OTP_HOST = self.location.hostname === "otp.gooop.top" || self.location.hostname.startsWith("otp.");
const APP_SHELL = OTP_HOST ? "/" : "/otp";
const SHELL = [APP_SHELL, "/otp-icon.svg", "/manifest.webmanifest"];
const HASHED_ASSET_PATH = /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

function isApiPath(pathname) {
  return pathname.startsWith("/prod-api/") || pathname.startsWith("/api/");
}

function isSharePath(pathname) {
  return pathname === "/s" || pathname.startsWith("/s/");
}

function isOtpNavigation(request, url) {
  if (request.mode !== "navigate" || isSharePath(url.pathname)) return false;
  return OTP_HOST || url.pathname === "/otp" || url.pathname.startsWith("/otp/");
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function refreshStaticAsset(request, event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (!cached) return network;
  event.waitUntil(network.catch(() => undefined));
  return cached;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(APP_SHELL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(APP_SHELL);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApiPath(url.pathname) || isSharePath(url.pathname)) return;

  if (HASHED_ASSET_PATH.test(url.pathname)) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  if (url.pathname === "/otp-icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(refreshStaticAsset(request, event));
    return;
  }

  if (isOtpNavigation(request, url)) event.respondWith(networkFirstNavigation(request));
});
