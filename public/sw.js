/* Service worker: lets the site install as an app and shows a friendly page when offline.
   Only page navigations are handled, network first; assets, the API and the admin panel
   always go straight to the network, so nothing stale is ever served. Pages are never
   cached, so switching the language (a cookie) always shows the new language. The one
   cached page, /offline, is fetched again when the site asks (after a language switch,
   see src/components/ui/ServiceWorker.tsx); the request carries the language cookie. */

const CACHE = "hoax-analyzer-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "refresh-offline") {
    // Keeps the old copy if the fetch fails.
    event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "no-store" }))).catch(() => {}));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
  );
});
