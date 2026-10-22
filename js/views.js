// Schermate delle ricette: elenco, dettaglio, modifica, importazione
import * as store from './store.js';
import { esc, toast, minToText, fmtDate, confirmDialog, recipeEmoji, debounce } from './utils.js';
import {
  parseIngredient, formatIngredient, isGroupHeader, blankRecipe, parseRecipeText, fetchRecipeFromUrl,
  recipeFromBookmarklet, recipeToText,
} from './parser.js';
import { normText, tokens, ingredientName, prepareHave, findHave } from './match.js';
import { imgTag, hydrateImages, storePhoto, addToShopping, stepHTML, cookMode, markCooked, openModal } from './ui.js';
import { SAMPLE_RECIPES } from './samples.js';

const listState = { q: '', tag: '', cat: '', sort: 'recent', fav: false };
let draft = null;
export function setDraft(r) { draft = r; }

const totalTime = (r) => r.totalTime || ((r.prepTime || 0) + (r.cookTime || 0)) || null;

// ===================== ELENCO =====================
export function recipesView(el) {
  const all = store.list('recipes');
  if (!all.length) {
    el.innerHTML = `
      <div class="empty">
        <span class="big">📖</span>
        <h1>Il tuo ricettario è vuoto</h1>
        <p>Incolla una ricetta trovata online, importala da un link o scrivila a mano.</p>
        <div class="row" style="justify-content:center">
          <a class="btn primary" href="#/import">＋ Aggiungi la prima ricetta</a>
          <button class="btn" data-act="samples">Carica ricette di esempio</button>
        </div>
        <p class="small mt">Usi più dispositivi? <a href="#/settings">Collega il tuo repository GitHub</a> per sincronizzarli.</p>
      </div>`;
    el.querySelector('[data-act=samples]').onclick = () => { loadSamples(); recipesView(el); };
    return;
  }

  const cats = [...new Set(all.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
  const tagCount = {};
  all.forEach((r) => (r.tags || []).forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
  const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 24).map((x) => x[0]);

  el.innerHTML = `
    <div class="page-head">
      <h1>Le mie ricette <span class="muted small" id="count"></span></h1>
      <button class="btn" data-act="random" title="Una ricetta a caso">🎲 Ispirami</button>
    </div>
    <div class="toolbar">
      <div class="search"><input type="search" id="q" placeholder="Cerca per nome, ingrediente o tag…" value="${esc(listState.q)}" autocomplete="off"></div>
      <select id="cat" aria-label="Categoria"><option value="">Tutte le categorie</option>${cats.map((c) => `<option ${c === listState.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select id="sort" aria-label="Ordina">
        ${[['recent', 'Più recenti'], ['az', 'A → Z'], ['rating', 'Più votate'], ['cooked', 'Più cucinate'], ['time', 'Più veloci'], ['forgotten', 'Da riscoprire']]
          .map(([v, l]) => `<option value="${v}" ${v === listState.sort ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <button class="btn ${listState.fav ? 'on' : ''}" id="fav" title="Solo preferite">★ Preferite</button>
    </div>
    ${tags.length ? `<div class="chips" id="tags">${tags.map((t) => `<button class="chip ${t === listState.tag ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="recipe-grid" id="grid"></div>
    <a class="fab" href="#/import" aria-label="Aggiungi ricetta" title="Aggiungi ricetta">＋</a>`;

  const grid = el.querySelector('#grid');
  const draw = () => {
    const q = normText(listState.q);
    let rs = all.filter((r) => {
      if (listState.fav && !r.favorite) return false;
      if (listState.cat && r.category !== listState.cat) return false;
      if (listState.tag && !(r.tags || []).includes(listState.tag)) return false;
      if (q) {
        const hay = normText([r.title, r.category, r.cuisine, (r.tags || []).join(' '), r.ingredients.join(' ')].join(' '));
        return q.split(' ').every((w) => hay.includes(w));
      }
      return true;
    });
    const by = {
      recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      az: (a, b) => a.title.localeCompare(b.title, 'it'),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0),
      cooked: (a, b) => (b.cookedCount || 0) - (a.cookedCount || 0),
      time: (a, b) => (totalTime(a) || 9999) - (totalTime(b) || 9999),
      forgotten: (a, b) => (a.lastCooked || 0) - (b.lastCooked || 0),
    };
    rs.sort(by[listState.sort] || by.recent);
    el.querySelector('#count').textContent = `(${rs.length}${rs.length !== all.length ? ' di ' + all.length : ''})`;
    grid.innerHTML = rs.length ? rs.map(card).join('') : '<div class="empty" style="grid-column:1/-1">Nessuna ricetta corrisponde ai filtri.</div>';
    hydrateImages(grid);
  };
  draw();

  el.querySelector('#q').addEventListener('input', debounce((e) => { listState.q = e.target.value; draw(); }, 120));
  el.querySelector('#cat').onchange = (e) => { listState.cat = e.target.value; draw(); };
  el.querySelector('#sort').onchange = (e) => { listState.sort = e.target.value; draw(); };
  el.querySelector('#fav').onclick = (e) => { listState.fav = !listState.fav; e.currentTarget.classList.toggle('on', listState.fav); draw(); };
  el.querySelector('#tags')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    listState.tag = listState.tag === b.dataset.tag ? '' : b.dataset.tag;
    el.querySelectorAll('#tags .chip').forEach((c) => c.classList.toggle('on', c.dataset.tag === listState.tag));
    draw();
  });
  el.querySelector('[data-act=random]').onclick = () => {
    const pool = all.filter((r) => r.rating !== 1);
    const r = pool[Math.floor(Math.random() * pool.length)];
    if (r) location.hash = '#/r/' + r.id;
  };
}

function card(r) {
  const t = totalTime(r);
  return `<a class="rcard" href="#/r/${r.id}">
    <div class="thumb">${esc(recipeEmoji(r))}${imgTag(r.image)}${r.favorite ? '<span class="fav">★</span>' : ''}</div>
    <div class="body">
      <div class="title">${esc(r.title || 'Senza titolo')}</div>
      <div class="meta">
        ${t ? `<span>⏱ ${minToText(t)}</span>` : ''}
        ${r.rating ? `<span>${'★'.repeat(r.rating)}</span>` : ''}
        ${r.category ? `<span>${esc(r.category)}</span>` : ''}
      </div>
    </div></a>`;
}

export function loadSamples() {
  const items = SAMPLE_RECIPES.map((r) => ({ ...blankRecipe(), ...structuredClone(r), tags: [...(r.tags || []), 'esempio'] }));
  store.upsertMany('recipes', items);
  toast(`${items.length} ricette di esempio aggiunte`);
}

// ===================== DETTAGLIO =====================
const detailState = { id: null, servings: null, done: new Set(), stepsDone: new Set() };

export function recipeView(el, id) {
  const r = store.get('recipes', id);
  if (!r) { el.innerHTML = '<div class="empty"><span class="big">🤷</span>Ricetta non trovata. <a href="#/">Torna all’elenco</a></div>'; return; }
  if (detailState.id !== id) Object.assign(detailState, { id, servings: r.servings || 4, done: new Set(), stepsDone: new Set() });
  const factor = r.servings ? detailState.servings / r.servings : 1;
  const S = prepareHave(store.state.data.prefs.staples.map((name) => ({ name })));
  const H = prepareHave(store.list('pantry'));
  const t = totalTime(r);

  const ingHTML = r.ingredients.map((line, i) => {
    const p = parseIngredient(line);
    if (p.header) return `<li class="group">${esc(p.name)}</li>`;
    const tok = tokens(ingredientName(p));
    const have = tok.length && (findHave(tok, H) ? 'in dispensa' : findHave(tok, S) ? 'sempre in casa' : '');
    return `<li class="${detailState.done.has(i) ? 'done' : ''}"><input type="checkbox" data-ing="${i}" ${detailState.done.has(i) ? 'checked' : ''} aria-label="Fatto">
      <span>${esc(formatIngredient(p, factor))}</span>${have ? `<span class="have chip ok">✓ ${have}</span>` : ''}</li>`;
  }).join('');

  let n = 0;
  const stepsHTML = r.steps.map((s, i) => {
    if (isGroupHeader(s)) return `<li style="padding-left:0;counter-increment:none" class="no-counter"><h3 style="color:var(--accent)">${esc(s)}</h3></li>`;
    n++;
    return `<li data-step="${i}" class="${detailState.stepsDone.has(i) ? 'done' : ''}">${stepHTML(s, r.title)}</li>`;
  }).join('');

  el.innerHTML = `
    <div class="page-head no-print">
      <a class="btn ghost" href="#/">← Ricette</a>
      <span class="grow"></span>
      <button class="btn primary" data-act="cook" ${r.steps.length ? '' : 'disabled'}>👨‍🍳 Cucina</button>
      <a class="btn" href="#/edit/${r.id}">✏️ Modifica</a>
      <button class="btn icon" data-act="more" aria-label="Altre azioni">⋯</button>
    </div>
    <div class="detail-hero">
      <div class="photo">${esc(recipeEmoji(r))}${imgTag(r.image, r.title)}</div>
      <div>
        <h1>${esc(r.title || 'Senza titolo')}</h1>
        <div class="row no-print">
          <span class="stars" id="stars">${[1, 2, 3, 4, 5].map((v) => `<button data-star="${v}" class="${v <= (r.rating || 0) ? 'on' : ''}" aria-label="${v} stelle">★</button>`).join('')}</span>
          <button class="btn sm ${r.favorite ? 'on' : ''}" data-act="fav">${r.favorite ? '♥ Preferita' : '♡ Preferita'}</button>
        </div>
        ${r.description ? `<p>${esc(r.description)}</p>` : ''}
        <div class="facts">
          ${r.prepTime ? `<div class="fact"><b>Preparazione</b>${minToText(r.prepTime)}</div>` : ''}
          ${r.cookTime ? `<div class="fact"><b>Cottura</b>${minToText(r.cookTime)}</div>` : ''}
          ${t && (r.totalTime || (r.prepTime && r.cookTime)) ? `<div class="fact"><b>Totale</b>${minToText(t)}</div>` : ''}
          ${r.difficulty ? `<div class="fact"><b>Difficoltà</b>${esc(r.difficulty)}</div>` : ''}
          ${r.category ? `<div class="fact"><b>Categoria</b>${esc(r.category)}</div>` : ''}
          ${r.cuisine ? `<div class="fact"><b>Cucina</b>${esc(r.cuisine)}</div>` : ''}
          ${r.calories ? `<div class="fact"><b>Calorie</b>${r.calories} kcal</div>` : ''}
        </div>
        ${(r.tags || []).length ? `<div class="chips">${r.tags.map((x) => `<span class="chip">#${esc(x)}</span>`).join('')}</div>` : ''}
        <p class="small muted mt">
          ${r.cookedCount ? `Cucinata ${r.cookedCount} ${r.cookedCount === 1 ? 'volta' : 'volte'}, l’ultima il ${fmtDate(r.lastCooked)}.` : 'Non ancora cucinata.'}
          <button class="btn sm ghost no-print" data-act="cooked">✓ L’ho cucinata</button>
          ${r.source ? `<br>Fonte: <a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(r.source))}</a>` : ''}
        </p>
      </div>
    </div>
    <div class="detail-cols">
      <section class="card">
        <div class="row" style="margin-bottom:8px"><h2 class="grow" style="margin:0">Ingredienti</h2>
          <div class="servings no-print"><button data-sv="-1" aria-label="Meno porzioni">−</button><span>${detailState.servings} ${detailState.servings === 1 ? 'porzione' : 'porzioni'}</span><button data-sv="1" aria-label="Più porzioni">＋</button></div>
        </div>
        <ul class="ing-list">${ingHTML || '<li class="muted">Nessun ingrediente.</li>'}</ul>
        <div class="row mt no-print"><button class="btn sm" data-act="shop">🛒 Aggiungi alla spesa</button></div>
      </section>
      <section class="card">
        <h2>Preparazione</h2>
        <ol class="steps">${stepsHTML || '<li class="muted">Nessun passaggio.</li>'}</ol>
        ${r.notes ? `<h2 class="mt">Note</h2><div class="notes">${esc(r.notes)}</div>` : ''}
      </section>
    </div>`;
  hydrateImages(el);

  // Ridisegna su un contenitore nuovo, così i gestori di eventi non si accumulano
  const rerender = () => { const y = window.scrollY; const fresh = el.cloneNode(false); el.replaceWith(fresh); recipeView(fresh, id); window.scrollTo(0, y); };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button, input, li[data-step]');
    if (!b || !el.contains(b)) return;
    if (b.dataset.star) { r.rating = r.rating === +b.dataset.star ? 0 : +b.dataset.star; store.upsert('recipes', r); rerender(); }
    else if (b.dataset.sv) { detailState.servings = Math.max(1, detailState.servings + +b.dataset.sv); rerender(); }
    else if (b.dataset.ing != null) { const i = +b.dataset.ing; detailState.done.has(i) ? detailState.done.delete(i) : detailState.done.add(i); b.closest('li').classList.toggle('done'); }
    else if (b.dataset.step != null && !e.target.closest('button')) { const i = +b.dataset.step; detailState.stepsDone.has(i) ? detailState.stepsDone.delete(i) : detailState.stepsDone.add(i); b.classList.toggle('done'); }
    else if (b.dataset.act === 'fav') { r.favorite = !r.favorite; store.upsert('recipes', r); rerender(); }
    else if (b.dataset.act === 'cooked') { markCooked(r); rerender(); }
    else if (b.dataset.act === 'cook') cookMode(r, factor);
    else if (b.dataset.act === 'shop') {
      const { added, skipped } = addToShopping(r.ingredients, { recipe: r, factor });
      toast(added ? `${added} ingredienti aggiunti alla spesa${skipped ? ` (${skipped} già in casa)` : ''}` : 'Hai già tutto in casa! 🎉');
    } else if (b.dataset.act === 'more') moreMenu(r, factor);
  });
}

