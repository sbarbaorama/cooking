// Ricerca di ricette sul web (Google, limitata ai siti di ricette italiani)
import * as store from './store.js';
import { esc, toast } from './utils.js';
import { findSharedUrl } from './parser.js';

export const SITES = [
  ['giallozafferano.it', 'GialloZafferano'],
  ['cookaround.com', 'Cookaround'],
  ['fattoincasadabenedetta.it', 'Fatto in casa da Benedetta'],
  ['cookist.it', 'Cookist'],
  ['misya.info', 'Misya'],
  ['cucchiaio.it', 'Il Cucchiaio d’Argento'],
  ['lacucinaitaliana.it', 'La Cucina Italiana'],
];

/** Indirizzo della ricerca Google. mode: 'name' (nome del piatto) o 'ing' (ingredienti). */
export function searchUrl({ mode, q, ings, sites }) {
  const words = mode === 'ing'
    ? `ricetta con ${ings.length > 1 ? ings.slice(0, -1).join(', ') + ' e ' + ings[ings.length - 1] : ings[0]}`
    : `ricetta ${q}`;
  const list = sites?.length ? sites : SITES.map((s) => s[0]);
  const filter = list.length === 1 ? `site:${list[0]}` : `(${list.map((s) => `site:${s}`).join(' OR ')})`;
  return 'https://www.google.com/search?hl=it&q=' + encodeURIComponent(`${words} ${filter}`);
}

const prefs = () => ({ sites: SITES.map((s) => s[0]), ...(store.state.settings.webSearch || {}) });

/**
 * Disegna il pannello "Cerca sul web".
 * init: { mode, q, ings }; onLink(url): importa un link (dagli appunti).
 */
export function webSearchPanel(el, init = {}, { onLink } = {}) {
  const st = { mode: init.mode || (init.ings?.length ? 'ing' : 'name'), q: init.q || '', ings: [...(init.ings || [])], sites: prefs().sites };
  const pantry = [...new Set(store.list('pantry').map((p) => p.name.toLowerCase()))].sort((a, b) => a.localeCompare(b, 'it'));

  const draw = () => {
    el.innerHTML = `
      <div class="card stack">
        <div class="seg" data-g="mode">
          <button type="button" data-v="name" class="${st.mode === 'name' ? 'on' : ''}">🍽️ Per nome</button>
          <button type="button" data-v="ing" class="${st.mode === 'ing' ? 'on' : ''}">🧺 Per ingredienti</button>
        </div>
        ${st.mode === 'name' ? `
          <div class="add-row"><div class="search grow"><input type="search" id="wq" placeholder="Es. parmigiana di melanzane, torta di mele…" value="${esc(st.q)}" autocomplete="off" enterkeyhint="search"></div>
            <button class="btn primary" data-act="go">🔎 Cerca</button></div>`
        : `
          <div class="add-row"><input type="text" id="wi" placeholder="Aggiungi un ingrediente (es. zucca) e premi Invio" autocomplete="off" enterkeyhint="done"><button class="btn" data-act="addi">＋</button></div>
          <div class="chips">${st.ings.length ? st.ings.map((n, i) => `<span class="chip on">${esc(n)} <button class="x" data-rm="${i}" aria-label="Togli ${esc(n)}">×</button></span>`).join('') : '<span class="small muted">Nessun ingrediente scelto.</span>'}</div>
          ${pantry.length ? `<details class="small"${st.ings.length ? '' : ' open'}><summary>Dalla dispensa</summary><div class="chips" style="margin-top:8px">${pantry.filter((n) => !st.ings.includes(n)).map((n) => `<button class="chip" data-addp="${esc(n)}">＋ ${esc(n)}</button>`).join('')}</div></details>` : ''}
          <div><button class="btn primary" data-act="go" ${st.ings.length ? '' : 'disabled'}>🔎 Cerca ricette con ${st.ings.length ? st.ings.length : ''} ${st.ings.length === 1 ? 'ingrediente' : 'ingredienti'}</button></div>`}
        <details class="small"><summary>Siti in cui cercare (${st.sites.length} di ${SITES.length})</summary>
          <div class="chips" style="margin-top:8px">${SITES.map(([d, n]) => `<button class="chip ${st.sites.includes(d) ? 'on' : ''}" data-site="${d}">${esc(n)}</button>`).join('')}</div>
        </details>
      </div>
      <div class="card stack web-help">
        <b>Trovata la ricetta? Importala così:</b>
        <ul>
          <li><b>Telefono:</b> dalla pagina della ricetta usa <i>Condividi → Ricettario</i>.</li>
          <li><b>PC:</b> clicca il pulsante <i>Salva nel Ricettario</i> nella barra dei preferiti (lo trovi in <a href="#/settings">Altro</a>).</li>
          <li><b>Oppure</b> copia il link della pagina e torna qui:</li>
        </ul>
        <div><button class="btn" data-act="clip">📋 Ho copiato il link: importa</button></div>
      </div>`;
    el.querySelector('#wq')?.focus();
  };

  const go = () => {
    if (st.mode === 'name') {
      st.q = el.querySelector('#wq').value.trim();
      if (!st.q) { toast('Scrivi il nome di un piatto'); return; }
    } else if (!st.ings.length) { toast('Aggiungi almeno un ingrediente'); return; }
    if (!st.sites.length) { toast('Scegli almeno un sito'); return; }
    const url = searchUrl(st);
    const w = window.open(url, '_blank');
    if (w) w.opener = null; else location.href = url;
  };
  const addIng = () => {
    const inp = el.querySelector('#wi');
    const vals = inp.value.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!vals.length) return;
    st.ings = [...new Set([...st.ings, ...vals])];
    draw();
    el.querySelector('#wi')?.focus();
  };

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.closest('[data-g=mode]')) { st.q = el.querySelector('#wq')?.value.trim() ?? st.q; st.mode = b.dataset.v; draw(); return; }
    if (b.dataset.rm != null) { st.ings.splice(+b.dataset.rm, 1); draw(); return; }
    if (b.dataset.addp) { st.ings.push(b.dataset.addp); draw(); return; }
    if (b.dataset.site) {
      const d = b.dataset.site;
      st.sites = st.sites.includes(d) ? st.sites.filter((x) => x !== d) : [...st.sites, d];
      store.saveSettings({ webSearch: { sites: st.sites } });
      b.classList.toggle('on', st.sites.includes(d));
      b.closest('details').querySelector('summary').textContent = `Siti in cui cercare (${st.sites.length} di ${SITES.length})`;
      return;
    }
    const a = b.dataset.act;
    if (a === 'go') go();
    else if (a === 'addi') addIng();
    else if (a === 'clip') {
      let txt = '';
      try { txt = await navigator.clipboard.readText(); } catch { toast('Non riesco a leggere gli appunti: incolla il link nella scheda “Da un link”'); onLink?.(''); return; }
      const url = findSharedUrl(txt);
      if (!url) { toast('Negli appunti non c’è un link'); return; }
      onLink?.(url);
    }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'wq') { e.preventDefault(); go(); }
    if (e.target.id === 'wi') { e.preventDefault(); if (e.target.value.trim()) addIng(); else go(); }
  });
  draw();
}
