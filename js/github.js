// Sincronizzazione dei dati con un file JSON in un repository GitHub (anche privato)
import { state, mergeData, serialize, replaceData, saveMeta, emit } from './store.js';
import { now } from './utils.js';
import { get as dbGet } from './db.js';

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function isConfigured() {
  const g = state.settings.gh;
  return !!(g.owner && g.repo && g.token && g.path);
}

function apiUrl() {
  const g = state.settings.gh;
  const path = g.path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${path}`;
}

async function gh(url, opts = {}) {
  const res = await fetch(url, {
    cache: 'no-store',
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${state.settings.gh.token.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function explain(res) {
  let msg = '';
  try { msg = (await res.json()).message || ''; } catch {}
  if (res.status === 401) return 'Token non valido o scaduto (401).';
  if (res.status === 403) return `Accesso negato (403): controlla i permessi del token. ${msg}`;
  if (res.status === 404) return 'Repository non trovato (404): controlla proprietario, nome e che il token abbia accesso.';
  return `Errore GitHub ${res.status}: ${msg}`;
}

/** Legge il file remoto. Restituisce { data, sha } oppure { data: null } se non esiste ancora. */
async function readRemote() {
  const g = state.settings.gh;
  const url = `${apiUrl()}?ref=${encodeURIComponent(g.branch || 'main')}`;
  const res = await gh(url);
  if (res.status === 404) {
    // Il file non esiste: verifichiamo che almeno il repo esista
    const r2 = await gh(`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}`);
    if (!r2.ok) throw new Error(await explain(r2));
    return { data: null, sha: null };
  }
  if (!res.ok) throw new Error(await explain(res));
  const j = await res.json();
  let text;
  if (j.content && j.encoding === 'base64') text = b64decode(j.content);
  else {
    // File > 1 MB: va scaricato in formato raw
    const raw = await gh(url, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!raw.ok) throw new Error(await explain(raw));
    text = await raw.text();
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Il file su GitHub non è un JSON valido.'); }
  return { data, sha: j.sha };
}

async function writeRemote(data, sha) {
  const g = state.settings.gh;
  const device = state.settings.deviceName || guessDevice();
  const body = {
    message: `Ricettario: aggiornamento da ${device} (${new Date().toLocaleString('it-IT')})`,
    content: b64encode(serialize(data)),
    branch: g.branch || 'main',
  };
  if (sha) body.sha = sha;
  const res = await gh(apiUrl(), { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  if (res.status === 409 || res.status === 422) return { conflict: true };
  if (!res.ok) throw new Error(await explain(res));
  return { conflict: false };
}

export function guessDevice() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android' : 'tablet Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'PC Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  return 'browser';
}

async function uploadPendingImages() {
  const pending = [...(state.meta.pendingImages || [])];
  for (const path of pending) {
    const dataUrl = await dbGet('img:' + path);
    if (dataUrl) await uploadFile(path, String(dataUrl).split(',')[1]);
    state.meta.pendingImages = (state.meta.pendingImages || []).filter((p) => p !== path);
    await saveMeta();
  }
}

let running = null;

/** Sincronizza: scarica, unisce con i dati locali, ricarica se ci sono differenze. */
export function sync() {
  if (running) return running;
  running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  if (!isConfigured()) throw new Error('Configura prima GitHub nelle impostazioni.');
  if (!navigator.onLine) throw new Error('Sei offline: la sincronizzazione avverrà appena torni online.');
  state.syncing = true;
  emit('sync');
  const startedAt = now();
  try {
    await uploadPendingImages();
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await readRemote();
      const merged = remote.data ? mergeData(state.data, remote.data) : mergeData(state.data, {});
      const needsPush = !remote.data || serialize(merged) !== serialize(remote.data);
      if (needsPush) {
        const r = await writeRemote(merged, remote.sha);
        if (r.conflict) continue; // qualcun altro ha scritto nel frattempo: riprova
      }
      // Conserva eventuali modifiche fatte durante la sincronizzazione
      const final = mergeData(merged, state.data);
      const changedMeanwhile = state.meta.localChangedAt > startedAt;
      replaceData(final, { dirty: changedMeanwhile });
      state.meta.lastSync = now();
      state.meta.lastError = '';
      await saveMeta();
      return { pushed: needsPush, pulled: !!remote.data };
    }
    throw new Error('Troppi conflitti di scrittura, riprova tra poco.');
  } catch (e) {
    state.meta.lastError = e.message || String(e);
    await saveMeta();
    throw e;
  } finally {
    state.syncing = false;
    emit('sync');
  }
}

// ===== Foto delle ricette (file separati nel repository) =====
function fileUrl(path) {
  const g = state.settings.gh;
  const p = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${p}`;
}

/** Carica un file (contenuto già in base64). Se esiste già lo considera caricato. */
export async function uploadFile(path, base64) {
  const g = state.settings.gh;
  const res = await gh(fileUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Ricettario: foto ${path}`, content: base64, branch: g.branch || 'main' }),
  });
  if (res.ok || res.status === 422) return true; // 422 = esiste già
  throw new Error(await explain(res));
}

/** Scarica un file binario e lo restituisce come data URL. */
export async function downloadDataUrl(path) {
  const g = state.settings.gh;
  const res = await gh(`${fileUrl(path)}?ref=${encodeURIComponent(g.branch || 'main')}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (!res.ok) throw new Error(await explain(res));
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob.type ? blob : new Blob([blob], { type: 'image/jpeg' }));
  });
}

/** Verifica le credenziali senza scrivere nulla. */
export async function testConnection() {
  const g = state.settings.gh;
  const res = await gh(`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}`);
  if (!res.ok) throw new Error(await explain(res));
  const j = await res.json();
  const remote = await readRemote();
  return {
    private: j.private,
    canPush: j.permissions ? !!j.permissions.push : null,
    exists: !!remote.data,
    recipes: remote.data ? (remote.data.recipes || []).filter((r) => !r.deleted).length : 0,
  };
}
