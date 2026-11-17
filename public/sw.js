/*
 * Lightweight offline shell for hive.ausbit.dev.
 *
 * The app remains a static SPA. Navigations are network-first with a cached
 * index.html fallback; same-origin assets and API-independent images use
 * stale-while-revalidate. Chain data is intentionally not cached here — the app
 * has its own read cache and a stale shell is safer than stale balances.
 */
const CACHE = 'hive-ausbit-shell-v1'
const SHELL = ['/', '/index.html', '/offline.html', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put('/index.html', copy)).catch(() => {})
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE)
          return (await cache.match('/index.html')) || (await cache.match('/offline.html'))
        })
    )
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then(response => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
