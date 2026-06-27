/* Service Worker — Controle de Horas CLT */

const VERSION      = 'v2'
const STATIC_CACHE = `horas-clt-static-${VERSION}`
const PAGES_CACHE  = `horas-clt-pages-${VERSION}`
const API_CACHE    = `horas-clt-api-${VERSION}`
const ALL_CACHES   = [STATIC_CACHE, PAGES_CACHE, API_CACHE]

const OFFLINE_URL  = '/offline'
const NETWORK_TIMEOUT = 4000  // ms antes de cair no cache

/* Páginas principais para pré-aquecer o cache no install */
const PRECACHE_PAGES = [
  '/dashboard',
  '/registrar',
  '/historico',
  '/calendario',
  '/configuracoes',
  OFFLINE_URL,
]

/* ── Install: pré-cachear páginas e shell offline ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then(cache =>
      Promise.allSettled(PRECACHE_PAGES.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  )
})

/* ── Activate: limpar versões antigas ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

/* ── Mensagens do cliente ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

/* ── Helpers ── */

function networkFirstWithTimeout(request, cacheName, timeout = NETWORK_TIMEOUT) {
  return caches.open(cacheName).then(cache => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    return fetch(request, { signal: controller.signal })
      .then(res => {
        clearTimeout(timer)
        if (res.ok) cache.put(request, res.clone())
        return res
      })
      .catch(() => {
        clearTimeout(timer)
        return cache.match(request)
      })
  })
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone())
        return res
      })
    })
  )
}

/* ── Fetch: estratégias por tipo ── */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  /* Só mesma origem, GET */
  if (request.method !== 'GET' || url.origin !== location.origin) return

  /* next-auth: sempre rede */
  if (url.pathname.startsWith('/api/auth/')) return

  /* Assets com hash do Next.js: CacheFirst (imutáveis) */
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/_next/image/')  ||
      url.pathname.match(/\.(png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  /* API routes: NetworkFirst com timeout + fallback JSON de cache */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirstWithTimeout(request, API_CACHE).then(res =>
        res || new Response(
          JSON.stringify({ error: 'offline', cached: false }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    return
  }

  /* Páginas: NetworkFirst com timeout → cache → /offline */
  event.respondWith(
    networkFirstWithTimeout(request, PAGES_CACHE).then(res =>
      res || caches.match(OFFLINE_URL)
    )
  )
})
