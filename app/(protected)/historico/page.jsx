'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import HistoricoCard from '@/components/historico/HistoricoCard'
import { calcularResumo } from '@/lib/calculations'
import { getMesAtual, getAnoAtual, getNomeMes, formatarDuracao, formatarMoeda, getDataHoje } from '@/lib/utils'

const MESES = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getNomeMes(i) }))

export default function HistoricoPage() {
  const router     = useRouter()
  const searchParams = useSearchParams()
  const pathname   = usePathname()

  const [registros, setRegistros] = useState([])
  const [config, setConfig]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const mes    = parseInt(searchParams.get('mes')   || getMesAtual())
  const ano    = parseInt(searchParams.get('ano')   || getAnoAtual())
  const search = searchParams.get('search') || ''
  const page   = parseInt(searchParams.get('page')  || '1')
  const ordem  = searchParams.get('ordem') || 'desc'

  function updateParams(updates) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => { if (v) params.set(k, v); else params.delete(k) })
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (mes) params.set('mes', mes)
      if (ano) params.set('ano', ano)
      if (search) params.set('search', search)
      params.set('page', page)
      params.set('limit', '20')

      const [regsRes, cfgRes] = await Promise.all([
        fetch(`/api/registros?${params}`),
        config ? null : fetch('/api/config')
      ])

      const regsData = await regsRes.json()
      let cfgData = config
      if (cfgRes) { const j = await cfgRes.json(); cfgData = j.config; setConfig(j.config) }

      let regs = regsData.registros || []
      if (ordem === 'asc') regs = [...regs].reverse()
      setRegistros(regs)
      setTotal(regsData.total || 0)
      setTotalPages(regsData.totalPages || 1)
    } catch {
      toast.error('Erro ao carregar registros')
    } finally {
      setLoading(false)
    }
  }, [mes, ano, search, page, ordem])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(id) {
    if (!confirm('Excluir este registro?')) return
    const res = await fetch(`/api/registros/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Registro excluído'); fetchData() }
    else toast.error('Erro ao excluir')
  }

  function handleEdit(id) { router.push(`/registrar?id=${id}`) }
  function handleDuplicate(data) { router.push(`/registrar?data=${data}`) }

  const hoje = getDataHoje()

  const regsFuturos  = registros.filter(r => r.data > hoje)
  const regsPassados = registros.filter(r => r.data <= hoje)

  const somarResumos = (regs) => regs.reduce((s, r) => {
    const res = calcularResumo(r, config)
    return { totalMin: s.totalMin + res.horasTrabalhadas, totalBanco: s.totalBanco + res.bancoHoras, totalGeral: s.totalGeral + res.totalDia }
  }, { totalMin: 0, totalBanco: 0, totalGeral: 0 })

  const resumoReal     = config && registros.length > 0 ? somarResumos(regsPassados) : null
  const resumoProjecao = config && regsFuturos.length > 0 ? somarResumos(registros) : null

  const anos = Array.from({ length: 5 }, (_, i) => getAnoAtual() - 2 + i)

  return (
    <div className="py-4 space-y-4">

      {/* Título + filtros toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-gray-900 dark:text-white">Histórico</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
          </svg>
          Filtros
        </button>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Mês</label>
              <select
                value={mes}
                onChange={e => updateParams({ mes: e.target.value })}
                className="input-base py-1.5 text-sm"
              >
                {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Ano</label>
              <select
                value={ano}
                onChange={e => updateParams({ ano: e.target.value })}
                className="input-base py-1.5 text-sm"
              >
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Ordem</label>
            <select
              value={ordem}
              onChange={e => updateParams({ ordem: e.target.value })}
              className="input-base py-1.5 text-sm"
            >
              <option value="desc">Mais recentes primeiro</option>
              <option value="asc">Mais antigos primeiro</option>
            </select>
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="search"
          placeholder="Buscar por data ou observação..."
          defaultValue={search}
          onChange={e => updateParams({ search: e.target.value })}
          className="input-base pl-9 py-2 text-sm"
        />
      </div>

      {/* Resumo da página */}
      {resumoReal && !loading && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Trabalhado</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatarDuracao(resumoReal.totalMin)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Banco</p>
              <p className={`text-sm font-bold ${resumoReal.totalBanco >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {formatarDuracao(resumoReal.totalBanco, true)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatarMoeda(resumoReal.totalGeral)}</p>
            </div>
          </div>

          {resumoProjecao && (
            <div className="rounded-xl border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-2">
              <p className="text-xs text-blue-500 dark:text-blue-400 font-semibold mb-1.5">
                Projeção com {regsFuturos.length} dia{regsFuturos.length !== 1 ? 's' : ''} futuro{regsFuturos.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-blue-400 dark:text-blue-500">Trabalhado</p>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatarDuracao(resumoProjecao.totalMin)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-400 dark:text-blue-500">Banco</p>
                  <p className={`text-sm font-bold ${resumoProjecao.totalBanco >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {formatarDuracao(resumoProjecao.totalBanco, true)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-400 dark:text-blue-500">Total</p>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatarMoeda(resumoProjecao.totalGeral)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      ) : registros.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-sm">Nenhum registro encontrado</p>
          <p className="text-xs mt-1">Tente ajustar os filtros</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
            {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
          {registros.map(registro => {
            const resumo = config ? calcularResumo(registro, config) : {}
            return (
              <HistoricoCard
                key={registro._id}
                registro={registro}
                resumo={resumo}
                config={config}
                isFuturo={registro.data > hoje}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => updateParams({ page: page - 1 })}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: page + 1 })}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
