'use client'
import { useEffect } from 'react'
import { toast } from 'sonner'

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Nova versão disponível', {
              description: 'Atualize para ter as últimas melhorias.',
              action: {
                label: 'Atualizar',
                onClick: () => { newSW.postMessage('SKIP_WAITING') },
              },
              duration: Infinity,
            })
          }
        })
      })
    }).catch(err => console.error('[SW] Erro ao registrar:', err))

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }, [])

  return null
}
