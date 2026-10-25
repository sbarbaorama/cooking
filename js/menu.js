// Classificazione delle ricette e compilazione automatica del menu settimanale
import { normText } from './match.js';
import { isGroupHeader } from './parser.js';
import { seasonInfo } from './season.js';
import { now } from './utils.js';
import { recipeKcal } from './nutrition.js';

const MEAT = /\b(poll|tacchin|manz|vitell|maial|salsicc|carne|macinat|bistecc|agnell|conigl|prosciutt|pancett|guancial|speck|salam|mortadell|bresaol|wurstel|cotechin|zampon|lardo|ragu(?! (?:di |vegetal|veg))|hamburger|fesa|lonz|costin|anatra|cinghial|capocoll|nduja|scaloppin|spezzatin|ossobuc|fegat|trippa|piadina al crudo)/;
const FISH = /\b(pesce|salmon|tonno|merluzz|baccal|gamber|cozz|vongol|calamar|polpo|polpi|seppi|orat|branzin|acciug|alic|spigol|sgombr|scamp|crostace|frutti di mare|trota|sardin|aringh|stoccafiss|nasell|halibut|platess|sogliol|mazzancoll|astic|aragost|bottarg|surimi)/;
const PASTA = /\b(pasta|spaghett|spaghettoni|penne|fusill|rigaton|tagliatell|lasagn|linguin|bucatin|paccher|orecchiett|tortellin|tortelli|raviol|gnocch|maccheron|ditalin|fettuccin|tagliolin|trofie|farfall|mezze maniche|calamarata|pappardell|cannellon|risott|riso|cuscus|couscous|orzo|farro|vermicell|chitarr|strozzapret|pici|garganell|anellett|gramign|tubett|ziti|fregola|malloreddus|canederl)/;
const FRIED = /\b(frigg|frittur|fritt[oie]\b|fritte\b|in pastella|impanat)/;
const HEAVY = /\b(frigg|frittur|fritt[oie]\b|in pastella|impanat|panna|burro|mascarpone|besciamella|maionese|lardo|pancetta|guanciale|salsiccia|pasta sfoglia|brise|cotechin|zampon|wurstel|nduja|gorgonzola|fontina|scamorza|provola|mozzarella in carrozza|parmigiana)/;
const LIGHT_TAG = /\b(legger|light|dieta|dietetic|fit|ipocalor|detox|healthy|vapore|al cartoccio|lessat|bollit|grigliat|alla piastra)/;
const NOT_MAIN = /dolc|dessert|torta|biscott|bevand|cocktail|salse|sugh|condiment|contorn|antipast|aperitiv|colazion|marmellat|confettur|conserv|pane\b/;

/** Testo su cui cercare: titolo, categoria, tag e ingredienti (senza i titoli di sezione). */
// "pasta sfoglia", "pasta frolla"… non sono pasta da primo
const NOT_PASTA = /\bpasta (?:sfoglia|brise|frolla|madre|fillo|filo|di pane|per pizza|di mandorle|di pistacchio|di nocciole|choux|bignè|bigne|di sale|kataifi)\b/g;

function hay(r) {
  const ings = (r.ingredients || []).filter((l) => !isGroupHeader(l)).join(' ');
  return normText([r.title, r.category, r.cuisine, (r.tags || []).join(' '), ings].join(' '));
}

const cache = new Map();
/**
 * Caratteristiche di una ricetta per il menu.
 * main: 'pasta' | 'carne' | 'pesce' | 'veg' (tipo prevalente, usato per alternare i piatti)
 */
export function profile(r) {
  const key = r.id + ':' + (r.updatedAt || 0);
  if (cache.has(key)) return cache.get(key);
  const h = hay(r);
  const cat = normText(r.category);
  const meat = MEAT.test(h);
  const fish = FISH.test(h);
  const strip = (t) => normText(t).replace(NOT_PASTA, ' ');
  const pasta = PASTA.test(strip(r.title + ' ' + r.category)) || (r.ingredients || []).some((l) => !isGroupHeader(l) && /\d/.test(l) && PASTA.test(strip(l)));
  const veg = !meat && !fish;
  const heavy = HEAVY.test(h);
  // Calorie inserite o stimate dagli ingredienti: se ci sono decidono loro, altrimenti si guarda il tipo di piatto
  const kcal = recipeKcal(r).kcal;
  const light = !FRIED.test(h) && (kcal
    ? kcal <= 450 || (kcal <= 550 && !heavy)
    : LIGHT_TAG.test(h) || (!heavy && (veg || fish || /\b(poll|tacchin|petto)/.test(h))));
  const main = pasta ? 'pasta' : meat ? 'carne' : fish ? 'pesce' : 'veg';
  const p = {
    meat, fish, veg, pasta, light, main, kcal,
    eligible: !NOT_MAIN.test(cat) && r.rating !== 1,
    primo: pasta || /\bprim|zupp|minestr|vellutat/.test(cat + ' ' + normText(r.title)),
    secondo: /\bsecond|piatti unic|piatto unic/.test(cat) || (!pasta && (meat || fish || /frittat|uov|torta salata|sformat|polpett|burger|pizza|focacc/.test(normText(r.title)))),
  };
  cache.set(key, p);
  return p;
}

