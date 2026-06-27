import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Registro from '@/models/Registro'
import Config from '@/models/Config'
import {
  calcularResumo,
  calcularResumoMensal,
  calcularResumoAnual
} from '@/lib/calculations'
import {
  getDataHoje,
  getMesAtual,
  getAnoAtual,
  getSaudacao,
  formatarDuracao,
  formatarMoeda,
  formatarDataLonga,
  formatarDataCurta,
  getNomeMes,
  getDiaSemanaCurto,
  getMesAno
} from '@/lib/utils'
import StatCard from '@/components/dashboard/StatCard'
import Charts from '@/components/dashboard/Charts'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  await connectDB()

  const userId = session.user.id
  const hoje   = getDataHoje()
  const mes    = getMesAtual()
  const ano    = getAnoAtual()

  let config = await Config.findOne({ userId }).lean()
  if (!config) {
    config = await Config.create({ userId })
    config = config.toObject()
  }

  const registros = await Registro.find({
    userId,
    data: { $regex: `^${ano}-` }
  }).sort({ data: -1 }).lean()

  const regs = registros.map(r => ({
    _id: r._id.toString(),
    data: r.data,
    batidas: r.batidas || [],
    observacao: r.observacao || ''
  }))

  const cfg = JSON.parse(JSON.stringify(config))

  const resumoMes  = calcularResumoMensal(regs, cfg, mes, ano)
  const resumoAnual = calcularResumoAnual(regs, cfg, ano)
  const registroHoje = regs.find(r => r.data === hoje)
  const resumoHoje   = registroHoje ? calcularResumo(registroHoje, cfg) : null

  const ultimosDias = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dataStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const reg = regs.find(r => r.data === dataStr)
    ultimosDias.push({
      label: getDiaSemanaCurto(dataStr) + ' ' + formatarDataCurta(dataStr),
      bancoHoras: reg ? calcularResumo(reg, cfg).bancoHoras : 0
    })
  }

  const mesesAnuais = resumoAnual.meses.map(m => ({
    label: getNomeMes(m.mes - 1).substring(0, 3),
    totalMinutosTrabalhados: m.totalMinutosTrabalhados
  }))

  const saudacao = getSaudacao()
  const nome = session.user.name?.split(' ')[0] || 'usuário'
  const bancoMesCls = resumoMes.totalBancoHoras >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400'

  return (
    <div className="py-4 space-y-5">

      {/* Banner de saudação */}
      <div className="relative overflow-hidden bg-linear-to-br from-indigo-500 via-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <p className="text-indigo-200 text-sm">
            {saudacao}, <strong>{nome}</strong>!
          </p>
          <h2 className="text-xl font-bold mt-1">{getMesAno(hoje)}</h2>
          {cfg.nomeEmpresa && (
            <p className="text-indigo-200 text-xs mt-2 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              {cfg.nomeEmpresa}
            </p>
          )}
        </div>
      </div>

      {/* Grid de estatísticas */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Dias trabalhados"
          value={resumoMes.totalDias}
          subtitle="no mês"
          color="indigo"
          accent="indigo"
        />
        <StatCard
          title="Horas trabalhadas"
          value={formatarDuracao(resumoMes.totalMinutosTrabalhados)}
          subtitle="no mês"
          color="indigo"
          accent="indigo"
        />
        <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 stat-accent-${resumoMes.totalBancoHoras >= 0 ? 'green' : 'rose'}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide leading-none">Banco de horas</p>
          <p className={`text-xl font-bold mt-1 leading-tight ${bancoMesCls}`}>
            {formatarDuracao(resumoMes.totalBancoHoras, true)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">no mês</p>
        </div>
        <StatCard
          title="Valor extras"
          value={formatarMoeda(resumoMes.totalValorExtras)}
          subtitle="no mês"
          color="green"
          accent="green"
        />
      </div>

      {/* Hoje */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Hoje</h3>
            <p className="text-xs text-gray-400">{formatarDataLonga(hoje)}</p>
          </div>
          <Link
            href={registroHoje ? `/registrar?id=${registroHoje._id}` : '/registrar'}
            className="text-xs font-semibold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
          >
            {registroHoje ? 'Ver / Editar' : '+ Registrar'}
          </Link>
        </div>
        <div className="p-4">
          {resumoHoje ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{resumoHoje.incompleto ? 'Em andamento' : 'Trabalhado'}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{formatarDuracao(resumoHoje.horasTrabalhadas)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Banco</p>
                  <p className={`text-sm font-bold ${resumoHoje.incompleto ? 'text-gray-400 dark:text-gray-500' : resumoHoje.bancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {resumoHoje.incompleto ? '—' : formatarDuracao(resumoHoje.bancoHoras, true)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Extras</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{resumoHoje.incompleto ? '—' : formatarMoeda(resumoHoje.valorExtras)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {registroHoje.batidas.map((b, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                      i % 2 === 0
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    {i % 2 === 0 ? '▶' : '■'} {b}
                  </span>
                ))}
                {resumoHoje.incompleto && <span className="text-xs text-amber-500">⚠ Incompleto</span>}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum registro hoje</p>
              <Link
                href="/registrar"
                className="mt-2 inline-block text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Registrar agora →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Gráficos */}
      <Charts diasRecentes={ultimosDias} mesesAnuais={mesesAnuais} />

      {/* Resumo anual */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumo {ano}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Dias trabalhados</p>
            <p className="font-bold text-gray-900 dark:text-white">{resumoAnual.totalDias}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Horas trabalhadas</p>
            <p className="font-bold text-gray-900 dark:text-white">{formatarDuracao(resumoAnual.totalMinutosTrabalhados)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Banco de horas</p>
            <p className={`font-bold ${resumoAnual.totalBancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {formatarDuracao(resumoAnual.totalBancoHoras, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Valor extras (ano)</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatarMoeda(resumoAnual.totalValorExtras)}</p>
          </div>
        </div>
      </div>

    </div>
  )
}
