// Componenti condivisi: immagini, finestre, lista della spesa, timer, modalità cucina
import * as store from './store.js';
import * as db from './db.js';
import { esc, uid, fmtQty, toast, recipeEmoji, now } from './utils.js';
import { parseIngredient, formatIngredient, findTimes, isGroupHeader } from './parser.js';
import { tokens, ingredientName, prepareHave, findHave, aisleOf } from './match.js';
import { isConfigured, downloadDataUrl } from './github.js';

// ===== Immagini =====
const imgCache = new Map();

/** Attributi <img> per una foto: URL esterno oppure foto salvata su GitHub ("gh:percorso"). */
export function imgTag(src, alt = '') {
  if (!src) return '';
  if (src.startsWith('gh:')) return `<img data-gh="${esc(src.slice(3))}" alt="${esc(alt)}">`;
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
}

/** Carica nelle <img data-gh> le foto salvate localmente o su GitHub. */
export function hydrateImages(root) {
  root.querySelectorAll('img[data-gh]').forEach(async (img) => {
    const path = img.dataset.gh;
    try {
      let url = imgCache.get(path) || (await db.get('img:' + path));
      if (!url && isConfigured()) { url = await downloadDataUrl(path); await db.set('img:' + path, url); }
      if (url) { imgCache.set(path, url); img.src = url; } else img.remove();
    } catch { img.remove(); }
  });
}

/** Ridimensiona una foto scelta dall'utente e la salva (verrà caricata su GitHub alla prossima sincronizzazione). */
export async function storePhoto(file) {
  const bmp = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', 0.8);
  const path = `images/${uid()}.jpg`;
  await db.set('img:' + path, dataUrl);
  imgCache.set(path, dataUrl);
  store.state.meta.pendingImages = [...(store.state.meta.pendingImages || []), path];
  await store.saveMeta();
  return 'gh:' + path;
}

export function thumb(r, cls = 'thumb') {
  return `<div class="${cls}">${esc(recipeEmoji(r))}${imgTag(r.image)}</div>`;
}

// ===== Finestre =====
export function openModal(html, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const back = root.firstElementChild;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  return { el: back.firstElementChild, close };
}

/** Finestra per scegliere una ricetta (o scrivere un piatto libero). */
export function pickRecipe(title = 'Scegli una ricetta', { allowFree = true } = {}) {
  return new Promise((resolve) => {
    let result = null;
    const recipes = store.list('recipes').sort((a, b) => a.title.localeCompare(b.title, 'it'));
    const m = openModal(`
      <header><h2>${esc(title)}</h2><button class="btn ghost icon" data-close aria-label="Chiudi">✕</button></header>
      <div class="mbody">
        <div class="search"><input type="search" id="pick-q" placeholder="Cerca ricetta${allowFree ? ' o scrivi un piatto' : ''}…" autocomplete="off"></div>
        <ul class="pick-list" id="pick-list"></ul>
      </div>
      <footer><button class="btn" data-act="random">🎲 A caso</button><span class="grow"></span><button class="btn" data-close>Annulla</button></footer>`,
    { onClose: () => resolve(result) });
    const q = m.el.querySelector('#pick-q');
    const listEl = m.el.querySelector('#pick-list');
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      const found = recipes.filter((r) => !s || r.title.toLowerCase().includes(s)).slice(0, 40);
      listEl.innerHTML = (allowFree && s ? `<li><button data-free="1">✍️ Usa “${esc(q.value.trim())}”</button></li>` : '') +
        found.map((r) => `<li><button data-id="${r.id}"><span>${esc(recipeEmoji(r))}</span><span>${esc(r.title)}</span></button></li>`).join('') +
        (!found.length && !s ? '<li class="muted small">Nessuna ricetta salvata.</li>' : '');
    };
    draw();
    q.addEventListener('input', draw);
    setTimeout(() => q.focus(), 50);
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.id) { result = { recipe: store.get('recipes', b.dataset.id) }; m.close(); }
      else if (b.dataset.free) { result = { free: q.value.trim() }; m.close(); }
      else if (b.dataset.act === 'random' && recipes.length) { result = { recipe: recipes[Math.floor(Math.random() * recipes.length)] }; m.close(); }
    });
  });
}

