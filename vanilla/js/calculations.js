'use strict';

/* ═══════════════════════════════════════
   calculations.js — Cálculos de horas e valores (CLT completo)
   ═══════════════════════════════════════ */

/* ─── FERIADOS NACIONAIS FIXOS ─── */

const FERIADOS_FIXOS = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalhador',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Sra. Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal'
};

/* Algoritmo de Meeus/Jones/Butcher para calcular a Páscoa */
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function _addDias(date, dias) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + dias));
}

function _dateToStr(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/* Feriados móveis baseados na Páscoa */
function getFeriadosMoveis(ano) {
  const pascoa = calcularPascoa(ano);
  return {
    [_dateToStr(_addDias(pascoa, -48))]: 'Segunda de Carnaval',
    [_dateToStr(_addDias(pascoa, -47))]: 'Terça de Carnaval',
    [_dateToStr(_addDias(pascoa, -2))]:  'Sexta-feira Santa',
    [_dateToStr(pascoa)]:                'Páscoa',
    [_dateToStr(_addDias(pascoa, 60))]:  'Corpus Christi'
  };
}

const _cacheMoveis = {};
function _getMoveis(ano) {
  if (!_cacheMoveis[ano]) _cacheMoveis[ano] = getFeriadosMoveis(ano);
  return _cacheMoveis[ano];
}

/* Retorna o nome do feriado ou null */
function getFeriado(dataStr, feriadosPersonalizados) {
  if (!dataStr) return null;
  const mmdd   = dataStr.substring(5);
  const ano    = parseInt(dataStr.substring(0, 4));
  const moveis = _getMoveis(ano);

  if (FERIADOS_FIXOS[mmdd])  return FERIADOS_FIXOS[mmdd];
  if (moveis[dataStr])       return moveis[dataStr];

  const custom = (feriadosPersonalizados || []).find(f => f.data === dataStr);
  if (custom) return custom.nome || 'Feriado';

  return null;
}

function isDomingo(dataStr) {
  return parseDataLocal(dataStr).getDay() === 0;
}

function isSabado(dataStr) {
  return parseDataLocal(dataStr).getDay() === 6;
}

/* ─── HORAS TRABALHADAS ─── */

function calcularHorasTrabalhadas(batidas) {
  if (!batidas || batidas.length < 2) return 0;
  const validas   = batidas.filter(b => b && validarFormatoHora(b));
  const ordenadas = [...validas].sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b));
  let total = 0;
  for (let i = 0; i + 1 < ordenadas.length; i += 2) {
    const entrada = horaParaMinutos(ordenadas[i]);
    const saida   = horaParaMinutos(ordenadas[i + 1]);
    if (saida > entrada) total += saida - entrada;
  }
  return total;
}

/* ─── MINUTOS EM HORÁRIO NOTURNO 22h–05h (Art. 73 CLT) ─── */

function calcularMinutosNoturnos(batidas) {
  if (!batidas || batidas.length < 2) return 0;
  const validas   = batidas.filter(b => b && validarFormatoHora(b));
  const ordenadas = [...validas].sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b));

  let totalNoturnos = 0;

  for (let i = 0; i + 1 < ordenadas.length; i += 2) {
    const entrada = horaParaMinutos(ordenadas[i]);
    const saida   = horaParaMinutos(ordenadas[i + 1]);
    if (saida <= entrada) continue;

    // Interseção com 22:00–24:00
    const n1ini = Math.max(entrada, 1320);
    const n1fim = Math.min(saida, 1440);
    if (n1fim > n1ini) totalNoturnos += n1fim - n1ini;

    // Interseção com 00:00–05:00
    const n2ini = Math.max(entrada, 0);
    const n2fim = Math.min(saida, 300);
    if (n2fim > n2ini) totalNoturnos += n2fim - n2ini;
  }

  return totalNoturnos;
}

/* ─── ANÁLISE DE INTRAJORNADA (Art. 71 CLT) ─── */

function analisarIntrajornada(batidas, totalMinutosTrabalhados) {
  if (!batidas || batidas.length < 2) return null;
  const validas = batidas.filter(b => b && validarFormatoHora(b));
  if (validas.length < 2) return null;
  const ordenadas = [...validas].sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b));

  const periodoTotal = horaParaMinutos(ordenadas[ordenadas.length - 1]) - horaParaMinutos(ordenadas[0]);
  const pausaTotal   = periodoTotal - totalMinutosTrabalhados;

  if (totalMinutosTrabalhados > 360) {
    // >6h → pausa mínima 60min
    const faltam = 60 - pausaTotal;
    if (faltam > 0) return { tipo: 'longa', minPausa: 60, pausaReal: pausaTotal, faltam };
  } else if (totalMinutosTrabalhados > 240) {
    // >4h ≤6h → pausa mínima 15min
    const faltam = 15 - pausaTotal;
    if (faltam > 0) return { tipo: 'curta', minPausa: 15, pausaReal: pausaTotal, faltam };
  }

  return null;
}

