'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { formatarDuracao } from '@/lib/utils'

function CustomTooltipHoras({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-indigo-600 dark:text-indigo-400">
          {formatarDuracao(payload[0].value, true)}
        </p>
      </div>
    )
  }
  return null
}

function CustomTooltipMensal({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-violet-600 dark:text-violet-400">
          {formatarDuracao(payload[0].value)} trabalhados
        </p>
      </div>
    )
  }
  return null
}

export default function Charts({ diasRecentes, mesesAnuais }) {
  return (
    <div className="space-y-4">
      {/* Últimos 14 dias — banco de horas */}
      {diasRecentes && diasRecentes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Últimos 14 dias</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diasRecentes} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-700" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => formatarDuracao(v)}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltipHoras />} />
                  <Bar dataKey="bancoHoras" radius={[4, 4, 0, 0]}>
                    {diasRecentes.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.bancoHoras >= 0 ? '#6366f1' : '#ef4444'}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
        </div>
      )}

      {/* Horas mensais do ano */}
      {mesesAnuais && mesesAnuais.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Horas por mês</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mesesAnuais} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-700" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => `${Math.floor(v / 60)}h`}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltipMensal />} />
                  <Bar dataKey="totalMinutosTrabalhados" fill="#7c3aed" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </div>
      )}
    </div>
  )
}
