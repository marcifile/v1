// p0nd cache reset worker
// This intentionally removes any legacy service worker/caches left from earlier builds.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      self.registration.unregister(),
      self.clients.claim(),
    ]).then(() =>
      self.clients.matchAll({ type: "window" }).then((clients) =>
        Promise.all(
          clients.map((client) => {
            if ("navigate" in client) return client.navigate(client.url);
            return Promise.resolve();
          })
        )
      )
    )
  );
});

self.addEventListener("fetch", () => {
  // No interception. The worker exists only to clean up the legacy registration.
});
