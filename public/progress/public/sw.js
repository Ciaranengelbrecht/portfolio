self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
const CACHE = 'liftlog-v1'
const ASSETS = [
  './',
  './index.html',
]
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    if (cached) return cached
    try {
      const res = await fetch(req)
      cache.put(req, res.clone())
      return res
    } catch (e) {
      return cached || Response.error()
    }
  })())
})
