'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  formatarBytes,
  formatarDataHoraISO,
  getAnoAtual,
  formatarData,
  getDiaSemana,
  getDiaSemanaCurto,
  formatarDuracao,
  getNomeMes,
  horaParaMinutos
} from '@/lib/utils'
import { calcularResumo, calcularResumoAnual } from '@/lib/calculations'

/* ─────────────────────────────────────────
   Componentes de interface
───────────────────────────────────────── */

function SectionCard({ children, danger = false }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border ${
      danger ? 'border-red-200 dark:border-red-800/60' : 'border-gray-100 dark:border-gray-700'
    }`}>
      {children}
    </div>
  )
}

function SectionHeader({ icon, iconBg = 'bg-indigo-100 dark:bg-indigo-900/40', iconColor = 'text-indigo-600 dark:text-indigo-400', children, action }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/80">
      <div className="flex items-center gap-2.5">
        <span className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center text-sm`}>
          <span className={iconColor}>{icon}</span>
        </span>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{children}</h2>
      </div>
      {action}
    </div>
  )
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight">{label}</span>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SubSection({ label }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50/60 dark:bg-gray-700/30">
      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

function NumberInput({ value, onChange, min = 0, max, step = 1, suffix, className = 'w-20' }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min} max={max} step={step}
        className={`input-base py-1.5 text-sm text-right ${className}`}
      />
      {suffix && <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{suffix}</span>}
    </div>
  )
}