function shortUrl(u) { try { const x = new URL(u); return x.hostname.replace(/^www\./, ''); } catch { return u; } }

async function moreMenu(r, factor) {
  const m = openModal(`
    <header><h2>${esc(r.title)}</h2><button class="btn ghost icon" data-close aria-label="Chiudi">✕</button></header>
    <div class="mbody"><ul class="pick-list">
      <li><button data-m="plan">📅 Aggiungi al menu della settimana</button></li>
      <li><button data-m="share">📤 Condividi / copia testo</button></li>
      <li><button data-m="print">🖨️ Stampa</button></li>
      <li><button data-m="dup">📄 Duplica</button></li>
      <li><button data-m="del" style="color:var(--danger)">🗑️ Elimina</button></li>
    </ul></div>`);
  m.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    m.close();
    const act = b.dataset.m;
    if (act === 'share') {
      const text = recipeToText(r);
      if (navigator.share) { try { await navigator.share({ title: r.title, text }); return; } catch (err) { if (err.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(text); toast('Ricetta copiata negli appunti'); } catch { toast('Impossibile copiare'); }
    } else if (act === 'print') setTimeout(() => window.print(), 200);
    else if (act === 'dup') {
      const copy = { ...structuredClone(r), id: undefined, title: r.title + ' (copia)', cookedCount: 0, lastCooked: null };
      delete copy.createdAt;
      store.upsert('recipes', copy);
      location.hash = '#/edit/' + copy.id;
    } else if (act === 'del') {
      if (await confirmDialog(`Eliminare “${r.title}”?`, 'Elimina', true)) { store.remove('recipes', r.id); toast('Ricetta eliminata'); location.hash = '#/'; }
    } else if (act === 'plan') {
      const { planAddDialog } = await import('./views-home.js');
      planAddDialog(r);
    }
  });
}

