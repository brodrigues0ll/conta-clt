'use strict';

/* ═══════════════════════════════════════
   app.js — Aplicação principal
   ═══════════════════════════════════════ */

/* ─── ESTADO GLOBAL ─── */
const App = {
  pagina: 'dashboard',
  config: null,
  registros: [],
  charts: {},

  // Formulário de registro
  form: {
    id: null,
    data: '',
    batidas: ['', ''],
    observacao: ''
  },

  // Histórico
  hSearch: '',
  hMes: '',
  hAno: '',
  hOrdem: 'desc',
  hPagina: 1,
  hPorPagina: 10,

  // Calendário
  calMes: new Date().getMonth() + 1,
  calAno: new Date().getFullYear()
};

/* ─── INICIALIZAÇÃO ─── */

async function initApp() {
  // Registrar service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Carregar config e aplicar dark mode
  try {
    App.config = await getConfig();
    aplicarDarkMode(App.config.darkMode);
    atualizarHeaderSubtitle();
  } catch (e) {
    console.error('Falha ao carregar config:', e);
  }

  // Eventos globais
  document.getElementById('btn-dark-mode').addEventListener('click', toggleDarkMode);
  document.getElementById('modal-close').addEventListener('click', hideModal);
  document.getElementById('modal-backdrop').addEventListener('click', hideModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideModal();
  });

  // Navegação inferior
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Ir para dashboard
  await navigate('dashboard');
}

/* ─── DARK MODE ─── */

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  document.getElementById('icon-sun').classList.toggle('hidden', !isDark);
  document.getElementById('icon-moon').classList.toggle('hidden', isDark);
  if (App.config) {
    App.config.darkMode = isDark;
    saveConfig(App.config).catch(() => {});
  }
  // Recriar gráficos com nova paleta
  if (App.pagina === 'dashboard') {
    renderDashboardCharts();
  }
}

function aplicarDarkMode(dark) {
  document.documentElement.classList.toggle('dark', !!dark);
  document.getElementById('icon-sun').classList.toggle('hidden', !dark);
  document.getElementById('icon-moon').classList.toggle('hidden', !!dark);
}

/* ─── NAVEGAÇÃO ─── */

async function navigate(pagina, params = {}) {
  App.pagina = pagina;

  // Atualizar botões da nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const ativo = btn.dataset.page === pagina;
    btn.classList.toggle('text-primary-600', ativo);
    btn.classList.toggle('dark:text-primary-400', ativo);
    btn.classList.toggle('bg-primary-50', ativo);
    btn.classList.toggle('dark:bg-primary-900/20', ativo);
    btn.classList.toggle('text-gray-500', !ativo);
    btn.classList.toggle('dark:text-gray-400', !ativo);
  });

  _destroyCharts();
  showLoading('Carregando...');

  try {
    switch (pagina) {
      case 'dashboard':     await renderDashboard(); break;
      case 'registrar':     await renderRegistrar(params); break;
      case 'historico':     await renderHistorico(); break;
      case 'calendario':    await renderCalendario(); break;
      case 'configuracoes': await renderConfiguracoes(); break;
      default:              await renderDashboard();
    }
    // Animação de entrada
    document.getElementById('main-content').querySelector(':scope > *')?.classList.add('page-enter');
  } catch (err) {
    console.error('Erro ao navegar:', err);
    showToast('Erro ao carregar página.', 'error');
  } finally {
    hideLoading();
  }
}

function _destroyCharts() {
  Object.values(App.charts).forEach(c => { try { c?.destroy(); } catch(e){} });
  App.charts = {};
}

/* ─── UTILITÁRIOS DE UI ─── */

function atualizarHeaderSubtitle() {
  const el = document.getElementById('header-subtitle');
  if (el && App.config) {
    el.textContent = App.config.nomeFuncionario || 'CLT';
  }
}

function isDark() {
  return document.documentElement.classList.contains('dark');
}

function _chartColors() {
  return {
    text:    isDark() ? '#9ca3af' : '#6b7280',
    grid:    isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    primary: 'rgba(99,102,241,',
    green:   'rgba(16,185,129,',
    amber:   'rgba(245,158,11,'
  };
}

/* ════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════ */

async function renderDashboard() {
  const [config, registros] = await Promise.all([getConfig(), getAllRegistros()]);
  App.config   = config;
  App.registros = registros;

  const hoje    = getDataHoje();
  const mesAtual = getMesAtual();
  const anoAtual = getAnoAtual();

  const resumoMes  = calcularResumoMensal(registros, config, mesAtual, anoAtual);
  const resumoAno  = calcularResumoAnual(registros, config, anoAtual);
  const regHoje    = registros.find(r => r.data === hoje);
  const resumoHoje = regHoje ? calcularResumo(regHoje, config) : null;

  const bancoMesCls = resumoMes.totalExtrasMinutos >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400';

  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="p-4 space-y-5">

      <!-- Banner de saudação -->
      <div class="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg">
        <div class="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full"></div>
        <div class="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full"></div>
        <div class="relative z-10">
          <p class="text-indigo-200 text-sm">${escapeHTML(getSaudacao())}, <strong>${escapeHTML(config.nomeFuncionario || 'usuário')}</strong>!</p>
          <h2 class="text-xl font-bold mt-1">${getMesAno(hoje)}</h2>
          ${config.nomeEmpresa ? `
            <p class="text-indigo-200 text-xs mt-2 flex items-center gap-1.5">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              ${escapeHTML(config.nomeEmpresa)}
            </p>` : ''}
        </div>
      </div>

      <!-- Grid de estatísticas mensais -->
      <div class="grid grid-cols-2 gap-3">
        ${renderStatCard({ label: 'Dias trabalhados', value: resumoMes.totalDias, sub: 'no mês', accent: 'indigo' })}
        ${renderStatCard({ label: 'Horas trabalhadas', value: formatarDuracao(resumoMes.totalMinutosTrabalhados), sub: 'no mês', accent: 'indigo' })}
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 stat-accent-${resumoMes.totalExtrasMinutos >= 0 ? 'green' : 'rose'}">
          <p class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide leading-none">Banco de horas</p>
          <p class="text-xl font-bold ${bancoMesCls} mt-1 leading-tight">
            ${formatarDuracao(resumoMes.totalExtrasMinutos, true)}
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">no mês</p>
        </div>
        ${renderStatCard({ label: 'Valor extras', value: formatarMoeda(resumoMes.totalValorExtras), sub: 'no mês', accent: 'green' })}
      </div>

      <!-- Hoje -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white text-sm">Hoje</h3>
            <p class="text-xs text-gray-400">${formatarDataLonga(hoje)}</p>
          </div>
          <button
            onclick="navigate('registrar')"
            class="text-xs font-semibold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
          >${regHoje ? 'Ver / Editar' : '+ Registrar'}</button>
        </div>
        <div class="p-4">
          ${resumoHoje ? `
            <div class="grid grid-cols-3 gap-3 mb-3">
              <div class="text-center">
                <p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Trabalhado</p>
                <p class="text-sm font-bold text-gray-900 dark:text-white">${formatarDuracao(resumoHoje.horasTrabalhadas)}</p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Banco</p>
                <p class="text-sm font-bold ${resumoHoje.bancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}">
                  ${formatarDuracao(resumoHoje.bancoHoras, true)}
                </p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Extras</p>
                <p class="text-sm font-bold text-indigo-600 dark:text-indigo-400">${formatarMoeda(resumoHoje.valorExtras)}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              ${(regHoje.batidas || []).map((b, i) => `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                  ${i % 2 === 0
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}">
                  ${i % 2 === 0 ? '▶' : '■'} ${b}
                </span>
              `).join('')}
              ${resumoHoje.incompleto ? '<span class="text-xs text-amber-500">⚠ Incompleto</span>' : ''}
            </div>
          ` : `
            <div class="text-center py-4">
              <p class="text-sm text-gray-400 dark:text-gray-500">Nenhum registro hoje</p>
              <button onclick="navigate('registrar')"
                class="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Registrar agora →
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Gráfico: últimos 14 dias -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Últimos 14 dias</h3>
        <div style="height:180px;position:relative">
          <canvas id="chart-dias"></canvas>
        </div>
      </div>

      <!-- Gráfico: mensal do ano -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Horas por mês — ${anoAtual}</h3>
        <div style="height:180px;position:relative">
          <canvas id="chart-mensal"></canvas>
        </div>
      </div>

      <!-- Resumo anual -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumo ${anoAtual}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-xs text-gray-400 dark:text-gray-500">Dias trabalhados</p>
            <p class="font-bold text-gray-900 dark:text-white">${resumoAno.totalDias}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 dark:text-gray-500">Horas trabalhadas</p>
            <p class="font-bold text-gray-900 dark:text-white">${formatarDuracao(resumoAno.totalMinutosTrabalhados)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 dark:text-gray-500">Banco de horas</p>
            <p class="font-bold ${resumoAno.totalExtrasMinutos >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}">
              ${formatarDuracao(resumoAno.totalExtrasMinutos, true)}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 dark:text-gray-500">Valor extras (ano)</p>
            <p class="font-bold text-emerald-600 dark:text-emerald-400">${formatarMoeda(resumoAno.totalValorExtras)}</p>
          </div>
        </div>
      </div>

    </div>
  `;

  renderDashboardCharts();
}

function renderDashboardCharts() {
  _destroyCharts();
  const cc = _chartColors();

  // Gráfico de barras — últimos 14 dias
  const hoje = new Date();
  const dias = [];
  for (let i = 13; i >= 0; i--) {
    const d   = new Date(hoje);
    d.setDate(d.getDate() - i);
    const ds  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const reg = App.registros.find(r => r.data === ds);
    dias.push({
      label: formatarDataCurta(ds),
      min:   reg ? calcularHorasTrabalhadas(reg.batidas || []) : 0
    });
  }

  const jornadaH = App.config?.jornadaDiaria || 8;
  const ctx1 = document.getElementById('chart-dias');
  if (ctx1) {
    App.charts.dias = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: dias.map(d => d.label),
        datasets: [{
          label: 'Horas',
          data:  dias.map(d => +(d.min / 60).toFixed(2)),
          backgroundColor: dias.map(d => d.min / 60 > jornadaH
            ? `${cc.primary}0.8)` : `${cc.primary}0.45)`),
          borderColor:     dias.map(d => d.min / 60 > jornadaH
            ? `${cc.primary}1)` : `${cc.primary}0.7)`),
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: _barOptions(cc, jornadaH + 2, v => `${v}h`)
    });
  }

  // Gráfico de barras — mensal do ano
  const anoAtual = getAnoAtual();
  const mesesData = [];
  for (let m = 1; m <= 12; m++) {
    const r = calcularResumoMensal(App.registros, App.config, m, anoAtual);
    mesesData.push({
      mes:    getNomeMes(m - 1).substring(0, 3),
      horas:  +(r.totalMinutosTrabalhados / 60).toFixed(1),
      extras: +(Math.max(0, r.totalExtrasMinutos) / 60).toFixed(1)
    });
  }

  const ctx2 = document.getElementById('chart-mensal');
  if (ctx2) {
    App.charts.mensal = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: mesesData.map(m => m.mes),
        datasets: [
          {
            label: 'Trabalhadas',
            data:  mesesData.map(m => m.horas),
            backgroundColor: `${cc.primary}0.55)`,
            borderColor:     `${cc.primary}0.9)`,
            borderWidth: 1, borderRadius: 4, borderSkipped: false
          },
          {
            label: 'Extras',
            data:  mesesData.map(m => m.extras),
            backgroundColor: `${cc.green}0.55)`,
            borderColor:     `${cc.green}0.9)`,
            borderWidth: 1, borderRadius: 4, borderSkipped: false
          }
        ]
      },
      options: {
        ..._barOptions(cc, null, v => `${v}h`),
        plugins: {
          legend: {
            display: true,
            labels: { color: cc.text, font: { size: 10 }, boxWidth: 12, padding: 10 }
          }
        }
      }
    });
  }
}

