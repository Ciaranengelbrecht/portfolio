// Legacy root service worker killer
// This file intentionally unregisters itself and clears old caches so the dist SW can take over.
// It claims clients immediately to perform cleanup, then unregisters and triggers client reloads.

self.addEventListener("install", (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Delete all caches under this scope (old workbox/precache caches)
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
      } catch {}

      try {
        // Unregister this root service worker so it no longer controls /progress
        await self.registration.unregister();
      } catch {}

      try {
        // Take control of open clients and force a reload so the dist SW can install
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map(async (client) => {
            try {
              await client.navigate(client.url);
            } catch {}
          })
        );
      } catch {}
    })()
  );
});

self.addEventListener("fetch", () => {
  // No-op: don't intercept any requests
});
