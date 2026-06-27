/* ═══════════════════════════════════════════════════════
   Service Worker — Controle de Horas CLT
   Inspirado no pwa-tutorial de fellyph/pwa-tutorial (Workbox)
   Estratégias: CacheFirst (estáticos), StaleWhileRevalidate (API),
                NetworkFirst (páginas), Offline fallback
   ═══════════════════════════════════════════════════════ */

const VERSION      = 'v3'
const STATIC_CACHE = `horas-clt-static-${VERSION}`
const PAGES_CACHE  = `horas-clt-pages-${VERSION}`
const API_CACHE    = `horas-clt-api-${VERSION}`
const ALL_CACHES   = [STATIC_CACHE, PAGES_CACHE, API_CACHE]

const OFFLINE_URL  = '/offline'

/* ── Install: apenas a página offline (servidor pode exigir auth nas outras) ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  )
})

/* ── Activate: limpar caches de versões anteriores ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

/* ── Mensagem do cliente (ex: clicar em "Atualizar" no toast) ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

/* ═══════════════════════════════════════════════════════
   Estratégias de cache (inspiradas no Workbox)
   ═══════════════════════════════════════════════════════ */

/**
 * CacheFirst — Workbox usa isso para assets com hash.
 * Nunca vai à rede se o asset já estiver em cache.
 */
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

/**
 * StaleWhileRevalidate — estratégia principal do pwa-tutorial para recursos dinâmicos.
 * 1. Responde IMEDIATAMENTE com o cache (sem esperar rede)
 * 2. Em background, busca da rede e atualiza o cache para a próxima vez
 * 3. Se não tem cache, espera a rede
 * 4. Se offline e sem cache, retorna fallback
 */
function staleWhileRevalidate(request, cacheName, fallback) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(res => {
          if (res.ok) cache.put(request, res.clone())
          return res
        })
        .catch(() => cached || fallback)

      /* Se tem cache: serve agora + atualiza em background */
      return cached || networkFetch
    })
  )
}

/**
 * NetworkFirst com timeout — para páginas HTML.
 * Tenta a rede; se demorar ou falhar, serve do cache.
 */
function networkFirst(request, cacheName, timeoutMs = 4000) {
  return caches.open(cacheName).then(cache => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    return fetch(request, { signal: controller.signal })
      .then(res => {
        clearTimeout(timer)
        if (res.ok) cache.put(request, res.clone())
        return res
      })
      .catch(() => {
        clearTimeout(timer)
        return cache.match(request).then(cached => cached || caches.match(OFFLINE_URL))
      })
  })
}

/* ═══════════════════════════════════════════════════════
   Roteamento de fetch
   ═══════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  /* Só processar mesma origem */
  if (url.origin !== location.origin) return

  /* Mutações (POST/PUT/DELETE) → sempre rede; offline retorna 503 limpo */
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

  /* next-auth → sempre rede (nunca cachear tokens/cookies de sessão) */
  if (url.pathname.startsWith('/api/auth/')) return

  /* ── Assets estáticos com hash (_next/static/): CacheFirst ──
     Idêntico ao que o Workbox faz com precacheAndRoute para assets com revisão.
     Hash garante que assets diferentes = URLs diferentes → seguro fazer CacheFirst. */
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/_next/image/')  ||
      /\.(png|jpe?g|svg|ico|webp|woff2?|ttf)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  /* ── API de leitura (/api/*): StaleWhileRevalidate ──
     Igual à estratégia do pwa-tutorial para Google Fonts.
     Dados aparecem instantaneamente do cache; rede os atualiza em background.
     Essencial para o app funcionar offline mostrando dados da última sessão. */
  if (url.pathname.startsWith('/api/')) {
    const offlineFallback = new Response(
      JSON.stringify({ error: 'offline', cached: false, registros: [], total: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
    event.respondWith(staleWhileRevalidate(request, API_CACHE, offlineFallback))
    return
  }

  /* ── Páginas HTML: NetworkFirst com timeout 4s ──
     Caches a página em cada visita. Offline: serve do cache.
     Se nunca visitou + offline: exibe /offline. */
  event.respondWith(networkFirst(request, PAGES_CACHE))
})