// ===== Lista della spesa =====
const UNIT_NORM = {
  g: ['g', 1], gr: ['g', 1], grammi: ['g', 1], grammo: ['g', 1], kg: ['g', 1000], hg: ['g', 100], etti: ['g', 100], etto: ['g', 100], mg: ['g', 0.001],
  ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000], lt: ['ml', 1000], litri: ['ml', 1000], litro: ['ml', 1000],
  cucchiaio: ['cucchiai', 1], cucchiai: ['cucchiai', 1], cucchiaino: ['cucchiaini', 1], cucchiaini: ['cucchiaini', 1],
  spicchio: ['spicchi', 1], spicchi: ['spicchi', 1], fetta: ['fette', 1], fette: ['fette', 1],
};
function normUnit(u) {
  const k = (u || '').toLowerCase().replace(/\.$/, '');
  return UNIT_NORM[k] || [k, 1];
}

export function shoppingText(it) {
  let q = '';
  if (it.qty != null) {
    let v = it.qty, u = it.unit || '';
    if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg'; }
    if (u === 'ml' && v >= 1000) { v /= 1000; u = 'l'; }
    q = `${fmtQty(v)}${u ? ' ' + u : ''} `;
  }
  return `${q}${it.name}${it.extra ? ` (+ ${it.extra})` : ''}`;
}

/**
 * Aggiunge righe di ingredienti alla lista della spesa, sommando le quantità dello stesso prodotto.
 * Salta gli ingredienti "sempre in casa" e, se richiesto, quelli già in dispensa.
 */
export function addToShopping(lines, { recipe = null, factor = 1, skipPantry = true } = {}) {
  const S = prepareHave(store.state.data.prefs.staples.map((name) => ({ name })));
  const H = skipPantry ? prepareHave(store.list('pantry')) : [];
  const items = store.list('shopping');
  const touched = [];
  let added = 0, skipped = 0;
  for (const line of lines) {
    const p = parseIngredient(line);
    if (p.header || !p.raw) continue;
    const name = ingredientName(p) || p.raw;
    const tok = tokens(name);
    if (recipe && tok.length && (findHave(tok, S) || findHave(tok, H))) { skipped++; continue; }
    const key = tok.join(' ');
    const [unit, mult] = normUnit(p.unit);
    const qty = p.qty != null ? p.qty * mult * factor : null;
    const ex = key && items.find((i) => !i.checked && i.key === key);
    if (ex) {
      if (qty != null && ex.qty != null && ex.unit === unit) ex.qty += qty;
      else if (qty != null) ex.extra = [ex.extra, `${fmtQty(qty)} ${unit}`.trim()].filter(Boolean).join(' + ');
      if (recipe && !(ex.recipes || []).includes(recipe.title)) ex.recipes = [...(ex.recipes || []), recipe.title];
      touched.push(ex);
    } else {
      const it = { name, qty, unit: qty != null ? unit : '', key, aisle: aisleOf(name), checked: false, recipes: recipe ? [recipe.title] : [] };
      items.push(it);
      touched.push(it);
    }
    added++;
  }
  if (touched.length) store.upsertMany('shopping', touched);
  return { added, skipped };
}

// ===== Timer =====
const timers = [];
let tick = null;
let audioCtx = null;

function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t + i * 0.35); g.gain.exponentialRampToValueAtTime(0.4, t + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.35 + 0.25);
      o.start(t + i * 0.35); o.stop(t + i * 0.35 + 0.3);
    }
  } catch {}
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
}

function fmtClock(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
}

function drawTimers() {
  const el = document.getElementById('timers');
  el.innerHTML = timers.map((t) => {
    const left = (t.end - now()) / 1000;
    return `<div class="timer ${t.ringing ? 'ring' : ''}" data-id="${t.id}">
      <span>⏱ ${esc(t.label)} · ${t.ringing ? 'Pronto!' : fmtClock(left)}</span>
      ${t.ringing ? '' : '<button data-t="add" title="+1 minuto">+1</button>'}
      <button data-t="x" title="${t.ringing ? 'Ferma' : 'Annulla'}">✕</button></div>`;
  }).join('');
}

function loop() {
  for (const t of timers) {
    if (!t.ringing && now() >= t.end) {
      t.ringing = true;
      beep();
      t.ringInt = setInterval(beep, 4000);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Timer finito', { body: t.label, icon: 'icons/icon-192.png' }); } catch {}
      }
    }
  }
  drawTimers();
  if (!timers.length) { clearInterval(tick); tick = null; }
}

export function startTimer(seconds, label) {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch {}
  timers.push({ id: uid(), label, end: now() + seconds * 1000, ringing: false });
  if (!tick) tick = setInterval(loop, 500);
  loop();
  toast(`Timer avviato: ${fmtClock(seconds)}`);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('#timers button');
  if (!b) return;
  const id = b.closest('.timer').dataset.id;
  const i = timers.findIndex((t) => t.id === id);
  if (i < 0) return;
  if (b.dataset.t === 'add') timers[i].end += 60000;
  else { clearInterval(timers[i].ringInt); timers.splice(i, 1); }
  loop();
});

