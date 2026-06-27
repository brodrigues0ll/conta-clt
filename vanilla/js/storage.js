'use strict';

/* ═══════════════════════════════════════
   storage.js — Importação, exportação e backup
   ═══════════════════════════════════════ */

/* ─── EXPORTAR JSON ─── */

async function exportarJSON() {
  try {
    const [config, registros] = await Promise.all([getConfig(), getAllRegistros()]);
    const dados = {
      versao: '1.0',
      exportadoEm: new Date().toISOString(),
      config,
      registros
    };
    const json = JSON.stringify(dados, null, 2);
    _downloadFile(json, `horas-clt-${_dataArquivo()}.json`, 'application/json');
    showToast('JSON exportado com sucesso!', 'success');
  } catch (err) {
    showToast(`Erro ao exportar JSON: ${err.message}`, 'error');
  }
}

/* ─── IMPORTAR JSON ─── */

async function importarJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dados = JSON.parse(e.target.result);

        // Validação básica
        if (!dados.registros || !Array.isArray(dados.registros)) {
          throw new Error('Arquivo inválido: campo "registros" ausente ou malformado.');
        }

        await importarRegistros(dados.registros);

        if (dados.config) {
          const cfgAtual = await getConfig();
          // Mescla sem sobrescrever darkMode
          const cfgNova = Object.assign({}, cfgAtual, dados.config, {
            id: 'main',
            darkMode: cfgAtual.darkMode
          });
          await saveConfig(cfgNova);
        }

        showToast(`${dados.registros.length} registros importados!`, 'success');
        resolve(dados.registros.length);
      } catch (err) {
        showToast(`Erro ao importar: ${err.message}`, 'error');
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsText(file);
  });
}

/* ─── EXPORTAR CSV ─── */

async function exportarCSV() {
  try {
    const [config, registros] = await Promise.all([getConfig(), getAllRegistros()]);

    const linhas = [
      ['Data', 'Dia da Semana', 'Batidas', 'Horas Trabalhadas', 'Horas Extras', 'Banco de Horas', 'Valor Extras (R$)', 'Total Dia (R$)', 'Observação']
    ];

    registros.forEach(reg => {
      const r   = calcularResumo(reg, config);
      const bat = (reg.batidas || []).join(' | ');
      linhas.push([
        formatarData(reg.data),
        getDiaSemana(reg.data),
        bat,
        formatarDuracao(r.horasTrabalhadas),
        formatarDuracao(r.horasExtras, true),
        formatarDuracao(r.bancoHoras, true),
        r.valorExtras.toFixed(2).replace('.', ','),
        r.totalDia.toFixed(2).replace('.', ','),
        reg.observacao || ''
      ]);
    });

    const csv = linhas
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    // BOM para Excel reconhecer UTF-8
    _downloadFile('\ufeff' + csv, `horas-clt-${_dataArquivo()}.csv`, 'text/csv;charset=utf-8;');
    showToast('CSV exportado com sucesso!', 'success');
  } catch (err) {
    showToast(`Erro ao exportar CSV: ${err.message}`, 'error');
  }
}

/* ─── EXPORTAR EXCEL (SheetJS) ─── */