function MoneyInput({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')

  function handleFocus() {
    setFocused(true)
    setRaw(value ? String(value).replace('.', ',') : '')
  }

  function handleBlur() {
    setFocused(false)
    const parsed = parseFloat((raw || '0').replace(',', '.')) || 0
    onChange(parsed)
  }

  function handleChange(e) {
    setRaw(e.target.value.replace(/[^\d,]/g, ''))
  }

  const display = focused
    ? raw
    : (value != null && value !== '')
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
      : ''

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder="R$ 0,00"
      className="input-base py-1.5 text-sm text-right w-32"
    />
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

/* ─────────────────────────────────────────
   Helpers RFP (Folha de Ponto XLS)
───────────────────────────────────────── */

function xlSerialToDateStr(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

function xlSerialToTimeStr(serial) {
  const totalMin = Math.round((serial % 1) * 1440)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function extrairObsRFP(obsArr) {
  if (!obsArr.length) return ''
  const linhas = obsArr
    .flatMap(txt => txt.split('\n'))
    .map(l => l.trim())
    .filter(l => l && l !== 'Ponto Aprovado' && l !== ' ')
  return linhas.join(' | ').substring(0, 600)
}

function parseRFPRows(rows) {
  const mapa = {}

  for (const row of rows) {
    const c10 = row[10], c14 = row[14], c20 = row[20]

    // Linha de batida: c10 contém serial de data+hora (parte inteira = data, fracionária = hora)
    if (typeof c10 !== 'number' || c10 <= 40000) continue

    const dateStr = xlSerialToDateStr(Math.floor(c10))
    const entrada = xlSerialToTimeStr(c10)
    const saida   = (typeof c14 === 'number' && c14 > 40000) ? xlSerialToTimeStr(c14) : null

    if (!mapa[dateStr]) mapa[dateStr] = { batidas: [], obs: [] }
    const reg = mapa[dateStr]
    if (!reg.batidas.includes(entrada)) reg.batidas.push(entrada)
    if (saida && !reg.batidas.includes(saida)) reg.batidas.push(saida)
    const obs = c20 && typeof c20 === 'string' ? c20.trim() : ''
    if (obs && obs !== ' ') reg.obs.push(obs)
  }

  return Object.entries(mapa)
    .filter(([, info]) => info.batidas.length > 0)
    .map(([data, info]) => ({
      data,
      batidas: [...info.batidas].sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b)),
      observacao: extrairObsRFP(info.obs)
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

function parseColetaPontosRows(rows) {
  const mapa = {}

  for (const row of rows) {
    const c3 = row[3]
    // Cada linha é uma batida: c3 = serial Excel com data (parte inteira) + hora (fração)
    if (typeof c3 !== 'number' || c3 <= 40000 || c3 === Math.floor(c3)) continue

    const dateStr = xlSerialToDateStr(Math.floor(c3))
    const timeStr = xlSerialToTimeStr(c3)
    if (!mapa[dateStr]) mapa[dateStr] = []
    if (!mapa[dateStr].includes(timeStr)) mapa[dateStr].push(timeStr)
  }

  return Object.entries(mapa)
    .map(([data, batidas]) => ({
      data,
      batidas: batidas.sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b)),
      observacao: ''
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

function detectarTipoXLS(wb) {
  return (wb.SheetNames[0] || '') === 'Coleta de Pontos Originais' ? 'coleta' : 'rfp'
}

/* Remove batidas que estão dentro de `toleranciaMin` do ponto anterior.
   Isso evita duplicatas entre arquivos que registram o mesmo ponto com 1–2 min de diferença. */
function deduplicarBatidas(batidas, toleranciaMin = 3) {
  const sorted = [...batidas].sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b))
  const resultado = []
  for (const b of sorted) {
    const minutos = horaParaMinutos(b)
    const anterior = resultado.length > 0 ? horaParaMinutos(resultado[resultado.length - 1]) : -999
    if (minutos - anterior > toleranciaMin) resultado.push(b)
  }
  return resultado
}

function mesclarRegistrosXLS(lista) {
  const mapa = {}
  for (const regs of lista) {
    for (const reg of regs) {
      if (!mapa[reg.data]) mapa[reg.data] = { batidas: [], obs: reg.observacao || '' }
      else if (reg.observacao) mapa[reg.data].obs += (mapa[reg.data].obs ? ' | ' : '') + reg.observacao
      mapa[reg.data].batidas.push(...reg.batidas)
    }
  }
  return Object.entries(mapa)
    .map(([data, info]) => ({
      data,
      batidas: deduplicarBatidas(info.batidas),
      observacao: info.obs
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

/* ─────────────────────────────────────────
   Modal RFP
───────────────────────────────────────── */

function ModalRFP({ registrosRFP, registrosExistentes, onClose, onConfirm }) {
  const [modo, setModo] = useState('merge')

  const existentes  = new Set(registrosExistentes.map(r => r.data))
  const conflitos   = registrosRFP.filter(r => existentes.has(r.data))
  const novos       = registrosRFP.filter(r => !existentes.has(r.data))
  const total       = registrosRFP.length
  const temConflitos = conflitos.length > 0

  const datas    = registrosRFP.map(r => r.data).sort()
  const primeira = datas[0]
  const ultima   = datas[datas.length - 1]

  const porMes = {}
  registrosRFP.forEach(r => {
    const chave = r.data.substring(0, 7)
    if (!porMes[chave]) porMes[chave] = []
    porMes[chave].push(r)
  })

  const qtImportar = modo === 'replace' ? total : novos.length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-gray-800 w-full sm:rounded-2xl shadow-2xl max-w-lg max-h-[92vh] flex flex-col overflow-hidden rounded-t-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-lg">📊</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Importar Planilha de Ponto</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Revise antes de confirmar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{total}</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">encontrados</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{novos.length}</p>
              <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5">novos</p>
            </div>
            <div className={`${temConflitos ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40' : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/40'} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-bold ${temConflitos ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>{conflitos.length}</p>
              <p className={`text-xs mt-0.5 ${temConflitos ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>conflitos</p>
            </div>
          </div>

          {/* Período */}
          <div className="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/40 rounded-xl px-3.5 py-2.5">
            <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>
              Período: <strong className="text-gray-700 dark:text-gray-300">{formatarData(primeira)}</strong>
              {' '}até{' '}
              <strong className="text-gray-700 dark:text-gray-300">{formatarData(ultima)}</strong>
            </span>
          </div>

          {/* Conflitos */}
          {temConflitos && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-800/60">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  ⚠ {conflitos.length} conflito{conflitos.length !== 1 ? 's' : ''} — escolha como importar
                </p>
              </div>
              <div className="p-3 space-y-2">
                {[
                  { value: 'merge', title: 'Importar apenas novos', desc: `${novos.length} novo${novos.length !== 1 ? 's' : ''} · mantém os ${conflitos.length} existente${conflitos.length !== 1 ? 's' : ''}` },
                  { value: 'replace', title: 'Substituir todos', desc: `${total} registros · sobrescreve os ${conflitos.length} existente${conflitos.length !== 1 ? 's' : ''}` },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                    modo === opt.value
                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/80 dark:bg-indigo-900/30'
                      : 'border-white dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                  }`}>
                    <input type="radio" name="rfp-modo" value={opt.value} checked={modo === opt.value} onChange={() => setModo(opt.value)} className="mt-0.5 accent-indigo-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Lista por mês */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-0.5">Registros encontrados</p>
            <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/60">
              {Object.entries(porMes).sort().map(([mesAno, regs]) => {
                const [ano, mes] = mesAno.split('-')
                return (
                  <div key={mesAno}>
                    <div className="sticky top-0 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/80 backdrop-blur-sm">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {getNomeMes(parseInt(mes) - 1)} {ano} <span className="font-normal text-gray-400">· {regs.length} dia{regs.length !== 1 ? 's' : ''}</span>
                      </p>
                    </div>
                    {regs.map(r => {
                      const conflito = existentes.has(r.data)
                      return (
                        <div key={r.data} className={`flex items-center gap-2.5 py-2 px-3 text-xs ${conflito ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'bg-white dark:bg-gray-800'}`}>
                          <span className={`shrink-0 font-bold ${conflito ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {conflito ? '⚠' : '✓'}
                          </span>
                          <span className="font-medium text-gray-700 dark:text-gray-300 w-20 shrink-0">{formatarData(r.data)}</span>
                          <span className="text-gray-400 dark:text-gray-500 truncate">{getDiaSemanaCurto(r.data)} · {r.batidas.join(' → ')}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button onClick={() => onConfirm(modo)} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
            Importar {qtImportar} registro{qtImportar !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Página principal
───────────────────────────────────────── */

export default function ConfiguracoesPage() {
  const [config, setConfig]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [backups, setBackups]         = useState([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [novoFeriado, setNovoFeriado] = useState({ data: '', nome: '' })
  const [rfpData, setRfpData]         = useState(null)
  const [importando, setImportando]   = useState(false)
  const inputJsonRef = useRef(null)
  const inputXlsRef  = useRef(null)

  function set(key, value) { setConfig(prev => ({ ...prev, [key]: value })) }

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config')
      const data = await res.json()
      setConfig(data.config)
    } finally { setLoading(false) }
  }, [])

  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true)
    try {
      const res  = await fetch('/api/backups')
      const data = await res.json()
      setBackups(data.backups || [])
    } finally { setLoadingBackups(false) }
  }, [])

  useEffect(() => { fetchConfig(); fetchBackups() }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.ok) toast.success('Configurações salvas!')
      else toast.error('Erro ao salvar configurações')
    } finally { setSaving(false) }
  }

  /* ── Backups ── */

  async function criarBackup() {
    const nome = `Backup ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    const res = await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) })
    if (res.ok) { toast.success('Backup criado!'); fetchBackups() }
    else toast.error('Erro ao criar backup')
  }

  async function restaurarBackup(id) {
    if (!confirm('Restaurar este backup? Todos os registros atuais serão substituídos.')) return
    const res  = await fetch(`/api/backups/${id}/restaurar`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) { toast.success(`Backup restaurado! ${data.totalRestaurados} registros.`); fetchConfig() }
    else toast.error('Erro ao restaurar backup')
  }

  async function excluirBackup(id) {
    if (!confirm('Excluir este backup?')) return
    const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Backup excluído'); fetchBackups() }
    else toast.error('Erro ao excluir backup')
  }

  /* ── Exportar ── */

  function _dataArquivo() {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  }

  async function exportarJSON() {
    const [regsRes, cfgRes] = await Promise.all([fetch('/api/registros?limit=10000'), fetch('/api/config')])
    const regsData = await regsRes.json()
    const cfgData  = await cfgRes.json()
    const blob = new Blob([JSON.stringify({ versao: '1.0', exportadoEm: new Date().toISOString(), config: cfgData.config, registros: regsData.registros || [] }, null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `horas-clt-${_dataArquivo()}.json` })
    a.click(); URL.revokeObjectURL(a.href)
    toast.success('JSON exportado!')
  }

  async function exportarCSV() {
    const [regsRes, cfgRes] = await Promise.all([fetch('/api/registros?limit=10000'), fetch('/api/config')])
    const { registros }   = await regsRes.json()
    const { config: cfg } = await cfgRes.json()

    const linhas = [['Data','Dia da Semana','Batidas','Horas Trabalhadas','Horas Extras','Banco de Horas','Valor Extras (R$)','Total Dia (R$)','Observação']]
    for (const reg of (registros || [])) {
      const r = calcularResumo(reg, cfg)
      linhas.push([formatarData(reg.data), getDiaSemana(reg.data), (reg.batidas || []).join(' | '), formatarDuracao(r.horasTrabalhadas), formatarDuracao(r.horasExtras, true), formatarDuracao(r.bancoHoras, true), r.valorExtras.toFixed(2).replace('.', ','), r.totalDia.toFixed(2).replace('.', ','), reg.observacao || ''])
    }

    const csv  = '\uFEFF' + linhas.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `horas-clt-${_dataArquivo()}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
    toast.success('CSV exportado!')
  }

  async function exportarExcel() {
    const XLSX = await import('xlsx')
    const [regsRes, cfgRes] = await Promise.all([fetch('/api/registros?limit=10000'), fetch('/api/config')])
    const { registros }   = await regsRes.json()
    const { config: cfg } = await cfgRes.json()

    const dadosPrincipais = (registros || []).map(reg => {
      const r = calcularResumo(reg, cfg)
      return {
        'Data': formatarData(reg.data), 'Dia da Semana': getDiaSemana(reg.data),
        'Batidas': (reg.batidas || []).join(' | '),
        'Horas Trabalhadas': formatarDuracao(r.horasTrabalhadas),
        'Horas Normais': formatarDuracao(r.horasNormais),
        'Horas Extras': formatarDuracao(r.horasExtras, true),
        'Banco de Horas': formatarDuracao(r.bancoHoras, true),
        'Valor Hora (R$)': r.valorHora?.toFixed(2) || '0,00',
        'Valor Hora Extra (R$)': r.valorHoraExtra?.toFixed(2) || '0,00',
        'Valor Extras (R$)': r.valorExtras.toFixed(2),
        'Total Dia (R$)': r.totalDia.toFixed(2),
        'Observação': reg.observacao || ''
      }
    })

    const ano = getAnoAtual()
    const resumoAnual  = calcularResumoAnual(registros || [], cfg, ano)
    const dadosMensais = resumoAnual.meses.map(m => ({
      'Mês': m.nomeMes, 'Ano': ano, 'Dias Trabalhados': m.totalDias,
      'Horas Trabalhadas': formatarDuracao(m.totalMinutosTrabalhados),
      'Banco de Horas': formatarDuracao(m.totalBancoHoras, true),
      'Valor Extras (R$)': m.totalValorExtras.toFixed(2),
      'Total (R$)': m.totalGeral.toFixed(2)
    }))

    const wb  = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(dadosPrincipais)
    ws1['!cols'] = [12,15,30,16,14,12,13,15,18,15,13,30].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws1, 'Registros')
    const ws2 = XLSX.utils.json_to_sheet(dadosMensais)
    ws2['!cols'] = [12,6,16,16,14,16,13].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo Mensal')
    XLSX.writeFile(wb, `horas-clt-${_dataArquivo()}.xlsx`)
    toast.success('Excel exportado!')
  }

  /* ── Importar JSON ── */

  async function handleImportJSON(e) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const dados = JSON.parse(ev.target.result)
        if (!dados.registros || !Array.isArray(dados.registros)) { toast.error('Arquivo inválido: campo "registros" ausente.'); return }
        setImportando(true)
        const res    = await fetch('/api/registros/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registros: dados.registros, modo: 'merge' }) })
        const result = await res.json()
        if (dados.config) { await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados.config) }); fetchConfig() }
        toast.success(`${result.importados} importados, ${result.ignorados} já existiam.`)
      } catch (err) { toast.error(`Erro ao importar: ${err.message}`) }
      finally { setImportando(false) }
    }
    reader.readAsText(file)
  }

  /* ── Importar XLS (RFP ou ColetaPontos, um ou vários arquivos) ── */

  async function handleImportXLS(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    setImportando(true)
    try {
      const XLSX = await import('xlsx')
      const todosRegistros = []

      for (const file of files) {
        const data = new Uint8Array(await file.arrayBuffer())
        const wb   = XLSX.read(data, { type: 'array', raw: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
        const tipo = detectarTipoXLS(wb)
        const regs = tipo === 'coleta' ? parseColetaPontosRows(rows) : parseRFPRows(rows)
        todosRegistros.push(regs)
      }

      const registrosXLS = todosRegistros.length === 1
        ? todosRegistros[0]
        : mesclarRegistrosXLS(todosRegistros)

      if (!registrosXLS.length) { toast.warning('Nenhum registro encontrado nas planilhas.'); return }
      const { registros: registrosExistentes } = await (await fetch('/api/registros?limit=10000')).json()
      setRfpData({ registrosRFP: registrosXLS, registrosExistentes: registrosExistentes || [] })
    } catch (err) {
      toast.error(`Erro ao ler planilha: ${err.message}`)
    } finally { setImportando(false) }
  }

  async function executarImportacaoRFP(modo) {
    if (!rfpData) return
    setRfpData(null); setImportando(true)
    try {
      await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: `Antes da importação RFP — ${new Date().toLocaleString('pt-BR')}` }) })
      fetchBackups()
      const res    = await fetch('/api/registros/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registros: rfpData.registrosRFP, modo }) })
      const result = await res.json()
      toast.success(`Concluído! ${result.importados} importados, ${result.substituidos} substituídos, ${result.ignorados} ignorados.`)
    } catch (err) { toast.error(`Erro ao importar: ${err.message}`) }
    finally { setImportando(false) }
  }

  /* ── Feriados ── */

  function adicionarFeriado() {
    if (!novoFeriado.data || !novoFeriado.nome) { toast.error('Preencha data e nome do feriado'); return }
    const atual = config.feriadosPersonalizados || []
    if (atual.find(f => f.data === novoFeriado.data)) { toast.error('Já existe um feriado nesta data'); return }
    set('feriadosPersonalizados', [...atual, { ...novoFeriado }])
    setNovoFeriado({ data: '', nome: '' })
  }

  function removerFeriado(data) {
    set('feriadosPersonalizados', (config.feriadosPersonalizados || []).filter(f => f.data !== data))
  }

  /* ── Apagar tudo ── */

  async function apagarTodosRegistros() {
    if (!confirm('ATENÇÃO: Isso excluirá TODOS os seus registros de horas. Esta ação não pode ser desfeita. Continuar?')) return
    if (!confirm('Tem certeza absoluta? Todos os registros serão perdidos permanentemente.')) return
    const { registros } = await (await fetch('/api/registros?limit=10000')).json()
    let deletados = 0
    for (const r of (registros || [])) { const dr = await fetch(`/api/registros/${r._id}`, { method: 'DELETE' }); if (dr.ok) deletados++ }
    toast.success(`${deletados} registros excluídos`)
  }

  /* ── Render ── */

  if (loading || !config) {
    return (
      <div className="py-4 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-36 skeleton rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="py-4 space-y-3">

      {rfpData && (
        <ModalRFP
          registrosRFP={rfpData.registrosRFP}
          registrosExistentes={rfpData.registrosExistentes}
          onClose={() => setRfpData(null)}
          onConfirm={executarImportacaoRFP}
        />
      )}

      <input ref={inputJsonRef} type="file" accept=".json"      className="hidden" onChange={handleImportJSON} />
      <input ref={inputXlsRef}  type="file" accept=".xls,.xlsx" className="hidden" multiple onChange={handleImportXLS} />

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-gray-900 dark:text-white">Configurações</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Dados pessoais */}
      <SectionCard>
        <SectionHeader icon="👤">Dados pessoais</SectionHeader>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nome do funcionário</label>
            <input type="text" value={config.nomeFuncionario || ''} onChange={e => set('nomeFuncionario', e.target.value)}
              placeholder="Seu nome completo" className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Empresa</label>
            <input type="text" value={config.nomeEmpresa || ''} onChange={e => set('nomeEmpresa', e.target.value)}
              placeholder="Nome da empresa" className="input-base" />
          </div>
        </div>
      </SectionCard>

      {/* Trabalho */}
      <SectionCard>
        <SectionHeader icon="💼">Trabalho</SectionHeader>
        <FieldRow label="Salário bruto" hint="Valor mensal em reais">
          <MoneyInput value={config.salario} onChange={v => set('salario', v)} />
        </FieldRow>
        <FieldRow label="Horas mensais">
          <NumberInput value={config.horasMensais} onChange={v => set('horasMensais', v)} min={1} max={300} suffix="h" className="w-16" />
        </FieldRow>
        <FieldRow label="Jornada diária">
          <NumberInput value={config.jornadaDiaria} onChange={v => set('jornadaDiaria', v)} min={1} max={12} suffix="h" className="w-16" />
        </FieldRow>
        <FieldRow label="Adicional de hora extra">
          <NumberInput value={config.percentualHoraExtra} onChange={v => set('percentualHoraExtra', v)} min={0} max={200} suffix="%" className="w-16" />
        </FieldRow>
        <FieldRow label="Tolerância de hora extra" hint="Extras abaixo deste limite não são contabilizadas">
          <NumberInput value={config.toleranciaHoraExtra} onChange={v => set('toleranciaHoraExtra', v)} min={0} max={60} suffix="min" className="w-16" />
        </FieldRow>
      </SectionCard>

      {/* Regras CLT */}
      <SectionCard>
        <SectionHeader
          icon="⚖️"
          iconBg="bg-violet-100 dark:bg-violet-900/40"
          iconColor="text-violet-600 dark:text-violet-400"
        >
          Regras CLT
        </SectionHeader>

        <SubSection label="Sábado" />
        <FieldRow label="Sábado como hora extra">
          <Toggle checked={config.sabadoHoraExtra} onChange={v => set('sabadoHoraExtra', v)} />
        </FieldRow>
        <FieldRow label="Pagar adicional de sábado">
          <Toggle checked={config.adicionalSabado} onChange={v => set('adicionalSabado', v)} />
        </FieldRow>
        {config.adicionalSabado && (
          <FieldRow label="Percentual adicional">
            <NumberInput value={config.percentualAdicionalSabado} onChange={v => set('percentualAdicionalSabado', v)} min={0} max={200} suffix="%" className="w-16" />
          </FieldRow>
        )}

        <SubSection label="Domingo" />
        <FieldRow label="Domingo como hora extra">
          <Toggle checked={config.domingoHoraExtra} onChange={v => set('domingoHoraExtra', v)} />
        </FieldRow>
        <FieldRow label="Pagar adicional de domingo">
          <Toggle checked={config.adicionalDomingo} onChange={v => set('adicionalDomingo', v)} />
        </FieldRow>
        {config.adicionalDomingo && (
          <FieldRow label="Percentual adicional">
            <NumberInput value={config.percentualAdicionalDomingo} onChange={v => set('percentualAdicionalDomingo', v)} min={0} max={200} suffix="%" className="w-16" />
          </FieldRow>
        )}

        <SubSection label="Feriado" />
        <FieldRow label="Pagar adicional de feriado">
          <Toggle checked={config.adicionalFeriado} onChange={v => set('adicionalFeriado', v)} />
        </FieldRow>
        {config.adicionalFeriado && (
          <FieldRow label="Percentual adicional">
            <NumberInput value={config.percentualAdicionalFeriado} onChange={v => set('percentualAdicionalFeriado', v)} min={0} max={200} suffix="%" className="w-16" />
          </FieldRow>
        )}

        <SubSection label="Adicional noturno — Art. 73 (22h–05h)" />
        <FieldRow label="Calcular adicional noturno">
          <Toggle checked={config.calcularNoturno} onChange={v => set('calcularNoturno', v)} />
        </FieldRow>
        {config.calcularNoturno && (
          <>
            <FieldRow label="Percentual adicional noturno">
              <NumberInput value={config.percentualAdicionalNoturno} onChange={v => set('percentualAdicionalNoturno', v)} min={0} max={100} suffix="%" className="w-16" />
            </FieldRow>
            <FieldRow label="Hora noturna reduzida" hint="52min30s = 1h noturna">
              <Toggle checked={config.horaNoturnaReduzida} onChange={v => set('horaNoturnaReduzida', v)} />
            </FieldRow>
          </>
        )}

        <SubSection label="Intrajornada — Art. 71" />
        <FieldRow label="Verificar intervalo mínimo">
          <Toggle checked={config.verificarIntrajornada} onChange={v => set('verificarIntrajornada', v)} />
        </FieldRow>
      </SectionCard>

      {/* Exibição */}
      <SectionCard>
        <SectionHeader icon="🖥️" iconBg="bg-sky-100 dark:bg-sky-900/40" iconColor="text-sky-600 dark:text-sky-400">
          Exibição
        </SectionHeader>
        <FieldRow label="Exibir valor total do dia" hint="Inclui horas normais + extras + adicionais">
          <Toggle checked={config.exibirTotalDia} onChange={v => set('exibirTotalDia', v)} />
        </FieldRow>
      </SectionCard>

      {/* Feriados personalizados */}
      <SectionCard>
        <SectionHeader icon="📅" iconBg="bg-rose-100 dark:bg-rose-900/40" iconColor="text-rose-600 dark:text-rose-400">
          Feriados personalizados
        </SectionHeader>
        <div className="p-4 space-y-3">
          {(config.feriadosPersonalizados || []).length > 0 && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {config.feriadosPersonalizados.map(f => (
                <div key={f.data} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{f.nome}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatarData(f.data)}</p>
                  </div>
                  <button onClick={() => removerFeriado(f.data)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={novoFeriado.data} onChange={e => setNovoFeriado(p => ({ ...p, data: e.target.value }))} className="input-base py-1.5 text-sm" />
            <input type="text" placeholder="Nome do feriado" value={novoFeriado.nome} onChange={e => setNovoFeriado(p => ({ ...p, nome: e.target.value }))} className="input-base py-1.5 text-sm" />
          </div>
          <button onClick={adicionarFeriado} className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-xs font-medium text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Adicionar feriado
          </button>
        </div>
      </SectionCard>

      {/* Salvar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
        </svg>
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </button>

      {/* Exportar / Importar */}
      <SectionCard>
        <SectionHeader icon="📤" iconBg="bg-emerald-100 dark:bg-emerald-900/40" iconColor="text-emerald-600 dark:text-emerald-400">
          Exportar dados
        </SectionHeader>
        <div className="p-4 grid grid-cols-3 gap-2">
          {[
            { label: 'JSON', desc: 'Backup completo', icon: '{}', fn: exportarJSON },
            { label: 'CSV',  desc: 'Planilha simples', icon: '≡',  fn: exportarCSV },
            { label: 'Excel', desc: 'Planilha .xlsx', icon: '⊞',  fn: exportarExcel },
          ].map(({ label, desc, fn }) => (
            <button key={label} onClick={fn} className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{label}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">{desc}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader icon="📥" iconBg="bg-amber-100 dark:bg-amber-900/40" iconColor="text-amber-600 dark:text-amber-400">
          Importar dados
        </SectionHeader>
        <div className="p-4 space-y-2">
          <button
            onClick={() => inputJsonRef.current?.click()}
            disabled={importando}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all disabled:opacity-50 group"
          >
            <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                {importando ? 'Importando...' : 'Importar JSON'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Restaurar um backup exportado anteriormente</p>
            </div>
          </button>
          <button
            onClick={() => inputXlsRef.current?.click()}
            disabled={importando}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all disabled:opacity-50 group"
          >
            <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                {importando ? 'Importando...' : 'Planilha de Ponto'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">RFP Detalhado ou Coleta de Pontos · um ou vários arquivos</p>
            </div>
          </button>
        </div>
      </SectionCard>

      {/* Backups */}
      <SectionCard>
        <SectionHeader
          icon="🗄️"
          iconBg="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-600 dark:text-slate-400"
          action={
            <button onClick={criarBackup} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Criar
            </button>
          }
        >
          Backups
        </SectionHeader>
        <div className="p-4">
          {loadingBackups ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Carregando...</p>
          ) : backups.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">Nenhum backup criado ainda</p>
          ) : (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {backups.map(b => (
                <div key={b._id} className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800">
                  <div className="min-w-0 mr-2">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{b.nome}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {b.totalRegistros} reg · {formatarBytes(b.tamanho)} · {formatarDataHoraISO(b.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => restaurarBackup(b._id)} title="Restaurar" className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                    </button>
                    <button onClick={() => excluirBackup(b._id)} title="Excluir" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Zona de perigo */}
      <SectionCard danger>
        <SectionHeader
          icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          }
          iconBg="bg-red-100 dark:bg-red-900/40"
          iconColor="text-red-600 dark:text-red-400"
        >
          <span className="text-red-600 dark:text-red-400">Zona de perigo</span>
        </SectionHeader>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ações irreversíveis. Crie um backup antes de prosseguir.
          </p>
          <button
            onClick={apagarTodosRegistros}
            className="w-full py-2.5 text-xs font-semibold border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Apagar todos os registros
          </button>
        </div>
      </SectionCard>

    </div>
  )
}
