'use client'
import { useEffect } from 'react'

const PAGES_TO_CACHE = [
  '/dashboard',
  '/registrar',
  '/historico',
  '/calendario',
  '/configuracoes',
]

/**
 * Aquece o cache de todas as páginas protegidas.
 * Deve ser montado apenas dentro do layout protegido (usuário já autenticado).
 * Roda 2s após o carregamento inicial para não competir com a navegação.
 */
export default function CacheWarmer() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    async function warm() {
      const sw = await navigator.serviceWorker.ready

      /* Pede ao SW para pré-carregar todas as páginas via fetch autenticado */
      if (sw.active) {
        sw.active.postMessage({ type: 'WARM_CACHE', urls: PAGES_TO_CACHE })
      } else {
        /* Fallback: fetch direto do cliente (SW já vai interceptar e cachear) */
        for (const url of PAGES_TO_CACHE) {
          fetch(url, { credentials: 'same-origin', priority: 'low' }).catch(() => {})
        }
      }
    }

    const timer = setTimeout(warm, 2000)
    return () => clearTimeout(timer)
  }, [])

  return null
}
