'use client'
import { diasNoMes, primeiroDiaSemana } from '@/lib/utils'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function CalendarioGrid({ mes, ano, registrosPorData, resumosPorData, onDayClick, hoje }) {
  const numDias = diasNoMes(mes, ano)
  const primeiroDia = primeiroDiaSemana(mes, ano)

  const cells = []
  for (let i = 0; i < primeiroDia; i++) cells.push(null)
  for (let d = 1; d <= numDias; d++) {
    const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, dataStr })
  }

  return (
    <div>
      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} />

          const { day, dataStr } = cell
          const registro = registrosPorData[dataStr]
          const resumo   = resumosPorData[dataStr]
          const ehHoje   = dataStr === hoje

          const classes = ['cal-day']
          if (ehHoje)   classes.push('cal-day-today')
          if (registro) classes.push('cal-day-has-record')
          if (resumo) {
            if (resumo.bancoHoras > 30)  classes.push('cal-day-extra-pos')
            if (resumo.bancoHoras < -30) classes.push('cal-day-extra-neg')
          }

          return (
            <button
              key={dataStr}
              onClick={() => onDayClick(dataStr)}
              className={classes.join(' ')}
              title={dataStr}
            >
              <span>{day}</span>
              {resumo && (
                <span className="text-[9px] leading-none mt-0.5 opacity-70">
                  {resumo.bancoHoras >= 0 ? '+' : ''}{Math.floor(Math.abs(resumo.bancoHoras) / 60)}h
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
