// Funzioni di utilità condivise

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const now = () => Date.now();

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const FRACTIONS = [[0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾']];

/** Formatta una quantità in modo leggibile (es. 1.5 -> "1½", 333.3 -> "335"). */
export function fmtQty(n) {
  if (n == null || isNaN(n)) return '';
  if (n >= 100) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  const int = Math.floor(n);
  const dec = n - int;
  if (dec < 0.08) return String(int || (n > 0 ? '0,1' : '0'));
  if (dec > 0.92) return String(int + 1);
  for (const [v, ch] of FRACTIONS) if (Math.abs(dec - v) < 0.06) return (int ? int : '') + ch;
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

/** Converte una durata ISO 8601 (PT1H30M) in minuti. */
export function isoDurationToMin(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/P(?:(\d+)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?/i);
  if (!m) return null;
  const min = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) + Math.round((+m[4] || 0) / 60);
  return min || null;
}

export function minToText(m) {
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function decodeEntities(s) {
  if (!s || !/[&<]/.test(s)) return s || '';
  const d = new DOMParser().parseFromString(`<!doctype html><body>${s}`, 'text/html');
  return (d.body.textContent || '').trim();
}

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function isoDate(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function startOfWeek(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }

export const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateTime(ts) {
  if (!ts) return 'mai';
  return new Date(ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Emoji di fallback in base alla categoria/titolo della ricetta. */
export function recipeEmoji(r) {
  const s = `${r.category || ''} ${r.title || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
  const map = [
    [/pizza|focacc/, '🍕'], [/pasta|spaghett|penne|lasagn|tagliatell|gnocch|risott|riso/, '🍝'], [/torta|dolce|dessert|biscott|crostat|tiramis|cioccolat/, '🍰'],
    [/zupp|minestr|vellutat/, '🍲'], [/insalat/, '🥗'], [/pesce|salmon|tonno|gamber|cozz|vongol|merluzz/, '🐟'],
    [/pollo|tacchin/, '🍗'], [/carne|manzo|maiale|vitell|bistecc|polpett|arrost/, '🥩'], [/pane|lievit/, '🍞'],
    [/uov|frittat|omelette/, '🍳'], [/verdur|contorn|zucchin|melanzan|patat/, '🥦'], [/cocktail|bevand|drink|smoothie/, '🍹'],
  ];
  for (const [re, e] of map) if (re.test(s)) return e;
  return '🍽️';
}

/** Mostra una finestra di conferma; restituisce una Promise<boolean>. */
export function confirmDialog(text, okLabel = 'Conferma', danger = false) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">
      <div class="mbody" style="padding-top:20px">${esc(text)}</div>
      <footer><button class="btn" data-r="0">Annulla</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(okLabel)}</button></footer>
    </div></div>`;
    const done = (v) => { root.innerHTML = ''; resolve(v); };
    root.querySelector('.modal-back').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-back')) return done(false);
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
    });
  });
}