/** Testo di un passaggio con le durate trasformate in pulsanti timer. */
export function stepHTML(text, label) {
  const times = findTimes(text);
  if (!times.length) return esc(text);
  let out = '', pos = 0;
  for (const t of times) {
    out += esc(text.slice(pos, t.index));
    out += `<button class="timer-link" data-timer="${t.seconds}" data-label="${esc(label)}" title="Avvia timer">⏱ ${esc(t.text)}</button>`;
    pos = t.index + t.length;
  }
  return out + esc(text.slice(pos));
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-timer]');
  if (!b) return;
  e.stopPropagation();
  startTimer(+b.dataset.timer, b.dataset.label || 'Timer');
});

// ===== Modalità cucina =====
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}

export function cookMode(r, factor = 1) {
  const steps = r.steps.filter((s) => s.trim());
  let i = 0, showIngs = false;
  const el = document.createElement('div');
  el.className = 'cook';
  document.body.appendChild(el);
  keepAwake(true);
  const onVis = () => { if (document.visibilityState === 'visible' && el.isConnected) keepAwake(true); };
  document.addEventListener('visibilitychange', onVis);

  const ings = r.ingredients.map(parseIngredient);
  const draw = () => {
    const last = i >= steps.length;
    el.innerHTML = `
      <div class="cook-top">
        <button class="btn icon" data-c="close" aria-label="Chiudi">✕</button>
        <div class="t">${esc(r.title)}</div>
        <button class="btn ${showIngs ? 'on' : ''}" data-c="ings">🧾 Ingredienti</button>
      </div>
      <div class="cook-progress"><div style="width:${steps.length ? Math.min(100, (i / steps.length) * 100) : 100}%"></div></div>
      <div class="cook-body">
        ${showIngs ? `<div class="cook-ings">${ings.map((p) => p.header ? `<div><b>${esc(p.name)}</b></div>` : `<div>• ${esc(formatIngredient(p, factor))}</div>`).join('')}</div>`
        : last ? `<div class="center"><div style="font-size:4rem">🎉</div><h1>Buon appetito!</h1>
            <p class="muted">Vuoi segnare la ricetta come cucinata?</p>
            <div class="row" style="justify-content:center"><button class="btn primary" data-c="cooked">✓ Sì, l'ho cucinata</button><button class="btn" data-c="close">Chiudi</button></div></div>`
        : isGroupHeader(steps[i]) ? `<div class="cook-step-n">Sezione</div><div class="cook-step"><b>${esc(steps[i])}</b></div>`
        : `<div class="cook-step-n">Passaggio ${i + 1} di ${steps.length}</div><div class="cook-step">${stepHTML(steps[i], r.title)}</div>`}
      </div>
      <div class="cook-nav">
        <button class="btn" data-c="prev" ${i === 0 ? 'disabled' : ''}>← Indietro</button>
        ${last ? '' : `<button class="btn primary" data-c="next">${i === steps.length - 1 ? 'Fine' : 'Avanti →'}</button>`}
      </div>`;
  };
  const close = () => {
    el.remove();
    keepAwake(false);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('hashchange', close);
  };
  window.addEventListener('hashchange', close);
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { if (i < steps.length) { i++; showIngs = false; draw(); } e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { if (i > 0) { i--; showIngs = false; draw(); } }
    else if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    const c = b.dataset.c;
    if (c === 'close') close();
    else if (c === 'ings') { showIngs = !showIngs; draw(); }
    else if (c === 'next') { i++; showIngs = false; draw(); }
    else if (c === 'prev') { i = Math.max(0, i - 1); showIngs = false; draw(); }
    else if (c === 'cooked') { markCooked(r); close(); }
  });
  // Scorrimento orizzontale sul telefono
  let x0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 70) return;
    if (dx < 0 && i < steps.length) i++;
    else if (dx > 0 && i > 0) i--;
    showIngs = false;
    draw();
  });
  draw();
}

export function markCooked(r) {
  const cur = store.get('recipes', r.id);
  if (!cur) return;
  cur.cookedCount = (cur.cookedCount || 0) + 1;
  cur.lastCooked = now();
  store.upsert('recipes', cur);
  toast('Segnata come cucinata 👨‍🍳');
}
