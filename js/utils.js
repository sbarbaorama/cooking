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
/**
 * Mostra un messaggio temporaneo. Con `action` ({ label, fn }) compare un pulsante,
 * ad esempio "Annulla" dopo un'eliminazione.
 */
export function toast(msg, ms = 2600, action = null) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('has-action', !!action);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.onclick = () => { clearTimeout(toastTimer); el.classList.remove('show'); action.fn(); };
    el.append(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? Math.max(ms, 5000) : ms);
}

/** Ridisegna la schermata corrente (usato dopo un "Annulla"). */
export function refreshView() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
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

// ===== WhatsApp =====
export const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>';

/** Numero in formato internazionale per wa.me (solo cifre). I numeri italiani senza prefisso ricevono 39. */
export function normPhone(p) {
  let d = String(p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^3\d{8,9}$/.test(d)) d = '39' + d;
  return d.replace(/\D/g, '');
}

/**
 * Apre WhatsApp (app su telefono, WhatsApp Web su PC) con il testo già pronto da inviare.
 * Con `phone` apre direttamente la chat con quel numero, altrimenti fa scegliere il contatto.
 */
export function shareWhatsApp(text, phone = '') {
  const n = normPhone(phone);
  const url = `https://wa.me/${n}?text=` + encodeURIComponent(text);
  const w = window.open(url, '_blank');
  if (w) w.opener = null; else location.href = url;
}
