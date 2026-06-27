'use strict';

/* ═══════════════════════════════════════
   db.js — IndexedDB (único armazenamento)
   ═══════════════════════════════════════ */

const DB_NAME    = 'controle-horas-clt';
const DB_VERSION = 1;

const STORES = {
  CONFIG:    'config',
  REGISTROS: 'registros',
  BACKUPS:   'backups'
};

let _db = null;

/** Abre (ou reutiliza) a conexão com o IndexedDB */
async function openDB() {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(new Error(`Falha ao abrir banco: ${req.error?.message}`));

    req.onsuccess = (e) => {
      _db = e.target.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        db.createObjectStore(STORES.CONFIG, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.REGISTROS)) {
        const rs = db.createObjectStore(STORES.REGISTROS, { keyPath: 'id' });
        rs.createIndex('data', 'data', { unique: true });
        rs.createIndex('criadoEm', 'criadoEm', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
        const bs = db.createObjectStore(STORES.BACKUPS, { keyPath: 'id' });
        bs.createIndex('criadoEm', 'criadoEm', { unique: false });
      }
    };
  });
}

/* ─── Primitivas ─── */

async function _getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function _getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function _put(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function _delete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function _clear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function _getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const idx   = store.index(indexName);
    const req   = idx.get(value);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

/* ─── CONFIG ─── */

const CONFIG_ID = 'main';
const CONFIG_PADRAO = {
  id: CONFIG_ID,
  salario: 0,
  horasMensais: 220,
  jornadaDiaria: 8,
  percentualHoraExtra: 50,
  nomeEmpresa: '',
  nomeFuncionario: '',
  darkMode: false,
  // Regras CLT
  toleranciaHoraExtra: 0,
  // Sábado — Art. 59 CLT / regime 40h semanais
  sabadoHoraExtra: true,
  adicionalSabado: true,
  percentualAdicionalSabado: 50,
  // Domingo — Art. 67 CLT
  domingoHoraExtra: true,
  adicionalDomingo: true,
  percentualAdicionalDomingo: 100,
  // Feriado — Art. 67 CLT
  adicionalFeriado: true,
  percentualAdicionalFeriado: 100,
  // Noturno — Art. 73 CLT
  calcularNoturno: true,
  percentualAdicionalNoturno: 20,
  horaNoturnaReduzida: true,
  // Intrajornada — Art. 71 CLT
  verificarIntrajornada: true,
  feriadosPersonalizados: [],
  // Exibição
  exibirTotalDia: true,
  atualizadoEm: null
};

async function getConfig() {
  const cfg = await _getById(STORES.CONFIG, CONFIG_ID);
  return Object.assign({}, CONFIG_PADRAO, cfg || {});
}

async function saveConfig(config) {
  config.id = CONFIG_ID;
  config.atualizadoEm = new Date().toISOString();
  await _put(STORES.CONFIG, config);
  return config;
}

/* ─── REGISTROS ─── */

async function getAllRegistros() {
  const lista = await _getAll(STORES.REGISTROS);
  return lista.sort((a, b) => b.data.localeCompare(a.data));
}

async function getRegistroById(id) {
  return _getById(STORES.REGISTROS, id);
}

async function getRegistroByData(data) {
  return _getByIndex(STORES.REGISTROS, 'data', data);
}

async function saveRegistro(registro) {
  if (!registro.id) {
    registro.id = generateId();
    registro.criadoEm = new Date().toISOString();
  }
  registro.atualizadoEm = new Date().toISOString();
  await _put(STORES.REGISTROS, registro);
  return registro;
}

async function deleteRegistro(id) {
  await _delete(STORES.REGISTROS, id);
}

async function getRegistrosMes(ano, mes) {
  const todos  = await getAllRegistros();
  const prefix = `${ano}-${String(mes).padStart(2,'0')}`;
  return todos.filter(r => r.data.startsWith(prefix));
}

async function getRegistrosAno(ano) {
  const todos = await getAllRegistros();
  return todos.filter(r => r.data.startsWith(`${ano}-`));
}

/** Importa (upsert) um array de registros em lote */
async function importarRegistros(registros) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORES.REGISTROS, 'readwrite');
    const store = tx.objectStore(STORES.REGISTROS);
    registros.forEach(r => {
      if (!r.id) r.id = generateId();
      if (!r.criadoEm) r.criadoEm = new Date().toISOString();
      r.atualizadoEm = new Date().toISOString();
      store.put(r);
    });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function limparRegistros() {
  await _clear(STORES.REGISTROS);
}

/* ─── BACKUPS ─── */

async function getAllBackups() {
  const lista = await _getAll(STORES.BACKUPS);
  return lista.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

async function saveBackup(backup) {
  if (!backup.id) backup.id = generateId();
  backup.criadoEm = new Date().toISOString();
  await _put(STORES.BACKUPS, backup);
  return backup;
}

async function deleteBackupById(id) {
  await _delete(STORES.BACKUPS, id);
}

async function limparBackups() {
  await _clear(STORES.BACKUPS);
}