// ===================== MODIFICA =====================
export function editView(el, id) {
  const isNew = !id;
  const r = isNew ? { ...blankRecipe(), ...(draft || {}) } : structuredClone(store.get('recipes', id) || {});
  const fromImport = isNew && !!draft;
  draft = null;
  if (!isNew && !r.id) { el.innerHTML = '<div class="empty">Ricetta non trovata.</div>'; return; }

  const all = store.list('recipes');
  const cats = [...new Set(['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Piatti unici', 'Lievitati', 'Salse', 'Bevande', ...all.map((x) => x.category).filter(Boolean)])];
  const dup = isNew && all.find((x) => (r.source && x.source === r.source) || (r.title && normText(x.title) === normText(r.title)));

  el.innerHTML = `
    <div class="page-head">
      <a class="btn ghost" href="${isNew ? '#/' : '#/r/' + r.id}">← Annulla</a>
      <h1>${isNew ? 'Nuova ricetta' : 'Modifica ricetta'}</h1>
      <button class="btn primary" data-act="save">💾 Salva</button>
    </div>
    ${fromImport ? `<div class="card mb" style="background:var(--ok-soft);border-color:transparent">✨ Ricetta importata: controlla i campi e premi <b>Salva</b>.${r._partial ? ' <br><b>Attenzione:</b> la pagina non conteneva dati strutturati, il riconoscimento potrebbe essere impreciso.' : ''}</div>` : ''}
    ${dup ? `<div class="card mb" style="background:var(--warn-soft);border-color:transparent">⚠️ Hai già una ricetta simile: <a href="#/r/${dup.id}">${esc(dup.title)}</a></div>` : ''}
    <form id="form" class="stack" autocomplete="off">
      <div class="card stack">
        <label class="field"><span>Titolo *</span><input type="text" name="title" required value="${esc(r.title)}" placeholder="Es. Spaghetti alla carbonara"></label>
        <label class="field"><span>Descrizione</span><textarea name="description" rows="2" style="min-height:60px">${esc(r.description)}</textarea></label>
        <div class="grid-form">
          <label class="field"><span>Porzioni</span><input type="number" name="servings" min="1" max="99" value="${esc(r.servings || 4)}"></label>
          <label class="field"><span>Preparazione (min)</span><input type="number" name="prepTime" min="0" value="${esc(r.prepTime ?? '')}"></label>
          <label class="field"><span>Cottura (min)</span><input type="number" name="cookTime" min="0" value="${esc(r.cookTime ?? '')}"></label>
          <label class="field"><span>Totale (min)</span><input type="number" name="totalTime" min="0" value="${esc(r.totalTime ?? '')}"></label>
          <label class="field"><span>Difficoltà</span><select name="difficulty">${['', 'molto facile', 'facile', 'media', 'difficile'].map((d) => `<option value="${d}" ${d === r.difficulty ? 'selected' : ''}>${d || '—'}</option>`).join('')}</select></label>
          <label class="field"><span>Categoria</span><input type="text" name="category" list="cats" value="${esc(r.category)}"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
          <label class="field"><span>Cucina</span><input type="text" name="cuisine" value="${esc(r.cuisine)}" placeholder="Italiana, romana…"></label>
          <label class="field"><span>Calorie (kcal/porz.)</span><input type="number" name="calories" min="0" value="${esc(r.calories ?? '')}"></label>
        </div>
        <label class="field"><span>Tag (separati da virgola)</span><input type="text" name="tags" value="${esc((r.tags || []).join(', '))}" placeholder="veloce, vegetariana, estate"></label>
      </div>
      <div class="card stack">
        <label class="field"><span>Ingredienti — uno per riga. Per creare un gruppo scrivi una riga che finisce con “:” (es. “Per la crema:”)</span>
          <textarea name="ingredients" rows="10" placeholder="320 g di spaghetti&#10;150 g di guanciale&#10;4 tuorli&#10;Pecorino romano 50 g&#10;Pepe nero q.b.">${esc(r.ingredients.join('\n'))}</textarea></label>
        <label class="field"><span>Preparazione — un passaggio per riga</span>
          <textarea name="steps" rows="10">${esc(r.steps.join('\n'))}</textarea></label>
        <label class="field"><span>Note personali</span><textarea name="notes" rows="3" style="min-height:70px" placeholder="Varianti, consigli, cosa cambiare la prossima volta…">${esc(r.notes)}</textarea></label>
      </div>
      <div class="card stack">
        <label class="field"><span>Foto (link a un’immagine)</span><input type="url" name="image" value="${esc(r.image?.startsWith('gh:') ? '' : r.image)}" placeholder="https://…"></label>
        <div class="row"><label class="btn">📷 Scatta o scegli una foto<input type="file" accept="image/*" id="photo" hidden></label>
          <span class="muted small" id="photo-info">${r.image?.startsWith('gh:') ? 'Foto personale salvata' : ''}</span>
          ${r.image ? '<button type="button" class="btn sm ghost danger" data-act="nophoto">Rimuovi foto</button>' : ''}</div>
        <div id="photo-prev" style="max-width:260px;border-radius:12px;overflow:hidden">${imgTag(r.image)}</div>
        <label class="field"><span>Fonte (link alla ricetta originale)</span><input type="url" name="source" value="${esc(r.source)}" placeholder="https://…"></label>
      </div>
      <div class="row">
        <button class="btn primary" type="submit">💾 Salva ricetta</button>
        <a class="btn" href="${isNew ? '#/' : '#/r/' + r.id}">Annulla</a>
        <span class="grow"></span>
        ${isNew ? '' : '<button type="button" class="btn danger" data-act="del">🗑️ Elimina</button>'}
      </div>
    </form>`;
  hydrateImages(el);

  const form = el.querySelector('#form');
  let image = r.image || '';
  form.image.addEventListener('change', () => { image = form.image.value.trim(); el.querySelector('#photo-prev').innerHTML = imgTag(image); });
  el.querySelector('#photo').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      image = await storePhoto(f);
      form.image.value = '';
      el.querySelector('#photo-info').textContent = 'Foto pronta (verrà salvata su GitHub alla sincronizzazione)';
      el.querySelector('#photo-prev').innerHTML = imgTag(image);
      hydrateImages(el);
    } catch (err) { toast('Impossibile leggere la foto'); console.error(err); }
  });

  const num = (v) => (v === '' || v == null ? null : Math.max(0, Math.round(+v)) || null);
  const save = () => {
    const f = new FormData(form);
    const title = String(f.get('title') || '').trim();
    if (!title) { toast('Il titolo è obbligatorio'); form.title.focus(); return; }
    const out = {
      ...r,
      title,
      description: String(f.get('description') || '').trim(),
      servings: num(f.get('servings')) || 4,
      prepTime: num(f.get('prepTime')), cookTime: num(f.get('cookTime')), totalTime: num(f.get('totalTime')),
      difficulty: f.get('difficulty') || '', category: String(f.get('category') || '').trim(), cuisine: String(f.get('cuisine') || '').trim(),
      calories: num(f.get('calories')),
      tags: [...new Set(String(f.get('tags') || '').split(',').map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))],
      ingredients: String(f.get('ingredients') || '').split('\n').map((l) => l.trim()).filter(Boolean),
      steps: String(f.get('steps') || '').split('\n').map((l) => l.trim()).filter(Boolean),
      notes: String(f.get('notes') || '').trim(),
      image, source: String(f.get('source') || '').trim(),
    };
    delete out._partial;
    store.upsert('recipes', out);
    toast('Ricetta salvata ✓');
    location.hash = '#/r/' + out.id;
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  el.querySelector('[data-act=save]').onclick = save;
  el.querySelector('[data-act=nophoto]')?.addEventListener('click', (e) => { image = ''; form.image.value = ''; el.querySelector('#photo-prev').innerHTML = ''; e.currentTarget.remove(); el.querySelector('#photo-info').textContent = ''; });
  el.querySelector('[data-act=del]')?.addEventListener('click', async () => {
    if (await confirmDialog(`Eliminare “${r.title}”?`, 'Elimina', true)) { store.remove('recipes', r.id); location.hash = '#/'; }
  });
}

