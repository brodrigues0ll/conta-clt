'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import CalendarioGrid from '@/components/calendario/CalendarioGrid'
import { calcularResumo, calcularResumoMensal } from '@/lib/calculations'
import {
  getDataHoje,
  getMesAtual,
  getAnoAtual,
  getNomeMes,
  formatarDataLonga,
  formatarDuracao,
  formatarMoeda
} from '@/lib/utils'

export default function CalendarioPage() {
  const router = useRouter()
  const hoje   = getDataHoje()

  const [mes, setMes]           = useState(getMesAtual())
  const [ano, setAno]           = useState(getAnoAtual())
  const [registros, setRegistros] = useState([])
  const [config, setConfig]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [regsRes, cfgRes] = await Promise.all([
        fetch(`/api/registros?mes=${mes}&ano=${ano}&limit=100`),
        config ? Promise.resolve(null) : fetch('/api/config')
      ])
      const regsData = await regsRes.json()
      setRegistros(regsData.registros || [])
      if (cfgRes) { const cfgData = await cfgRes.json(); setConfig(cfgData.config) }
    } finally {
      setLoading(false)
    }
  }, [mes, ano])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMes() {
    if (mes === 1) { setMes(12); setAno(a => a - 1) } else setMes(m => m - 1)
  }
  function nextMes() {
    if (mes === 12) { setMes(1); setAno(a => a + 1) } else setMes(m => m + 1)
  }
  function goHoje() { setMes(getMesAtual()); setAno(getAnoAtual()) }

  const registrosPorData = {}
  const resumosPorData   = {}
  if (config) {
    registros.forEach(r => {
      registrosPorData[r.data] = r
      resumosPorData[r.data]   = calcularResumo(r, config)
    })
  }

  const registrosReais   = registros.filter(r => r.data <= hoje)
  const registrosFuturos = registros.filter(r => r.data > hoje)
  const prefixMes = `${ano}-${String(mes).padStart(2, '0')}`
  const temFuturosMes = registrosFuturos.some(r => r.data.startsWith(prefixMes))

  const resumoMes     = config ? calcularResumoMensal(registrosReais, config, mes, ano) : null
  const resumoMesProj = config && temFuturosMes ? calcularResumoMensal(registros, config, mes, ano) : null
  const selectedRegistro = selectedDay ? registrosPorData[selectedDay] : null
  const selectedResumo = selectedDay && config && selectedRegistro
    ? calcularResumo(selectedRegistro, config) : null

  return (
    <div className="py-4 space-y-4">

      {/* Navegação do mês */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMes}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="text-center">
          <h1 className="font-bold text-gray-900 dark:text-white">
            {getNomeMes(mes - 1)} {ano}
          </h1>
          {(mes !== getMesAtual() || ano !== getAnoAtual()) && (
            <button onClick={goHoje} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Voltar ao mês atual
            </button>
          )}
        </div>
        <button
          onClick={nextMes}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Grid calendário */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-700">
        {loading ? (
          <div className="h-48 skeleton rounded-xl" />
        ) : (
          <CalendarioGrid
            mes={mes}
            ano={ano}
            registrosPorData={registrosPorData}
            resumosPorData={resumosPorData}
            onDayClick={setSelectedDay}
            hoje={hoje}
          />
        )}
      </div>

      {/* Card do dia selecionado */}
      {selectedDay && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-indigo-200 dark:border-indigo-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Dia selecionado</p>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{formatarDataLonga(selectedDay)}</h3>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="p-4">
            {selectedRegistro && selectedResumo ? (
              <div className="space-y-3">
                {/* Badges */}
                <div className="flex gap-1.5 flex-wrap">
                  {selectedResumo.isFeriado && (
                    <span className="chip bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">🎉 {selectedResumo.nomeFeriado}</span>
                  )}
                  {selectedResumo.isSabado && !selectedResumo.isFeriado && (
                    <span className="chip bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">📅 Sábado</span>
                  )}
                  {selectedResumo.isDomingo && !selectedResumo.isFeriado && (
                    <span className="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">☀️ Domingo</span>
                  )}
                  {selectedResumo.incompleto && (
                    <span className="chip bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">⚠ Incompleto</span>
                  )}
                </div>

                {/* Batidas */}
                <div className="flex gap-1.5 flex-wrap">
                  {selectedRegistro.batidas.map((b, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                      i % 2 === 0
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800'
                    }`}>
                      {i % 2 === 0 ? '▶' : '■'} {b}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedResumo.incompleto ? 'Em andamento' : 'Trabalhado'}</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatarDuracao(selectedResumo.horasTrabalhadas)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Banco</p>
                    <p className={`font-semibold ${selectedResumo.incompleto ? 'text-gray-400 dark:text-gray-500' : selectedResumo.bancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {selectedResumo.incompleto ? '—' : formatarDuracao(selectedResumo.bancoHoras, true)}
                    </p>
                  </div>
                  {!selectedResumo.incompleto && selectedResumo.horasExtras > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Extras</p>
                      <p className="font-semibold text-amber-600 dark:text-amber-400">{formatarDuracao(selectedResumo.horasExtras)}</p>
                    </div>
                  )}
                  {config?.salario > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Valor do dia</p>
                      <p className={`font-semibold ${selectedResumo.incompleto ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                        {selectedResumo.incompleto ? '—' : formatarMoeda(selectedResumo.totalDia)}
                      </p>
                    </div>
                  )}
                </div>

                {selectedRegistro.observacao && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{selectedRegistro.observacao}"</p>
                )}

                <button
                  onClick={() => router.push(`/registrar?id=${selectedRegistro._id}`)}
                  className="w-full py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                >
                  Editar registro
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum registro neste dia</p>
                <button
                  onClick={() => router.push(`/registrar?data=${selectedDay}`)}
                  className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-lg transition-colors"
                >
                  Registrar este dia
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumo do mês */}
      {resumoMes && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Resumo — {getNomeMes(mes - 1)} {ano}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dias registrados</p>
              <p className="font-semibold text-gray-900 dark:text-white">{resumoMes.totalDias}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total trabalhado</p>
              <p className="font-semibold text-gray-900 dark:text-white">{formatarDuracao(resumoMes.totalMinutosTrabalhados)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Banco de horas</p>
              <p className={`font-semibold ${resumoMes.totalBancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {formatarDuracao(resumoMes.totalBancoHoras, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Extras</p>
              <p className="font-semibold text-amber-600 dark:text-amber-400">{formatarDuracao(resumoMes.totalExtrasMinutos, true)}</p>
            </div>
            {config?.salario > 0 && (
              <div className="col-span-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total do mês</p>
                <p className="font-bold text-gray-900 dark:text-white">{formatarMoeda(resumoMes.totalGeral)}</p>
              </div>
            )}
          </div>

          {resumoMesProj && (
            <div className="mt-3 pt-3 border-t border-dashed border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 mb-2">
                Projeção ({registrosFuturos.filter(r => r.data.startsWith(prefixMes)).length} dia{registrosFuturos.filter(r => r.data.startsWith(prefixMes)).length !== 1 ? 's' : ''} futuro{registrosFuturos.filter(r => r.data.startsWith(prefixMes)).length !== 1 ? 's' : ''})
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-blue-400 dark:text-blue-500">Dias</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">{resumoMesProj.totalDias}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-400 dark:text-blue-500">Trabalhado</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">{formatarDuracao(resumoMesProj.totalMinutosTrabalhados)}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-400 dark:text-blue-500">Banco</p>
                  <p className={`font-semibold ${resumoMesProj.totalBancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {formatarDuracao(resumoMesProj.totalBancoHoras, true)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-400 dark:text-blue-500">Extras</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">{formatarDuracao(resumoMesProj.totalExtrasMinutos, true)}</p>
                </div>
                {config?.salario > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-blue-400 dark:text-blue-500">Total do mês</p>
                    <p className="font-bold text-blue-700 dark:text-blue-300">{formatarMoeda(resumoMesProj.totalGeral)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
