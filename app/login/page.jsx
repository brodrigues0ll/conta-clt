'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Preencha email e senha')
      return
    }
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false
      })
      if (result?.error) {
        toast.error('Email ou senha inválidos')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Preencha todos os campos')
      return
    }
    if (form.password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password })
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar conta')
        return
      }
      toast.success('Conta criada! Entrando...')
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false
      })
      if (result?.error) {
        toast.error('Conta criada, mas erro ao entrar. Tente fazer login.')
        setMode('login')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle de Horas</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gestão CLT completa</p>
        </div>

        <Card className="shadow-xl border-0 dark:bg-gray-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Entre com seu email e senha para continuar'
                : 'Preencha os dados para criar sua conta gratuita'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Seu nome"
                    value={form.name}
                    onChange={handleChange}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                  value={form.password}
                  onChange={handleChange}
                  disabled={loading}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={loading}
              >
                {loading
                  ? (mode === 'login' ? 'Entrando...' : 'Criando conta...')
                  : (mode === 'login' ? 'Entrar' : 'Criar conta')}
              </Button>
            </form>

            <div className="mt-4 text-center">
              {mode === 'login' ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Não tem conta?{' '}
                  <button
                    onClick={() => { setMode('register'); setForm({ name: '', email: '', password: '' }) }}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Criar conta grátis
                  </button>
                </p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Já tem conta?{' '}
                  <button
                    onClick={() => { setMode('login'); setForm({ name: '', email: '', password: '' }) }}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Entrar
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
