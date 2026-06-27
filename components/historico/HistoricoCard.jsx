'use client'
import { useState } from 'react'
import {
  formatarDuracao,
  formatarMoeda,
  getDiaSemanaCurto,
  formatarData
} from '@/lib/utils'

export default function HistoricoCard({ registro, resumo, config, isFuturo, onEdit, onDuplicate, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const bancoPos  = resumo.bancoHoras >= 0
  const incompleto = resumo.incompleto
  const batidas   = registro.batidas || []

  const bancoCls = incompleto
    ? 'text-amber-600 dark:text-amber-400'
    : bancoPos
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-500 dark:text-red-400'

  const badgesCLT = []
  if (resumo.isFeriado)
    badgesCLT.push(<span key="feriado" className="chip bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">🎉 {resumo.nomeFeriado}</span>)
  else if (resumo.isDomingo)
    badgesCLT.push(<span key="domingo" className="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">☀️ Domingo</span>)
  else if (resumo.isSabado)
    badgesCLT.push(<span key="sabado" className="chip bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">📅 Sábado</span>)
  if (resumo.minutosNoturnos > 0)
    badgesCLT.push(<span key="noturno" className="chip bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">🌙 {formatarDuracao(resumo.minutosNoturnos)}</span>)
  if (resumo.alertaHoraExtraCLT)
    badgesCLT.push(<span key="extraclt" className="chip bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">🚨 &gt;2h extras</span>)
  if (resumo.alertaIntrajornada)
    badgesCLT.push(<span key="intra" className="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">⚠ Pausa insuf.</span>)

  const exibirTotal = config?.exibirTotalDia !== false

  return (
    <div className={`history-card card-hover ${isFuturo ? 'border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
      {/* Cabeçalho clicável */}
      <button
        className="w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{getDiaSemanaCurto(registro.data)}</p>
              {isFuturo && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  futuro
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{formatarData(registro.data)}</h3>
            {registro.observacao && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-50">{registro.observacao}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 dark:text-gray-500">{incompleto ? '⚠ incompleto' : 'banco de horas'}</p>
            <p className={`text-base font-bold ${bancoCls}`}>{formatarDuracao(resumo.bancoHoras, true)}</p>
          </div>
        </div>

        {/* Batidas */}
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {batidas.map((b, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                  i % 2 === 0
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800'
                }`}
              >
                {i % 2 === 0 ? '▶' : '■'} {b}
              </span>
            ))}
            {batidas.length === 0 && <span className="text-xs text-gray-400">Sem batidas</span>}
          </div>

          {/* Stats linha */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-400 dark:text-gray-500">Trabalhado</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatarDuracao(resumo.horasTrabalhadas)}</p>
            </div>
            <div className="text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-400 dark:text-gray-500">Extras</p>
              <p className={`text-sm font-semibold ${bancoCls}`}>{formatarDuracao(resumo.horasExtras, true)}</p>
            </div>
            <div className="text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-400 dark:text-gray-500">{exibirTotal ? 'Total' : 'Extras R$'}</p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatarMoeda(exibirTotal ? resumo.totalDia : resumo.valorExtras)}
              </p>
            </div>
          </div>

          {badgesCLT.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">{badgesCLT}</div>
          )}
        </div>
      </button>

      {/* Ações expandidas */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-3 pt-3">
          {resumo.alertaIntrajornada && (
            <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1.5 rounded mb-2">
              Intrajornada: faltam {formatarDuracao(resumo.alertaIntrajornada.faltam)} (Art. 71 CLT)
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(registro._id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Editar
            </button>
            <button
              onClick={() => onDuplicate(registro.data)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              Duplicar
            </button>
            <button
              onClick={() => onDelete(registro._id)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