// ===================== IMPORTAZIONE =====================
const importState = { tab: 'paste', text: '', url: '' };

export function importView(el, params = {}) {
  // Dati arrivati dal bookmarklet o dalla condivisione Android
  if (params.bm) {
    try {
      const r = recipeFromBookmarklet(JSON.parse(params.bm));
      history.replaceState(null, '', location.pathname + location.search + '#/import');
      draft = r; location.hash = '#/new'; return;
    } catch (e) { console.error(e); toast('Dati del bookmarklet non validi'); }
  }
  if (params.url || params.text) history.replaceState(null, '', location.pathname + location.search + '#/import');
  if (params.url) { importState.tab = 'url'; importState.url = params.url; }
  if (params.text) { importState.tab = 'paste'; importState.text = params.text; }

  el.innerHTML = `
    <div class="page-head"><a class="btn ghost" href="#/">← Ricette</a><h1>Aggiungi ricetta</h1></div>
    <div class="tabs" role="tablist">
      <button data-tab="paste" class="${importState.tab === 'paste' ? 'on' : ''}">📋 Incolla testo</button>
      <button data-tab="url" class="${importState.tab === 'url' ? 'on' : ''}">🔗 Da un link</button>
      <button data-tab="manual">✍️ Scrivi a mano</button>
    </div>
    <div id="tab"></div>`;
  const tabEl = el.querySelector('#tab');

  const drawTab = () => {
    el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === importState.tab));
    if (importState.tab === 'paste') {
      tabEl.innerHTML = `
        <div class="card stack">
          <p class="muted" style="margin:0">Copia la ricetta da un sito, un messaggio o un documento e incollala qui: titolo, ingredienti e passaggi vengono riconosciuti in automatico.</p>
          <textarea id="paste" rows="14" placeholder="Spaghetti alla carbonara&#10;&#10;Ingredienti per 4 persone&#10;320 g di spaghetti&#10;150 g di guanciale&#10;…&#10;&#10;Preparazione&#10;Tagliate il guanciale a listarelle…">${esc(importState.text)}</textarea>
          <div class="row">
            <button class="btn primary" data-act="parse">✨ Riconosci ricetta</button>
            ${navigator.clipboard?.readText ? '<button class="btn" data-act="clip">📋 Incolla dagli appunti</button>' : ''}
          </div>
        </div>`;
      const ta = tabEl.querySelector('#paste');
      ta.addEventListener('input', () => { importState.text = ta.value; });
      tabEl.querySelector('[data-act=parse]').onclick = () => {
        if (!ta.value.trim()) { toast('Incolla prima il testo della ricetta'); return; }
        const urlOnly = ta.value.trim().match(/^https?:\/\/\S+$/);
        if (urlOnly) { importState.tab = 'url'; importState.url = urlOnly[0]; drawTab(); tabEl.querySelector('[data-act=fetch]').click(); return; }
        draft = parseRecipeText(ta.value);
        importState.text = '';
        location.hash = '#/new';
      };
      tabEl.querySelector('[data-act=clip]')?.addEventListener('click', async () => {
        try { ta.value = await navigator.clipboard.readText(); importState.text = ta.value; } catch { toast('Permesso negato: incolla con Ctrl+V o tieni premuto'); }
      });
    } else {
      tabEl.innerHTML = `
        <div class="card stack">
          <p class="muted" style="margin:0">Incolla il link di una pagina con una ricetta (GialloZafferano, Cookist, Fatto in casa da Benedetta, BBC Good Food, ecc.).</p>
          <div class="add-row"><input type="url" id="url" placeholder="https://www.sito.it/ricetta…" value="${esc(importState.url)}"><button class="btn primary" data-act="fetch">Importa</button></div>
          <p class="small muted" id="status" style="margin:0"></p>
          <details class="small"><summary>Come funziona e alternative</summary>
            <p>La pagina viene scaricata tramite un servizio “proxy” pubblico (configurabile nelle impostazioni) perché i browser non permettono di leggere direttamente altri siti. Se un sito non funziona:</p>
            <ul>
              <li><b>Su PC:</b> usa il pulsante “Salva nel Ricettario” da trascinare nei preferiti (vedi <a href="#/settings">Altro → Importazione</a>).</li>
              <li><b>Su Android:</b> installa l’app, poi dal browser usa <i>Condividi → Ricettario</i>.</li>
              <li>Oppure seleziona e copia il testo della ricetta e usa “Incolla testo”.</li>
            </ul>
          </details>
        </div>`;
      const inp = tabEl.querySelector('#url');
      const status = tabEl.querySelector('#status');
      const go = async () => {
        const url = inp.value.trim();
        if (!/^https?:\/\//.test(url)) { toast('Inserisci un link valido (https://…)'); return; }
        importState.url = url;
        const btn = tabEl.querySelector('[data-act=fetch]');
        btn.disabled = true; status.textContent = '⏳ Scarico la pagina…';
        try {
          draft = await fetchRecipeFromUrl(url, store.state.settings.proxy);
          importState.url = '';
          location.hash = '#/new';
        } catch (e) {
          status.innerHTML = `❌ ${esc(e.message)} Prova a copiare il testo della ricetta e usare “Incolla testo”.`;
        } finally { btn.disabled = false; }
      };
      tabEl.querySelector('[data-act=fetch]').onclick = go;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      if (params.url && params.auto) { params.auto = false; go(); }
    }
  };
  el.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === 'manual') { draft = null; location.hash = '#/new'; return; }
    importState.tab = b.dataset.tab;
    drawTab();
  });
  drawTab();
}
