// Analisi delle ricette: ingredienti, testo incollato, pagine web (schema.org/Recipe)
import { decodeEntities, isoDurationToMin, fmtQty } from './utils.js';

// ===== Ingredienti =====
const UNITS = [
  'kg', 'g', 'gr', 'grammi', 'grammo', 'hg', 'etti', 'etto', 'mg', 'l', 'lt', 'litri', 'litro', 'dl', 'cl', 'ml',
  'cucchiai', 'cucchiaio', 'cucchiaini', 'cucchiaino', 'cc', 'tazze', 'tazza', 'tazzine', 'tazzina', 'bicchieri', 'bicchiere',
  'pizzichi', 'pizzico', 'spicchi', 'spicchio', 'fette', 'fetta', 'fettine', 'fettina', 'foglie', 'foglia', 'rametti', 'rametto',
  'rami', 'ramo', 'mazzetti', 'mazzetto', 'mazzo', 'ciuffi', 'ciuffo', 'bustine', 'bustina', 'buste', 'busta', 'cubetti', 'cubetto',
  'dadi', 'dado', 'noci', 'noce', 'manciate', 'manciata', 'confezioni', 'confezione', 'scatole', 'scatola', 'barattoli', 'barattolo',
  'vasetti', 'vasetto', 'lattine', 'lattina', 'gambi', 'gambo', 'coste', 'costa', 'teste', 'testa', 'filetti', 'filetto',
  'pezzi', 'pezzo', 'pz', 'rotoli', 'rotolo', 'panetti', 'panetto', 'tbsp', 'tsp', 'cups', 'cup', 'oz', 'lbs', 'lb',
].sort((a, b) => b.length - a.length);
const UNIT_RE = new RegExp(`^(${UNITS.join('|')})\\.?(?![a-zà-ú])\\s*(?:(di|d['’])\\s*)?`, 'i');
const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[½¼¾⅓⅔⅛]|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])`;
const LEAD_RE = new RegExp(`^(${NUM})(?:\\s*(?:-|–|÷|a|o)\\s*(${NUM}))?\\s*`, 'i');
const TRAIL_RE = new RegExp(`^(.*?\\S)\\s+(${NUM})(?:\\s*(?:-|–)\\s*(${NUM}))?\\s*(${UNITS.join('|')})?\\.?$`, 'i');
const WORD_NUM = { un: 1, uno: 1, una: 1, "un'": 1, mezzo: 0.5, mezza: 0.5, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12 };
const UNI_FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const QB_RE = /\b(?:q\.?\s?b\.?|quanto basta|a piacere|to taste)(?=\s|$|[),.;])/i;
const OPT_RE = /\(?\b(?:facoltativ[oaie]|opzional[ei]|optional)\b\)?/i;

export function parseNum(s) {
  if (s == null) return null;
  s = String(s).trim();
  let m;
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
  if ((m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/))) return +m[1] + UNI_FRAC[m[2]];
  if (UNI_FRAC[s]) return UNI_FRAC[s];
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

export function isGroupHeader(line) {
  const l = line.trim();
  return l.length > 1 && l.length < 60 && /:\s*$/.test(l) && !LEAD_RE.test(l);
}

export function cleanLine(line) {
  return String(line || '').replace(/^\s*(?:[-•*·▢□☐✓✔▪◦>]|\d+[.)](?=\s))\s*/, '').replace(/\s+/g, ' ').trim();
}

/** Scompone una riga di ingrediente in quantità, unità e nome. */
export function parseIngredient(line) {
  const raw = cleanLine(line);
  const out = { raw, qty: null, qty2: null, unit: '', sep: '', name: raw, qb: false, optional: false, header: false, trailing: false };
  if (!raw) return out;
  if (isGroupHeader(raw)) { out.header = true; out.name = raw.replace(/:\s*$/, ''); return out; }
  out.qb = QB_RE.test(raw);
  out.optional = OPT_RE.test(raw);
  let s = raw;

  // Numeri in lettere ("un cucchiaio di", "due uova")
  const w = s.match(/^(un'|[a-zà]+)\s+/i);
  if (w && WORD_NUM[w[1].toLowerCase()] != null) {
    const rest = s.slice(w[0].length);
    const um = rest.match(UNIT_RE);
    out.qty = WORD_NUM[w[1].toLowerCase()];
    s = rest;
    if (um) { out.unit = um[1]; out.sep = um[2] || ''; s = s.slice(um[0].length); }
    out.name = s.trim() || raw;
    out.wordQty = w[1];
    return out;
  }

  let m = s.match(LEAD_RE);
  if (m && !/^0\d/.test(m[1])) {
    out.qty = parseNum(m[1]);
    out.qty2 = m[2] ? parseNum(m[2]) : null;
    s = s.slice(m[0].length);
    // "2 x 100 g" o "2-3 g": già gestito; ora l'unità
    const um = s.match(UNIT_RE);
    if (um) { out.unit = um[1]; out.sep = um[2] || ''; s = s.slice(um[0].length); }
    out.name = s.trim() || raw;
    return out;
  }

  // Formato "Farina 00 300 g" (tipico di molti siti italiani)
  m = s.replace(QB_RE, '').trim().match(TRAIL_RE);
  if (m && !/^0\d/.test(m[2])) {
    out.name = m[1].trim();
    out.qty = parseNum(m[2]);
    out.qty2 = m[3] ? parseNum(m[3]) : null;
    out.unit = m[4] || '';
    out.trailing = true;
    return out;
  }
  out.name = s.replace(QB_RE, '').replace(/\s{2,}/g, ' ').trim() || raw;
  return out;
}

/** Riscrive un ingrediente con le quantità moltiplicate per factor. */
export function formatIngredient(p, factor = 1) {
  if (p.header) return p.name;
  if (p.qty == null || factor === 1) return p.raw;
  const q = fmtQty(p.qty * factor) + (p.qty2 != null ? '-' + fmtQty(p.qty2 * factor) : '');
  if (p.trailing) return `${p.name} ${q}${p.unit ? ' ' + p.unit : ''}`;
  const unit = p.unit ? ' ' + p.unit : '';
  const sep = !p.sep ? ' ' : /['’]$/.test(p.sep) ? ` ${p.sep}` : ` ${p.sep} `;
  return `${q}${unit}${sep}${p.name}`.replace(/\s+/g, ' ').trim();
}

// ===== Passaggi e timer =====
const TIME_RE = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|o|\/)\s*(\d+(?:[.,]\d+)?))?\s*(ore|ora|h|minuti|minuto|min|mins|secondi|secondo|sec|minutes|minute|hours|hour|seconds)\b/gi;

/** Trova le durate citate in un passaggio (per i timer). */
export function findTimes(text) {
  const out = [];
  for (const m of text.matchAll(TIME_RE)) {
    const n = parseFloat(m[1].replace(',', '.'));
    const u = m[3].toLowerCase();
    const mult = /^(ore|ora|h|hours?)$/.test(u) ? 3600 : /^(sec|secondi|secondo|seconds)$/.test(u) ? 1 : 60;
    out.push({ index: m.index, length: m[0].length, text: m[0], seconds: Math.round(n * mult) });
  }
  return out;
}

// ===== Ricetta vuota =====
export function blankRecipe() {
  return {
    title: '', description: '', image: '', source: '', servings: 4, prepTime: null, cookTime: null, totalTime: null,
    difficulty: '', category: '', cuisine: '', tags: [], ingredients: [], steps: [], notes: '',
    rating: 0, favorite: false, cookedCount: 0, lastCooked: null, calories: null,
  };
}

// ===== Testo libero incollato =====
const ING_H = /^(?:ingredienti|ingredients|occorrente|cosa (?:ti )?serve|lista ingredienti)\b[^a-z]*(?:per\s+\d+.*)?$/i;
const STEP_H = /^(?:preparazione|procedimento|istruzioni|metodo|esecuzione|come (?:si )?prepar\w*|instructions|directions|method|steps?|passaggi|realizzazione)\b[^.]{0,40}$/i;
const NOTE_H = /^(?:note|consigli|conservazione|suggerimenti|curiosit[àa]|varianti|tips?|notes)\b[^.]{0,30}$/i;
const STEP_NUM = /^(?:(?:passo|step|fase|passaggio)\s*)?\d+\s*[.):\-–]\s*/i;
// "Preparazione della crema:", "Procedimento per il ripieno:" → sezione, non inizio del procedimento
const SUB_SECTION = /^(?:preparazione|procedimento|realizzazione|esecuzione)\s+(?:del|dello|della|dei|degli|delle|di|per)\b.*:\s*$/i;
const isStepHeading = (l) => STEP_H.test(l) && !SUB_SECTION.test(l);

/**
 * Nella lista ingredienti, una riga breve come "Per decorare" o "Per la crema" (senza quantità)
 * è il titolo di una sezione: le si aggiungono i due punti così non finisce nella spesa.
 */
export function asSectionLine(l) {
  if (isGroupHeader(l)) return l;
  if (/^per\s+(?!\d)[^\d]{2,45}$/i.test(l) && !/\bq\.?\s?b\.?\b|\bpersone\b|\bporzioni\b/i.test(l)) return l.replace(/[\s.]*$/, ':');
  return l;
}

function readMeta(text, r) {
  let m;
  if ((m = text.match(/(?:dosi|porzioni|persone|serves|yield|per)\s*(?:per)?\s*:?\s*(\d+)\s*(?:persone|porzioni|pers\.?)?/i)) || (m = text.match(/(\d+)\s*(?:persone|porzioni|servings)/i))) {
    const n = +m[1]; if (n > 0 && n < 50) r.servings = n;
  }
  const t = (re) => { const x = text.match(re); if (!x) return null; const n = parseFloat(x[1].replace(',', '.')); return /^(h|ore|ora)/i.test(x[2]) ? Math.round(n * 60) : Math.round(n); };
  r.prepTime = t(/preparazione\s*:?\s*(\d+(?:[.,]\d+)?)\s*(min|minuti|h|ore|ora)/i) ?? r.prepTime;
  r.cookTime = t(/cottura\s*:?\s*(\d+(?:[.,]\d+)?)\s*(min|minuti|h|ore|ora)/i) ?? r.cookTime;
  r.totalTime = t(/(?:tempo totale|totale)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(min|minuti|h|ore|ora)/i) ?? r.totalTime;
  if ((m = text.match(/difficolt[àa]\s*:?\s*(molto facile|facile|media|medio|difficile|elevata|bassa)/i))) r.difficulty = m[1].toLowerCase();
}

function isMetaLine(l) {
  if (/^(?:dosi\s+)?per\s+\d+\s*(?:persone|porzioni|pers\.?)\s*:?$/i.test(l)) return true;
  return /^(?:dosi|porzioni|persone|preparazione|cottura|difficolt|costo|tempo|totale|calorie|kcal)\b[^.]{0,40}$/i.test(l) && /\d|facile|media|difficile|basso|medio|elevato/i.test(l);
}

function looksLikeIngredient(l) {
  if (l.length > 90) return false;
  if (/[.!?]$/.test(l) && l.split(' ').length > 8) return false;
  const p = parseIngredient(l);
  return p.qty != null || p.qb || /^[-•*·▢□☐]/.test(l);
}

/** Converte del testo incollato (o HTML) in una ricetta. */
export function parseRecipeText(input) {
  let text = String(input || '').trim();
  if (!text) return blankRecipe();
  // HTML o JSON incollati
  if (/<script[^>]+ld\+json|<html|<body|<div|<p[\s>]|<li[\s>]/i.test(text)) {
    const fromHtml = recipeFromHTML(text);
    if (fromHtml && fromHtml.ingredients.length) return fromHtml;
    text = htmlToText(text);
  }
  if (/^\s*[[{]/.test(text)) {
    try { const r = recipeFromJsonLd(JSON.parse(text)); if (r) return r; } catch {}
  }

  const r = blankRecipe();
  const url = text.match(/https?:\/\/[^\s)>\]]+/);
  if (url) r.source = url[0];
  readMeta(text, r);

  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const iIng = lines.findIndex((l) => ING_H.test(l));
  const iStep = lines.findIndex((l, i) => isStepHeading(l) && (iIng < 0 || i > iIng));
  const iNote = lines.findIndex((l, i) => NOTE_H.test(l) && i > Math.max(iIng, iStep));

  const firstIdx = lines.findIndex((l) => l && !ING_H.test(l) && !isStepHeading(l) && !/^https?:\/\//.test(l));
  if (firstIdx >= 0 && (iIng < 0 || firstIdx < iIng) && lines[firstIdx].length < 140) r.title = lines[firstIdx].replace(/^#+\s*/, '');

  const body = (a, b) => lines.slice(a, b).filter((l) => l && !/^\d+$/.test(l));
  let ingLines = [], stepLines = [], descLines = [], noteLines = [];

  if (iIng >= 0) {
    const end = iStep > iIng ? iStep : (iNote > iIng ? iNote : lines.length);
    const block = body(iIng + 1, end).filter((l) => !isMetaLine(l));
    if (iStep > iIng) ingLines = block;
    else {
      // Nessuna intestazione per il procedimento: gli ingredienti finiscono al primo testo lungo
      let k = 0;
      while (k < block.length && (looksLikeIngredient(block[k]) || isGroupHeader(block[k]) || block[k].length < 45)) k++;
      ingLines = block.slice(0, k);
      stepLines = block.slice(k);
    }
    descLines = body(firstIdx + 1, iIng).filter((l) => !isMetaLine(l) && !/^https?:\/\//.test(l));
  }
  if (iStep >= 0) stepLines = body(iStep + 1, iNote > iStep ? iNote : lines.length);
  if (iNote >= 0) noteLines = body(iNote + 1, lines.length);

  if (iIng < 0 && iStep < 0) {
    // Nessuna intestazione: euristica sulla forma delle righe
    const rest = body(firstIdx + 1, lines.length).filter((l) => !isMetaLine(l) && !/^https?:\/\//.test(l));
    let start = rest.findIndex(looksLikeIngredient);
    if (start < 0) { stepLines = rest; }
    else {
      descLines = rest.slice(0, start);
      let k = start;
      while (k < rest.length && (looksLikeIngredient(rest[k]) || isGroupHeader(rest[k]) || (rest[k].length < 40 && !/[.!?]$/.test(rest[k])))) k++;
      ingLines = rest.slice(start, k);
      stepLines = rest.slice(k);
    }
  }

  r.description = descLines.join(' ').slice(0, 600);
  r.ingredients = ingLines.map(cleanLine).filter(Boolean).map(asSectionLine);
  r.steps = splitSteps(stepLines);
  r.notes = noteLines.join('\n');
  return r;
}

function splitSteps(lines) {
  const out = [];
  for (let l of lines) {
    l = l.replace(STEP_NUM, '').trim();
    if (!l || /^\d+$/.test(l)) continue;
    out.push(l);
  }
  // Un unico paragrafo lunghissimo: dividilo per frasi raggruppate
  if (out.length === 1 && out[0].length > 500) {
    const sentences = out[0].match(/[^.!?]+[.!?]+(\s|$)/g) || [out[0]];
    const chunks = [];
    let cur = '';
    for (const s of sentences) { if ((cur + s).length > 260 && cur) { chunks.push(cur.trim()); cur = ''; } cur += s; }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
  }
  return out;
}

// ===== HTML / schema.org =====
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg').forEach((n) => n.remove());
  doc.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  doc.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr,section,article,ul,ol').forEach((n) => { n.prepend('\n'); n.append('\n'); });
  return (doc.body?.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function findRecipeNode(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null;
  if (Array.isArray(obj)) { for (const x of obj) { const r = findRecipeNode(x, depth + 1); if (r) return r; } return null; }
  const t = obj['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return obj;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    if (obj[k]) { const r = findRecipeNode(obj[k], depth + 1); if (r) return r; }
  }
  return null;
}

function pickImage(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return pickImage(img[img.length > 1 && typeof img[0] === 'string' ? img.length - 1 : 0]) || pickImage(img[0]);
  return img.url || img.contentUrl || img['@id'] || '';
}

function flattenInstructions(ins, out = []) {
  if (!ins) return out;
  if (typeof ins === 'string') {
    const t = decodeEntities(ins);
    t.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s.replace(STEP_NUM, '')));
    return out;
  }
  if (Array.isArray(ins)) { ins.forEach((x) => flattenInstructions(x, out)); return out; }
  if (ins['@type'] === 'HowToSection' || ins.itemListElement) {
    if (ins.name) out.push(decodeEntities(ins.name).replace(/:?\s*$/, ':'));
    flattenInstructions(ins.itemListElement, out);
    return out;
  }
  const txt = ins.text || ins.name || ins.description;
  if (txt) flattenInstructions(String(txt), out);
  return out;
}

function parseYield(y) {
  if (y == null) return null;
  if (Array.isArray(y)) { for (const v of y) { const n = parseYield(v); if (n) return n; } return null; }
  if (typeof y === 'number') return y;
  const m = String(y).match(/\d+/);
  return m ? +m[0] : null;
}

function asList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(asList);
  return String(v).split(/[,;]/).map((s) => decodeEntities(s).trim()).filter(Boolean);
}

export function recipeFromJsonLd(json, url = '') {
  const node = findRecipeNode(json);
  if (!node) return null;
  const r = blankRecipe();
  r.title = decodeEntities(node.name || node.headline || '');
  r.description = decodeEntities(node.description || '').slice(0, 800);
  r.image = pickImage(node.image);
  r.servings = parseYield(node.recipeYield) || 4;
  r.prepTime = isoDurationToMin(node.prepTime);
  r.cookTime = isoDurationToMin(node.cookTime);
  r.totalTime = isoDurationToMin(node.totalTime);
  let ings = node.recipeIngredient || node.ingredients || [];
  if (typeof ings === 'string') ings = ings.split(/\n+/);
  r.ingredients = ings.map((s) => cleanLine(decodeEntities(String(s)))).filter(Boolean);
  r.steps = flattenInstructions(node.recipeInstructions).filter(Boolean);
  r.category = asList(node.recipeCategory)[0] || '';
  r.cuisine = asList(node.recipeCuisine)[0] || '';
  r.tags = [...new Set(asList(node.keywords).map((t) => t.toLowerCase()))].filter((t) => t.length < 30).slice(0, 8);
  r.source = url || node.url || (typeof node.mainEntityOfPage === 'string' ? node.mainEntityOfPage : '') || '';
  const kcal = node.nutrition?.calories && String(node.nutrition.calories).match(/\d+/);
  if (kcal) r.calories = +kcal[0];
  return r;
}

function tryJson(s) {
  try { return JSON.parse(s); } catch {}
  try { return JSON.parse(s.replace(/[\u0000-\u001f]+/g, ' ')); } catch {}
  return null;
}

/** Estrae la ricetta da una pagina HTML. Restituisce null se non trova nulla di utile. */
export function recipeFromHTML(html, url = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (p) => doc.querySelector(`meta[property="${p}"],meta[name="${p}"]`)?.content || '';
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const j = tryJson(s.textContent || '');
    const r = j && recipeFromJsonLd(j, url);
    if (r && (r.ingredients.length || r.steps.length)) {
      if (!r.image) r.image = meta('og:image');
      if (/giallozafferano/i.test(url || r.source)) {
        // Rimuove i rimandi numerici alle foto dei passaggi ("a fette 1 e poi…", "spesse 1cm 2 3 .")
        r.steps = r.steps.map((s) => s
          .replace(/\s\d{1,2}(?:\s\d{1,2})*(?=\s*[.,;:)]|\s+(?:e|ed|poi|quindi|infine|e poi)\b)/g, '')
          .replace(/\s+([.,;:])/g, '$1'));
      }
      return r;
    }
  }
  // Microdata
  const md = doc.querySelector('[itemtype*="schema.org/Recipe"]');
  if (md) {
    const r = blankRecipe();
    const prop = (n) => [...md.querySelectorAll(`[itemprop="${n}"]`)];
    r.title = (prop('name')[0]?.textContent || meta('og:title')).trim();
    r.ingredients = [...prop('recipeIngredient'), ...prop('ingredients')].map((e) => cleanLine(e.textContent)).filter(Boolean);
    r.steps = prop('recipeInstructions').flatMap((e) => splitSteps(htmlToText(e.innerHTML).split('\n')));
    r.image = prop('image')[0]?.getAttribute('src') || prop('image')[0]?.getAttribute('content') || meta('og:image');
    r.source = url;
    if (r.ingredients.length) return r;
  }
  // Ultima possibilità: testo della pagina
  const main = doc.querySelector('article, main, [class*="recipe"], [id*="recipe"]') || doc.body;
  if (!main) return null;
  const r = parseRecipeText(htmlToText(main.innerHTML));
  r.title = meta('og:title') || r.title || doc.title || '';
  r.image = r.image || meta('og:image');
  r.description = r.description || meta('og:description');
  r.source = url || r.source;
  r._partial = true;
  return r.ingredients.length || r.steps.length ? r : null;
}

// ===== Importazione da link =====
const FALLBACK_PROXIES = [
  'https://api.allorigins.win/raw?url={url}',
  'https://corsproxy.io/?url={url}',
  'https://api.codetabs.com/v1/proxy?quest={url}',
  'https://api.allorigins.win/get?url={url}',
];
const isGoogle = (h) => /(^|\.)google\.[a-z.]+$|^share\.google$|^goo\.gl$/i.test(h);
const hostOf = (u) => { try { return new URL(u.replace('{url}', '')).hostname.replace(/^www\./, ''); } catch { return u; } };

/**
 * Ripulisce un link condiviso dal telefono: toglie i rimandi di Google (AMP, /url?q=),
 * la cache AMP, i parametri di tracciamento e la parte dopo "#".
 */
export function cleanRecipeUrl(raw) {
  let u = String(raw || '').trim().replace(/[)\].,;:!?»"'’]+$/, '');
  if (!/^https?:\/\//i.test(u) && /^[\w-]+(\.[\w-]+)+\//.test(u)) u = 'https://' + u;
  try {
    let x = new URL(u);
    const amp = x.pathname.match(/^\/amp\/s\/(.+)$/);
    if (isGoogle(x.hostname) && amp) x = new URL('https://' + amp[1] + x.search);
    if (isGoogle(x.hostname) && x.pathname === '/url' && (x.searchParams.get('q') || x.searchParams.get('url'))) x = new URL(x.searchParams.get('q') || x.searchParams.get('url'));
    const cdn = x.hostname.endsWith('.cdn.ampproject.org') && x.pathname.match(/^\/[cv]\/(?:s\/)?(.+)$/);
    if (cdn) x = new URL('https://' + cdn[1]);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|_gl$|amp$|si$|ref$)/i.test(k)) x.searchParams.delete(k);
    x.hash = '';
    return x.toString();
  } catch { return u; }
}

/** Trova nel testo condiviso il link della ricetta (anche senza "https://"). */
export function findSharedUrl(text) {
  const s = String(text || '');
  const m = s.match(/https?:\/\/[^\s<>"]+/i) || s.match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s<>"]*/i);
  return m ? cleanRecipeUrl(m[0]) : '';
}

async function fetchText(url, ms = 25000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally { clearTimeout(t); }
}

async function fetchViaProxy(tpl, url) {
  const txt = await fetchText(tpl.replace('{url}', encodeURIComponent(url)));
  if (tpl.includes('/get?url=')) { try { return JSON.parse(txt).contents || ''; } catch { /* testo semplice */ } }
  return txt;
}

/** Link "vero" della pagina (canonical / og:url), o la destinazione di una pagina di rimando di Google. */
function linkedUrl(html, base) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const b = new URL(base);
    const cands = [doc.querySelector('link[rel="canonical"]')?.href, doc.querySelector('meta[property="og:url"]')?.content];
    if (isGoogle(b.hostname)) cands.push(...[...doc.querySelectorAll('a[href^="http"]')].map((a) => a.getAttribute('href')));
    for (const c of cands) {
      if (!c) continue;
      const u = cleanRecipeUrl(new URL(c, base).toString());
      const x = new URL(u);
      if (/^https?:$/.test(x.protocol) && !isGoogle(x.hostname) && u !== cleanRecipeUrl(base)) return u;
    }
  } catch {}
  return '';
}

/**
 * Scarica una pagina di ricetta tramite i proxy CORS, tutti insieme (vince il primo che risponde
 * con una ricetta completa), e la converte. In caso di errore, err.details elenca cosa è successo.
 */
export async function fetchRecipeFromUrl(rawUrl, proxyTpl) {
  const proxies = [...new Set([proxyTpl, ...FALLBACK_PROXIES].filter(Boolean))];
  const details = [];
  const attempt = (target) => new Promise((resolve) => {
    let pending = proxies.length, partial = null, html0 = '';
    for (const tpl of proxies) {
      fetchViaProxy(tpl, target)
        .then((html) => {
          if (!html0 && html) html0 = html;
          const r = recipeFromHTML(html, target);
          if (r && !r._partial) resolve({ r, html });
          else if (r) { partial ||= r; details.push(`${hostOf(tpl)}: ricetta riconosciuta solo in parte`); }
          else {
            details.push(`${hostOf(tpl)}: pagina scaricata ma senza ricetta`);
            // Pagina di rimando (es. share.google): si segue subito il link, senza aspettare gli altri proxy
            if (html && linkedUrl(html, target)) resolve({ r: null, html });
          }
        })
        .catch((e) => details.push(`${hostOf(tpl)}: ${e.name === 'AbortError' ? 'tempo scaduto' : e.message === 'Failed to fetch' ? 'non raggiungibile' : e.message}`))
        .finally(() => { if (--pending === 0) resolve({ r: partial, html: html0 }); });
    }
  });

  let url = cleanRecipeUrl(rawUrl);
  let res = await attempt(url);
  if ((!res.r || res.r._partial) && res.html) {
    // Pagina di rimando (es. share.google) o versione AMP: riprova con il link vero della ricetta
    const next = linkedUrl(res.html, url);
    if (next) {
      const res2 = await attempt(next);
      if (res2.r && (!res.r || !res2.r._partial)) { res = res2; url = next; }
    }
  }
  if (res.r) return res.r;
  const err = new Error(details.some((d) => /senza ricetta|in parte/.test(d))
    ? `La pagina di ${hostOf(url)} è stata scaricata ma non contiene una ricetta riconoscibile.`
    : `Impossibile scaricare la pagina di ${hostOf(url)}.`);
  err.details = details;
  err.url = url;
  throw err;
}

/** Dati inviati dal bookmarklet (pagina già aperta nel browser). */
export function recipeFromBookmarklet(p) {
  for (const s of p.l || []) {
    const j = tryJson(s);
    const r = j && recipeFromJsonLd(j, p.u);
    if (r && (r.ingredients.length || r.steps.length)) { if (!r.image && p.i) r.image = p.i; return r; }
  }
  const r = parseRecipeText(p.s || '');
  if (!r.title) r.title = p.t || '';
  r.source = p.u || r.source;
  if (!r.image && p.i) r.image = p.i;
  return r;
}

/** Testo semplice di una ricetta (per condividerla o copiarla). */
export function recipeToText(r) {
  const parts = [r.title, ''];
  if (r.description) parts.push(r.description, '');
  parts.push(`Porzioni: ${r.servings || '-'}`);
  parts.push('', 'INGREDIENTI');
  r.ingredients.forEach((i) => parts.push(isGroupHeader(i) ? `\n${i}` : `- ${i}`));
  parts.push('', 'PREPARAZIONE');
  r.steps.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
  if (r.notes) parts.push('', 'NOTE', r.notes);
  if (r.source) parts.push('', `Fonte: ${r.source}`);
  return parts.join('\n');
}
