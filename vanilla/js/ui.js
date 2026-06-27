'use strict';

/* ═══════════════════════════════════════
   ui.js — Componentes de interface reutilizáveis
   Toast, Modal, Loading, Confirm, Paginação
   ═══════════════════════════════════════ */

/* ─── LOADING ─── */

function showLoading(texto = 'Carregando...') {
  const overlay = document.getElementById('loading-overlay');
  const txt     = document.getElementById('loading-text');
  if (txt) txt.textContent = texto;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex', 'backdrop-enter');
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  overlay.classList.remove('backdrop-enter');
}

/* ─── TOAST ─── */

const TOAST_CONFIG = {
  success: { bg: 'bg-emerald-500', icon: '✓', aria: 'Sucesso' },
  error:   { bg: 'bg-red-500',     icon: '✕', aria: 'Erro'    },
  warning: { bg: 'bg-amber-500',   icon: '⚠', aria: 'Aviso'   },
  info:    { bg: 'bg-indigo-500',  icon: 'ℹ', aria: 'Info'    }
};

/**
 * Exibe uma notificação toast.
 * @param {string} mensagem
 * @param {'success'|'error'|'warning'|'info'} tipo
 * @param {number} duracao - ms
 */
function showToast(mensagem, tipo = 'info', duracao = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const cfg  = TOAST_CONFIG[tipo] || TOAST_CONFIG.info;
  const id   = generateId();
  const el   = document.createElement('div');

  el.id        = `toast-${id}`;
  el.role      = 'alert';
  el.ariaLabel = cfg.aria;
  el.className = `pointer-events-auto flex items-start gap-3 px-4 py-3 ${cfg.bg} text-white rounded-xl shadow-xl toast-enter`;
  el.style.maxWidth = '320px';
  el.innerHTML = `
    <span class="text-base mt-0.5 shrink-0 font-bold">${cfg.icon}</span>
    <span class="text-sm leading-snug flex-1">${escapeHTML(mensagem)}</span>
    <button
      onclick="document.getElementById('toast-${id}')?.remove()"
      class="shrink-0 opacity-80 hover:opacity-100 transition-opacity text-lg leading-none"
      aria-label="Fechar"
    >×</button>
  `;

  container.appendChild(el);

  setTimeout(() => {
    el.classList.remove('toast-enter');
    el.classList.add('toast-exit');
    setTimeout(() => el.remove(), 350);
  }, duracao);
}

/* ─── MODAL ─── */

let _modalOnClose = null;

/**
 * Exibe um modal.
 * @param {{ title, body, footer?, onClose?, size? }} opts
 */
function showModal({ title, body, footer = null, onClose = null, size = 'md' }) {
  _modalOnClose = onClose;

  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  const content = document.getElementById('modal-content');
  if (content) {
    content.className = content.className.replace(/max-w-\S+/, sizeMap[size] || sizeMap.md);
    if (!content.className.includes('max-w-')) {
      content.className += ` ${sizeMap[size] || sizeMap.md}`;
    }
  }

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = body;

  const footerEl = document.getElementById('modal-footer');
  if (footer) {
    footerEl.innerHTML = footer;
    footerEl.classList.remove('hidden');
  } else {
    footerEl.innerHTML = '';
    footerEl.classList.add('hidden');
  }

  const container = document.getElementById('modal-container');
  container.classList.remove('hidden');

  // Add enter animation to content
  const mc = document.getElementById('modal-content');
  mc.classList.remove('modal-enter');
  void mc.offsetWidth; // reflow
  mc.classList.add('modal-enter');
}

function hideModal() {
  document.getElementById('modal-container').classList.add('hidden');
  if (_modalOnClose) {
    _modalOnClose();
    _modalOnClose = null;
  }
}

/**
 * Exibe um modal de confirmação.
 * @param {{ title, message, confirmText?, confirmClass?, cancelText?, onConfirm, onCancel? }} opts
 */
function showConfirm({
  title,
  message,
  confirmText  = 'Confirmar',
  confirmClass = 'bg-red-500 hover:bg-red-600',
  cancelText   = 'Cancelar',
  onConfirm,
  onCancel     = null
}) {
  const footerId = `footer-${generateId()}`;

  showModal({
    title,
    body: `<p class="text-gray-600 dark:text-gray-400 leading-relaxed">${escapeHTML(message)}</p>`,
    footer: `
      <div id="${footerId}" class="flex gap-3 w-full">
        <button
          id="btn-confirm-cancel"
          class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium
                 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >${escapeHTML(cancelText)}</button>
        <button
          id="btn-confirm-ok"
          class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${confirmClass}"
        >${escapeHTML(confirmText)}</button>
      </div>
    `
  });

  // Attach after render
  setTimeout(() => {
    document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => {
      hideModal();
      if (onCancel) onCancel();
    });
    document.getElementById('btn-confirm-ok')?.addEventListener('click', () => {
      hideModal();
      onConfirm();
    });
  }, 0);
}

