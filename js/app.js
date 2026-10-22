// Avvio dell'app, navigazione e sincronizzazione automatica
import * as store from './store.js';
import { sync, isConfigured } from './github.js';
import { recipesView, recipeView, editView, importView } from './views.js';
import { pantryView, shoppingView, planView, settingsView } from './views-home.js';
import { debounce, toast } from './utils.js';

const viewEl = document.getElementById('view');
let currentKey = '';

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const qi = h.indexOf('?');
  const path = qi >= 0 ? h.slice(0, qi) : h;
  const params = Object.fromEntries(new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : ''));
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), params };
}

const NAV_OF = { '': 'recipes', r: 'recipes', edit: 'recipes', new: 'recipes', import: 'recipes', pantry: 'pantry', shopping: 'shopping', plan: 'plan', settings: 'settings' };

function route({ keepScroll = false } = {}) {
  const { parts, params } = parseHash();
  const [p0 = '', p1] = parts;
  const key = parts.join('/');
  const y = window.scrollY;
  const el = document.createElement('div');
  viewEl.replaceChildren(el);
  if (!keepScroll) document.getElementById('modal-root').innerHTML = '';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === (NAV_OF[p0] || 'recipes')));
  try {
    switch (p0) {
      case '': recipesView(el); break;
      case 'r': recipeView(el, p1); break;
      case 'edit': editView(el, p1); break;
      case 'new': editView(el, null); break;
      case 'import': importView(el, params); break;
      case 'pantry': pantryView(el); break;
      case 'shopping': shoppingView(el); break;
      case 'plan': planView(el); break;
      case 'settings': settingsView(el); break;
      default: recipesView(el);
    }
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty"><span class="big">⚠️</span>Si è verificato un errore: ${String(e.message || e)}<br><a href="#/">Torna alle ricette</a></div>`;
  }
  const title = { '': 'Ricette', r: 'Ricetta', edit: 'Modifica', new: 'Nuova ricetta', import: 'Aggiungi ricetta', pantry: 'Dispensa', shopping: 'Spesa', plan: 'Menu', settings: 'Altro' }[p0];
  document.title = title ? `${title} · Ricettario` : 'Ricettario';
  if (keepScroll && key === currentKey) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  currentKey = key;
}

/** Ridisegna la schermata dopo una sincronizzazione, ma non mentre si sta scrivendo. */
function softRerender() {
  const { parts } = parseHash();
  if (['edit', 'new', 'import'].includes(parts[0])) return;
  const a = document.activeElement;
  if (a && viewEl.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if (document.querySelector('#modal-root .modal, .cook')) return;
  route({ keepScroll: true });
}

// ===== Stato della sincronizzazione =====
function updateSyncUI() {
  const dot = document.getElementById('sync-dot');
  const label = document.getElementById('sync-label');
  const m = store.state.meta;
  let cls = '', txt = 'Solo locale';
  if (isConfigured()) {
    if (store.state.syncing) { cls = 'busy'; txt = 'Sincronizzo…'; }
    else if (m.lastError) { cls = 'err'; txt = 'Errore di sincronizzazione'; }
    else if (m.dirty) { cls = 'dirty'; txt = 'Modifiche da inviare'; }
    else { cls = 'ok'; txt = 'Sincronizzato'; }
  }
  dot.className = 'sync-dot ' + cls;
  label.textContent = txt;
  document.getElementById('sync-btn').title = m.lastError || 'Sincronizza con GitHub';
}

function updateBadge() {
  const n = store.list('shopping').filter((i) => !i.checked).length;
  const b = document.getElementById('shop-badge');
  b.hidden = !n;
  b.textContent = n;
}

let lastErrShown = '';
async function autoSync({ quiet = true } = {}) {
  if (!isConfigured() || !store.state.settings.autoSync || !navigator.onLine) return;
  try {
    await sync();
    lastErrShown = '';
  } catch (e) {
    console.warn('Sincronizzazione non riuscita:', e);
    if (!quiet || e.message !== lastErrShown) { toast('Sincronizzazione: ' + e.message, 5000); lastErrShown = e.message; }
  }
}
const autoSyncSoon = debounce(() => autoSync(), 2500);

document.getElementById('sync-btn').addEventListener('click', async () => {
  if (!isConfigured()) { location.hash = '#/settings'; return; }
  try { await sync(); toast('Sincronizzato ✓'); } catch (e) { toast(e.message, 5000); }
});

// ===== Condivisione da Android (share target) =====
function handleShareTarget() {
  const sp = new URLSearchParams(location.search);
  if (!sp.has('share_url') && !sp.has('share_text') && !sp.has('share_title')) return;
  const all = [sp.get('share_url'), sp.get('share_text')].filter(Boolean).join(' ');
  const url = (all.match(/https?:\/\/[^\s]+/) || [])[0];
  const hash = url ? `#/import?url=${encodeURIComponent(url)}&auto=1` : `#/import?text=${encodeURIComponent(sp.get('share_text') || '')}`;
  history.replaceState(null, '', location.pathname + hash);
}

// ===== Avvio =====
async function start() {
  await store.load();
  handleShareTarget();
  store.subscribe((kind) => {
    updateSyncUI();
    updateBadge();
    if (kind === 'data') softRerender();
  });
  store.onLocalChange(autoSyncSoon);
  window.addEventListener('hashchange', () => route());
  route();
  updateSyncUI();
  updateBadge();

  // Scorciatoia: "/" per cercare
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      const q = document.getElementById('q');
      if (q) { e.preventDefault(); q.focus(); }
    }
  });

  window.addEventListener('online', () => autoSync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (store.state.meta.lastSync || 0) > 30000) autoSync();
  });
  setInterval(() => { if (document.visibilityState === 'visible' && (store.state.meta.dirty || Date.now() - (store.state.meta.lastSync || 0) > 300000)) autoSync(); }, 60000);
  autoSync();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non registrato', e));
  }
}

start();
