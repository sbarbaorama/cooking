// Schermate: dispensa e suggerimenti, lista della spesa, menu settimanale, impostazioni
import * as store from './store.js';
import {
  esc, toast, confirmDialog, isoDate, addDays, startOfWeek, DAY_NAMES, fmtDateTime, download, recipeEmoji, now, WA_ICON, shareWhatsApp, refreshView, normPhone,
} from './utils.js';
import { suggest, tokens, aisleOf, AISLE_ORDER } from './match.js';
import { parseIngredient } from './parser.js';
import { STYLES, styleCounts, fillWeek, suggestFor, profile } from './menu.js';
import { thumb, hydrateImages, addToShopping, shoppingText, pickRecipe, openModal } from './ui.js';
import { isConfigured, sync, testConnection, guessDevice } from './github.js';
import { loadSamples } from './views.js';
import { appVersion, checkForUpdate, forceUpdate } from './version.js';

const fresh = (el) => { const n = el.cloneNode(false); el.replaceWith(n); return n; };
const daysTo = (d) => (d ? Math.round((new Date(d + 'T00:00') - new Date(isoDate(new Date()) + 'T00:00')) / 86400000) : null);
const isExpiring = (p) => p.expiry && daysTo(p.expiry) <= 3;

const COMMON = ['uova', 'latte', 'burro', 'farina', 'zucchero', 'pasta', 'riso', 'pomodori', 'passata di pomodoro', 'cipolle', 'aglio',
  'patate', 'carote', 'zucchine', 'parmigiano', 'mozzarella', 'pollo', 'tonno in scatola', 'limoni', 'pane', 'prosciutto cotto', 'yogurt',
  'panna', 'basilico', 'prezzemolo', 'ceci', 'lenticchie', 'pangrattato', 'lievito', 'spinaci'];

// ===================== DISPENSA =====================
const pantryState = { tab: 'cook', required: new Set(), extras: [], maxMissing: 'any' };

export function pantryView(el) {
  const pantry = store.list('pantry');
  el.innerHTML = `
    <div class="page-head"><h1>Dispensa</h1></div>
    <div class="tabs">
      <button data-tab="cook" class="${pantryState.tab === 'cook' ? 'on' : ''}">🍳 Cosa cucino?</button>
      <button data-tab="pantry" class="${pantryState.tab === 'pantry' ? 'on' : ''}">🥫 In dispensa (${pantry.length})</button>
      <button data-tab="staples" class="${pantryState.tab === 'staples' ? 'on' : ''}">🧂 Sempre in casa</button>
    </div>
    <div id="tab"></div>`;
  el.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) { pantryState.tab = b.dataset.tab; pantryView(fresh(el)); }
  });
  const tab = el.querySelector('#tab');
  if (pantryState.tab === 'cook') cookTab(tab, el);
  else if (pantryState.tab === 'pantry') pantryTab(tab, el);
  else staplesTab(tab);
}

