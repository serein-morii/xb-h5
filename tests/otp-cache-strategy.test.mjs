import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const serviceWorkerSource = await readFile(new URL("../public/otp-sw.js", import.meta.url), "utf8");

function createWorker({ cachedUrls = [] } = {}) {
  const handlers = new Map();
  const stored = new Map(cachedUrls.map((url) => [url, new Response(`cached:${url}`)]));
  const puts = [];
  let fetchCount = 0;
  const cache = {
    addAll: async () => {},
    delete: async (key) => stored.delete(typeof key === "string" ? key : key.url),
    match: async (request) => stored.get(typeof request === "string" ? request : request.url),
    put: async (request, response) => {
      const key = typeof request === "string" ? request : request.url;
      stored.set(key, response);
      puts.push(key);
    },
  };
  const context = {
    URL,
    Response,
    caches: {
      delete: cache.delete,
      keys: async () => [],
      match: cache.match,
      open: async () => cache,
    },
    fetch: async (request) => {
      fetchCount += 1;
      return new Response(`network:${request.url}`, { status: 200 });
    },
    self: {
      addEventListener: (type, handler) => handlers.set(type, handler),
      clients: { claim: async () => {} },
      location: new URL("https://otp.gooop.top/"),
      skipWaiting: async () => {},
    },
  };
  vm.runInNewContext(serviceWorkerSource, context);
  return { handlers, puts, get fetchCount() { return fetchCount; } };
}

function dispatchFetch(worker, url, mode = "cors") {
  let response;
  worker.handlers.get("fetch")({
    request: { method: "GET", mode, url },
    respondWith: (value) => { response = value; },
    waitUntil: () => {},
  });
  return response;
}

test("serves hashed assets from cache without waiting for the network", async () => {
  const url = "https://otp.gooop.top/assets/app-abc12345.js";
  const worker = createWorker({ cachedUrls: [url] });

  const response = await dispatchFetch(worker, url);

  assert.equal(await response.text(), `cached:${url}`);
  assert.equal(worker.fetchCount, 0);
});

test("keeps OTP navigation network-first and refreshes the cached shell", async () => {
  const worker = createWorker();
  const url = "https://otp.gooop.top/guide";

  const response = await dispatchFetch(worker, url, "navigate");

  assert.equal(await response.text(), `network:${url}`);
  assert.equal(worker.fetchCount, 1);
  assert.deepEqual(worker.puts, ["/"]);
});

test("never intercepts API or shared-authorization requests", () => {
  const worker = createWorker();

  assert.equal(dispatchFetch(worker, "https://otp.gooop.top/prod-api/otp/vault"), undefined);
  assert.equal(dispatchFetch(worker, "https://otp.gooop.top/api/otp/vault"), undefined);
  assert.equal(dispatchFetch(worker, "https://otp.gooop.top/s/abcde", "navigate"), undefined);
  assert.equal(dispatchFetch(worker, "https://otp.gooop.top/assets/runtime.js"), undefined);
  assert.equal(worker.fetchCount, 0);
});

test("service worker updates bypass the browser HTTP cache", async () => {
  const app = await readFile(new URL("../app/systems/otp/OtpApp.tsx", import.meta.url), "utf8");
  assert.match(app, /register\("\/otp-sw\.js", \{ updateViaCache: "none" \}\)/);
});