/* ─── HELPERS DE VALOR ─── */

function calcularValorHora(salario, horasMensais) {
  if (!salario || !horasMensais || horasMensais <= 0) return 0;
  return salario / horasMensais;
}

function calcularValorHoraExtra(valorHora, percentual) {
  return valorHora * (1 + (percentual || 50) / 100);
}

/* ─── RESUMO COMPLETO CLT ─── */

function calcularResumo(registro, config) {
  const batidas          = registro.batidas || [];
  const dataStr          = registro.data    || '';
  const horasTrabalhadas = calcularHorasTrabalhadas(batidas);
  const jornadaBase      = (config.jornadaDiaria || 8) * 60;
  const tolerancia       = config.toleranciaHoraExtra || 0;

  const valorHora      = calcularValorHora(config.salario || 0, config.horasMensais || 220);
  const pctExtra       = config.percentualHoraExtra ?? 50;
  const valorHoraExtra = calcularValorHoraExtra(valorHora, pctExtra);

  // Tipo do dia
  const feriadoNome = getFeriado(dataStr, config.feriadosPersonalizados);
  const ehDomingo   = dataStr ? isDomingo(dataStr) : false;
  const ehSabado    = dataStr ? isSabado(dataStr)  : false;
  const ehFeriado   = !!feriadoNome;

  // Jornada efetiva: sábado/domingo configurados como dia extra → jornadaMin = 0
  // (todas as horas entram no banco de horas como extras positivas)
  let jornadaMin = jornadaBase;
  if (ehSabado  && config.sabadoHoraExtra  !== false) jornadaMin = 0;
  if (ehDomingo && config.domingoHoraExtra !== false) jornadaMin = 0;

  // Horas extras e normais (com jornada efetiva)
  const horasExtrasMin  = horasTrabalhadas - jornadaMin;
  const horasNormaisMin = Math.min(horasTrabalhadas, jornadaMin);

  // Tolerância: extras positivos < tolerância → não paga (mas entra no banco)
  let extrasParaPagamento = Math.max(0, horasExtrasMin);
  if (tolerancia > 0 && extrasParaPagamento > 0 && extrasParaPagamento < tolerancia) {
    extrasParaPagamento = 0;
  }

  // ─── Noturno (Art. 73) ───
  let minutosNoturnos = 0;
  let valorNoturno    = 0;
  if (config.calcularNoturno !== false) {
    minutosNoturnos = calcularMinutosNoturnos(batidas);
    if (minutosNoturnos > 0) {
      const pctNoturno = config.percentualAdicionalNoturno ?? 20;
      valorNoturno = (minutosNoturnos / 60) * valorHora * (pctNoturno / 100);
    }
  }

  // Hora noturna reduzida: 52min30s = 1h noturna → crédito extra de ~7.5min/hora noturna
  let minutosNoturnoReduzido = 0;
  if (config.horaNoturnaReduzida !== false && minutosNoturnos > 0) {
    minutosNoturnoReduzido = Math.floor(minutosNoturnos / 7);
  }

  const bancoHoras = horasExtrasMin + minutosNoturnoReduzido;

  // ─── Sábado (Art. 59 / acordo coletivo) ───
  // Adicional de pagamento sobre as horas trabalhadas no sábado
  let valorSabado = 0;
  if (ehSabado && config.adicionalSabado !== false) {
    const pct = config.percentualAdicionalSabado ?? 50;
    valorSabado = (horasTrabalhadas / 60) * valorHora * (pct / 100);
  }

  // ─── Domingo / Feriado (Art. 67) ───
  // Adicional de pagamento sobre as horas trabalhadas
  let valorDomingo = 0;
  if (ehDomingo && config.adicionalDomingo !== false) {
    const pct = config.percentualAdicionalDomingo ?? 100;
    valorDomingo = (horasTrabalhadas / 60) * valorHora * (pct / 100);
  } else if (ehFeriado && config.adicionalFeriado !== false) {
    const pct = config.percentualAdicionalFeriado ?? 100;
    valorDomingo = (horasTrabalhadas / 60) * valorHora * (pct / 100);
  }

  // ─── Valores ───
  const valorHorasNormais = (horasNormaisMin / 60) * valorHora;
  const valorExtras       = (extrasParaPagamento / 60) * valorHoraExtra;
  const totalDia          = valorHorasNormais + valorExtras + valorNoturno + valorSabado + valorDomingo;

  // ─── Alertas CLT ───
  const alertaIntrajornada = config.verificarIntrajornada !== false
    ? analisarIntrajornada(batidas, horasTrabalhadas)
    : null;
  const alertaHoraExtraCLT = horasExtrasMin > 120; // >2h extras — Art. 59

  return {
    horasTrabalhadas,
    horasExtras:          horasExtrasMin,
    horasNormais:         horasNormaisMin,
    bancoHoras,
    extrasParaPagamento,

    valorHora,
    valorHoraExtra,
    valorHorasNormais,
    valorExtras,
    valorNoturno,
    valorSabado,
    valorDomingo,
    totalDia,

    isDomingo:   ehDomingo,
    isSabado:    ehSabado,
    isFeriado:   ehFeriado,
    nomeFeriado: feriadoNome,
    minutosNoturnos,

    alertaIntrajornada,
    alertaHoraExtraCLT,

    incompleto: batidas.filter(b => b).length % 2 !== 0
  };
}