function cookTab(tab, root) {
  const pantry = store.list('pantry');
  const recipes = store.list('recipes');
  const have = [...pantry.map((p) => ({ name: p.name, expiring: isExpiring(p) })), ...pantryState.extras.map((name) => ({ name }))];
  const names = [...new Set([...pantry.map((p) => p.name), ...pantryState.extras])];

  tab.innerHTML = `
    <div class="card stack">
      <div class="add-row"><input type="text" id="extra" placeholder="Aggiungi al volo un ingrediente che hai (es. zucchine)…"><button class="btn" data-act="extra">＋</button></div>
      ${names.length ? `<div><div class="small muted mb" style="margin-bottom:6px">Tocca gli ingredienti che vuoi <b>usare per forza</b>:</div>
        <div class="chips">${names.map((n) => {
          const p = pantry.find((x) => x.name === n);
          const exp = p && isExpiring(p);
          return `<button class="chip ${pantryState.required.has(n) ? 'on' : exp ? 'warn' : ''}" data-req="${esc(n)}">${exp ? '⏰ ' : ''}${esc(n)}${pantryState.extras.includes(n) ? ` <span class="x" data-rmextra="${esc(n)}">×</span>` : ''}</button>`;
        }).join('')}</div></div>`
        : '<p class="muted" style="margin:0">La dispensa è vuota: aggiungi quello che hai in casa nella scheda <b>In dispensa</b> oppure scrivilo qui sopra.</p>'}
      <div class="row small"><span class="muted">Mostra ricette con</span>
        <select id="maxmiss" style="width:auto;min-height:34px;padding:4px 8px">
          ${[['0', 'tutto disponibile'], ['1', 'al massimo 1 mancante'], ['2', 'al massimo 2 mancanti'], ['any', 'qualsiasi copertura']].map(([v, l]) => `<option value="${v}" ${v === pantryState.maxMissing ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
    </div>
    <div class="section-title"><h2>Ricette suggerite</h2><span class="muted small" id="nres"></span>
      ${names.length ? `<a class="btn sm" href="#/import?web=ing&ing=${encodeURIComponent((pantryState.required.size ? [...pantryState.required] : names.slice(0, 4)).join(','))}" title="Cerca sul web ricette con ${pantryState.required.size ? 'gli ingredienti scelti' : 'alcuni ingredienti della dispensa'}">🔎 Cerca sul web</a>` : ''}</div>
    <div id="res"></div>`;

  const res = tab.querySelector('#res');
  let results = have.length ? suggest(recipes, have, store.state.data.prefs.staples, { required: [...pantryState.required] }) : [];
  if (pantryState.maxMissing !== 'any') results = results.filter((x) => x.missing <= +pantryState.maxMissing);
  else results = results.filter((x) => x.have > 0);
  tab.querySelector('#nres').textContent = results.length ? `${results.length} trovate` : '';

  if (!recipes.length) res.innerHTML = '<div class="empty">Non hai ancora ricette salvate. <a href="#/import">Aggiungine una</a>.</div>';
  else if (!have.length) res.innerHTML = '<div class="empty"><span class="big">🥕</span>Dimmi cosa hai in casa e ti suggerisco cosa cucinare.</div>';
  else if (!results.length) res.innerHTML = '<div class="empty"><span class="big">🤔</span>Nessuna ricetta corrisponde. Prova ad allargare il filtro o ad aggiungere ingredienti.</div>';
  else {
    res.innerHTML = results.slice(0, 60).map((x) => {
      const pct = Math.round(x.score * 100);
      const miss = x.detail.filter((d) => d.status === 'missing').map((d) => d.name);
      const exp = x.detail.filter((d) => d.expiring).map((d) => d.name);
      return `<div class="sugg">
        <a href="#/r/${x.recipe.id}" style="display:contents;color:inherit;text-decoration:none">${thumb(x.recipe)}
        <div class="grow">
          <div style="font-weight:650">${esc(x.recipe.title)}</div>
          <div class="meter ${pct < 50 ? 'low' : pct < 100 ? 'mid' : ''}"><div style="width:${pct}%"></div></div>
          <div class="small muted">Hai ${x.have} di ${x.have + x.missing} ingredienti${miss.length ? ` · manca: <span style="color:var(--danger)">${esc(miss.slice(0, 5).join(', '))}${miss.length > 5 ? '…' : ''}</span>` : ' · <b style="color:var(--ok)">hai tutto!</b>'}</div>
          ${exp.length ? `<div class="small" style="color:var(--warn)">⏰ Usa ${esc(exp.join(', '))} in scadenza</div>` : ''}
        </div></a>
        <div class="row" style="flex-direction:column;align-items:flex-end;gap:4px">
          <span class="pct">${pct}%</span>
          ${miss.length ? `<button class="btn sm" data-shop="${x.recipe.id}" title="Aggiungi i mancanti alla spesa">🛒</button>` : ''}
        </div>
      </div>`;
    }).join('');
    hydrateImages(res);
  }

  const addExtra = () => {
    const inp = tab.querySelector('#extra');
    const vals = inp.value.split(',').map((s) => s.trim()).filter(Boolean);
    for (const v of vals) if (!pantryState.extras.includes(v)) pantryState.extras.push(v);
    pantryView(fresh(root));
  };
  tab.querySelector('[data-act=extra]').onclick = addExtra;
  tab.querySelector('#extra').addEventListener('keydown', (e) => { if (e.key === 'Enter') addExtra(); });
  tab.querySelector('#maxmiss').onchange = (e) => { pantryState.maxMissing = e.target.value; pantryView(fresh(root)); };
  tab.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rmextra]');
    if (rm) { e.stopPropagation(); pantryState.extras = pantryState.extras.filter((x) => x !== rm.dataset.rmextra); pantryState.required.delete(rm.dataset.rmextra); pantryView(fresh(root)); return; }
    const c = e.target.closest('[data-req]');
    if (c) { const n = c.dataset.req; pantryState.required.has(n) ? pantryState.required.delete(n) : pantryState.required.add(n); pantryView(fresh(root)); return; }
    const s = e.target.closest('[data-shop]');
    if (s) {
      const x = results.find((y) => y.recipe.id === s.dataset.shop);
      const lines = x.detail.filter((d) => d.status === 'missing').map((d) => d.line);
      const { added } = addToShopping(lines, { recipe: x.recipe });
      toast(`${added} ingredienti aggiunti alla spesa`);
    }
  });
}

function pantryTab(tab, root) {
  const items = store.list('pantry');
  const names = new Set(items.map((p) => tokens(p.name).join(' ')));
  const common = COMMON.filter((c) => !names.has(tokens(c).join(' ')));
  const groups = {};
  for (const p of items) (groups[aisleOf(p.name)] ||= []).push(p);
  const expiring = items.filter(isExpiring);

  tab.innerHTML = `
    <div class="card stack">
      <div class="add-row"><input type="text" id="add" placeholder="Cosa hai in casa? (più cose separate da virgola)"><button class="btn primary" data-act="add">Aggiungi</button></div>
      ${common.length ? `<div><div class="small muted" style="margin-bottom:6px">Aggiunta rapida:</div><div class="chips">${common.slice(0, 18).map((c) => `<button class="chip" data-quick="${esc(c)}">＋ ${esc(c)}</button>`).join('')}</div></div>` : ''}
    </div>
    ${expiring.length ? `<div class="card mt" style="background:var(--warn-soft);border-color:transparent">⏰ <b>In scadenza:</b> ${expiring.map((p) => `${esc(p.name)} (${expiryText(p.expiry)})`).join(', ')}.
      <a href="#/pantry" data-gotocook>Vedi cosa cucinare</a></div>` : ''}
    ${items.length ? AISLE_ORDER.filter((a) => groups[a]).map((a) => `
      <div class="shop-group"><h3>${esc(a)}</h3>
        ${groups[a].sort((x, y) => (x.expiry || '9').localeCompare(y.expiry || '9') || x.name.localeCompare(y.name, 'it')).map((p) => `
          <div class="shop-item" data-id="${p.id}">
            <div class="txt">${esc(p.name)}${p.expiry ? ` <span class="chip ${isExpiring(p) ? 'warn' : ''}" style="font-size:.74rem;padding:1px 8px">${expiryText(p.expiry)}</span>` : ''}</div>
            <input type="date" value="${esc(p.expiry || '')}" data-exp title="Scadenza (facoltativa)" style="width:auto;min-height:34px;padding:4px 6px;font-size:.85rem">
            <button class="btn sm ghost" data-del title="Rimuovi">✕</button>
          </div>`).join('')}
      </div>`).join('') : '<div class="empty"><span class="big">🥫</span>La dispensa è vuota.</div>'}
    ${items.length ? '<div class="row mt"><button class="btn sm danger" data-act="clear">Svuota dispensa</button></div>' : ''}`;

  const add = (vals) => {
    const cur = store.list('pantry');
    const toAdd = [];
    for (const v of vals) {
      const name = v.trim().toLowerCase();
      if (!name) continue;
      const k = tokens(name).join(' ');
      if (cur.some((p) => tokens(p.name).join(' ') === k) || toAdd.some((p) => tokens(p.name).join(' ') === k)) continue;
      toAdd.push({ name, expiry: null });
    }
    if (toAdd.length) store.upsertMany('pantry', toAdd);
    pantryView(fresh(root));
    setTimeout(() => document.getElementById('add')?.focus(), 30);
  };
  const inp = tab.querySelector('#add');
  tab.querySelector('[data-act=add]').onclick = () => add(inp.value.split(','));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(inp.value.split(',')); });
  tab.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-quick]');
    if (q) return add([q.dataset.quick]);
    if (e.target.closest('[data-gotocook]')) { e.preventDefault(); pantryState.tab = 'cook'; pantryView(fresh(root)); return; }
    const d = e.target.closest('[data-del]');
    if (d) { store.remove('pantry', d.closest('[data-id]').dataset.id); pantryView(fresh(root)); return; }
    if (e.target.closest('[data-act=clear]') && (await confirmDialog('Svuotare tutta la dispensa?', 'Svuota', true))) {
      store.removeMany('pantry', store.list('pantry').map((p) => p.id));
      pantryView(fresh(root));
    }
  });
  tab.addEventListener('change', (e) => {
    if (!e.target.matches('[data-exp]')) return;
    const p = store.get('pantry', e.target.closest('[data-id]').dataset.id);
    p.expiry = e.target.value || null;
    store.upsert('pantry', p);
    pantryView(fresh(root));
  });
}

function expiryText(d) {
  const n = daysTo(d);
  if (n < 0) return `scaduto da ${-n} g`;
  if (n === 0) return 'scade oggi';
  if (n === 1) return 'scade domani';
  return `scade tra ${n} g`;
}

function staplesTab(tab) {
  const staples = store.state.data.prefs.staples;
  tab.innerHTML = `
    <div class="card stack">
      <p class="muted" style="margin:0">Ingredienti che hai praticamente sempre: non vengono considerati “mancanti” nei suggerimenti e non finiscono nella lista della spesa quando aggiungi una ricetta.</p>
      <div class="add-row"><input type="text" id="st" placeholder="Es. zucchero, aceto, farina…"><button class="btn primary" data-act="add">Aggiungi</button></div>
      <div class="chips">${staples.map((s) => `<span class="chip">${esc(s)}<button class="x" data-rm="${esc(s)}" aria-label="Rimuovi">×</button></span>`).join('') || '<span class="muted">Nessuno.</span>'}</div>
    </div>`;
  const inp = tab.querySelector('#st');
  const add = () => {
    const vals = inp.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!vals.length) return;
    store.setPrefs({ staples: [...new Set([...staples, ...vals])] });
    staplesTab(fresh(tab));
  };
  tab.querySelector('[data-act=add]').onclick = add;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  tab.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (b) { store.setPrefs({ staples: staples.filter((s) => s !== b.dataset.rm) }); staplesTab(fresh(tab)); }
  });
}

// ===================== SPESA =====================
const shopState = { group: true };
const shopKey = (name) => tokens(name).join(' ');

/** Prodotti suggeriti per l'aggiunta rapida: i più comprati, poi quelli comuni. */
function quickItems(todo) {
  const freq = store.state.data.prefs.shopFreq || {};
  const inList = new Set(todo.map((i) => shopKey(i.name)));
  const out = [], seen = new Set();
  const names = [...Object.entries(freq).sort((a, b) => b[1] - a[1]).map((x) => x[0]), ...COMMON];
  for (const n of names) {
    const k = shopKey(n);
    if (!k || inList.has(k) || seen.has(k)) continue;
    seen.add(k); out.push(n);
    if (out.length >= 10) break;
  }
  return out;
}

/** Ricorda quante volte si aggiunge a mano un prodotto (per i suggerimenti rapidi). */
function countAdds(vals) {
  const freq = { ...(store.state.data.prefs.shopFreq || {}) };
  for (const v of vals) {
    const p = parseIngredient(v);
    const name = (p.name || v).toLowerCase().trim();
    if (name && name.length < 40) freq[name] = (freq[name] || 0) + 1;
  }
  // Tiene solo i 60 più frequenti
  store.setPrefs({ shopFreq: Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60)) });
}

/** Elimina elementi della lista con la possibilità di annullare. */
function removeWithUndo(list, msg) {
  const copies = list.map((i) => structuredClone(i));
  store.removeMany('shopping', list.map((i) => i.id));
  toast(msg, 5000, { label: 'Annulla', fn: () => { store.upsertMany('shopping', copies); refreshView(); } });
}

export function shoppingView(el) {
  const items = store.list('shopping');
  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const wa = store.state.settings.wa || {};
  const row = (it) => `<label class="shop-item ${it.checked ? 'checked' : ''}" data-id="${it.id}">
      <input type="checkbox" ${it.checked ? 'checked' : ''}>
      <span class="txt">${esc(shoppingText(it))}${it.recipes?.length ? `<span class="from">per ${esc(it.recipes.join(', '))}</span>` : ''}</span>
      <button class="btn sm ghost" data-del title="Rimuovi" aria-label="Rimuovi">✕</button></label>`;
  let list = '';
  if (shopState.group) {
    const g = {};
    for (const it of todo) (g[it.aisle || aisleOf(it.name)] ||= []).push(it);
    list = AISLE_ORDER.filter((a) => g[a]).map((a) => `<div class="shop-group"><h3>${esc(a)}</h3>${g[a].map(row).join('')}</div>`).join('');
  } else list = `<div class="shop-group">${todo.map(row).join('')}</div>`;
  const quick = quickItems(todo);

  el.innerHTML = `
    <div class="page-head"><h1>Lista della spesa</h1>
      <button class="btn ${shopState.group ? 'on' : ''}" data-act="group" title="Raggruppa per reparto">🗂️ Reparti</button>
    </div>
    ${todo.length ? `<div class="shop-share">
      <div class="txt"><b>Manda la lista</b>${todo.length} ${todo.length === 1 ? 'prodotto' : 'prodotti'} da comprare, ${shopState.group ? 'divisi per reparto' : 'in un unico elenco'}
        ${wa.phone ? '' : '<br><a href="#/settings?focus=wa" class="small">Imposta un contatto preferito</a>'}</div>
      <button class="btn wa" data-act="wa">${WA_ICON} ${wa.phone ? `A ${esc(wa.name || 'contatto preferito')}` : 'WhatsApp'}</button>
      ${wa.phone ? `<button class="btn icon" data-act="wa-any" title="Scegli un altro contatto o un gruppo" aria-label="Invia a un altro contatto">${WA_ICON}<span class="plus">＋</span></button>` : ''}
      <button class="btn icon" data-act="copy" title="Copia il testo" aria-label="Copia il testo">📋</button>
      ${navigator.share ? '<button class="btn icon" data-act="share" title="Altre app" aria-label="Condividi con altre app">📤</button>' : ''}
    </div>` : ''}
    <div class="card"><div class="add-row"><input type="text" id="add" placeholder="Aggiungi prodotto (es. 1 kg di farina)…" autocomplete="off"><button class="btn primary" data-act="add">Aggiungi</button></div>
      ${quick.length ? `<div class="quick-row"><span class="small muted">Aggiungi al volo</span><div class="chips">${quick.map((n) => `<button class="chip quick" data-quick="${esc(n)}">＋ ${esc(n)}</button>`).join('')}</div></div>` : ''}
      <div class="row small mt"><button class="btn sm" data-act="fromplan">📅 Dal menu della settimana</button><button class="btn sm" data-act="fromrecipe">📖 Da una ricetta</button></div></div>
    ${todo.length ? list : `<div class="empty"><span class="big">🛒</span>${done.length ? 'Hai preso tutto! 🎉' : 'La lista è vuota.'}</div>`}
    ${done.length ? `<div class="section-title"><h2 class="muted" style="font-size:1rem">Nel carrello (${done.length})</h2>
        <button class="btn sm" data-act="topantry">🥫 Sposta in dispensa</button><button class="btn sm danger" data-act="cleardone">Elimina</button></div>
      <div class="shop-group">${done.map(row).join('')}</div>` : ''}
    ${items.length ? '<div class="row mt"><button class="btn sm ghost danger" data-act="clearall">Svuota tutta la lista</button></div>' : ''}`;

  const redraw = () => shoppingView(fresh(el));
  const inp = el.querySelector('#add');
  const add = () => {
    const vals = inp.value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!vals.length) return;
    addToShopping(vals, { skipPantry: false });
    countAdds(vals);
    redraw();
    setTimeout(() => document.getElementById('add')?.focus(), 30);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  el.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const it = store.get('shopping', e.target.closest('[data-id]').dataset.id);
    it.checked = e.target.checked;
    store.upsert('shopping', it);
    setTimeout(redraw, 180);
  });
  el.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.preventDefault();
      const it = store.get('shopping', del.closest('[data-id]').dataset.id);
      removeWithUndo([it], `“${it.name}” rimosso`);
      redraw();
      return;
    }
    const q = e.target.closest('[data-quick]');
    if (q) { addToShopping([q.dataset.quick], { skipPantry: false }); countAdds([q.dataset.quick]); toast(`${q.dataset.quick} aggiunto`); redraw(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'add') add();
    else if (a === 'group') { shopState.group = !shopState.group; redraw(); }
    else if (a === 'wa') shareWhatsApp(shoppingMessage(todo), wa.phone);
    else if (a === 'wa-any') shareWhatsApp(shoppingMessage(todo));
    else if (a === 'copy') {
      try { await navigator.clipboard.writeText(shoppingMessage(todo)); toast('Lista copiata negli appunti'); } catch { toast('Impossibile copiare'); }
    } else if (a === 'share') {
      const text = shoppingMessage(todo);
      try { await navigator.share({ title: 'Lista della spesa', text }); } catch (err) {
        if (err.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); toast('Lista copiata negli appunti'); } catch { toast('Impossibile condividere'); } }
      }
    } else if (a === 'cleardone') { removeWithUndo(done, `${done.length} ${done.length === 1 ? 'prodotto eliminato' : 'prodotti eliminati'}`); redraw(); }
    else if (a === 'clearall') { removeWithUndo(items, 'Lista svuotata'); redraw(); }
    else if (a === 'topantry') {
      const cur = store.list('pantry');
      const toAdd = [];
      for (const it of done) {
        const k = shopKey(it.name);
        if (k && !cur.some((p) => shopKey(p.name) === k) && !toAdd.some((p) => shopKey(p.name) === k)) toAdd.push({ name: it.name.toLowerCase(), expiry: null });
      }
      if (toAdd.length) store.upsertMany('pantry', toAdd);
      const copies = done.map((i) => structuredClone(i));
      store.removeMany('shopping', done.map((i) => i.id));
      toast(`${toAdd.length} prodotti aggiunti alla dispensa`, 5000, { label: 'Annulla', fn: () => {
        if (toAdd.length) store.removeMany('pantry', toAdd.map((p) => p.id));
        store.upsertMany('shopping', copies);
        refreshView();
      } });
      redraw();
    } else if (a === 'fromrecipe') {
      const res = await pickRecipe('Aggiungi ingredienti di…', { allowFree: false });
      if (res?.recipe) { const { added } = addToShopping(res.recipe.ingredients, { recipe: res.recipe }); toast(`${added} ingredienti aggiunti`); redraw(); }
    } else if (a === 'fromplan') { await shopFromWeek(startOfWeek(new Date())); redraw(); }
  });
}

const AISLE_EMOJI = {
  'Frutta e verdura': '🥬', 'Carne e pesce': '🐟', 'Salumi e formaggi': '🧀', 'Latte, uova e frigo': '🥚', 'Pane e forno': '🥖',
  'Pasta, riso e cereali': '🍝', 'Dispensa': '🫙', 'Bevande': '🍷', 'Surgelati': '❄️', 'Altro': '🧺',
};

/** Testo della lista per WhatsApp: grassetto per i reparti (*…*), una riga per prodotto. */
function shoppingMessage(todo) {
  const date = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const line = (i) => `▢ ${shoppingText(i)}`;
  let body;
  if (shopState.group) {
    const g = {};
    for (const it of todo) (g[it.aisle || aisleOf(it.name)] ||= []).push(it);
    body = AISLE_ORDER.filter((a) => g[a]).map((a) => `${AISLE_EMOJI[a] || '•'} *${a}*\n${g[a].map(line).join('\n')}`).join('\n\n');
  } else body = todo.map(line).join('\n');
  return `🛒 *Lista della spesa*\n_${date}_\n\n${body}\n\n${todo.length} ${todo.length === 1 ? 'prodotto' : 'prodotti'} · dal Ricettario`;
}

async function shopFromWeek(weekStart) {
  const from = isoDate(weekStart), to = isoDate(addDays(weekStart, 6));
  const today = isoDate(new Date());
  const entries = store.list('plan').filter((p) => p.date >= from && p.date <= to && p.date >= (from > today ? from : today) && p.recipeId);
  if (!entries.length) { toast('Nessuna ricetta in programma per i prossimi giorni di questa settimana'); return; }
  let total = 0;
  for (const p of entries) {
    const r = store.get('recipes', p.recipeId);
    if (!r) continue;
    const factor = p.servings && r.servings ? p.servings / r.servings : 1;
    total += addToShopping(r.ingredients, { recipe: r, factor }).added;
  }
  toast(`${total} ingredienti aggiunti da ${entries.length} pasti`);
}

// ===================== MENU SETTIMANALE =====================
const MEALS = [['pranzo', 'Pranzo'], ['cena', 'Cena']];
const planState = { week: startOfWeek(new Date()) };
const planPrefs = () => ({ meals: 'both', style: 'varieta', ...(store.state.settings.planPrefs || {}) });
const MAIN_ICON = { pasta: '🍝', carne: '🥩', pesce: '🐟', veg: '🥦' };

export function planView(el) {
  const ws = planState.week;
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const from = isoDate(days[0]), to = isoDate(days[6]);
  const today = isoDate(new Date());
  const entries = store.list('plan').filter((p) => p.date >= from && p.date <= to);
  const fmt = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  el.innerHTML = `
    <div class="page-head"><h1>Menu della settimana</h1>
      <div class="row nowrap">
        <button class="btn icon" data-w="-1" aria-label="Settimana precedente">‹</button>
        <button class="btn" data-w="0">${fmt(days[0])} – ${fmt(days[6])}</button>
        <button class="btn icon" data-w="1" aria-label="Settimana successiva">›</button>
      </div>
    </div>
    <div class="row mb">
      <button class="btn primary" data-act="auto">✨ Compila automaticamente</button>
      <button class="btn" data-act="shop">🛒 Crea lista della spesa</button>
      ${entries.length ? '<button class="btn ghost danger" data-act="clear">Svuota settimana</button>' : ''}
    </div>
    <div class="week">${days.map((d, i) => {
      const iso = isoDate(d);
      return `<div class="day ${iso === today ? 'today' : ''}"><h3><span>${DAY_NAMES[i]}</span><span class="muted">${d.getDate()}</span></h3>
        ${MEALS.map(([k, label]) => `<div class="meal-slot"><div class="lab">${label}</div>
          ${entries.filter((p) => p.date === iso && p.meal === k).map((p) => {
            const r = p.recipeId && store.get('recipes', p.recipeId);
            return `<div class="plan-item" data-id="${p.id}">${r ? `<a href="#/r/${r.id}">${esc(recipeEmoji(r))} ${esc(r.title)}</a>` : `<a>${esc(p.title || '?')}</a>`}${r ? '<button data-swap title="Proponi un altro piatto" aria-label="Cambia piatto">↻</button>' : ''}<button data-del aria-label="Rimuovi">✕</button></div>`;
          }).join('')}
          <button class="add-slot" data-add="${iso}|${k}">＋</button></div>`).join('')}
      </div>`;
    }).join('')}</div>`;

  const redraw = () => planView(fresh(el));
  el.addEventListener('click', async (e) => {
    const w = e.target.closest('[data-w]');
    if (w) { planState.week = +w.dataset.w === 0 ? startOfWeek(new Date()) : addDays(planState.week, 7 * +w.dataset.w); redraw(); return; }
    const del = e.target.closest('[data-del]');
    if (del) { store.remove('plan', del.closest('[data-id]').dataset.id); redraw(); return; }
    const swap = e.target.closest('[data-swap]');
    if (swap) { swapMeal(swap.closest('[data-id]').dataset.id, entries); redraw(); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      const [date, meal] = add.dataset.add.split('|');
      const res = await pickRecipe(`${DAY_NAMES[(new Date(date + 'T00:00').getDay() + 6) % 7]} – ${meal}`);
      if (res?.recipe) store.upsert('plan', { date, meal, recipeId: res.recipe.id, servings: res.recipe.servings });
      else if (res?.free) store.upsert('plan', { date, meal, title: res.free });
      redraw();
      return;
    }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'shop') await shopFromWeek(ws);
    else if (a === 'clear') { if (await confirmDialog('Rimuovere tutti i pasti di questa settimana?', 'Svuota', true)) { store.removeMany('plan', entries.map((p) => p.id)); redraw(); } }
    else if (a === 'auto') { if (await autoFillDialog(days, entries)) redraw(); }
  });
}

/** Finestra "Compila automaticamente": quali pasti e che tipo di menu. Restituisce true se ha aggiunto qualcosa. */
function autoFillDialog(days, entries) {
  return new Promise((resolve) => {
    const recipes = store.list('recipes');
    if (!recipes.length) { toast('Aggiungi prima qualche ricetta'); resolve(false); return; }
    const counts = styleCounts(recipes);
    const prefs = planPrefs();
    const today = isoDate(new Date());
    const isos = days.map(isoDate);
    const free = (meal) => isos.filter((d) => d >= today && !entries.some((p) => p.date === d && p.meal === meal)).length;
    let done = false;
    const m = openModal(`
      <header><h2>✨ Compila il menu</h2><button class="btn ghost icon" data-close aria-label="Chiudi">✕</button></header>
      <div class="mbody stack">
        <div><div class="opt-lab">Quali pasti</div>
          <div class="seg" data-g="meals">
            ${[['both', 'Pranzi e cene', free('pranzo') + free('cena')], ['cena', 'Solo cene', free('cena')], ['pranzo', 'Solo pranzi', free('pranzo')]]
              .map(([v, l, n]) => `<button type="button" data-v="${v}" class="${prefs.meals === v ? 'on' : ''}">${l}<small>${n} liberi</small></button>`).join('')}
          </div></div>
        <div><div class="opt-lab">Che tipo di menu</div>
          <div class="style-grid" data-g="style">
            ${Object.entries(STYLES).map(([k, st]) => `<button type="button" data-v="${k}" class="style-opt ${prefs.style === k ? 'on' : ''}" ${counts[k] ? '' : 'disabled'}>
              <span class="ico">${st.icon}</span><b>${st.label}</b><span class="small muted">${st.hint}</span><span class="cnt">${counts[k]} ${counts[k] === 1 ? 'ricetta' : 'ricette'}</span></button>`).join('')}
          </div></div>
        <p class="small muted" style="margin:0">Riempie solo i pasti vuoti${isos[6] >= today ? (isos[0] < today ? ', da oggi a domenica' : '') : ''}. A pranzo preferisce i primi, a cena i secondi; sceglie ricette ben votate, di stagione e non cucinate di recente, senza ripeterle nella settimana.</p>
      </div>
      <footer><button class="btn" data-close>Annulla</button><button class="btn primary" data-go>✨ Compila</button></footer>`,
    { onClose: () => resolve(done) });
    const sel = { ...prefs };
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g] [data-v]');
      if (b && !b.disabled) {
        const g = b.closest('[data-g]').dataset.g;
        sel[g] = b.dataset.v;
        b.closest('[data-g]').querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
        return;
      }
      if (!e.target.closest('[data-go]')) return;
      store.saveSettings({ planPrefs: sel });
      planState.style = sel.style;
      const meals = sel.meals === 'both' ? ['pranzo', 'cena'] : [sel.meals];
      const { add, empty, repeated } = fillWeek(recipes, { days: isos, meals, style: sel.style, existing: entries, fromDate: today });
      if (add.length) {
        store.upsertMany('plan', add);
        done = true;
        const st = STYLES[sel.style];
        toast(`${add.length} ${add.length === 1 ? 'pasto aggiunto' : 'pasti aggiunti'} · ${st.label}${empty ? ` · ${empty} restano vuoti: servono più ricette di questo tipo` : repeated ? ` · ${repeated} ${repeated === 1 ? 'ricetta si ripete' : 'ricette si ripetono'}: aggiungine altre di questo tipo` : ''}`, 6000,
          { label: 'Annulla', fn: () => { store.removeMany('plan', add.map((p) => p.id)); refreshView(); } });
      } else toast(empty ? 'Non ci sono abbastanza ricette di questo tipo' : 'Non ci sono pasti vuoti da riempire', 4000);
      m.close();
    });
  });
}

/** Sostituisce un piatto del menu con un altro consigliato (stesso stile dell'ultima compilazione). */
function swapMeal(id, entries) {
  const item = store.get('plan', id);
  if (!item) return;
  const recipes = store.list('recipes');
  const style = planState.style || planPrefs().style;
  const others = entries.filter((p) => p.id !== id && p.recipeId);
  const ctx = { style, used: new Set([item.recipeId, ...others.map((p) => p.recipeId)]), mainsByDay: new Map(), recipesByDay: new Map(), mainCount: {}, prevMain: null };
  for (const p of others) {
    const r = store.get('recipes', p.recipeId);
    if (!r) continue;
    const pr = profile(r);
    ctx.mainsByDay.set(p.date, [...(ctx.mainsByDay.get(p.date) || []), pr.main]);
    ctx.recipesByDay.set(p.date, [...(ctx.recipesByDay.get(p.date) || []), r.id]);
    ctx.mainCount[pr.main] = (ctx.mainCount[pr.main] || 0) + 1;
  }
  ctx.recipesByDay.set(item.date, [...(ctx.recipesByDay.get(item.date) || []), item.recipeId]);
  const r = suggestFor(recipes, item, ctx);
  if (!r || r.id === item.recipeId) { toast(`Nessun’altra ricetta adatta (${STYLES[style].label})`); return; }
  const prev = { ...item };
  store.upsert('plan', { ...item, recipeId: r.id, servings: r.servings, title: undefined });
  toast(`${MAIN_ICON[profile(r).main] || ''} ${r.title}`, 5000, { label: 'Annulla', fn: () => { store.upsert('plan', prev); refreshView(); } });
}

/** Finestra "aggiungi questa ricetta al menu". */
export function planAddDialog(r) {
  const ws = startOfWeek(new Date());
  const days = [...Array(14)].map((_, i) => addDays(ws, i)).filter((d) => isoDate(d) >= isoDate(new Date()));
  const m = openModal(`
    <header><h2>Aggiungi al menu</h2><button class="btn ghost icon" data-close aria-label="Chiudi">✕</button></header>
    <div class="mbody stack">
      <div><b>${esc(r.title)}</b></div>
      <label class="field"><span>Giorno</span><select id="pd">${days.map((d) => `<option value="${isoDate(d)}">${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</option>`).join('')}</select></label>
      <label class="field"><span>Pasto</span><select id="pm">${MEALS.map(([k, l]) => `<option value="${k}" ${k === 'cena' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <footer><button class="btn" data-close>Annulla</button><button class="btn primary" id="pok">Aggiungi</button></footer>`);
  m.el.querySelector('#pok').onclick = () => {
    store.upsert('plan', { date: m.el.querySelector('#pd').value, meal: m.el.querySelector('#pm').value, recipeId: r.id, servings: r.servings });
    m.close();
    toast('Aggiunta al menu 📅');
  };
}

// ===================== IMPOSTAZIONI =====================
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

/** Parametri dopo "?" nell'indirizzo (#/settings?setup=…). */
function hashParams() {
  const h = location.hash, i = h.indexOf('?');
  return Object.fromEntries(new URLSearchParams(i >= 0 ? h.slice(i + 1) : ''));
}

/** Link che apre l'app su un altro dispositivo con utente e repository già compilati (senza token). */
function setupLink() {
  const g = store.state.settings.gh;
  const data = btoa(unescape(encodeURIComponent(JSON.stringify({ o: g.owner, r: g.repo, b: g.branch, p: g.path }))));
  return location.origin + location.pathname + '#/settings?setup=' + encodeURIComponent(data);
}

export function settingsView(el) {
  const s = store.state.settings, meta = store.state.meta;
  const params = hashParams();
  let g = s.gh, incoming = null;
  if (params.setup) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(params.setup))));
      if (d.o && d.r) { incoming = d; g = { ...s.gh, owner: d.o, repo: d.r, branch: d.b || 'main', path: d.p || 'ricettario.json' }; }
    } catch { toast('Link di configurazione non valido'); }
  }
  const wa = s.wa || {};
  const recipes = store.list('recipes');
  const appUrl = location.origin + location.pathname;
  const bookmarklet = `javascript:(()=>{const L=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent).filter(t=>/Recipe/.test(t));const m=document.querySelector('meta[property="og:image"]');const sel=String(getSelection());const p={u:location.href,t:document.title,i:m?m.content:'',l:L,s:sel||(L.length?'':document.body.innerText.slice(0,12000))};window.open('${appUrl}#/import?bm='+encodeURIComponent(JSON.stringify(p)),'_blank')})()`;
  const theme = (() => { try { return localStorage.getItem('theme') || ''; } catch { return ''; } })();
  const standalone = matchMedia('(display-mode: standalone)').matches;

  el.innerHTML = `
    <div class="page-head"><h1>Altro</h1></div>
    ${incoming ? `<div class="card mb" style="background:var(--sea-soft);border-color:transparent">👋 <b>Configurazione ricevuta</b> per il repository <code>${esc(incoming.o)}/${esc(incoming.r)}</code>.
      Ho già compilato i campi qui sotto: incolla il <b>tuo token</b> GitHub (vedi “Come configurarla” più sotto) e premi <b>Salva</b>.</div>` : ''}

    <div class="card stack" id="wa-card">
      <h2>💬 WhatsApp</h2>
      <p class="muted small" style="margin:0">Scegli a chi mandare di solito la lista della spesa: il pulsante WhatsApp aprirà direttamente la sua chat. Per mandarla a un gruppo o a qualcun altro resta disponibile il pulsante “altro contatto”.</p>
      <div class="grid-form">
        <label class="field"><span>Nome</span><input type="text" id="wa-name" value="${esc(wa.name || '')}" placeholder="Es. Marta"></label>
        <label class="field"><span>Numero di telefono</span><input type="tel" id="wa-phone" value="${esc(wa.phone || '')}" placeholder="333 123 4567" inputmode="tel"></label>
      </div>
      <div class="row"><button class="btn primary" data-act="wa-save">Salva contatto</button>
        ${wa.phone ? '<button class="btn" data-act="wa-test">Prova</button><button class="btn ghost danger" data-act="wa-clear">Rimuovi</button>' : ''}
        <span class="small muted">Senza prefisso internazionale viene usato +39. Il contatto resta salvato solo su questo dispositivo.</span></div>
    </div>

    <div class="card stack">
      <h2>☁️ Sincronizzazione con GitHub</h2>
      <p class="muted small" style="margin:0">I dati sono salvati sul dispositivo e, se configuri GitHub, anche in un file <code>${esc(g.path || 'ricettario.json')}</code> nel tuo repository privato: così ritrovi tutto su PC, tablet e telefono.</p>
      <form id="gh" class="grid-form" autocomplete="off">
        <label class="field"><span>Utente / organizzazione</span><input type="text" name="owner" value="${esc(g.owner)}" placeholder="il-tuo-utente"></label>
        <label class="field"><span>Repository dati (privato)</span><input type="text" name="repo" value="${esc(g.repo)}" placeholder="ricettario-dati"></label>
        <label class="field"><span>Branch</span><input type="text" name="branch" value="${esc(g.branch)}"></label>
        <label class="field"><span>File</span><input type="text" name="path" value="${esc(g.path)}"></label>
        <label class="field" style="grid-column:1/-1"><span>Token di accesso (fine-grained, permesso “Contents: read and write” solo su quel repo)</span>
          <input type="password" name="token" value="${esc(g.token)}" placeholder="github_pat_…" autocomplete="off"></label>
        <label class="field"><span>Nome di questo dispositivo</span><input type="text" name="deviceName" value="${esc(s.deviceName)}" placeholder="${esc(guessDevice())}"></label>
        <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="autoSync" ${s.autoSync ? 'checked' : ''}> Sincronizza automaticamente</label>
      </form>
      <div class="row">
        <button class="btn primary" data-act="save">Salva</button>
        <button class="btn" data-act="test">Verifica connessione</button>
        <button class="btn" data-act="sync" ${isConfigured() ? '' : 'disabled'}>🔄 Sincronizza ora</button>
      </div>
      <div class="small ${meta.lastError ? '' : 'muted'}" id="ghstatus" style="${meta.lastError ? 'color:var(--danger)' : ''}">
        ${isConfigured() ? `Ultima sincronizzazione: ${fmtDateTime(meta.lastSync)}${meta.dirty ? ' · modifiche locali da inviare' : ''}${meta.lastError ? `<br>Errore: ${esc(meta.lastError)}` : ''}` : 'Non configurato: i dati restano solo su questo dispositivo.'}
      </div>
      <details class="small"><summary>Come configurarla (5 minuti)</summary>
        <ol>
          <li>Su GitHub crea un <b>nuovo repository privato</b>, ad esempio <code>ricettario-dati</code> (puoi lasciarlo vuoto, ma spunta “Add a README” così ha già un branch <code>main</code>).</li>
          <li>Vai su <i>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</i>.</li>
          <li>In <i>Repository access</i> scegli <b>Only select repositories</b> e seleziona solo il repository dei dati.</li>
          <li>In <i>Permissions → Repository permissions</i> imposta <b>Contents: Read and write</b>. Scegli una scadenza (es. 1 anno).</li>
          <li>Copia il token, incollalo qui sopra con utente e nome del repository, premi <b>Salva</b> e poi <b>Verifica connessione</b>.</li>
          <li>Ripeti la configurazione su ogni dispositivo (il token resta salvato solo sul dispositivo, non nel repository).</li>
        </ol>
        <p>Il file è un normale JSON leggibile: GitHub conserva la cronologia di ogni modifica, quindi puoi sempre recuperare una versione precedente.</p>
      </details>
    </div>

    <div class="card stack">
      <h2>👥 Lista condivisa in famiglia</h2>
      <p class="small" style="margin:0">Se anche un’altra persona usa il Ricettario collegato allo <b>stesso repository</b>, ricette, dispensa, menu e lista della spesa restano allineati su entrambi i telefoni: quando uno spunta un prodotto al supermercato, l’altro lo vede dopo pochi secondi.</p>
      ${isConfigured() ? `
      <ol class="small" style="margin:0;padding-left:20px">
        <li>Su GitHub, nel repository <code>${esc(s.gh.repo)}</code>, vai su <i>Settings → Collaborators</i> e invita l’account GitHub dell’altra persona (oppure usate lo stesso account).</li>
        <li>L’altra persona crea il <b>suo</b> token fine-grained (stessi permessi: <i>Contents: Read and write</i> solo su quel repository). È meglio non condividere il tuo.</li>
        <li>Mandale il link qui sotto: aprendolo, l’app si configura da sola e le chiede solo il token.</li>
      </ol>
      <div class="row">
        <button class="btn wa" data-act="setup-wa">${WA_ICON} Invia il link su WhatsApp</button>
        <button class="btn" data-act="setup-copy">🔗 Copia il link</button>
      </div>
      <p class="small muted" style="margin:0">Il link contiene solo utente e nome del repository, mai il token.</p>`
      : '<p class="small muted" style="margin:0">Prima configura la sincronizzazione con GitHub qui sopra: poi qui troverai il link da mandare all’altra persona.</p>'}
    </div>

    <div class="card stack">
      <h2>📥 Importare ricette dal web</h2>
      <p class="small" style="margin:0"><b>Su PC:</b> trascina questo pulsante nella barra dei preferiti. Quando sei su una pagina con una ricetta, cliccalo: la ricetta si apre nel Ricettario pronta da salvare (puoi anche selezionare prima il testo da importare).</p>
      <div><a class="bookmarklet" href="${esc(bookmarklet)}" onclick="event.preventDefault();alert('Trascina questo pulsante nella barra dei preferiti del browser.')">🍝 Salva nel Ricettario</a></div>
      <p class="small" style="margin:0"><b>Su Android:</b> installa l’app (vedi sotto), poi in Chrome apri una ricetta e usa <i>Condividi → Ricettario</i>.</p>
      <label class="field"><span>Proxy per scaricare le pagine ({url} viene sostituito con il link)</span><input type="text" id="proxy" value="${esc(s.proxy)}"></label>
    </div>

    <div class="card stack" id="ver-card">
      <h2>📱 App e aspetto</h2>
      <div class="ver-box">
        <div><span class="small muted">Versione installata</span><b id="ver-num">…</b></div>
        <div class="row">
          <button class="btn" data-act="ver-check">🔄 Controlla aggiornamenti</button>
          <button class="btn ghost" data-act="ver-force" title="Riscarica l’app dal server">Forza aggiornamento</button>
        </div>
      </div>
      <p class="small muted" style="margin:0">L’app si aggiorna da sola: quando pubblichi una versione nuova compare l’avviso <b>Aggiorna</b>. “Forza aggiornamento” riscarica tutti i file dell’app; ricette, spesa e impostazioni restano al loro posto.</p>
      ${standalone ? '<p class="small muted" style="margin:0">✓ Stai usando l’app installata.</p>' : `<div class="row"><button class="btn" data-act="install">⬇️ Installa l’app</button>
        <span class="small muted">Su Android: menu ⋮ di Chrome → “Installa app” / “Aggiungi a schermata Home”. Su PC: icona di installazione nella barra degli indirizzi.</span></div>`}
      <label class="field" style="max-width:260px"><span>Tema</span><select id="theme">
        <option value="" ${!theme ? 'selected' : ''}>Automatico</option><option value="light" ${theme === 'light' ? 'selected' : ''}>Chiaro</option><option value="dark" ${theme === 'dark' ? 'selected' : ''}>Scuro</option></select></label>
    </div>

    <div class="card stack">
      <h2>📊 Statistiche</h2>
      <div class="kpis">
        <div class="kpi"><b>${recipes.length}</b><span class="small muted">ricette</span></div>
        <div class="kpi"><b>${recipes.filter((r) => r.favorite).length}</b><span class="small muted">preferite</span></div>
        <div class="kpi"><b>${recipes.reduce((a, r) => a + (r.cookedCount || 0), 0)}</b><span class="small muted">volte ai fornelli</span></div>
        <div class="kpi"><b>${store.list('pantry').length}</b><span class="small muted">in dispensa</span></div>
      </div>
      ${topCooked(recipes)}
    </div>

    <div class="card stack">
      <h2>💾 Backup</h2>
      <div class="row">
        <button class="btn" data-act="export">⬇️ Esporta tutto (JSON)</button>
        <label class="btn">⬆️ Importa backup<input type="file" accept=".json,application/json" id="importfile" hidden></label>
        <button class="btn" data-act="samples">🍝 Aggiungi ricette di esempio</button>
      </div>
      <p class="small muted" style="margin:0">L’importazione unisce i dati del file a quelli esistenti (non cancella nulla).</p>
      <hr>
      <div class="row"><button class="btn danger" data-act="wipe">Cancella i dati da questo dispositivo</button>
      <span class="small muted">I dati su GitHub non vengono toccati.</span></div>
    </div>
    <p class="small muted center">Ricettario · i tuoi dati restano tuoi</p>`;

  const form = el.querySelector('#gh');
  const readForm = () => {
    const f = new FormData(form);
    return {
      gh: {
        owner: String(f.get('owner')).trim(), repo: String(f.get('repo')).trim(), branch: String(f.get('branch')).trim() || 'main',
        path: String(f.get('path')).trim() || 'ricettario.json', token: String(f.get('token')).trim(),
      },
      deviceName: String(f.get('deviceName')).trim(), autoSync: !!f.get('autoSync'),
    };
  };
  const status = el.querySelector('#ghstatus');
  const redraw = () => settingsView(fresh(el));
  appVersion().then((v) => { const n = el.querySelector('#ver-num'); if (n) n.textContent = v || 'non disponibile'; });
  if (params.focus === 'ver') setTimeout(() => el.querySelector('#ver-card')?.scrollIntoView({ block: 'start' }), 50);
  if (params.focus === 'wa') setTimeout(() => { el.querySelector('#wa-card')?.scrollIntoView({ block: 'start' }); el.querySelector(wa.phone ? '#wa-phone' : '#wa-name')?.focus(); }, 50);

  el.querySelector('#proxy').addEventListener('change', (e) => store.saveSettings({ proxy: e.target.value.trim() || store.DEFAULT_SETTINGS.proxy }));
  el.querySelector('#theme').addEventListener('change', (e) => {
    const v = e.target.value;
    try { v ? localStorage.setItem('theme', v) : localStorage.removeItem('theme'); } catch {}
    if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  });
  el.querySelector('#importfile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.recipes)) throw new Error('formato');
      const merged = store.mergeData(store.state.data, data);
      store.replaceData(merged, { dirty: true });
      store.state.meta.localChangedAt = now();
      toast(`Backup importato: ${store.list('recipes').length} ricette totali`);
      redraw();
    } catch { toast('File non valido'); }
  });

  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!a) return;
    if (a === 'ver-check') {
      e.target.closest('button').disabled = true;
      const r = await checkForUpdate();
      e.target.closest('button').disabled = false;
      toast(r === 'found' ? 'Nuova versione trovata: premi “Aggiorna” in basso' : r === 'offline' ? 'Sei offline: riprova con la connessione' : `Hai già l’ultima versione (${await appVersion() || '—'}) ✓`, 4000);
      return;
    }
    if (a === 'ver-force') {
      if (await confirmDialog('Riscaricare l’app dal server? Ricette, spesa e impostazioni non vengono toccate.', 'Aggiorna ora')) forceUpdate();
      return;
    }
    if (a === 'wa-save') {
      const phone = el.querySelector('#wa-phone').value.trim();
      const name = el.querySelector('#wa-name').value.trim();
      if (phone && normPhone(phone).length < 8) { toast('Numero non valido'); return; }
      await store.saveSettings({ wa: phone ? { phone, name } : {} });
      toast(phone ? 'Contatto WhatsApp salvato' : 'Contatto rimosso');
      redraw();
    } else if (a === 'wa-clear') { await store.saveSettings({ wa: {} }); toast('Contatto rimosso'); redraw(); }
    else if (a === 'wa-test') shareWhatsApp('Ciao! Da adesso ti mando la lista della spesa da qui 🛒', wa.phone);
    else if (a === 'setup-wa' || a === 'setup-copy') {
      const link = setupLink();
      if (a === 'setup-wa') shareWhatsApp(`Ho collegato il Ricettario per condividere ricette e lista della spesa 🍝\nApri questo link e inserisci il tuo token GitHub:\n${link}`);
      else { try { await navigator.clipboard.writeText(link); toast('Link copiato'); } catch { toast('Impossibile copiare'); } }
    } else if (a === 'save') {
      await store.saveSettings(readForm());
      if (params.setup) history.replaceState(null, '', location.pathname + location.search + '#/settings');
      toast('Impostazioni salvate');
      if (isConfigured()) { try { await sync(); toast('Sincronizzato ✓'); } catch (err) { toast(err.message, 5000); } }
      redraw();
    } else if (a === 'test') {
      await store.saveSettings(readForm());
      status.textContent = '⏳ Verifico…';
      status.style.color = '';
      try {
        const r = await testConnection();
        status.innerHTML = `✅ Connessione riuscita. Repository ${r.private ? 'privato' : '<b style="color:var(--danger)">PUBBLICO (attenzione: i dati sarebbero visibili a tutti)</b>'}.
          ${r.canPush === false ? '<br><b style="color:var(--danger)">Il token non ha il permesso di scrittura.</b>' : ''}
          ${r.exists ? `<br>Trovato il file dati con ${r.recipes} ricette.` : '<br>Il file dati verrà creato alla prima sincronizzazione.'}`;
      } catch (err) { status.innerHTML = `❌ ${esc(err.message)}`; status.style.color = 'var(--danger)'; }
    } else if (a === 'sync') {
      try { const r = await sync(); toast(r.pushed ? 'Sincronizzato ✓ (dati inviati)' : 'Sincronizzato ✓ (già aggiornato)'); } catch (err) { toast(err.message, 5000); }
      redraw();
    } else if (a === 'install') {
      if (installEvt) { installEvt.prompt(); installEvt = null; }
      else toast('Usa il menu del browser: “Installa app” o “Aggiungi a schermata Home”', 4500);
    } else if (a === 'export') {
      download(`ricettario-backup-${isoDate(new Date())}.json`, store.serialize(store.state.data));
    } else if (a === 'samples') { loadSamples(); redraw(); }
    else if (a === 'wipe') {
      const warn = store.state.meta.dirty && isConfigured() ? ' Ci sono modifiche non ancora inviate a GitHub che andranno perse.' : !isConfigured() ? ' Non hai configurato GitHub: i dati andranno persi definitivamente (esporta prima un backup).' : '';
      if (await confirmDialog(`Cancellare tutti i dati salvati su questo dispositivo?${warn}`, 'Cancella', true)) {
        store.replaceData(store.emptyData(), { dirty: false });
        store.state.meta.lastSync = 0;
        await store.saveMeta();
        toast('Dati locali cancellati');
        redraw();
      }
    }
  });
}

function topCooked(recipes) {
  const top = recipes.filter((r) => r.cookedCount).sort((a, b) => b.cookedCount - a.cookedCount).slice(0, 5);
  if (!top.length) return '';
  return `<div class="small"><b>Le più cucinate:</b> ${top.map((r) => `<a href="#/r/${r.id}">${esc(r.title)}</a> (${r.cookedCount})`).join(' · ')}</div>`;
}
