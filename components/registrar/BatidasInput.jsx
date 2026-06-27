'use client'

const labels = ['Entrada', 'Saída', 'Retorno', 'Saída final', 'Entrada extra', 'Saída extra']

export default function BatidasInput({ batidas, onChange }) {
  function addBatida() { onChange([...batidas, '']) }
  function removeBatida(i) { onChange(batidas.filter((_, idx) => idx !== i)) }
  function updateBatida(i, v) {
    const novo = [...batidas]
    novo[i] = v
    onChange(novo)
  }

  return (
    <div className="space-y-2">
      {batidas.map((batida, i) => (
        <div key={i} className="flex items-center gap-2 batida-enter">
          <span className={`text-xs font-medium w-20 shrink-0 ${i % 2 === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {i % 2 === 0 ? '▶' : '■'} {labels[i] || `Batida ${i + 1}`}
          </span>
          <input
            type="time"
            value={batida}
            onChange={e => updateBatida(i, e.target.value)}
            className={`flex-1 input-base py-1.5 ${
              i % 2 === 0
                ? 'border-green-200 dark:border-green-800 focus:border-green-400'
                : 'border-red-200 dark:border-red-800 focus:border-red-400'
            }`}
          />
          {batidas.length > 2 && (
            <button
              type="button"
              onClick={() => removeBatida(i)}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      ))}

      {batidas.length < 8 && (
        <button
          type="button"
          onClick={addBatida}
          className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Adicionar batida
        </button>
      )}
    </div>
  )
}