function _barOptions(cc, suggestedMax, tickFmt) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: ctx => tickFmt ? tickFmt(ctx.raw) : ctx.raw }
      }
    },
    scales: {
      x: {
        ticks: { color: cc.text, font: { size: 10 } },
        grid:  { color: cc.grid }
      },
      y: {
        ticks: { color: cc.text, font: { size: 10 }, callback: tickFmt },
        grid:  { color: cc.grid },
        beginAtZero: true,
        suggestedMax: suggestedMax || undefined
      }
    }
  };
}

/* ════════════════════════════════════════
   REGISTRAR DIA
   ════════════════════════════════════════ */

async function renderRegistrar(params = {}) {
  const [config, todos] = await Promise.all([getConfig(), getAllRegistros()]);
  App.config   = config;
  App.registros = todos;

  // Determinar estado inicial do formulário
  if (params.id) {
    const reg = await getRegistroById(params.id);
    if (reg) {
      App.form = { id: reg.id, data: reg.data, batidas: [...(reg.batidas || [])], observacao: reg.observacao || '' };
    }
  } else if (params.data) {
    const existente = await getRegistroByData(params.data);
    if (existente) {
      App.form = { id: existente.id, data: existente.data, batidas: [...(existente.batidas || [])], observacao: existente.observacao || '' };
    } else {
      App.form = { id: null, data: params.data, batidas: ['', ''], observacao: '' };
    }
  } else {
    // Hoje
    const existente = await getRegistroByData(getDataHoje());
    if (existente && !params.novo) {
      App.form = { id: existente.id, data: existente.data, batidas: [...(existente.batidas || [])], observacao: existente.observacao || '' };
    } else {
      App.form = { id: null, data: getDataHoje(), batidas: ['', ''], observacao: '' };
    }
  }

  _renderFormRegistro(config);
}

function _renderFormRegistro(config) {
  const edicao = !!App.form.id;

  document.getElementById('main-content').innerHTML = `
    <div class="p-4 space-y-4">

      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">
          ${edicao ? 'Editar Registro' : 'Novo Registro'}
        </h2>
        ${edicao ? `
          <button onclick="_excluirRegistroAtual()"
            class="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Excluir
          </button>` : ''}
      </div>

      <!-- Data -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">

        <div>
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Data
          </label>
          <input
            type="date"
            id="input-data"
            value="${App.form.data}"
            class="input-base"
          />
        </div>

        <!-- Batidas -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Horários de ponto
            </label>
            <button
              id="btn-add-batida"
              onclick="adicionarBatida()"
              class="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400
                     px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30
                     hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Adicionar
            </button>
          </div>
          <div id="batidas-list" class="space-y-2"></div>
        </div>

        <!-- Preview -->
        <div id="preview-calculo" class="hidden bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 border border-indigo-100 dark:border-indigo-800">
          <p class="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 uppercase tracking-wide">Prévia do dia</p>
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center">
              <p class="text-xs text-indigo-600/70 dark:text-indigo-400/70">Trabalhado</p>
              <p id="prev-trabalhado" class="text-sm font-bold text-indigo-700 dark:text-indigo-300">--:--</p>
            </div>
            <div class="text-center">
              <p class="text-xs text-indigo-600/70 dark:text-indigo-400/70">Banco</p>
              <p id="prev-banco" class="text-sm font-bold">--:--</p>
            </div>
            <div class="text-center">
              <p class="text-xs text-indigo-600/70 dark:text-indigo-400/70">Total</p>
              <p id="prev-extras" class="text-sm font-bold text-indigo-700 dark:text-indigo-300">R$ --</p>
            </div>
          </div>
          <div id="prev-alertas-clt" class="hidden mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-indigo-100 dark:border-indigo-800"></div>
        </div>

        <!-- Observação -->
        <div>
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Observação <span class="font-normal normal-case">(opcional)</span>
          </label>
          <textarea
            id="input-obs"
            rows="2"
            placeholder="Ex.: Trabalhei em home office, saí mais cedo..."
            class="input-base resize-none"
          >${escapeHTML(App.form.observacao)}</textarea>
        </div>

      </div>

      <!-- Botões de ação -->
      <div class="flex gap-3">
        <button
          onclick="navigate('historico')"
          class="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold
                 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >Cancelar</button>
        <button
          onclick="salvarRegistro()"
          class="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold
                 transition-colors shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
        >${edicao ? 'Salvar Alterações' : 'Salvar Registro'}</button>
      </div>

      ${edicao ? `
        <div class="text-center">
          <button
            onclick="_duplicarRegistroAtual()"
            class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >Duplicar este registro para outra data</button>
        </div>` : ''}

    </div>
  `;

  // Renderizar batidas
  _renderBatidasList();

  // Listener na data para verificar existente
  document.getElementById('input-data').addEventListener('change', async (e) => {
    const nova = e.target.value;
    if (!nova || nova === App.form.data) return;

    // Verificar se já existe registro para esta data
    if (nova !== App.form.data) {
      const existente = await getRegistroByData(nova);
      if (existente && existente.id !== App.form.id) {
        showToast(`Já existe um registro para ${formatarData(nova)}. Ele será carregado.`, 'info');
        App.form = { id: existente.id, data: existente.data, batidas: [...(existente.batidas || [])], observacao: existente.observacao || '' };
        _renderFormRegistro(App.config);
        return;
      }
    }
    App.form.data = nova;
  });
}