/* ─── PAGINAÇÃO ─── */

/**
 * Renderiza controles de paginação.
 * @param {{ total, pagina, porPagina, onChange }} opts
 * @returns {string} HTML
 */
function renderPaginacao({ total, pagina, porPagina, onChange }) {
  const totalPaginas = Math.ceil(total / porPagina);
  if (totalPaginas <= 1) return '';

  const inicio = (pagina - 1) * porPagina + 1;
  const fim    = Math.min(pagina * porPagina, total);

  const botoes = [];

  // Prev
  botoes.push(`
    <button
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
             ${pagina <= 1
               ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
               : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
      data-page="${pagina - 1}"
      ${pagina <= 1 ? 'disabled' : ''}
    >← Anterior</button>
  `);

  // Page numbers (window of 5)
  const delta = 2;
  const left  = Math.max(1, pagina - delta);
  const right = Math.min(totalPaginas, pagina + delta);

  if (left > 1) {
    botoes.push(paginaBotao(1, pagina));
    if (left > 2) botoes.push('<span class="px-1 text-gray-400">…</span>');
  }

  for (let p = left; p <= right; p++) {
    botoes.push(paginaBotao(p, pagina));
  }

  if (right < totalPaginas) {
    if (right < totalPaginas - 1) botoes.push('<span class="px-1 text-gray-400">…</span>');
    botoes.push(paginaBotao(totalPaginas, pagina));
  }

  // Next
  botoes.push(`
    <button
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
             ${pagina >= totalPaginas
               ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
               : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
      data-page="${pagina + 1}"
      ${pagina >= totalPaginas ? 'disabled' : ''}
    >Próximo →</button>
  `);

  const html = `
    <div class="flex flex-col items-center gap-2 py-2">
      <p class="text-xs text-gray-400 dark:text-gray-500">
        Mostrando ${inicio}–${fim} de ${total}
      </p>
      <div class="flex items-center gap-1 flex-wrap justify-center" id="paginacao-buttons">
        ${botoes.join('')}
      </div>
    </div>
  `;

  // After render, attach events
  setTimeout(() => {
    document.querySelectorAll('#paginacao-buttons [data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (!isNaN(p) && p >= 1 && p <= totalPaginas && !btn.disabled) {
          onChange(p);
        }
      });
    });
  }, 0);

  return html;
}

function paginaBotao(num, atual) {
  const ativo = num === atual;
  return `
    <button
      data-page="${num}"
      class="min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors
             ${ativo
               ? 'bg-primary-500 text-white'
               : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
    >${num}</button>
  `;
}

/* ─── MENSAGEM VAZIA ─── */

function renderEmptyState({ icon, title, description, action = null }) {
  return `
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4 text-3xl">
        ${icon}
      </div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">${escapeHTML(title)}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs">${escapeHTML(description)}</p>
      ${action ? `
        <button
          onclick="${action.onclick}"
          class="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
        >${escapeHTML(action.label)}</button>
      ` : ''}
    </div>
  `;
}

/* ─── BADGE DE STATUS ─── */

function badgeBancoHoras(minutos) {
  if (minutos === 0) {
    return `<span class="chip bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
      ${formatarDuracao(0, true)}
    </span>`;
  }
  if (minutos > 0) {
    return `<span class="chip bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
      ${formatarDuracao(minutos, true)}
    </span>`;
  }
  return `<span class="chip bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
    ${formatarDuracao(minutos, true)}
  </span>`;
}

/* ─── CARD DE STAT ─── */

function renderStatCard({ label, value, sub = '', accent = 'indigo', icon = '' }) {
  const colors = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    green:  'text-emerald-600 dark:text-emerald-400',
    amber:  'text-amber-600 dark:text-amber-400',
    red:    'text-red-600 dark:text-red-400',
    gray:   'text-gray-600 dark:text-gray-400'
  };
  return `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 stat-accent-${accent}">
      ${icon ? `<div class="text-lg mb-1">${icon}</div>` : ''}
      <p class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide leading-none">${escapeHTML(label)}</p>
      <p class="text-xl font-bold ${colors[accent] || colors.indigo} mt-1 leading-tight">${value}</p>
      ${sub ? `<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${escapeHTML(sub)}</p>` : ''}
    </div>
  `;
}
