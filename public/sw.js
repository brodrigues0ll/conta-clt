/* ═══════════════════════════════════════════════════════
   Service Worker — Controle de Horas CLT  v4
   ═══════════════════════════════════════════════════════ */

const VERSION      = 'v4'
const STATIC_CACHE = `horas-clt-static-${VERSION}`
const PAGES_CACHE  = `horas-clt-pages-${VERSION}`
const API_CACHE    = `horas-clt-api-${VERSION}`
const ALL_CACHES   = [STATIC_CACHE, PAGES_CACHE, API_CACHE]

const OFFLINE_URL  = '/offline'

/* ── Install ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
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

/* ── Mensagem do cliente ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()

  /* Cliente pede para aquecer o cache de páginas (chamado após login) */
  if (event.data?.type === 'WARM_CACHE') {
    const urls = event.data.urls || []
    caches.open(PAGES_CACHE).then(cache =>
      Promise.allSettled(urls.map(url =>
        fetch(url, { credentials: 'same-origin' })
          .then(res => { if (res.ok) cache.put(url, res) })
          .catch(() => {})
      ))
    )
  }
})

/* ═══════════════════════════════════════════════════════
   Estratégias
   ═══════════════════════════════════════════════════════ */

/** CacheFirst — assets com hash (nunca mudam) */
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

/** StaleWhileRevalidate — responde do cache imediatamente, atualiza em background */
function staleWhileRevalidate(request, cacheName, offlineFallback) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(res => { if (res.ok) cache.put(request, res.clone()); return res })
        .catch(() => cached || offlineFallback)
      return cached || networkFetch
    })
  )
}

/**
 * SmartPage — estratégia para páginas HTML:
 * • Se JÁ está no cache → StaleWhileRevalidate (resposta instantânea, sem offline indevido)
 * • Se NÃO está no cache → NetworkFirst com timeout longo
 * • Tela /offline só aparece quando navigator.onLine === false e não há cache
 */
function smartPage(request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(cached => {
      /* Página já cacheada: serve do cache agora, atualiza em background */
      if (cached) {
        fetch(request, { credentials: 'same-origin' })
          .then(res => { if (res.ok) cache.put(request, res.clone()) })
          .catch(() => {})
        return cached
      }

      /* Página não cacheada: tenta a rede (sem timeout agressivo) */
      return fetch(request, { credentials: 'same-origin' })
        .then(res => {
          if (res.ok) cache.put(request, res.clone())
          return res
        })
        .catch(() => {
          /* Só mostra /offline se o dispositivo realmente não tem rede */
          if (!navigator.onLine) return caches.match(OFFLINE_URL)
          /* Se tem rede mas falhou (servidor down, etc.) → deixa o browser tratar */
          return new Response('Erro ao carregar página', { status: 503 })
        })
    })
  )
}

/* ═══════════════════════════════════════════════════════
   Roteamento
   ═══════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  if (url.origin !== location.origin) return

  /* next-auth → sempre rede */
  if (url.pathname.startsWith('/api/auth/')) return

  /* Mutações → rede; offline retorna 503 limpo */
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'Sem conexão. Tente novamente quando estiver online.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    return
  }

  /* Assets estáticos com hash → CacheFirst */
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/_next/image/')  ||
      /\.(png|jpe?g|svg|ico|webp|woff2?|ttf)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  /* API de leitura → StaleWhileRevalidate (instantâneo do cache, atualiza em background) */
  if (url.pathname.startsWith('/api/')) {
    const fallback = new Response(
      JSON.stringify({ error: 'offline', cached: false, registros: [], total: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
    event.respondWith(staleWhileRevalidate(request, API_CACHE, fallback))
    return
  }

  /* Páginas → SmartPage (sem tela offline indevida) */
  event.respondWith(smartPage(request, PAGES_CACHE))
})
