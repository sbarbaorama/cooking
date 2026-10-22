// Confronto tra ingredienti e dispensa: "cosa posso cucinare con quello che ho?"
import { parseIngredient } from './parser.js';

const STOP = new Set(`di del della dello dei degli delle da dal dalla dai dagli dalle a al alla allo ai agli alle e ed o
il lo la i gli le l un uno una per con in su tra fra q b qb circa ben quanto basta piacere g gr kg ml cl dl lt
fresco fresca freschi fresche secco secca secchi secche tritato tritata tritati tritate grattugiato grattugiata grattugiati grattugiate
affettato affettata affettati intero intera interi intere grande grandi piccolo piccola piccoli piccole medio media medi medie
maturo matura maturi mature fine finemente grosso grossa grossi tagliato tagliata tagliati tagliate pezzi pezzetti cubetti dadini
fette fettine sottili sottile qualita tipo biologico biologica bio facoltativo facoltativa opzionale ambiente temperatura
sgocciolato sgocciolati sgocciolata sgocciolate pulito pulita puliti pulite lavato lavata lavati sbucciato sbucciata sbucciati
congelato congelata surgelato surgelata surgelati surgelate extra vergine extravergine ammorbidito sciolto fuso fusa freddo fredda
caldo calda tiepido tiepida abbondante circa q.b n gusto mio nostro vostro fino grossa`.split(/\s+/));

const SYN = {
  uova: 'uovo', tuorli: 'uovo', tuorlo: 'uovo', albumi: 'uovo', albume: 'uovo', eggs: 'uovo', egg: 'uovo',
  grana: 'parmigiano', parmigiano: 'parmigiano', reggiano: '', padano: '',
  spaghetti: 'spaghetti', pomodorini: 'pomodoro', pomodorino: 'pomodoro', ciliegini: 'pomodoro', datterini: 'pomodoro',
  scalogno: 'cipolla', cipollotto: 'cipolla', cipollotti: 'cipolla', patate: 'patata',
  burro: 'burro', margarina: 'burro', lievito: 'lievito', mozzarelle: 'mozzarella', fiordilatte: 'mozzarella',
};

function stem(w) {
  if (w.length < 4) return w;
  let s = w.replace(/[aeiouàèéìòù]$/, '');
  if (/[cg]h$/.test(s)) s = s.slice(0, -1);
  else if (/[cg]i$/.test(s) && s.length > 3) s = s.slice(0, -1);
  return s;
}

export function normText(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Parole chiave (radici) di un nome di ingrediente. */
export function tokens(name) {
  const out = [];
  for (let w of normText(name).split(' ')) {
    if (!w || w.length < 2 || STOP.has(w)) continue;
    if (w in SYN) { w = SYN[w]; if (!w) continue; }
    const st = stem(w);
    if (!out.includes(st)) out.push(st);
  }
  return out;
}

/** Nome "pulito" dell'ingrediente, senza parentesi, preparazioni e quantità. */
export function ingredientName(p) {
  return p.name.replace(/\([^)]*\)/g, ' ').split(/[,;]| - /)[0].replace(/\bq\.?\s?b\.?/gi, '').trim();
}

export function ingredientTokens(line) {
  const p = typeof line === 'string' ? parseIngredient(line) : line;
  if (p.header) return [];
  return tokens(ingredientName(p));
}

function subset(a, b) { return a.length > 0 && a.every((x) => b.includes(x)); }

// Nomi generici che coprono più ingredienti specifici (radici)
const GENERIC = {
  past: ['spaghett', 'penn', 'fusill', 'rigaton', 'maccheron', 'linguin', 'bucatin', 'paccher', 'orecchiett', 'farfall', 'tagliatell',
    'fettuccin', 'ditalin', 'mezz', 'tortiglion', 'sedanin', 'trofi', 'strozzaprett', 'vermicell', 'tagliolin', 'pappardell', 'conchigli', 'gemell', 'caserecc'],
  formagg: ['parmigian', 'pecorin', 'grana', 'mozzarell', 'ricott', 'mascarpon', 'gorgonzol', 'fontin', 'provol', 'scamorz', 'stracchin', 'asiag', 'emmental', 'feta', 'taleggi'],
  verdur: ['zucchin', 'melanzan', 'peperon', 'carot', 'spinac', 'broccol', 'cavol', 'fagiolin', 'bietol', 'asparag', 'carciof', 'zucc', 'pisell'],
};
function generic(a, b) {
  return a.length === 1 && GENERIC[a[0]] && b.some((t) => GENERIC[a[0]].includes(t));
}

/** L'ingrediente (token) è coperto da un elemento della dispensa (token)? */
export function matches(ingTok, haveTok) {
  if (!ingTok.length || !haveTok.length) return false;
  return subset(haveTok, ingTok) || subset(ingTok, haveTok) || generic(haveTok, ingTok) || generic(ingTok, haveTok);
}

export function prepareHave(items) {
  return items.map((it) => ({ ...it, toks: tokens(it.name) })).filter((x) => x.toks.length);
}

export function findHave(ingTok, have) {
  return have.find((h) => matches(ingTok, h.toks)) || null;
}

/**
 * Valuta quanto ogni ricetta è realizzabile con gli ingredienti disponibili.
 * have: [{name, expiring?}]; staples: [string]; required: [string] ingredienti da usare per forza.
 */
