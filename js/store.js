// Stato dell'app: dati (sincronizzati su GitHub) + impostazioni locali del dispositivo
import * as db from './db.js';
import { uid, now } from './utils.js';

export const COLLECTIONS = ['recipes', 'pantry', 'shopping', 'plan'];
export const DEFAULT_STAPLES = ['sale', 'pepe', 'acqua', 'olio extravergine di oliva'];
const TOMBSTONE_TTL = 1000 * 60 * 60 * 24 * 180; // 180 giorni

export function emptyData() {
  return {
    app: 'ricettario', schema: 1,
    recipes: [], pantry: [], shopping: [], plan: [],
    prefs: { staples: [...DEFAULT_STAPLES], categories: [], updatedAt: 0 },
  };
}

export const DEFAULT_SETTINGS = {
  gh: { owner: '', repo: '', branch: 'main', path: 'ricettario.json', token: '' },
  autoSync: true,
  proxy: 'https://api.allorigins.win/raw?url={url}',
  deviceName: '',
};

export const state = {
  data: emptyData(),
  settings: structuredClone(DEFAULT_SETTINGS),
  meta: { dirty: false, lastSync: 0, lastError: '', localChangedAt: 0 },
  syncing: false,
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(kind) { for (const fn of listeners) { try { fn(kind); } catch (e) { console.error(e); } } }

export async function load() {
  const [data, settings, meta] = await Promise.all([db.get('data'), db.get('settings'), db.get('meta')]);
  if (data) state.data = normalizeData(data);
  if (settings) state.settings = { ...structuredClone(DEFAULT_SETTINGS), ...settings, gh: { ...DEFAULT_SETTINGS.gh, ...(settings.gh || {}) } };
  if (meta) state.meta = { ...state.meta, ...meta };
}

export function normalizeData(d) {
  const e = emptyData();
  const out = { ...e, ...d };
  for (const c of COLLECTIONS) out[c] = Array.isArray(d?.[c]) ? d[c] : [];
  out.prefs = { ...e.prefs, ...(d?.prefs || {}) };
  return out;
}

export const saveData = () => db.set('data', state.data);
export const saveMeta = () => db.set('meta', state.meta);
export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await db.set('settings', state.settings);
  emit('settings');
}

let changeHook = null;
/** Registra una funzione chiamata ad ogni modifica locale (usata per l'auto-sync). */
export function onLocalChange(fn) { changeHook = fn; }

function changed(kind = 'data') {
  state.meta.dirty = true;
  state.meta.localChangedAt = now();
  saveData();
  saveMeta();
  emit(kind);
  if (changeHook) changeHook();
}

// ===== CRUD =====
export const list = (coll) => state.data[coll].filter((x) => !x.deleted);
export const get = (coll, id) => state.data[coll].find((x) => x.id === id && !x.deleted);

export function upsert(coll, item, { silent = false } = {}) {
  const arr = state.data[coll];
  const t = now();
  if (!item.id) { item.id = uid(); item.createdAt = t; }
  item.updatedAt = t;
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  if (!silent) changed(coll);
  return item;
}

export function upsertMany(coll, items) {
  for (const it of items) upsert(coll, it, { silent: true });
  changed(coll);
}

export function remove(coll, id, { silent = false } = {}) {
  const arr = state.data[coll];
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return;
  arr[i] = { id, deleted: true, updatedAt: now() };
  if (!silent) changed(coll);
}

export function removeMany(coll, ids) {
  for (const id of ids) remove(coll, id, { silent: true });
  changed(coll);
}

export function setPrefs(patch) {
  state.data.prefs = { ...state.data.prefs, ...patch, updatedAt: now() };
  changed('prefs');
}

/** Sostituisce i dati locali (dopo una sincronizzazione o un import). */
export function replaceData(data, { dirty } = {}) {
  state.data = normalizeData(data);
  if (dirty !== undefined) state.meta.dirty = dirty;
  saveData();
  saveMeta();
  emit('data');
}

// ===== Unione dati (per la sincronizzazione tra dispositivi) =====
/** Unisce due versioni dei dati: per ogni elemento vince la modifica più recente. */
export function mergeData(a, b) {
  a = normalizeData(a); b = normalizeData(b);
  const out = emptyData();
  const cutoff = now() - TOMBSTONE_TTL;
  for (const c of COLLECTIONS) {
    const map = new Map();
    for (const x of [...a[c], ...b[c]]) {
      if (!x || !x.id) continue;
      const cur = map.get(x.id);
      if (!cur || (x.updatedAt || 0) > (cur.updatedAt || 0)) map.set(x.id, x);
    }
    out[c] = [...map.values()]
      .filter((x) => !(x.deleted && (x.updatedAt || 0) < cutoff))
      .sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0) || (x.id < y.id ? -1 : 1));
  }
  out.prefs = (a.prefs.updatedAt || 0) >= (b.prefs.updatedAt || 0) ? a.prefs : b.prefs;
  return out;
}

/** Serializzazione stabile usata per salvare su GitHub e confrontare versioni. */
export function serialize(data) {
  return JSON.stringify(normalizeData(data), null, 1);
}
