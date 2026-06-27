'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OfflinePage() {
  const router = useRouter()
  const [online, setOnline] = useState(false)

  useEffect(() => {
    function check() {
      if (navigator.onLine) { setOnline(true); setTimeout(() => router.back(), 1000) }
    }
    window.addEventListener('online', check)
    return () => window.removeEventListener('online', check)
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
        </svg>
      </div>

      {online ? (
        <>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Conexão restaurada!</h1>
          <p className="text-sm text-gray-500">Voltando...</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Você está offline</h1>
          <p className="text-sm text-gray-500 max-w-xs mb-8">
            Sem conexão com a internet. Se você já visitou o app antes, os dados em cache ainda estão disponíveis.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Tentar novamente
          </button>
        </>
      )}
    </div>
  )
}
