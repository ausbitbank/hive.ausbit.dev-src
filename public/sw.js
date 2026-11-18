/*
 * Lightweight offline shell for hive.ausbit.dev.
 *
 * The app remains a static SPA. Navigations are network-first with a cached
 * index.html fallback; same-origin assets and API-independent images use
 * stale-while-revalidate. Chain data is intentionally not cached here — the app
 * has its own read cache and offline snapshots. Updates wait for an explicit
 * SKIP_WAITING message so an open tab is never reloaded mid-action.
 */
const CACHE = 'hive-ausbit-shell-v4'
const SHELL = ['/', '/index.html', '/offline.html', '/manifest.webmanifest']
const OFFLINE_FALLBACK = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Offline — hive.ausbit.dev</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#121212;color:#e4eaed;font-family:Roboto,Helvetica,Arial,sans-serif}main{max-width:32rem;padding:2rem;text-align:center}a{color:#4fc3f7}</style></head><body><main><h1>Offline</h1><p>hive.ausbit.dev could not load this page. Reconnect and try again.</p><p><a href="/">Retry</a></p></main></body></html>'

function textResponse (status) {
  return new Response(OFFLINE_FALLBACK, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}

async function cachedResponse (path) {
  try {
    const cache = await caches.open(CACHE)
    return (await cache.match(path)) || null
  } catch {
    return null
  }
}

async function offlineResponse () {
  return (await cachedResponse('/index.html')) ||
    (await cachedResponse('/offline.html')) ||
    textResponse(503)
}

async function cachePut (request, response) {
  if (!response || !response.ok) return
  try {
    const cache = await caches.open(CACHE)
    await cache.put(request, response)
  } catch {
    // Quota, opaque responses and private-mode failures are non-fatal.
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL).catch(() => undefined))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone()
            cachePut('/index.html', copy)
          }
          return response
        })
        .catch(offlineResponse)
    )
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    const cached = await cachedResponse(request)
    const network = fetch(request)
      .then(response => {
        cachePut(request, response.clone())
        return response
      })

    if (cached) {
      // Refresh in the background; a failed refresh must never reject the
      // response the page is already receiving from the cache.
      network.catch(() => {})
      return cached
    }

    try {
      return await network
    } catch {
      return new Response('', { status: 504, statusText: 'Gateway Timeout' })
    }
  })())
})
