// Piccolo archivio chiave/valore su IndexedDB (con ripiego su localStorage)

const DB_NAME = 'ricettario';
const STORE = 'kv';
let dbPromise = null;
let useLocal = false;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  }).catch((e) => { console.warn('IndexedDB non disponibile, uso localStorage', e); useLocal = true; return null; });
  return dbPromise;
}

export async function get(key) {
  const db = await open();
  if (useLocal || !db) {
    try { const v = localStorage.getItem('kv:' + key); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
  }
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function set(key, value) {
  const db = await open();
  if (useLocal || !db) {
    try { localStorage.setItem('kv:' + key, JSON.stringify(value)); } catch (e) { console.error(e); }
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