export const STYLES = {
  varieta: { label: 'Varietà', icon: '🎨', hint: 'Un po’ di tutto: pasta, carne, pesce e verdure a rotazione' },
  vegetale: { label: 'Vegetale', icon: '🥦', hint: 'Niente carne né pesce', only: (p) => p.veg },
  pasta: { label: 'Pasta', icon: '🍝', hint: 'Primi di pasta, riso e cereali', prefer: (p) => p.pasta },
  carne: { label: 'Carne', icon: '🥩', hint: 'Piatti di carne', prefer: (p) => p.meat, first: (p) => p.meat && !p.pasta },
  dietetico: { label: 'Dietetico', icon: '🥗', hint: 'Piatti leggeri, fino a circa 450–550 kcal a porzione, niente fritti', only: (p) => p.light },
};

/** Quante ricette sono adatte a ciascuno stile (per mostrarlo nella scelta). */
export function styleCounts(recipes) {
  const ok = recipes.filter((r) => profile(r).eligible);
  const out = {};
  for (const [k, s] of Object.entries(STYLES)) {
    const test = s.only || s.prefer;
    out[k] = test ? ok.filter((r) => test(profile(r))).length : ok.length;
  }
  return out;
}

/** Peso di base: ricette ben votate, preferite, di stagione e non cucinate di recente. */
const baseWeight = (r) => 1 + (r.rating || 0) + (r.favorite ? 2 : 0) + (seasonInfo(r).seasonal ? 3 : 0) + Math.min(5, (now() - (r.lastCooked || 0)) / (86400000 * 14));

function weightedPick(list, w) {
  const ws = list.map(w);
  const tot = ws.reduce((a, b) => a + b, 0);
  if (!tot) return null;
  let x = Math.random() * tot;
  for (let i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i]; }
  return list[list.length - 1];
}

/**
 * Sceglie una ricetta per un pasto.
 * slot: { date, meal }, ctx: { style, used:Set<id>, mainsByDay: Map<date, string[]>, mainCount: {main:n}, prevMain }
 */
export function suggestFor(recipes, slot, ctx) {
  const style = STYLES[ctx.style] || STYLES.varieta;
  let pool = recipes.filter((r) => profile(r).eligible);
  if (style.only) pool = pool.filter((r) => style.only(profile(r)));
  if (!pool.length) return null;
  const fresh = pool.filter((r) => !ctx.used.has(r.id));
  const sameDay = new Set(ctx.recipesByDay?.get(slot.date) || []);
  // Se le ricette adatte sono finite, si ripetono, ma mai nello stesso giorno
  const cands = fresh.length ? fresh : pool.filter((r) => !sameDay.has(r.id));
  if (!cands.length) return null;
  // Livelli di preferenza: prima i più adatti (es. secondi di carne), poi gli adatti, poi gli altri
  const tier1 = style.first ? cands.filter((r) => style.first(profile(r))) : [];
  const tier2 = style.prefer ? cands.filter((r) => style.prefer(profile(r))) : [];
  const list = tier1.length ? tier1 : tier2.length ? tier2 : cands;
  const dayMains = ctx.mainsByDay.get(slot.date) || [];
  ctx.repeated = (ctx.repeated || 0) + (fresh.length ? 0 : 1);
  return weightedPick(list, (r) => {
    const p = profile(r);
    let w = baseWeight(r);
    // A pranzo i primi, a cena i secondi (e i piatti unici vanno bene sempre)
    if (slot.meal === 'pranzo') w *= p.primo ? 3 : p.secondo ? 0.6 : 1;
    else w *= p.secondo ? 2 : p.primo ? (ctx.style === 'pasta' ? 1 : 0.6) : 1;
    // Varietà: evita lo stesso tipo di piatto nello stesso giorno e nel pasto precedente,
    // e bilancia i tipi nell'arco della settimana
    if (ctx.style !== 'pasta' && ctx.style !== 'carne') {
      if (dayMains.includes(p.main)) w *= 0.25;
      if (ctx.prevMain === p.main) w *= 0.5;
      w /= 1 + (ctx.mainCount[p.main] || 0) * 0.35;
    }
    return w;
  });
}

/**
 * Riempie i pasti vuoti dei giorni indicati.
 * Restituisce { add: [voci del menu], empty: n pasti rimasti vuoti }.
 */
export function fillWeek(recipes, { days, meals, style, existing, fromDate }) {
  const ctx = { style, used: new Set(), mainsByDay: new Map(), recipesByDay: new Map(), mainCount: {}, prevMain: null };
  const note = (date, r) => {
    const p = profile(r);
    ctx.used.add(r.id);
    ctx.mainsByDay.set(date, [...(ctx.mainsByDay.get(date) || []), p.main]);
    ctx.recipesByDay.set(date, [...(ctx.recipesByDay.get(date) || []), r.id]);
    ctx.mainCount[p.main] = (ctx.mainCount[p.main] || 0) + 1;
    ctx.prevMain = p.main;
  };
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const add = [];
  let empty = 0;
  for (const date of days) {
    for (const meal of ['pranzo', 'cena']) {
      const have = existing.filter((p) => p.date === date && p.meal === meal);
      if (have.length) { for (const h of have) if (byId.has(h.recipeId)) note(date, byId.get(h.recipeId)); continue; }
      if (!meals.includes(meal) || date < fromDate) continue;
      const r = suggestFor(recipes, { date, meal }, ctx);
      if (!r) { empty++; continue; }
      note(date, r);
      add.push({ date, meal, recipeId: r.id, servings: r.servings, auto: style });
    }
  }
  return { add, empty, repeated: ctx.repeated || 0 };
}