async function exportarExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca Excel não carregada. Verifique a conexão.', 'error');
    return;
  }

  try {
    const [config, registros] = await Promise.all([getConfig(), getAllRegistros()]);

    // Aba principal
    const dadosPrincipais = registros.map(reg => {
      const r = calcularResumo(reg, config);
      return {
        'Data':                formatarData(reg.data),
        'Dia da Semana':       getDiaSemana(reg.data),
        'Batidas':             (reg.batidas || []).join(' | '),
        'Horas Trabalhadas':   formatarDuracao(r.horasTrabalhadas),
        'Horas Normais':       formatarDuracao(r.horasNormais),
        'Horas Extras':        formatarDuracao(r.horasExtras, true),
        'Banco de Horas':      formatarDuracao(r.bancoHoras, true),
        'Valor Hora (R$)':     r.valorHora.toFixed(2),
        'Valor Hora Extra (R$)': r.valorHoraExtra.toFixed(2),
        'Valor Extras (R$)':   r.valorExtras.toFixed(2),
        'Total Dia (R$)':      r.totalDia.toFixed(2),
        'Observação':          reg.observacao || ''
      };
    });

    // Aba de resumo mensal
    const hoje      = new Date();
    const anoAtual  = hoje.getFullYear();
    const resumoAnual = calcularResumoAnual(registros, config, anoAtual);
    const dadosMensais = resumoAnual.meses.map(m => ({
      'Mês':                    m.nomeMes,
      'Ano':                    anoAtual,
      'Dias Trabalhados':       m.totalDias,
      'Horas Trabalhadas':      formatarDuracao(m.totalMinutosTrabalhados),
      'Banco de Horas':         formatarDuracao(m.totalExtrasMinutos, true),
      'Valor Extras (R$)':      m.totalValorExtras.toFixed(2),
      'Total (R$)':             m.totalGeral.toFixed(2)
    }));

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(dadosPrincipais);
    _setColWidths(ws1, [12, 15, 30, 16, 14, 12, 13, 15, 18, 15, 13, 30]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Registros');

    const ws2 = XLSX.utils.json_to_sheet(dadosMensais);
    _setColWidths(ws2, [12, 6, 16, 16, 14, 16, 13]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo Mensal');

    XLSX.writeFile(wb, `horas-clt-${_dataArquivo()}.xlsx`);
    showToast('Excel exportado com sucesso!', 'success');
  } catch (err) {
    showToast(`Erro ao exportar Excel: ${err.message}`, 'error');
  }
}

function _setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

/* ─── BACKUP ─── */

async function criarBackup(nomePersonalizado = null) {
  try {
    const [config, registros] = await Promise.all([getConfig(), getAllRegistros()]);
    const nome = nomePersonalizado || `Backup ${formatarDataHoraISO(new Date().toISOString())}`;

    const backup = {
      nome,
      tamanho: JSON.stringify({ config, registros }).length,
      totalRegistros: registros.length,
      dados: { config, registros }
    };

    await saveBackup(backup);
    showToast('Backup criado com sucesso!', 'success');
    return backup;
  } catch (err) {
    showToast(`Erro ao criar backup: ${err.message}`, 'error');
    throw err;
  }
}

async function restaurarBackup(backup) {
  try {
    if (!backup.dados) throw new Error('Dados do backup corrompidos.');

    await limparRegistros();

    if (backup.dados.registros?.length) {
      await importarRegistros(backup.dados.registros);
    }

    if (backup.dados.config) {
      const cfgAtual = await getConfig();
      await saveConfig(Object.assign({}, backup.dados.config, {
        id: 'main',
        darkMode: cfgAtual.darkMode
      }));
    }

    showToast('Backup restaurado com sucesso!', 'success');
  } catch (err) {
    showToast(`Erro ao restaurar backup: ${err.message}`, 'error');
    throw err;
  }
}

/* ─── IMPORTAR FOLHA DE PONTO (RFP XLS) ─── */

/**
 * Lê um arquivo .xls da Folha de Ponto (formato RFP) e retorna
 * os registros parseados prontos para importar.
 * Estrutura do XLS:
 *   - col 0:  serial de data Excel (dia do registro)
 *   - col 4:  nome do dia da semana
 *   - col 10: serial decimal de entrada (data+hora)
 *   - col 14: serial decimal de saída   (data+hora)
 *   - col 20: texto de observação
 * O arquivo tem múltiplas páginas separadas por "Folha de Ponto" em col 0.
 */
async function importarRFP(file) {
  if (typeof XLSX === 'undefined') {
    showToast('Biblioteca Excel não carregada. Verifique conexão.', 'error');
    return null;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array', raw: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        const registros = _parseRFPRows(rows);
        resolve(registros);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

/** Converte serial de data Excel (inteiro) para "YYYY-MM-DD" */
function _xlSerialToDateStr(serial) {
  // Época Excel: 30/12/1899
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

/** Converte serial decimal Excel (fração do dia) para "HH:MM" */
function _xlSerialToTimeStr(serial) {
  const totalMin = Math.round((serial % 1) * 1440);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

/** Faz o parse das linhas do XLS e retorna array de registros */
function _parseRFPRows(rows) {
  const mapa    = {};   // data -> { batidas, obs }
  let dataAtual = null;

  for (const row of rows) {
    const c0  = row[0];
    const c4  = row[4];
    const c10 = row[10];
    const c14 = row[14];
    const c20 = row[20];

    // Nova página → resetar contexto do dia
    if (c0 === 'Folha de Ponto') {
      dataAtual = null;
      continue;
    }

    // Linha de cabeçalho do dia:
    //   col 0 = serial de data (número entre 40000–47000)
    //   col 4 = nome do dia da semana (string não vazia, não "a")
    if (
      typeof c0 === 'number' && c0 > 40000 && c0 < 47000 &&
      typeof c4 === 'string' && c4.trim() && c4.trim() !== 'a'
    ) {
      dataAtual = _xlSerialToDateStr(c0);
      if (!mapa[dataAtual]) mapa[dataAtual] = { batidas: [], obs: [] };
      continue;
    }

    // Linha de período:
    //   col 10 = serial decimal de entrada
    //   col 14 = serial decimal de saída
    if (dataAtual && typeof c10 === 'number' && c10 > 40000) {
      const entrada = _xlSerialToTimeStr(c10);
      const saida   = (typeof c14 === 'number' && c14 > 40000)
        ? _xlSerialToTimeStr(c14) : null;

      const reg = mapa[dataAtual];
      if (!reg.batidas.includes(entrada)) reg.batidas.push(entrada);
      if (saida && !reg.batidas.includes(saida)) reg.batidas.push(saida);

      const obs = c20 && typeof c20 === 'string' ? c20.trim() : '';
      if (obs && obs !== ' ' && obs !== '') reg.obs.push(obs);
    }
  }

  // Montar array de registros apenas de dias com batidas
  return Object.entries(mapa)
    .filter(([, info]) => info.batidas.length > 0)
    .map(([data, info]) => ({
      data,
      // Ordenar batidas cronologicamente
      batidas: [...info.batidas].sort((a, b) => horaParaMinutos(a) - horaParaMinutos(b)),
      // Extrair horários aprovados das observações (linhas "Marcação: HH:MM")
      observacao: _extrairObsRFP(info.obs)
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Extrai e limpa texto de observação das linhas de marcação */
function _extrairObsRFP(obsArr) {
  if (!obsArr.length) return '';
  // Pegar apenas linhas que têm "Marcação:" para manter o contexto útil
  const linhas = obsArr
    .flatMap(txt => txt.split('\n'))
    .map(l => l.trim())
    .filter(l => l && l !== 'Ponto Aprovado' && l !== ' ');
  return linhas.join(' | ').substring(0, 600);
}

/* ─── HELPERS ─── */

function _downloadFile(conteudo, nomeArquivo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

function _dataArquivo() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
