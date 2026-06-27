import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/* ═══════════════════════════════════════
   utils.js — Funções utilitárias gerais
   ═══════════════════════════════════════ */

const DIAS_SEMANA = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const DIAS_SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

/** Shadcn helper */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Gera um ID único */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

/** Converte "YYYY-MM-DD" em Date local (sem deslocamento de fuso) */
export function parseDataLocal(dataStr) {
  if (!dataStr) return new Date(NaN)
  const [ano, mes, dia] = dataStr.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/** Retorna hoje no formato "YYYY-MM-DD" */
export function getDataHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

/** "DD/MM/YYYY" */
export function formatarData(dataStr) {
  if (!dataStr) return ''
  const d = parseDataLocal(dataStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

/** "Segunda-feira, 01 de Janeiro de 2024" */
export function formatarDataLonga(dataStr) {
  if (!dataStr) return ''
  const d = parseDataLocal(dataStr)
  return `${DIAS_SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

/** "01/01" */
export function formatarDataCurta(dataStr) {
  if (!dataStr) return ''
  const d = parseDataLocal(dataStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

/** Nome do dia da semana */
export function getDiaSemana(dataStr) {
  if (!dataStr) return ''
  return DIAS_SEMANA[parseDataLocal(dataStr).getDay()]
}

/** Nome curto do dia */
export function getDiaSemanaCurto(dataStr) {
  if (!dataStr) return ''
  return DIAS_SEMANA_CURTO[parseDataLocal(dataStr).getDay()]
}

/** "Janeiro 2024" */
export function getMesAno(dataStr) {
  if (!dataStr) return ''
  const d = parseDataLocal(dataStr)
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

/** Nome do mês pelo índice 0-11 */
export function getNomeMes(indice) {
  return MESES[indice] || ''
}

/** Ano atual */
export function getAnoAtual() {
  return new Date().getFullYear()
}

/** Mês atual (1-12) */
export function getMesAtual() {
  return new Date().getMonth() + 1
}

/** Formata valor monetário em BRL */
export function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

/**
 * Formata duração em minutos como "HH:MM"
 * @param {number} totalMinutos
 * @param {boolean} showSign - se true, prefixa com + ou -
 */
export function formatarDuracao(totalMinutos, showSign = false) {
  if (totalMinutos === null || totalMinutos === undefined || isNaN(totalMinutos)) return '--:--'
  const negativo = totalMinutos < 0
  const abs = Math.abs(Math.round(totalMinutos))
  const horas = Math.floor(abs / 60)
  const mins  = abs % 60
  const str = `${String(horas).padStart(2,'0')}:${String(mins).padStart(2,'0')}`
  if (showSign) return (negativo ? '-' : '+') + str
  return negativo ? `-${str}` : str
}

/** Converte "HH:MM" para total de minutos */
export function horaParaMinutos(horaStr) {
  if (!horaStr) return 0
  const [h, m] = horaStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Converte minutos para "HH:MM" */
export function minutosParaHora(minutos) {
  const abs = Math.abs(Math.round(minutos))
  return `${String(Math.floor(abs / 60)).padStart(2,'0')}:${String(abs % 60).padStart(2,'0')}`
}

/** Valida se uma string é horário válido HH:MM */
export function validarFormatoHora(hora) {
  if (!hora) return false
  return /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(hora)
}

/** Valida se uma string é data válida YYYY-MM-DD */
export function validarFormatoData(data) {
  if (!data) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const d = parseDataLocal(data)
  return !isNaN(d.getTime())
}

/**
 * Valida lista de batidas.
 * Retorna array de erros (vazio = válido).
 */
export function validarBatidas(batidas) {
  const erros = []
  if (!batidas || batidas.length === 0) {
    erros.push('Adicione pelo menos um horário.')
    return erros
  }

  const batidasFiltradas = batidas.filter(b => b && b.trim())

  for (let i = 0; i < batidasFiltradas.length; i++) {
    if (!validarFormatoHora(batidasFiltradas[i])) {
      erros.push(`Horário ${i + 1} inválido: "${batidasFiltradas[i]}".`)
    }
  }
  if (erros.length > 0) return erros

  // Duplicatas
  const unicos = new Set(batidasFiltradas)
  if (unicos.size !== batidasFiltradas.length) {
    erros.push('Existem horários duplicados.')
  }

  // Ordem crescente
  for (let i = 1; i < batidasFiltradas.length; i++) {
    if (horaParaMinutos(batidasFiltradas[i]) <= horaParaMinutos(batidasFiltradas[i - 1])) {
      erros.push(`Horário ${i + 1} (${batidasFiltradas[i]}) deve ser maior que o horário ${i} (${batidasFiltradas[i - 1]}).`)
    }
  }

  return erros
}

/** Escapa HTML para prevenir XSS */
export function escapeHTML(str) {
  if (!str && str !== 0) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Formata tamanho em bytes */
export function formatarBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/** Saudação conforme horário */
export function getSaudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Retorna quantos dias tem um mês/ano */
export function diasNoMes(mes, ano) {
  return new Date(ano, mes, 0).getDate()
}

/** Retorna o dia da semana (0=Dom) do 1º dia do mês */
export function primeiroDiaSemana(mes, ano) {
  return new Date(ano, mes - 1, 1).getDay()
}

/** Formata data ISO para exibição compacta */
export function formatarDataHoraISO(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
