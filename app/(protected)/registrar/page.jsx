'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import BatidasInput from '@/components/registrar/BatidasInput'
import {
  calcularResumo,
  getFeriado,
  isDomingo,
  isSabado
} from '@/lib/calculations'
import {
  getDataHoje,
  formatarDataLonga,
  formatarDuracao,
  formatarMoeda,
  validarBatidas
} from '@/lib/utils'

export default function RegistrarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const duplicarData = searchParams.get('data')

  const [data, setData] = useState(getDataHoje())
  const [batidas, setBatidas] = useState(['', ''])
  const [observacao, setObservacao] = useState('')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resumo, setResumo] = useState(null)
  const [errosBatidas, setErrosBatidas] = useState([])

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => setConfig(d.config))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (editId) {
      fetch(`/api/registros/${editId}`)
        .then(r => r.json())
        .then(d => {
          if (d.registro) {
            setData(d.registro.data)
            setBatidas(d.registro.batidas.length >= 2 ? d.registro.batidas : [...d.registro.batidas, ...Array(2 - d.registro.batidas.length).fill('')])
            setObservacao(d.registro.observacao || '')
          }
        })
        .catch(() => {})
    } else if (duplicarData) {
      setData(getDataHoje())
      fetch(`/api/registros?search=${duplicarData}&limit=1`)
        .then(r => r.json())
        .then(d => {
          const reg = d.registros?.find(r => r.data === duplicarData)
          if (reg) {
            setBatidas(reg.batidas.length >= 2 ? reg.batidas : [...reg.batidas, ...Array(2 - reg.batidas.length).fill('')])
            setObservacao(reg.observacao || '')
          }
        })
        .catch(() => {})
    }
  }, [editId, duplicarData])

  useEffect(() => {
    if (!config || !data) { setResumo(null); return }
    const batidasValidas = batidas.filter(b => b && b.trim())
    if (batidasValidas.length < 2) { setResumo(null); return }
    const r = calcularResumo({ data, batidas: batidasValidas }, config)
    setResumo(r)
    setErrosBatidas(validarBatidas(batidasValidas))
  }, [data, batidas, config])

  async function handleSubmit(e) {
    e.preventDefault()
    const batidasValidas = batidas.filter(b => b && b.trim())
    if (batidasValidas.length < 2) { toast.error('Adicione pelo menos 2 batidas'); return }
    const erros = validarBatidas(batidasValidas)
    if (erros.length > 0) { toast.error(erros[0]); return }

    setLoading(true)
    try {
      const payload = { data, batidas: batidasValidas, observacao }
      let res
      if (editId) {
        res = await fetch(`/api/registros/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch('/api/registros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      const resData = await res.json()
      if (!res.ok) { toast.error(resData.error || 'Erro ao salvar registro'); return }
      toast.success(editId ? 'Registro atualizado!' : 'Registro salvo!')
      router.push('/historico')
    } finally {
      setLoading(false)
    }
  }

  const feriadoNome = config ? getFeriado(data, config.feriadosPersonalizados) : null
  const ehSabado = data ? isSabado(data) : false
  const ehDomingo = data ? isDomingo(data) : false

  return (
    <div className="py-4 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-linear-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-none">
            {editId ? 'Editar registro' : 'Novo registro'}
          </h1>
          {data && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatarDataLonga(data)}</p>}
        </div>
      </div>

      {/* Alertas do dia */}
      {(feriadoNome || ehSabado || ehDomingo) && (
        <div className="flex gap-2 flex-wrap">
          {feriadoNome && (
            <span className="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">🎉 Feriado: {feriadoNome}</span>
          )}
          {ehSabado && !feriadoNome && (
            <span className="chip bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">📅 Sábado</span>
          )}
          {ehDomingo && !feriadoNome && (
            <span className="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">☀️ Domingo</span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Data */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Data</label>
          <input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            className="input-base"
          />
        </div>

        {/* Batidas */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Horários</h3>
          <BatidasInput batidas={batidas} onChange={setBatidas} />
          {errosBatidas.length > 0 && (
            <div className="mt-2 space-y-1">
              {errosBatidas.map((erro, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  {erro}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Preview em tempo real */}
        {resumo && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-indigo-200 dark:border-indigo-800">
            <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-3">Preview do dia</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Trabalhado</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatarDuracao(resumo.horasTrabalhadas)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Banco</p>
                <p className={`font-semibold ${resumo.incompleto ? 'text-gray-400 dark:text-gray-500' : resumo.bancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {resumo.incompleto ? '—' : formatarDuracao(resumo.bancoHoras, true)}
                </p>
              </div>
              {!resumo.incompleto && resumo.horasExtras > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">H. extras</p>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">{formatarDuracao(resumo.horasExtras)}</p>
                </div>
              )}
              {!resumo.incompleto && resumo.minutosNoturnos > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Noturno</p>
                  <p className="font-semibold text-violet-600 dark:text-violet-400">🌙 {formatarDuracao(resumo.minutosNoturnos)}</p>
                </div>
              )}
              {config?.salario > 0 && (
                <div className="col-span-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Valor do dia</p>
                  <p className={`font-bold ${resumo.incompleto ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                    {resumo.incompleto ? '—' : formatarMoeda(resumo.totalDia)}
                  </p>
                </div>
              )}
            </div>

            {/* Alertas CLT */}
            <div className="mt-3 space-y-1.5">
              {resumo.alertaIntrajornada && (
                <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs p-2 rounded-lg">
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>Intrajornada insuficiente — faltam {formatarDuracao(resumo.alertaIntrajornada.faltam)} (Art. 71 CLT)</span>
                </div>
              )}
              {resumo.alertaHoraExtraCLT && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs p-2 rounded-lg">
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>Mais de 2h extras — limite diário CLT (Art. 59)</span>
                </div>
              )}
              {resumo.incompleto && (
                <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs p-2 rounded-lg">
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>Número ímpar de batidas — registro incompleto</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Observação */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Ex: Reunião extra, home office, plantão..."
            rows={2}
            className="input-base resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 13l4 4L19 7"/>
          </svg>
          {loading ? 'Salvando...' : editId ? 'Atualizar registro' : 'Salvar registro'}
        </button>
      </form>
    </div>
  )
}
