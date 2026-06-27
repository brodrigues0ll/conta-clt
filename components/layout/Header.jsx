'use client'
import { useSession, signOut } from 'next-auth/react'
import { Moon, Sun, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Header() {
  const { data: session } = useSession()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shrink-0">
      <div className="flex items-center justify-between px-4 py-3">

        {/* Logo + título */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-linear-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-none truncate">
              Controle de Horas
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">CLT</p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleDark}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            aria-label="Alternar modo escuro"
            title="Alternar tema"
          >
            {dark
              ? <Sun className="w-5 h-5 text-amber-500" />
              : <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            }
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="w-5 h-5 text-red-400 dark:text-red-500" />
          </button>
        </div>
      </div>
    </header>
  )
}
