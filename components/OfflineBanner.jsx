'use client'
import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [status, setStatus] = useState('online')  // 'online' | 'offline' | 'restored'

  useEffect(() => {
    /* Estado inicial */
    if (!navigator.onLine) setStatus('offline')

    function onOffline() { setStatus('offline') }
    function onOnline() {
      setStatus('restored')
      setTimeout(() => setStatus('online'), 3000)
    }

    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online',  onOnline)
    }
  }, [])

  if (status === 'online') return null

  return (
    <div className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all ${
      status === 'restored'
        ? 'bg-emerald-500 text-white'
        : 'bg-amber-500 text-white'
    }`}>
      {status === 'restored' ? (
        <>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
          Conexão restaurada
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728"/>
          </svg>
          Você está offline — exibindo dados salvos
        </>
      )}
    </div>
  )
}
