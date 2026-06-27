/* Service Worker — Controle de Horas CLT */

const STATIC_CACHE = 'horas-clt-static-v1'
const PAGES_CACHE  = 'horas-clt-pages-v1'
const API_CACHE    = 'horas-clt-api-v1'
const ALL_CACHES   = [STATIC_CACHE, PAGES_CACHE, API_CACHE]

const OFFLINE_URL  = '/offline'

/* Instalar: precachear a página offline */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  )
})

/* Ativar: limpar caches antigos */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

/* Fetch: estratégias por tipo de recurso */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  /* Só interceptar mesma origem, método GET */
  if (request.method !== 'GET' || url.origin !== location.origin) return

  /* Auth do next-auth: sempre rede (nunca cachear cookies de sessão) */
  if (url.pathname.startsWith('/api/auth/')) return

  /* Assets estáticos do Next.js (_next/static/*): CacheFirst
     São nomeados com hash — nunca mudam, podem ficar em cache indefinidamente */
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
        })
      )
    )
    return
  }

  /* API routes (/api/*): NetworkFirst com fallback para cache
     Permite uso offline com dados da última visita */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            caches.open(API_CACHE).then(c => c.put(request, res.clone()))
          }
          return res
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || new Response(
              JSON.stringify({ error: 'offline', message: 'Sem conexão — exibindo dados em cache' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            )
          )
        )
    )
    return
  }

  /* Páginas HTML: NetworkFirst com fallback para cache, depois /offline */
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          caches.open(PAGES_CACHE).then(c => c.put(request, res.clone()))
        }
        return res
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match(OFFLINE_URL)
        )
      )
  )
})
