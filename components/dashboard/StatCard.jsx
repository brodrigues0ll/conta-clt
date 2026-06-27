const valueColors = {
  indigo: 'text-indigo-600 dark:text-indigo-400',
  green:  'text-emerald-600 dark:text-emerald-400',
  amber:  'text-amber-600 dark:text-amber-400',
  rose:   'text-red-500 dark:text-red-400',
  red:    'text-red-500 dark:text-red-400',
  violet: 'text-violet-600 dark:text-violet-400',
}

export default function StatCard({ title, value, subtitle, color = 'indigo', accent }) {
  const accentClass = `stat-accent-${accent || color}`
  const valueColor = valueColors[color] || valueColors.indigo

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 ${accentClass}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide leading-none">
        {title}
      </p>
      <p className={`text-xl font-bold mt-1 leading-tight ${valueColor}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
