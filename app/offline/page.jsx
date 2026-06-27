'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OfflinePage() {
  const router  = useRouter()
  const [dots, setDots]       = useState('.')
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onOnline() {
      setRestored(true)
      setTimeout(() => router.back(), 1200)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">

        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-3xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <svg className="w-12 h-12 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
            </svg>
          </div>
        </div>

        {restored ? (
          <div className="space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Conexão restaurada!</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Voltando{dots}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Você está offline</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Não foi possível carregar esta página. Verifique sua conexão com a internet.
              </p>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">Dica</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300 leading-relaxed">
                Páginas já visitadas ficam salvas no dispositivo. Navegue pelas abas —{' '}
                <strong>dashboard</strong>, <strong>histórico</strong> e <strong>calendário</strong>{' '}
                funcionam offline com os dados da última visita.
              </p>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Aguardando conexão{dots}
            </p>

            <button
              onClick={() => router.back()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </div>
  )
}