/* ─── RESUMO MENSAL ─── */

function calcularResumoMensal(registros, config, mes, ano) {
  const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
  const doMes  = registros.filter(r => r.data.startsWith(prefix));

  let totalMinutosTrabalhados = 0;
  let totalExtrasMinutos      = 0;
  let totalBancoHoras         = 0;
  let totalValorExtras        = 0;
  let totalValorNormais       = 0;
  let totalValorNoturno       = 0;
  let totalValorDomingo       = 0;

  doMes.forEach(reg => {
    const r = calcularResumo(reg, config);
    totalMinutosTrabalhados += r.horasTrabalhadas;
    totalExtrasMinutos      += r.horasExtras;
    totalBancoHoras         += r.bancoHoras;
    totalValorExtras        += r.valorExtras;
    totalValorNormais       += r.valorHorasNormais;
    totalValorNoturno       += r.valorNoturno;
    totalValorDomingo       += r.valorDomingo;
  });

  return {
    totalMinutosTrabalhados,
    totalExtrasMinutos,
    totalBancoHoras,
    totalValorExtras,
    totalValorNormais,
    totalValorNoturno,
    totalValorDomingo,
    totalDias:  doMes.length,
    totalGeral: totalValorNormais + totalValorExtras + totalValorNoturno + totalValorDomingo,
    registros:  doMes
  };
}

/* ─── RESUMO ANUAL ─── */

function calcularResumoAnual(registros, config, ano) {
  const doAno = registros.filter(r => r.data.startsWith(`${ano}-`));
  const meses = [];

  for (let m = 1; m <= 12; m++) {
    const resumo = calcularResumoMensal(registros, config, m, ano);
    meses.push({ mes: m, nomeMes: getNomeMes(m - 1), ...resumo });
  }

  return {
    totalMinutosTrabalhados: meses.reduce((s, m) => s + m.totalMinutosTrabalhados, 0),
    totalExtrasMinutos:      meses.reduce((s, m) => s + m.totalExtrasMinutos, 0),
    totalBancoHoras:         meses.reduce((s, m) => s + m.totalBancoHoras, 0),
    totalValorExtras:        meses.reduce((s, m) => s + m.totalValorExtras, 0),
    totalValorNormais:       meses.reduce((s, m) => s + m.totalValorNormais, 0),
    totalValorNoturno:       meses.reduce((s, m) => s + m.totalValorNoturno, 0),
    totalValorDomingo:       meses.reduce((s, m) => s + m.totalValorDomingo, 0),
    totalDias:               doAno.length,
    meses,
    registros:               doAno
  };
}

/* ─── ÚLTIMOS N MESES (gráficos) ─── */

function obterUltimosMeses(registros, config, n = 6) {
  const result = [];
  const hoje   = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d   = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = d.getMonth() + 1;
    const ano = d.getFullYear();
    const res = calcularResumoMensal(registros, config, mes, ano);
    result.push({ mes, ano, label: `${getNomeMes(d.getMonth()).substring(0, 3)}/${ano}`, ...res });
  }
  return result;
}

/* ─── SEMANA ISO (para alerta 44h — Art. 58 CLT) ─── */

function getISOWeek(dataStr) {
  const d        = parseDataLocal(dataStr);
  const thursday = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 3 - (d.getDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return [
    thursday.getUTCFullYear(),
    Math.ceil(((thursday - yearStart) / 86400000 + yearStart.getUTCDay() + 1) / 7)
  ];
}

function calcularResumosSemana(registros, config) {
  const semanas = {};
  registros.forEach(reg => {
    const [anoSem, numSem] = getISOWeek(reg.data);
    const chave = `${anoSem}-W${String(numSem).padStart(2, '0')}`;
    if (!semanas[chave]) semanas[chave] = { chave, registros: [] };
    semanas[chave].registros.push(reg);
  });

  return Object.values(semanas).map(({ chave, registros: regs }) => {
    let totalMin = 0;
    regs.forEach(r => { totalMin += calcularHorasTrabalhadas(r.batidas || []); });
    return { chave, totalMin, excede44h: totalMin > 2640, registros: regs }; // 44h = 2640min
  });
}