function _renderBatidasList() {
  const container = document.getElementById('batidas-list');
  if (!container) return;

  if (App.form.batidas.length === 0) {
    container.innerHTML = `
      <p class="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
        Nenhum horário adicionado. Clique em "+ Adicionar".
      </p>`;
    _atualizarPreview();
    return;
  }

  container.innerHTML = App.form.batidas.map((b, i) => `
    <div class="batida-enter flex items-center gap-2" data-idx="${i}">
      <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-24 shrink-0
        ${i % 2 === 0
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}">
        <span>${i % 2 === 0 ? '▶' : '■'}</span>
        <span>${i % 2 === 0 ? 'Entrada' : 'Saída'}</span>
      </div>
      <input
        type="time"
        value="${escapeHTML(b)}"
        data-idx="${i}"
        class="batida-input input-base flex-1 text-center font-mono text-lg py-2"
        placeholder="--:--"
        oninput="atualizarBatida(${i}, this.value)"
      />
      <button
        onclick="removerBatida(${i})"
        class="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50
               dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
        title="Remover horário"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');

  _atualizarPreview();
}

function adicionarBatida() {
  App.form.batidas.push('');
  _renderBatidasList();
  // Focar no novo input
  setTimeout(() => {
    const inputs = document.querySelectorAll('.batida-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function removerBatida(idx) {
  App.form.batidas.splice(idx, 1);
  _renderBatidasList();
}

function atualizarBatida(idx, valor) {
  App.form.batidas[idx] = valor;
  _atualizarPreview();
}

function _atualizarPreview() {
  const batidas = App.form.batidas.filter(b => b && validarFormatoHora(b));
  const preview = document.getElementById('preview-calculo');
  if (!preview) return;

  if (batidas.length < 2) {
    preview.classList.add('hidden');
    return;
  }

  preview.classList.remove('hidden');
  const resumo = calcularResumo({ batidas, data: App.form.data }, App.config || {});

  document.getElementById('prev-trabalhado').textContent = formatarDuracao(resumo.horasTrabalhadas);

  const bancoEl = document.getElementById('prev-banco');
  bancoEl.textContent = formatarDuracao(resumo.bancoHoras, true);
  bancoEl.className   = `text-sm font-bold ${resumo.bancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`;

  document.getElementById('prev-extras').textContent = formatarMoeda(resumo.totalDia);

  // Alertas CLT
  const alertas = [];
  if (resumo.isFeriado)           alertas.push(`🎉 ${resumo.nomeFeriado}`);
  else if (resumo.isDomingo)      alertas.push('☀️ Domingo (+adicional)');
  else if (resumo.isSabado)       alertas.push('📅 Sábado (+adicional)');
  if (resumo.minutosNoturnos > 0) alertas.push(`🌙 Noturno: ${formatarDuracao(resumo.minutosNoturnos)}`);
  if (resumo.alertaHoraExtraCLT) alertas.push('🚨 Excedeu 2h extras (Art. 59)');
  if (resumo.alertaIntrajornada)  alertas.push(`⚠ Pausa insuficiente (faltam ${resumo.alertaIntrajornada.faltam}min)`);

  const alertasEl = document.getElementById('prev-alertas-clt');
  if (alertasEl) {
    alertasEl.innerHTML = alertas.length
      ? alertas.map(a => `<span class="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs">${escapeHTML(a)}</span>`).join('')
      : '';
    alertasEl.classList.toggle('hidden', alertas.length === 0);
  }
}

async function salvarRegistro() {
  // Sincronizar data da input
  const dataInput = document.getElementById('input-data');
  const obsInput  = document.getElementById('input-obs');
  if (dataInput) App.form.data = dataInput.value;
  if (obsInput)  App.form.observacao = obsInput.value.trim();

  // Validar data
  if (!App.form.data || !validarFormatoData(App.form.data)) {
    showToast('Data inválida. Selecione uma data válida.', 'error');
    return;
  }

  // Pegar apenas batidas preenchidas
  const batidas = App.form.batidas.filter(b => b && b.trim());

  if (batidas.length === 0) {
    showToast('Adicione pelo menos um horário de ponto.', 'error');
    return;
  }

  // Validar batidas
  const erros = validarBatidas(batidas);

  // Erros críticos (formato, ordem, duplicatas)
  const errosCriticos = erros.filter(e => !e.includes('ímpar'));
  if (errosCriticos.length > 0) {
    showModal({
      title: 'Erros nos horários',
      body: `
        <ul class="space-y-2">
          ${errosCriticos.map(e => `
            <li class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
              <span class="shrink-0 mt-0.5">⚠</span>
              <span>${escapeHTML(e)}</span>
            </li>
          `).join('')}
        </ul>
      `
    });
    return;
  }

  // Aviso de número ímpar (incompleto) — pede confirmação
  const errosAviso = erros.filter(e => e.includes('ímpar'));
  if (errosAviso.length > 0) {
    showConfirm({
      title: 'Registro incompleto',
      message: `${errosAviso[0]} Deseja salvar mesmo assim?`,
      confirmText: 'Salvar assim mesmo',
      confirmClass: 'bg-amber-500 hover:bg-amber-600',
      onConfirm: () => _salvarRegistroConfirmado(batidas)
    });
    return;
  }

  await _salvarRegistroConfirmado(batidas);
}

async function _salvarRegistroConfirmado(batidas) {
  try {
    showLoading('Salvando...');

    // Verificar conflito de data (outro registro)
    const existente = await getRegistroByData(App.form.data);
    if (existente && existente.id !== App.form.id) {
      showToast('Já existe um registro para esta data!', 'error');
      return;
    }

    const registro = {
      id:         App.form.id || undefined,
      data:       App.form.data,
      batidas:    batidas.sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b)),
      observacao: App.form.observacao
    };

    await saveRegistro(registro);
    showToast(App.form.id ? 'Registro atualizado!' : 'Registro salvo!', 'success');
    App.form = { id: null, data: getDataHoje(), batidas: ['', ''], observacao: '' };
    await navigate('historico');
  } catch (err) {
    showToast(`Erro ao salvar: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function _excluirRegistroAtual() {
  if (!App.form.id) return;
  showConfirm({
    title: 'Excluir registro',
    message: `Excluir o registro de ${formatarData(App.form.data)}? Esta ação não pode ser desfeita.`,
    confirmText: 'Excluir',
    onConfirm: async () => {
      try {
        await deleteRegistro(App.form.id);
        showToast('Registro excluído.', 'success');
        App.form = { id: null, data: getDataHoje(), batidas: ['', ''], observacao: '' };
        await navigate('historico');
      } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
      }
    }
  });
}

async function _duplicarRegistroAtual() {
  showModal({
    title: 'Duplicar para outra data',
    body: `
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Selecione a data de destino para os mesmos horários de <strong>${formatarData(App.form.data)}</strong>.
      </p>
      <input type="date" id="dup-data" class="input-base" value="${getDataHoje()}"/>
    `,
    footer: `
      <button onclick="hideModal()"
        class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium
               text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button id="btn-dup-confirm"
        class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
        Duplicar
      </button>
    `
  });

  setTimeout(() => {
    document.getElementById('btn-dup-confirm')?.addEventListener('click', async () => {
      const novaData = document.getElementById('dup-data')?.value;
      if (!novaData || !validarFormatoData(novaData)) {
        showToast('Data inválida.', 'error'); return;
      }
      const existente = await getRegistroByData(novaData);
      if (existente) {
        showToast(`Já existe registro para ${formatarData(novaData)}.`, 'error'); return;
      }
      hideModal();
      await saveRegistro({ data: novaData, batidas: [...App.form.batidas.filter(b => b)], observacao: App.form.observacao });
      showToast('Registro duplicado!', 'success');
      await navigate('historico');
    });
  }, 0);
}

/* ════════════════════════════════════════
   HISTÓRICO
   ════════════════════════════════════════ */

async function renderHistorico() {
  const [config, registros] = await Promise.all([getConfig(), getAllRegistros()]);
  App.config    = config;
  App.registros = registros;

  // Extrair anos disponíveis para filtro
  const anos = [...new Set(registros.map(r => r.data.split('-')[0]))].sort((a, b) => b - a);

  document.getElementById('main-content').innerHTML = `
    <div class="p-4 space-y-4">

      <h2 class="text-lg font-bold text-gray-900 dark:text-white">Histórico</h2>

      <!-- Busca e filtros -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
        <!-- Busca -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
               fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            id="h-search"
            value="${escapeHTML(App.hSearch)}"
            placeholder="Pesquisar por data ou observação..."
            class="input-base pl-9"
          />
        </div>

        <!-- Filtros -->
        <div class="grid grid-cols-3 gap-2">
          <select id="h-mes" class="input-base text-sm py-2 col-span-1">
            <option value="">Todos os meses</option>
            ${MESES.map((m, i) => `
              <option value="${String(i+1).padStart(2,'0')}"
                ${App.hMes === String(i+1).padStart(2,'0') ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
          <select id="h-ano" class="input-base text-sm py-2 col-span-1">
            <option value="">Todos os anos</option>
            ${anos.map(a => `<option value="${a}" ${App.hAno === a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
          <select id="h-ordem" class="input-base text-sm py-2 col-span-1">
            <option value="desc" ${App.hOrdem === 'desc' ? 'selected' : ''}>Mais recente</option>
            <option value="asc"  ${App.hOrdem === 'asc'  ? 'selected' : ''}>Mais antigo</option>
          </select>
        </div>
      </div>

      <!-- Lista -->
      <div id="historico-content"></div>

    </div>
  `;

  _bindHistoricoEvents();
  _renderHistoricoLista();
}

function _bindHistoricoEvents() {
  const busca   = debounce(() => { App.hSearch = document.getElementById('h-search')?.value || ''; App.hPagina = 1; _renderHistoricoLista(); }, 300);
  const filtrar = () => {
    App.hMes   = document.getElementById('h-mes')?.value  || '';
    App.hAno   = document.getElementById('h-ano')?.value  || '';
    App.hOrdem = document.getElementById('h-ordem')?.value || 'desc';
    App.hPagina = 1;
    _renderHistoricoLista();
  };
  document.getElementById('h-search')?.addEventListener('input',  busca);
  document.getElementById('h-mes')?.addEventListener('change',    filtrar);
  document.getElementById('h-ano')?.addEventListener('change',    filtrar);
  document.getElementById('h-ordem')?.addEventListener('change',  filtrar);
}

function _filtrarRegistros(registros) {
  let lista = [...registros];

  if (App.hSearch) {
    const q = App.hSearch.toLowerCase();
    lista = lista.filter(r =>
      formatarData(r.data).includes(q) ||
      formatarDataLonga(r.data).toLowerCase().includes(q) ||
      (r.observacao || '').toLowerCase().includes(q) ||
      (r.batidas || []).some(b => b.includes(q))
    );
  }

  if (App.hMes) lista = lista.filter(r => r.data.split('-')[1] === App.hMes);
  if (App.hAno) lista = lista.filter(r => r.data.startsWith(App.hAno));

  lista.sort((a, b) => App.hOrdem === 'asc'
    ? a.data.localeCompare(b.data)
    : b.data.localeCompare(a.data));

  return lista;
}

function _renderHistoricoLista() {
  const container = document.getElementById('historico-content');
  if (!container) return;

  const filtrados = _filtrarRegistros(App.registros);
  const total     = filtrados.length;
  const inicio    = (App.hPagina - 1) * App.hPorPagina;
  const pagina    = filtrados.slice(inicio, inicio + App.hPorPagina);

  if (total === 0) {
    container.innerHTML = renderEmptyState({
      icon: '📋',
      title: 'Nenhum registro encontrado',
      description: App.hSearch || App.hMes || App.hAno
        ? 'Tente ajustar os filtros de busca.'
        : 'Comece registrando seu primeiro dia de trabalho.',
      action: (!App.hSearch && !App.hMes && !App.hAno) ? {
        label: 'Registrar dia',
        onclick: "navigate('registrar')"
      } : null
    });
    return;
  }

  container.innerHTML = `
    <p class="text-xs text-gray-400 dark:text-gray-500 px-1">
      ${total} registro${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}
    </p>
    <div class="space-y-3">
      ${pagina.map(reg => _renderHistoricoCard(reg)).join('')}
    </div>
    ${renderPaginacao({ total, pagina: App.hPagina, porPagina: App.hPorPagina, onChange: (p) => { App.hPagina = p; _renderHistoricoLista(); } })}
  `;
}

function _renderHistoricoCard(registro) {
  const resumo     = calcularResumo(registro, App.config || {});
  const bancoPos   = resumo.bancoHoras >= 0;
  const incompleto = resumo.incompleto;
  const batidas    = registro.batidas || [];

  // Badges CLT
  const badgesCLT = [];
  if (resumo.isFeriado)
    badgesCLT.push(`<span class="chip bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">🎉 ${escapeHTML(resumo.nomeFeriado)}</span>`);
  else if (resumo.isDomingo)
    badgesCLT.push(`<span class="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">☀️ Domingo</span>`);
  else if (resumo.isSabado)
    badgesCLT.push(`<span class="chip bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">📅 Sábado</span>`);
  if (resumo.minutosNoturnos > 0)
    badgesCLT.push(`<span class="chip bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">🌙 ${formatarDuracao(resumo.minutosNoturnos)}</span>`);
  if (resumo.alertaHoraExtraCLT)
    badgesCLT.push(`<span class="chip bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">🚨 &gt;2h extras</span>`);
  if (resumo.alertaIntrajornada)
    badgesCLT.push(`<span class="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">⚠ Pausa insuf.</span>`);

  const statusCls  = incompleto
    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    : bancoPos
      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  const bancoCls  = incompleto
    ? 'text-amber-600 dark:text-amber-400'
    : bancoPos
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-500 dark:text-red-400';

  return `
    <div class="history-card card-hover">
      <div class="flex items-start justify-between px-4 pt-4 pb-2">
        <div>
          <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">${getDiaSemana(registro.data)}</p>
          <h3 class="text-base font-bold text-gray-900 dark:text-white">${formatarData(registro.data)}</h3>
          ${registro.observacao ? `<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[200px]">${escapeHTML(registro.observacao)}</p>` : ''}
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-400 dark:text-gray-500">${incompleto ? '⚠ incompleto' : 'banco de horas'}</p>
          <p class="text-base font-bold ${bancoCls}">${formatarDuracao(resumo.bancoHoras, true)}</p>
        </div>
      </div>

      <!-- Batidas -->
      <div class="px-4 pb-3">
        <div class="flex flex-wrap gap-1.5 mb-3">
          ${batidas.map((b, i) => `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
              ${i % 2 === 0
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800'}">
              ${i % 2 === 0 ? '▶' : '■'} ${b}
            </span>
          `).join('')}
          ${batidas.length === 0 ? '<span class="text-xs text-gray-400">Sem batidas</span>' : ''}
        </div>

        <!-- Stats linha -->
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p class="text-xs text-gray-400 dark:text-gray-500">Trabalhado</p>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">${formatarDuracao(resumo.horasTrabalhadas)}</p>
          </div>
          <div class="text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p class="text-xs text-gray-400 dark:text-gray-500">Extras</p>
            <p class="text-sm font-semibold ${bancoCls}">${formatarDuracao(resumo.horasExtras, true)}</p>
          </div>
          <div class="text-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p class="text-xs text-gray-400 dark:text-gray-500">${(App.config || {}).exibirTotalDia !== false ? 'Total' : 'Extras'}</p>
            <p class="text-sm font-semibold text-emerald-600 dark:text-emerald-400">${formatarMoeda((App.config || {}).exibirTotalDia !== false ? resumo.totalDia : resumo.valorExtras)}</p>
          </div>
        </div>

        ${badgesCLT.length > 0 ? `
          <div class="flex flex-wrap gap-1.5 mb-3">${badgesCLT.join('')}</div>
        ` : ''}

        <!-- Ações -->
        <div class="flex gap-2">
          <button
            onclick="navigate('registrar', { id: '${escapeHTML(registro.id)}' })"
            class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold
                   text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30
                   hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Editar
          </button>
          <button
            onclick="_iniciarDuplicarRegistro('${escapeHTML(registro.id)}')"
            class="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold
                   text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700
                   hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
            title="Duplicar"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            Duplicar
          </button>
          <button
            onclick="_confirmarExcluirRegistro('${escapeHTML(registro.id)}', '${escapeHTML(registro.data)}')"
            class="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold
                   text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20
                   hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Excluir"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Excluir
          </button>
        </div>
      </div>
    </div>
  `;
}

async function _confirmarExcluirRegistro(id, data) {
  showConfirm({
    title: 'Excluir registro',
    message: `Excluir o registro de ${formatarData(data)}? Esta ação não pode ser desfeita.`,
    confirmText: 'Excluir',
    onConfirm: async () => {
      try {
        await deleteRegistro(id);
        App.registros = App.registros.filter(r => r.id !== id);
        showToast('Registro excluído.', 'success');
        _renderHistoricoLista();
      } catch (err) {
        showToast(`Erro: ${err.message}`, 'error');
      }
    }
  });
}

async function _iniciarDuplicarRegistro(id) {
  const reg = App.registros.find(r => r.id === id);
  if (!reg) return;

  showModal({
    title: 'Duplicar registro',
    body: `
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Duplicar os horários de <strong>${formatarData(reg.data)}</strong> para:
      </p>
      <input type="date" id="dup-data2" class="input-base" value="${getDataHoje()}"/>
    `,
    footer: `
      <button onclick="hideModal()"
        class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium
               text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button id="btn-dup2-confirm"
        class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
        Duplicar
      </button>
    `
  });

  setTimeout(() => {
    document.getElementById('btn-dup2-confirm')?.addEventListener('click', async () => {
      const novaData = document.getElementById('dup-data2')?.value;
      if (!novaData || !validarFormatoData(novaData)) { showToast('Data inválida.', 'error'); return; }
      const existente = await getRegistroByData(novaData);
      if (existente) { showToast(`Já existe registro para ${formatarData(novaData)}.`, 'error'); return; }
      hideModal();
      const novo = await saveRegistro({ data: novaData, batidas: [...(reg.batidas || [])], observacao: reg.observacao || '' });
      App.registros.push(novo);
      showToast('Registro duplicado!', 'success');
      _renderHistoricoLista();
    });
  }, 0);
}

/* ════════════════════════════════════════
   CALENDÁRIO
   ════════════════════════════════════════ */

async function renderCalendario() {
  const [config, registros] = await Promise.all([getConfig(), getAllRegistros()]);
  App.config    = config;
  App.registros = registros;

  document.getElementById('main-content').innerHTML = `
    <div class="p-4 space-y-4">
      <div id="cal-header"></div>
      <div id="cal-grid-wrapper"></div>
      <div id="cal-resumo"></div>
    </div>
  `;

  _renderCalMes();
}

function _renderCalMes() {
  const mes  = App.calMes;
  const ano  = App.calAno;
  const hoje = getDataHoje();

  const total    = diasNoMes(mes, ano);
  const primeiro = primeiroDiaSemana(mes, ano);
  const prefix   = `${ano}-${String(mes).padStart(2,'0')}`;

  // Índice de registros do mês
  const regDoMes  = App.registros.filter(r => r.data.startsWith(prefix));
  const regPorDia = {};
  regDoMes.forEach(r => { regPorDia[r.data] = r; });

  // Resumo mensal
  const resumoMes = calcularResumoMensal(App.registros, App.config, mes, ano);
  const bancoMesCls = resumoMes.totalExtrasMinutos >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  // Header
  document.getElementById('cal-header').innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between px-4 py-3">
        <button onclick="_navCalendario(-1)"
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2 class="text-base font-bold text-gray-900 dark:text-white">
          ${getNomeMes(mes - 1)} ${ano}
        </h2>
        <button onclick="_navCalendario(1)"
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Calendário
  const diasSemanaHeader = DIAS_SEMANA_CURTO.map(d =>
    `<div class="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">${d}</div>`
  ).join('');

  const celulas = [];
  // Dias vazios antes do primeiro
  for (let i = 0; i < primeiro; i++) {
    celulas.push(`<div class="cal-day cal-day-empty opacity-0"></div>`);
  }

  // Dias do mês
  for (let d = 1; d <= total; d++) {
    const ds      = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const reg     = regPorDia[ds];
    const isHoje  = ds === hoje;
    const temReg  = !!reg;

    let cls = 'cal-day';
    let extra = '';

    if (isHoje) cls += ' cal-day-today';
    else if (temReg) cls += ' cal-day-has-record';

    if (temReg) {
      const res = calcularResumo(reg, App.config);
      if (res.bancoHoras > 0)      cls += ' cal-day-extra-pos';
      else if (res.bancoHoras < 0) cls += ' cal-day-extra-neg';
    }

    celulas.push(`
      <div class="${cls}" onclick="_abrirDiaCalendario('${ds}')">
        <span class="text-xs">${d}</span>
        ${temReg ? `<span class="w-1 h-1 rounded-full mt-0.5 ${isHoje ? 'bg-white/70' : 'bg-indigo-400 dark:bg-indigo-500'}"></span>` : ''}
      </div>
    `);
  }

  document.getElementById('cal-grid-wrapper').innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-700">
      <div class="grid grid-cols-7 mb-1">${diasSemanaHeader}</div>
      <div class="grid grid-cols-7 gap-1">${celulas.join('')}</div>
      <div class="mt-3 flex items-center justify-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Horas extras
        </div>
        <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span class="w-2 h-2 rounded-full bg-red-400"></span> Déficit
        </div>
        <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span class="w-2 h-2 rounded-full bg-indigo-400"></span> Normal
        </div>
      </div>
    </div>
  `;

  // Resumo do mês
  document.getElementById('cal-resumo').innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumo de ${getNomeMes(mes - 1)}</h3>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <p class="text-xs text-gray-400 dark:text-gray-500">Dias registrados</p>
          <p class="font-bold text-gray-900 dark:text-white">${resumoMes.totalDias}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400 dark:text-gray-500">Horas trabalhadas</p>
          <p class="font-bold text-gray-900 dark:text-white">${formatarDuracao(resumoMes.totalMinutosTrabalhados)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400 dark:text-gray-500">Banco de horas</p>
          <p class="font-bold ${bancoMesCls}">${formatarDuracao(resumoMes.totalExtrasMinutos, true)}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400 dark:text-gray-500">Valor extras</p>
          <p class="font-bold text-emerald-600 dark:text-emerald-400">${formatarMoeda(resumoMes.totalValorExtras)}</p>
        </div>
      </div>
    </div>
  `;
}

function _navCalendario(delta) {
  let mes = App.calMes + delta;
  let ano = App.calAno;

  if (mes > 12) { mes = 1;  ano++; }
  if (mes < 1)  { mes = 12; ano--; }

  App.calMes = mes;
  App.calAno = ano;
  _renderCalMes();
}

async function _abrirDiaCalendario(dataStr) {
  const reg = await getRegistroByData(dataStr);
  if (reg) {
    showModal({
      title: formatarDataLonga(dataStr),
      body: _renderDetalhesDia(reg, App.config),
      footer: `
        <button onclick="hideModal(); navigate('registrar', { id: '${reg.id}' })"
          class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
          Editar registro
        </button>
      `
    });
  } else {
    showConfirm({
      title: formatarDataLonga(dataStr),
      message: 'Não há registro para este dia. Deseja registrá-lo agora?',
      confirmText: 'Registrar',
      confirmClass: 'bg-indigo-600 hover:bg-indigo-700',
      onConfirm: () => navigate('registrar', { data: dataStr })
    });
  }
}

function _renderDetalhesDia(registro, config) {
  const resumo   = calcularResumo(registro, config);
  const bancoCls = resumo.bancoHoras >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  const badgesCLT = [];
  if (resumo.isFeriado)            badgesCLT.push(`<span class="chip bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">🎉 ${escapeHTML(resumo.nomeFeriado)}</span>`);
  else if (resumo.isDomingo)       badgesCLT.push(`<span class="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">☀️ Domingo</span>`);
  else if (resumo.isSabado)        badgesCLT.push(`<span class="chip bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">📅 Sábado</span>`);
  if (resumo.minutosNoturnos > 0)  badgesCLT.push(`<span class="chip bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">🌙 Noturno: ${formatarDuracao(resumo.minutosNoturnos)}</span>`);
  if (resumo.alertaHoraExtraCLT)   badgesCLT.push(`<span class="chip bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">🚨 &gt;2h extras (Art. 59)</span>`);
  if (resumo.alertaIntrajornada)    badgesCLT.push(`<span class="chip bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">⚠ Pausa insuf. (faltam ${resumo.alertaIntrajornada.faltam}min)</span>`);

  return `
    <div class="space-y-4">
      ${badgesCLT.length > 0 ? `<div class="flex flex-wrap gap-1.5">${badgesCLT.join('')}</div>` : ''}
      <!-- Batidas -->
      <div>
        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Horários</p>
        <div class="flex flex-wrap gap-2">
          ${(registro.batidas || []).map((b, i) => `
            <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold
              ${i % 2 === 0
                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'}">
              ${i % 2 === 0 ? '▶ Entrada' : '■ Saída'}: ${b}
            </span>
          `).join('')}
        </div>
      </div>
      <!-- Cálculos -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">Horas trabalhadas</p>
          <p class="font-bold text-gray-900 dark:text-white">${formatarDuracao(resumo.horasTrabalhadas)}</p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">Banco de horas</p>
          <p class="font-bold ${bancoCls}">${formatarDuracao(resumo.bancoHoras, true)}</p>
        </div>
        ${resumo.valorNoturno > 0 ? `
          <div class="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3">
            <p class="text-xs text-gray-400 dark:text-gray-500">Adicional noturno</p>
            <p class="font-bold text-indigo-600 dark:text-indigo-400">${formatarMoeda(resumo.valorNoturno)}</p>
          </div>
        ` : `
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
            <p class="text-xs text-gray-400 dark:text-gray-500">Valor hora extra</p>
            <p class="font-bold text-gray-900 dark:text-white">${formatarMoeda(resumo.valorHoraExtra)}</p>
          </div>
        `}
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">Total do dia</p>
          <p class="font-bold text-emerald-600 dark:text-emerald-400">${formatarMoeda(resumo.totalDia)}</p>
        </div>
        ${resumo.valorDomingo > 0 ? `
          <div class="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 col-span-2">
            <p class="text-xs text-gray-400 dark:text-gray-500">Adicional ${resumo.isFeriado ? 'feriado' : 'dominical'}</p>
            <p class="font-bold text-purple-600 dark:text-purple-400">${formatarMoeda(resumo.valorDomingo)}</p>
          </div>
        ` : ''}
      </div>
      ${registro.observacao ? `
        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
          <p class="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">Observação</p>
          <p class="text-sm text-gray-700 dark:text-gray-300">${escapeHTML(registro.observacao)}</p>
        </div>
      ` : ''}
      ${resumo.incompleto ? `
        <p class="text-xs text-amber-500 text-center">⚠ Registro incompleto (número ímpar de batidas)</p>
      ` : ''}
    </div>
  `;
}

/* ════════════════════════════════════════
   CONFIGURAÇÕES
   ════════════════════════════════════════ */

async function renderConfiguracoes() {
  const [config, backups] = await Promise.all([getConfig(), getAllBackups()]);
  App.config = config;

  document.getElementById('main-content').innerHTML = `
    <div class="p-4 space-y-5">

      <h2 class="text-lg font-bold text-gray-900 dark:text-white">Configurações</h2>

      <!-- Dados pessoais -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">
          👤 Dados pessoais
        </h3>
        <div>
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Nome do funcionário
          </label>
          <input type="text" id="cfg-nome-funcionario" value="${escapeHTML(config.nomeFuncionario || '')}"
            placeholder="Seu nome completo" class="input-base"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Nome da empresa
          </label>
          <input type="text" id="cfg-nome-empresa" value="${escapeHTML(config.nomeEmpresa || '')}"
            placeholder="Nome da empresa" class="input-base"/>
        </div>
      </div>

      <!-- Trabalho -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">
          💼 Configurações de trabalho
        </h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Salário mensal
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
              <input type="number" id="cfg-salario" value="${config.salario || ''}"
                min="0" step="0.01" placeholder="0,00" class="input-base pl-9"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Horas mensais
            </label>
            <input type="number" id="cfg-horas-mensais" value="${config.horasMensais || 220}"
              min="1" max="400" class="input-base"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Jornada diária (h)
            </label>
            <input type="number" id="cfg-jornada" value="${config.jornadaDiaria || 8}"
              min="1" max="24" step="0.5" class="input-base"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Adicional h.e. (%)
            </label>
            <div class="relative">
              <input type="number" id="cfg-percentual" value="${config.percentualHoraExtra ?? 50}"
                min="0" max="200" class="input-base pr-8"/>
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
        </div>
        <!-- Preview do valor da hora -->
        <div id="preview-valor-hora" class="text-xs text-gray-400 dark:text-gray-500 text-center"></div>
      </div>

      <!-- Exibição -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">
          🖥️ Exibição
        </h3>
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">Valor mostrado no histórico</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">
              <strong>Total do dia</strong> inclui normais + extras + noturno + adicional. <strong>Só extras</strong> mostra apenas o valor das horas extras.
            </p>
          </div>
          <div class="shrink-0">
            <select id="cfg-exibir-total-dia" class="input-base text-sm py-1.5">
              <option value="total" ${config.exibirTotalDia !== false ? 'selected' : ''}>Total do dia</option>
              <option value="extras" ${config.exibirTotalDia === false ? 'selected' : ''}>Só extras</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Regras CLT -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">
          ⚖️ Regras CLT
        </h3>

        <!-- Tolerância hora extra -->
        <div>
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Tolerância de hora extra (minutos)
          </label>
          <input type="number" id="cfg-tolerancia" value="${config.toleranciaHoraExtra ?? 0}"
            min="0" max="60" step="5" class="input-base"/>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Extras abaixo desse limite não são pagas, mas entram no banco de horas.
          </p>
        </div>

        <!-- Sábado como hora extra -->
        <div class="rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">
          <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Sábado (regime 40h/sem)</p>

          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Todas as horas entram no banco</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Sábado = dia de folga → horas extras positivas</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" id="cfg-sabado-hora-extra" class="sr-only peer" ${config.sabadoHoraExtra !== false ? 'checked' : ''}/>
              <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Adicional de pagamento</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Percentual extra sobre as horas trabalhadas</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <input type="number" id="cfg-pct-sabado" value="${config.percentualAdicionalSabado ?? 50}"
                min="0" max="500" class="input-base w-16 text-center text-sm py-1.5" ${config.adicionalSabado !== false ? '' : 'disabled'}/>
              <span class="text-xs text-gray-400">%</span>
              <label class="relative inline-flex items-center cursor-pointer ml-1">
                <input type="checkbox" id="cfg-adicional-sabado" class="sr-only peer" ${config.adicionalSabado !== false ? 'checked' : ''}
                  onchange="document.getElementById('cfg-pct-sabado').disabled=!this.checked"/>
                <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Domingo como hora extra -->
        <div class="rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">
          <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Domingo (Art. 67 CLT)</p>

          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Todas as horas entram no banco</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Domingo = DSR → horas extras positivas</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" id="cfg-domingo-hora-extra" class="sr-only peer" ${config.domingoHoraExtra !== false ? 'checked' : ''}/>
              <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Adicional dominical (Art. 67)</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Percentual extra sobre as horas trabalhadas</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <input type="number" id="cfg-pct-domingo" value="${config.percentualAdicionalDomingo ?? 100}"
                min="0" max="500" class="input-base w-16 text-center text-sm py-1.5" ${config.adicionalDomingo !== false ? '' : 'disabled'}/>
              <span class="text-xs text-gray-400">%</span>
              <label class="relative inline-flex items-center cursor-pointer ml-1">
                <input type="checkbox" id="cfg-adicional-domingo" class="sr-only peer" ${config.adicionalDomingo !== false ? 'checked' : ''}
                  onchange="document.getElementById('cfg-pct-domingo').disabled=!this.checked"/>
                <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Feriados -->
        <div class="rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-3 bg-gray-50/50 dark:bg-gray-700/20">
          <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Feriados (Art. 67 CLT)</p>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Adicional em feriados</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Nacional + Carnaval + Corpus Christi + Páscoa</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <input type="number" id="cfg-pct-feriado" value="${config.percentualAdicionalFeriado ?? 100}"
                min="0" max="500" class="input-base w-16 text-center text-sm py-1.5" ${config.adicionalFeriado !== false ? '' : 'disabled'}/>
              <span class="text-xs text-gray-400">%</span>
              <label class="relative inline-flex items-center cursor-pointer ml-1">
                <input type="checkbox" id="cfg-adicional-feriado" class="sr-only peer" ${config.adicionalFeriado !== false ? 'checked' : ''}
                  onchange="document.getElementById('cfg-pct-feriado').disabled=!this.checked"/>
                <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Adicional noturno -->
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">Adicional noturno (Art. 73)</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">Horas entre 22h e 05h com percentual extra</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <input type="number" id="cfg-pct-noturno" value="${config.percentualAdicionalNoturno ?? 20}"
              min="0" max="100" class="input-base w-16 text-center text-sm py-1.5" ${config.calcularNoturno !== false ? '' : 'disabled'}/>
            <span class="text-xs text-gray-400">%</span>
            <label class="relative inline-flex items-center cursor-pointer ml-1">
              <input type="checkbox" id="cfg-calcular-noturno" class="sr-only peer" ${config.calcularNoturno !== false ? 'checked' : ''}
                onchange="document.getElementById('cfg-pct-noturno').disabled=!this.checked"/>
              <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        <!-- Hora noturna reduzida -->
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">Hora noturna reduzida</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">52min30s = 1h noturna — crédito extra no banco</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" id="cfg-hora-noturna-reduzida" class="sr-only peer" ${config.horaNoturnaReduzida !== false ? 'checked' : ''}/>
            <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <!-- Alertar intrajornada -->
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">Alertar intrajornada (Art. 71)</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">&gt;6h → pausa mínima 1h · &gt;4h → pausa mínima 15min</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" id="cfg-verificar-intrajornada" class="sr-only peer" ${config.verificarIntrajornada !== false ? 'checked' : ''}/>
            <div class="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      <!-- Botão salvar -->
      <button onclick="salvarConfiguracoes()"
        class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm
               transition-colors shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
        Salvar Configurações
      </button>

      <!-- Importar Folha de Ponto RFP -->
      <div class="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20
                  rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800 space-y-3">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center shrink-0 text-lg">
            📋
          </div>
          <div>
            <h3 class="text-sm font-bold text-indigo-900 dark:text-indigo-300">Importar Folha de Ponto</h3>
            <p class="text-xs text-indigo-700/70 dark:text-indigo-400/80 mt-0.5">
              Importa automaticamente o arquivo <strong>.xls</strong> do sistema de ponto
              (RFP_DETALHADO). Extrai todas as datas, entradas e saídas de cada período.
            </p>
          </div>
        </div>
        <button
          onclick="document.getElementById('input-import-rfp').click()"
          class="w-full flex items-center justify-center gap-2 py-3 px-4
                 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold
                 transition-colors shadow-md shadow-indigo-300 dark:shadow-indigo-900/50"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
          </svg>
          Selecionar arquivo RFP (.xls)
        </button>
        <input type="file" id="input-import-rfp" accept=".xls,.xlsx" class="hidden"/>
      </div>

      <!-- Dados -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">
          📦 Exportar / Importar dados
        </h3>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="exportarJSON()"
            class="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-50 dark:bg-blue-900/20
                   text-blue-700 dark:text-blue-400 rounded-xl text-xs font-semibold
                   hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100 dark:border-blue-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Exportar JSON
          </button>
          <button onclick="exportarCSV()"
            class="flex items-center justify-center gap-2 py-2.5 px-3 bg-green-50 dark:bg-green-900/20
                   text-green-700 dark:text-green-400 rounded-xl text-xs font-semibold
                   hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors border border-green-100 dark:border-green-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Exportar CSV
          </button>
          <button onclick="exportarExcel()"
            class="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-50 dark:bg-emerald-900/20
                   text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold
                   hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-100 dark:border-emerald-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Excel (.xlsx)
          </button>
          <button onclick="document.getElementById('input-import-json').click()"
            class="flex items-center justify-center gap-2 py-2.5 px-3 bg-violet-50 dark:bg-violet-900/20
                   text-violet-700 dark:text-violet-400 rounded-xl text-xs font-semibold
                   hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors border border-violet-100 dark:border-violet-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
            </svg>
            Importar JSON
          </button>
        </div>
        <input type="file" id="input-import-json" accept=".json" class="hidden"/>
      </div>

      <!-- Backups -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">💾 Backups</h3>
          <button onclick="_criarBackupInterface()"
            class="text-xs font-semibold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400
                   rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
            + Criar backup
          </button>
        </div>
        <div id="lista-backups">
          ${_renderListaBackups(backups)}
        </div>
      </div>

      <!-- Zona de perigo -->
      <div class="bg-red-50 dark:bg-red-900/10 rounded-2xl p-4 border border-red-200 dark:border-red-900 space-y-3">
        <h3 class="text-sm font-semibold text-red-700 dark:text-red-400">⚠ Zona de perigo</h3>
        <button onclick="_confirmarLimparDados()"
          class="w-full py-2.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold
                 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          Apagar todos os registros
        </button>
      </div>

    </div>
  `;

  // Listener importar JSON
  document.getElementById('input-import-json')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showLoading('Importando...');
    try {
      await importarJSON(file);
      App.registros = await getAllRegistros();
    } finally {
      hideLoading();
      e.target.value = '';
    }
  });

  // Listener importar Folha de Ponto RFP (.xls)
  document.getElementById('input-import-rfp')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    showLoading('Lendo planilha...');
    let registros;
    try {
      registros = await importarRFP(file);
    } catch (err) {
      hideLoading();
      showToast(`Erro ao ler planilha: ${err.message}`, 'error');
      return;
    }
    hideLoading();

    if (!registros || registros.length === 0) {
      showToast('Nenhum registro encontrado na planilha.', 'warning');
      return;
    }

    _mostrarPreviewRFP(registros);
  });

  // Preview valor hora ao alterar campos
  const atualizarPreviewHora = () => {
    const salario  = parseFloat(document.getElementById('cfg-salario')?.value || 0);
    const horasM   = parseFloat(document.getElementById('cfg-horas-mensais')?.value || 220);
    const percentual = parseFloat(document.getElementById('cfg-percentual')?.value || 50);
    const el       = document.getElementById('preview-valor-hora');
    if (!el) return;
    if (salario > 0 && horasM > 0) {
      const vh  = salario / horasM;
      const vhe = vh * (1 + percentual / 100);
      el.textContent = `Valor/hora: ${formatarMoeda(vh)} | Valor hora extra: ${formatarMoeda(vhe)}`;
    } else {
      el.textContent = '';
    }
  };
  ['cfg-salario','cfg-horas-mensais','cfg-percentual'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', atualizarPreviewHora);
  });
  atualizarPreviewHora();
}

function _renderListaBackups(backups) {
  if (!backups.length) {
    return `<p class="text-xs text-gray-400 dark:text-gray-500 text-center py-3">Nenhum backup criado ainda.</p>`;
  }
  return backups.map(b => `
    <div class="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div class="min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">${escapeHTML(b.nome)}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500">
          ${formatarDataHoraISO(b.criadoEm)} · ${b.totalRegistros || 0} registros
          ${b.tamanho ? ` · ${formatarBytes(b.tamanho)}` : ''}
        </p>
      </div>
      <div class="flex gap-1.5 shrink-0 ml-2">
        <button
          onclick="_restaurarBackupInterface('${escapeHTML(b.id)}')"
          class="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400
                 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-medium">
          Restaurar
        </button>
        <button
          onclick="_excluirBackup('${escapeHTML(b.id)}')"
          class="text-xs px-2 py-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
          ×
        </button>
      </div>
    </div>
  `).join('');
}

async function salvarConfiguracoes() {
  const salario    = parseFloat(document.getElementById('cfg-salario')?.value || 0);
  const horasM     = parseFloat(document.getElementById('cfg-horas-mensais')?.value || 220);
  const jornada    = parseFloat(document.getElementById('cfg-jornada')?.value || 8);
  const percentual = parseFloat(document.getElementById('cfg-percentual')?.value || 50);
  const nomeFun    = document.getElementById('cfg-nome-funcionario')?.value.trim() || '';
  const nomeEmp    = document.getElementById('cfg-nome-empresa')?.value.trim() || '';

  if (isNaN(salario) || salario < 0) { showToast('Salário inválido.', 'error'); return; }
  if (isNaN(horasM)  || horasM <= 0) { showToast('Horas mensais inválidas.', 'error'); return; }
  if (isNaN(jornada) || jornada <= 0 || jornada > 24) { showToast('Jornada diária inválida.', 'error'); return; }

  // Exibição
  const exibirTotalDia = document.getElementById('cfg-exibir-total-dia')?.value !== 'extras';

  // Campos CLT
  const tolerancia         = parseInt(document.getElementById('cfg-tolerancia')?.value || 0);
  const sabadoHoraExtra    = document.getElementById('cfg-sabado-hora-extra')?.checked !== false;
  const adicionalSabado    = document.getElementById('cfg-adicional-sabado')?.checked !== false;
  const pctSabado          = parseFloat(document.getElementById('cfg-pct-sabado')?.value || 50);
  const domingoHoraExtra   = document.getElementById('cfg-domingo-hora-extra')?.checked !== false;
  const adicionalDomingo   = document.getElementById('cfg-adicional-domingo')?.checked !== false;
  const pctDomingo         = parseFloat(document.getElementById('cfg-pct-domingo')?.value || 100);
  const adicionalFeriado   = document.getElementById('cfg-adicional-feriado')?.checked !== false;
  const pctFeriado         = parseFloat(document.getElementById('cfg-pct-feriado')?.value || 100);
  const calcularNoturno    = document.getElementById('cfg-calcular-noturno')?.checked !== false;
  const pctNoturno         = parseFloat(document.getElementById('cfg-pct-noturno')?.value || 20);
  const horaNReduzida      = document.getElementById('cfg-hora-noturna-reduzida')?.checked !== false;
  const verificarIntra     = document.getElementById('cfg-verificar-intrajornada')?.checked !== false;

  const novo = Object.assign({}, App.config, {
    salario, horasMensais: horasM, jornadaDiaria: jornada,
    percentualHoraExtra: percentual, nomeFuncionario: nomeFun, nomeEmpresa: nomeEmp,
    exibirTotalDia,
    toleranciaHoraExtra: tolerancia,
    sabadoHoraExtra,  adicionalSabado,  percentualAdicionalSabado: pctSabado,
    domingoHoraExtra, adicionalDomingo, percentualAdicionalDomingo: pctDomingo,
    adicionalFeriado,  percentualAdicionalFeriado: pctFeriado,
    calcularNoturno,   percentualAdicionalNoturno: pctNoturno,
    horaNoturnaReduzida: horaNReduzida,
    verificarIntrajornada: verificarIntra
  });

  try {
    App.config = await saveConfig(novo);
    atualizarHeaderSubtitle();
    showToast('Configurações salvas!', 'success');
  } catch (err) {
    showToast(`Erro ao salvar: ${err.message}`, 'error');
  }
}

async function _criarBackupInterface() {
  showModal({
    title: 'Criar backup',
    body: `
      <div>
        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          Nome do backup (opcional)
        </label>
        <input type="text" id="backup-nome" class="input-base" placeholder="Meu backup de ${new Date().toLocaleDateString('pt-BR')}"/>
      </div>
    `,
    footer: `
      <button onclick="hideModal()"
        class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium
               text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button id="btn-salvar-backup"
        class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
        Criar
      </button>
    `
  });

  setTimeout(() => {
    document.getElementById('btn-salvar-backup')?.addEventListener('click', async () => {
      const nome = document.getElementById('backup-nome')?.value.trim() || null;
      hideModal();
      showLoading('Criando backup...');
      try {
        await criarBackup(nome);
        const backups = await getAllBackups();
        const lista   = document.getElementById('lista-backups');
        if (lista) lista.innerHTML = _renderListaBackups(backups);
      } finally {
        hideLoading();
      }
    });
  }, 0);
}

async function _restaurarBackupInterface(id) {
  const backups = await getAllBackups();
  const backup  = backups.find(b => b.id === id);
  if (!backup) return;

  showConfirm({
    title: 'Restaurar backup',
    message: `Restaurar "${backup.nome}"? Os registros atuais serão substituídos. Esta ação não pode ser desfeita.`,
    confirmText: 'Restaurar',
    confirmClass: 'bg-indigo-600 hover:bg-indigo-700',
    onConfirm: async () => {
      showLoading('Restaurando...');
      try {
        await restaurarBackup(backup);
        App.registros = await getAllRegistros();
        App.config    = await getConfig();
        atualizarHeaderSubtitle();
      } finally {
        hideLoading();
      }
    }
  });
}

async function _excluirBackup(id) {
  showConfirm({
    title: 'Excluir backup',
    message: 'Excluir este backup permanentemente?',
    confirmText: 'Excluir',
    onConfirm: async () => {
      await deleteBackupById(id);
      const backups = await getAllBackups();
      const lista   = document.getElementById('lista-backups');
      if (lista) lista.innerHTML = _renderListaBackups(backups);
      showToast('Backup excluído.', 'success');
    }
  });
}

function _confirmarLimparDados() {
  showConfirm({
    title: 'Apagar todos os registros',
    message: 'Todos os registros serão apagados permanentemente. Considere criar um backup antes. Esta ação não pode ser desfeita!',
    confirmText: 'Apagar tudo',
    onConfirm: async () => {
      showLoading('Apagando...');
      try {
        await limparRegistros();
        App.registros = [];
        showToast('Todos os registros foram apagados.', 'warning');
      } finally {
        hideLoading();
      }
    }
  });
}

/* ════════════════════════════════════════
   IMPORTAR FOLHA DE PONTO RFP — PREVIEW
   ════════════════════════════════════════ */

function _mostrarPreviewRFP(registros) {
  // Estatísticas do arquivo
  const total     = registros.length;
  const datas     = registros.map(r => r.data).sort();
  const primeira  = datas[0];
  const ultima    = datas[datas.length - 1];

  // Detectar conflitos com registros existentes
  const existentes    = new Set(App.registros.map(r => r.data));
  const conflitos     = registros.filter(r => existentes.has(r.data));
  const novos         = registros.filter(r => !existentes.has(r.data));
  const temConflitos  = conflitos.length > 0;

  // Agrupar por mês para exibição
  const porMes = {};
  registros.forEach(r => {
    const chave = r.data.substring(0, 7); // "YYYY-MM"
    if (!porMes[chave]) porMes[chave] = [];
    porMes[chave].push(r);
  });

  const listaPreview = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mesAno, regs]) => {
      const [ano, mes] = mesAno.split('-');
      const nomeMes    = getNomeMes(parseInt(mes) - 1);
      return `
        <div class="mb-3">
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            ${nomeMes} ${ano} — ${regs.length} dia${regs.length !== 1 ? 's' : ''}
          </p>
          <div class="space-y-1">
            ${regs.map(r => {
              const conflito = existentes.has(r.data);
              return `
                <div class="flex items-center gap-2 py-1 px-2.5 rounded-lg text-xs
                  ${conflito
                    ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                    : 'bg-gray-50 dark:bg-gray-700/50'}">
                  ${conflito
                    ? '<span class="text-amber-500 shrink-0" title="Já existe registro para esta data">⚠</span>'
                    : '<span class="text-emerald-500 shrink-0">✓</span>'}
                  <span class="font-medium text-gray-700 dark:text-gray-300 w-20 shrink-0">
                    ${formatarData(r.data)}
                  </span>
                  <span class="text-gray-400 dark:text-gray-500 text-xs truncate">
                    ${getDiaSemanaCurto(r.data)} · ${r.batidas.join(' → ')}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

  showModal({
    title: 'Importar Folha de Ponto',
    size: 'lg',
    body: `
      <div class="space-y-4">

        <!-- Resumo -->
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center">
            <p class="text-xl font-bold text-indigo-600 dark:text-indigo-400">${total}</p>
            <p class="text-xs text-indigo-500 dark:text-indigo-500 mt-0.5">dias encontrados</p>
          </div>
          <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400">${novos.length}</p>
            <p class="text-xs text-emerald-500 dark:text-emerald-500 mt-0.5">novos registros</p>
          </div>
          <div class="bg-${temConflitos ? 'amber' : 'gray'}-50 dark:bg-${temConflitos ? 'amber' : 'gray'}-900/20 rounded-xl p-3 text-center">
            <p class="text-xl font-bold text-${temConflitos ? 'amber' : 'gray'}-600 dark:text-${temConflitos ? 'amber' : 'gray'}-400">${conflitos.length}</p>
            <p class="text-xs text-${temConflitos ? 'amber' : 'gray'}-500 dark:text-${temConflitos ? 'amber' : 'gray'}-500 mt-0.5">já existem</p>
          </div>
        </div>

        <!-- Período -->
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span>Período: <strong class="text-gray-700 dark:text-gray-300">${formatarData(primeira)}</strong>
            até <strong class="text-gray-700 dark:text-gray-300">${formatarData(ultima)}</strong></span>
        </div>

        ${temConflitos ? `
          <!-- Aviso de conflito -->
          <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
            <p class="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠ ${conflitos.length} conflito${conflitos.length !== 1 ? 's' : ''} detectado${conflitos.length !== 1 ? 's' : ''}</p>
            <p class="text-xs text-amber-600 dark:text-amber-500">
              Escolha abaixo se quer <strong>substituir</strong> os registros existentes pelos dados da planilha,
              ou <strong>ignorar</strong> as datas que já têm registro e importar apenas os novos.
            </p>
          </div>

          <!-- Opção de modo -->
          <div class="space-y-2">
            <label class="flex items-start gap-3 p-3 border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl cursor-pointer">
              <input type="radio" name="rfp-modo" value="merge" checked class="mt-0.5 accent-indigo-600"/>
              <div>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">Importar apenas novos</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Importa ${novos.length} registro${novos.length !== 1 ? 's' : ''} novo${novos.length !== 1 ? 's' : ''} e mantém os ${conflitos.length} existente${conflitos.length !== 1 ? 's' : ''} sem alterar.
                </p>
              </div>
            </label>
            <label class="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <input type="radio" name="rfp-modo" value="replace" class="mt-0.5 accent-indigo-600"/>
              <div>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">Substituir todos</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Importa todos os ${total} registros, sobrescrevendo os ${conflitos.length} existente${conflitos.length !== 1 ? 's' : ''}.
                </p>
              </div>
            </label>
          </div>
        ` : ''}

        <!-- Lista de registros -->
        <div>
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Registros a importar
          </p>
          <div class="max-h-64 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/30">
            ${listaPreview}
          </div>
        </div>

      </div>
    `,
    footer: `
      <button onclick="hideModal()"
        class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium
               text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        Cancelar
      </button>
      <button id="btn-confirmar-rfp"
        class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
        Importar ${novos.length > 0 ? novos.length : total} registros
      </button>
    `
  });

  // Atualizar texto do botão ao mudar o modo
  setTimeout(() => {
    document.querySelectorAll('[name="rfp-modo"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const modo = document.querySelector('[name="rfp-modo"]:checked')?.value || 'merge';
        const btn  = document.getElementById('btn-confirmar-rfp');
        if (btn) {
          btn.textContent = modo === 'replace'
            ? `Importar ${total} registros (substituir)`
            : `Importar ${novos.length} novos registros`;
        }
      });
    });

    document.getElementById('btn-confirmar-rfp')?.addEventListener('click', async () => {
      const modo = document.querySelector('[name="rfp-modo"]:checked')?.value || 'merge';
      hideModal();
      await _executarImportacaoRFP(registros, modo);
    });
  }, 0);
}

async function _executarImportacaoRFP(registros, modo) {
  showLoading('Importando registros...');
  try {
    // Criar backup automático antes de importar
    await criarBackup(`Antes da importação RFP — ${formatarDataHoraISO(new Date().toISOString())}`);

    let paraImportar = registros;

    if (modo === 'merge') {
      // Apenas os que NÃO existem no banco
      const existentes = new Set(App.registros.map(r => r.data));
      paraImportar = registros.filter(r => !existentes.has(r.data));
    }

    if (paraImportar.length === 0) {
      showToast('Nenhum registro novo para importar.', 'info');
      return;
    }

    await importarRegistros(paraImportar);
    App.registros = await getAllRegistros();

    showToast(`${paraImportar.length} registros importados com sucesso!`, 'success');

    // Ir para o histórico para ver os registros importados
    await navigate('historico');
  } catch (err) {
    showToast(`Erro ao importar: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}

/* ─── INICIAR ─── */
document.addEventListener('DOMContentLoaded', initApp);