export function suggest(recipes, have, staples, { required = [] } = {}) {
  const H = prepareHave(have);
  const S = prepareHave(staples.map((name) => ({ name })));
  const R = required.map(tokens).filter((t) => t.length);
  const res = [];
  for (const r of recipes) {
    const detail = [];
    let haveN = 0, missN = 0, expN = 0;
    for (const line of r.ingredients || []) {
      const p = parseIngredient(line);
      if (p.header) continue;
      const tok = tokens(ingredientName(p));
      if (!tok.length) continue;
      const name = ingredientName(p) || p.raw;
      if (findHave(tok, S)) { detail.push({ name, status: 'staple', tok }); continue; }
      const h = findHave(tok, H);
      if (h) { haveN++; if (h.expiring) expN++; detail.push({ name, status: 'have', expiring: !!h.expiring, tok }); continue; }
      if (p.optional || p.qb) { detail.push({ name, status: 'optional', tok }); continue; }
      missN++;
      detail.push({ name, status: 'missing', tok, line });
    }
    const total = haveN + missN;
    if (!total) continue;
    if (R.length && !R.every((rt) => detail.some((d) => d.status !== 'missing' && matches(d.tok, rt)))) continue;
    const score = haveN / total;
    res.push({
      recipe: r, score, have: haveN, missing: missN, expiring: expN, detail,
      rank: score * 100 - missN * 2 + expN * 8 + (r.favorite ? 3 : 0) + (r.rating || 0),
    });
  }
  return res.sort((a, b) => b.rank - a.rank);
}

// ===== Reparti per la lista della spesa =====
const AISLES = [
  ['Surgelati', ['surgel', 'gelat']],
  ['Frutta e verdura', ['mel', 'per', 'banan', 'aranc', 'limon', 'lime', 'fragol', 'uv', 'kiwi', 'pesc', 'albicocc', 'cilieg', 'frutt', 'insalat', 'lattug', 'rucol', 'spinac', 'zucchin', 'melanzan', 'peperon', 'pomodor', 'patat', 'cipoll', 'agli', 'carot', 'sedan', 'finocch', 'cavol', 'broccol', 'fung', 'zucc', 'porr', 'asparag', 'carciof', 'fagiolin', 'basilic', 'prezzemol', 'rosmarin', 'salv', 'ment', 'tim', 'avocad', 'cetriol', 'ravanell', 'radicc', 'bietol', 'erb', 'zenzer', 'cavolfior', 'scarol', 'verz', 'mirtill', 'lampon', 'anan', 'mang', 'cocomer', 'melon', 'pisell']],
  ['Carne e pesce', ['poll', 'tacchin', 'manz', 'vitell', 'maial', 'salsicc', 'carn', 'macinat', 'bistecc', 'pett', 'cosc', 'agnell', 'conigl', 'salmon', 'merluzz', 'gamber', 'cozz', 'vongol', 'calamar', 'polp', 'orat', 'branzin', 'acciug', 'alic', 'spad', 'sepp', 'scamp', 'baccal', 'hamburger', 'fesa', 'lonz', 'costin']],
  ['Salumi e formaggi', ['prosciutt', 'pancett', 'guancial', 'speck', 'salam', 'mortadell', 'bresaol', 'parmigian', 'pecorin', 'mozzarell', 'ricott', 'mascarpon', 'gorgonzol', 'fontin', 'provol', 'stracchin', 'scamorz', 'formagg', 'feta', 'burrat', 'emmental', 'asiag', 'taleggi', 'philadelphi', 'stracciatell', 'wurstel']],
  ['Latte, uova e frigo', ['latt', 'pann', 'burr', 'yogurt', 'uov', 'kefir', 'tofu']],
  ['Pane e forno', ['pan', 'pangrattat', 'grissin', 'cracker', 'focacc', 'piadin', 'sfogl', 'brise', 'fett biscottat', 'tortill']],
  ['Pasta, riso e cereali', ['past', 'spaghett', 'penn', 'fusill', 'rigaton', 'tagliatell', 'lasagn', 'ris', 'farin', 'semol', 'cuscus', 'orz', 'farr', 'quino', 'gnocc', 'polent', 'aven', 'linguin', 'tortellin', 'ravioli', 'orecchiett', 'paccher', 'bucatin', 'maccheron', 'ditalin', 'tagliolin', 'fettuccin']],
  ['Dispensa', ['zuccher', 'sal', 'oli', 'acet', 'passat', 'pelat', 'concentrat', 'legum', 'cec', 'lenticc', 'fagiol', 'tonn', 'mais', 'capper', 'oliv', 'brod', 'dad', 'spez', 'pep', 'cannell', 'nocemoscat', 'curry', 'paprik', 'caca', 'cioccolat', 'marmellat', 'lievit', 'vanigl', 'biscott', 'caff', 'conserv', 'miel', 'maizen', 'amid', 'frutta secc', 'mandorl', 'noc', 'nocciol', 'pinol', 'pistacch', 'uvett', 'sesam', 'senap', 'maionese', 'ketchup', 'sals', 'sugo', 'origan', 'peperoncin', 'zafferan', 'curcum', 'cumin', 'chiod', 'allor']],
  ['Bevande', ['vin', 'birr', 'acqu', 'succ', 'liquor', 'rum', 'marsal', 'brandy', 'cognac', 'gin', 'vodk', 'spumant', 'prosecc']],
];
export const AISLE_ORDER = [...AISLES.map((a) => a[0]), 'Altro'];

export function aisleOf(name) {
  const n = normText(name);
  if (/surgel/.test(n)) return 'Surgelati';
  // Il primo nome riconosciuto decide; a parità vince la chiave più lunga (zucchero ≠ zucca)
  for (const t of tokens(name)) {
    let best = null, len = 0;
    for (const [aisle, keys] of AISLES) {
      for (const k of keys) {
        if ((t === k || (k.length >= 4 && t.startsWith(k))) && k.length > len) { best = aisle; len = k.length; }
      }
    }
    if (best) return best;
  }
  return 'Altro';
}
