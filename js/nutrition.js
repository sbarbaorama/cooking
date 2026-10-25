// Stima delle calorie di una ricetta a partire dagli ingredienti (valori medi, kcal per 100 g)
import { parseIngredient } from './parser.js';
import { normText } from './match.js';

/*
 * [espressione, kcal per 100 g, peso di un pezzo in g (facoltativo), grammi a porzione se "q.b." (facoltativo)]
 * L'ordine conta: le voci più specifiche vengono prima ("latte di cocco" prima di "latte").
 * Per pesci interi, cozze e vongole i valori sono riferiti al peso lordo (con lische o gusci).
 */
const FOODS = [
  // --- da non contare
  [/\b(sale|pepe|peperoncin|spezi|noce moscata|cannell|curcuma|curry|paprika|zafferan|cumino|chiodi di garofano|vanigli|vanillina|alloro|origano|timo|rosmarino|salvia|basilico|prezzemolo|menta|erba cipollina|aneto|maggiorana|erbe|lievito|bicarbonato|cremor|gelatina|colla di pesce|agar|acqua|ghiaccio|aroma|essenza|scorza|caff[eè]|\bt[eè]\b|tisana|infuso)/, 0, 1],
  [/\bbrodo|\bdado/, 5, 10],
  // --- grassi e condimenti
  [/olio.*(friggere|frittura|semi di arachide)|per friggere/, 900, null, 15, { fry: true }],
  [/\bolio|\bstrutto/, 900, null, 5],
  [/burro di arachidi|burro d arachidi/, 590],
  [/\bburro|\bmargarin/, 750, null, 5],
  [/maionese/, 680], [/ketchup/, 100], [/senape/, 70], [/salsa di soia|\bsoia\b/, 60], [/aceto balsamico/, 90], [/\baceto/, 20],
  [/\bpesto/, 450], [/besciamella/, 120], [/\bragu/, 150], [/sugo/, 70],
  [/\bvino|\bmarsala|\bporto\b/, 75], [/\bbirra/, 40], [/\brum|\bliquor|\bcognac|\bbrandy|\bwhisky|\bamaretto/, 230],
  // --- dolci e zuccheri
  [/zucchero|\bcanna\b/, 390, null, 2], [/\bmiele/, 300], [/marmellat|confettur/, 250], [/sciroppo/, 280],
  [/cioccolat.*bianc/, 540], [/cioccolat|gocce di cioccolat/, 540], [/\bcacao/, 360], [/nutella|crema spalmabile|crema di nocciole/, 540],
  [/savoiard|pavesin/, 390], [/biscott|frollini|amaretti/, 460], [/fette biscottate/, 410],
  // --- latticini e uova
  [/tuorl/, 330, 18], [/album/, 45, 35], [/\buov/, 140, 60],
  [/latte di cocco/, 200], [/latte di (soia|mandorla|riso|avena)|bevanda vegetale/, 40], [/latte condensato/, 320],
  [/\blatte/, 60], [/panna (da cucina|per cucinare)/, 200], [/\bpanna/, 340],
  [/yogurt greco/, 100, 150], [/\byogurt/, 65, 125],
  [/mascarpone/, 450], [/\bricotta/, 145], [/mozzarell|fior di latte|fiordilatte/, 250, 125], [/burrata/, 300, 125], [/stracciatella/, 280],
  [/parmigian|grana|pecorin/, 390, null, 5], [/gorgonzola/, 330], [/feta\b/, 260], [/philadelphia|formaggio spalmabile|robiola|stracchino|crescenza/, 260],
  [/fontina|emmental|groviera|gruyere|asiago|taleggio|provola|scamorza|caciocavallo|provolone|cheddar|edamer|formaggi/, 350],
  // --- carne e salumi
  [/guancial/, 650], [/pancett/, 450], [/lardo/, 890], [/salam|salsicc|nduja|cotechin|zampon/, 330, 100], [/wurstel/, 270, 50],
  [/prosciutto cotto|\bcotto\b/, 200], [/prosciutto|speck|culatello/, 260], [/mortadell/, 310], [/bresaol/, 150], [/coppa|capocoll/, 400],
  [/petto di (pollo|tacchino)|fesa di tacchino|tacchino|sovracosc.*senza pelle/, 110, 250], [/\bpoll|\bgallin/, 190, 1200],
  [/macinat|hamburger|polpett/, 240], [/vitell|fettin|scaloppin/, 110], [/\bmanzo|bistecc|filetto di manzo|roast beef|spezzatino|bollito|ossobuc/, 160],
  [/\bmaial|lonza|arista|costin|filetto di maiale/, 200], [/agnell|capretto/, 230], [/conigli/, 140], [/anatra/, 230], [/fegat/, 140],
  // --- pesce
  [/tonno.*(naturale)/, 110, 80], [/tonno.*(scatol|olio|lattin|sgocciolat)/, 200, 80], [/\btonno/, 130],
  [/salmone affumicato/, 180], [/\bsalmon/, 190, 150], [/merluzz|nasell|platess|sogliol|halibut|filetti di pesce|persico/, 80, 150],
  [/baccal|stoccafiss/, 100], [/acciugh.*olio|alici.*olio/, 200, 4], [/acciug|\balic/, 100, 15], [/sgombr/, 170], [/sardin/, 130, 40],
  [/pesce spada|spada/, 110, 150], [/\btrot/, 120, 300], [/orat|branzin|spigol|dentice|pagell/, 65, 400],
  [/gamber|mazzancoll|scamp/, 60, 25], [/calamar|totan/, 70, 150], [/\bpolp[oi]/, 70], [/seppi/, 70], [/cozz/, 30], [/vongol|telline|lupini/, 25],
  [/frutti di mare/, 60], [/surimi/, 100], [/bottarga/, 380],
  // --- cereali, pasta, pane
  [/pasta sfoglia|sfoglia/, 400, 230], [/pasta brise|brise/, 450, 230], [/pasta frolla/, 460], [/pasta per pizza|impasto per pizza|pasta di pane/, 250],
  [/farina di mandorl/, 600], [/farina di (mais|polenta)|polenta|fioretto/, 360], [/farina di ceci/, 350],
  [/farina|semola|fecola|amido|maizena/, 350, null, 0],
  [/pangrattato|pan grattato|pane grattugiato/, 380], [/pancarre|pan carre|pane in cassetta|tramezzin/, 270, 25],
  [/\bpane|baguette|rosetta|ciabatt|focacc|piadin|tortill|panin/, 270, 60], [/cracker|grissin|taralli/, 420],
  [/gnocch/, 150], [/tortellin|raviol|cappellett|agnolott/, 300],
  [/tagliatelle fresche|pasta fresca|pasta all uovo|lasagne fresche|pappardell|fettuccin|tagliolin/, 290],
  [/\bpasta|spaghett|penne|fusill|rigaton|linguin|bucatin|paccher|orecchiett|maccheron|ditalin|trofie|farfall|mezze maniche|calamarata|lasagn|cannellon|vermicell|tubett|ziti|strozzapret|garganell|anellett|fregola|mafald|sedanin|caserecc|conchigl|candele|chitarr|pici|stelline|tempestina|capellini/, 355],
  [/\briso|carnaroli|arborio|vialone|basmati|venere/, 350], [/\bfarro/, 335], [/\borzo/, 320], [/cous ?cous|cuscus/, 360], [/quinoa/, 370], [/avena|fiocchi d/, 370], [/cereali|muesli/, 380],
  // --- legumi
  [/(ceci|fagiol|lenticch|cicerchi).*secch/, 330], [/\bceci|lenticch|fagiol|cannellini|borlott|cicerch/, 110, null, 0], [/pisell/, 70], [/\bfave/, 70], [/edamame|soia gialla/, 120], [/tofu/, 120],
  // --- verdure
  [/passata|polpa di pomodoro|pomodori pelati|pelati/, 25], [/concentrato di pomodoro|doppio concentrato/, 80], [/pomodori secchi/, 250],
  [/pomodorin|ciliegin|datterin/, 20, 15], [/pomodor/, 18, 120],
  [/patat/, 80, 170], [/patate dolci|patata americana/, 90, 250], [/zucchin/, 17, 200], [/melanzan/, 20, 300], [/peperon/, 25, 200],
  [/scalogn/, 70, 25], [/cipollott/, 30, 50], [/cipoll/, 30, 100], [/\bagli/, 120, 5], [/porr/, 30, 150], [/carot/, 35, 80], [/sedano rapa/, 25, 500], [/sedan/, 15, 40],
  [/finocch/, 15, 250], [/cavolfior/, 25, 700], [/broccol|cime di rapa|friariell/, 30, 300], [/cavolo nero|cavolo|verza|cavolini/, 25, 700],
  [/spinac|bietol|catalogna|cicoria|scarola|indivia/, 20], [/lattug|insalat|songino|valeriana|misticanza|iceberg/, 15, 300], [/rucol/, 25], [/radicc/, 15, 200],
  [/zucca/, 20], [/porcin/, 30], [/fung|champignon|chiodin|pleurot|shiitake/, 25, 20], [/carciof/, 25, 120], [/asparag/, 25, 20],
  [/fagiolin|taccole/, 25], [/\bmais/, 90], [/olive/, 150, 4], [/capper/, 40], [/cetriol/, 15, 250], [/avocado/, 160, 200], [/ravanell/, 15, 10], [/barbabietol/, 40, 150], [/germogli/, 30],
  // --- frutta
  [/succo di limone|limone.*succo|succo.*limon/, 25], [/\blimon|\blime/, 30, 100], [/arancia|arance/, 45, 200], [/mandarin|clementin/, 50, 80],
  [/\bmel[ae]\b|\bmele\b/, 50, 180], [/\bper[ae]\b/, 55, 180], [/banan/, 90, 120], [/fragol/, 30, 20], [/frutti di bosco|mirtill|lampon|more\b|ribes/, 45],
  [/\buva\b|uvetta|uva passa|sultanina/, 70], [/pesch|nettarin/, 40, 150], [/albicocc/, 45, 40], [/ananas/, 50], [/mango/, 60, 300], [/kiwi/, 60, 80],
  [/cilieg/, 60, 8], [/fichi secchi|datter|prugne secche/, 270, 20], [/\bfich/, 70, 50], [/melagran/, 70, 250], [/cocco rap|cocco/, 600],
  // --- frutta secca e semi
  [/mandorl|nocciol|\bnoci\b|\bnoce\b|gherigli|pinoli|pistacch|anacard|arachid|frutta secca|semi di|sesamo|tahin/, 620, 5],
];

// Grammi per unità di misura (le unità "a pezzi" usano il peso del pezzo se c'è)
const UNIT_G = {
  g: 1, gr: 1, grammi: 1, grammo: 1, kg: 1000, hg: 100, etto: 100, etti: 100, mg: 0.001,
  ml: 1, cl: 10, dl: 100, l: 1000, lt: 1000, litro: 1000, litri: 1000,
  cucchiaio: 10, cucchiai: 10, tbsp: 15, cucchiaino: 4, cucchiaini: 4, cc: 4, tsp: 5,
  tazza: 200, tazze: 200, cup: 240, cups: 240, tazzina: 50, tazzine: 50, bicchiere: 200, bicchieri: 200,
  pizzico: 0.5, pizzichi: 0.5, spicchio: 5, spicchi: 5, noce: 10, noci: 10, manciata: 30, manciate: 30,
  foglia: 0.5, foglie: 0.5, rametto: 1, rametti: 1, ramo: 1, rami: 1, ciuffo: 5, ciuffi: 5, mazzetto: 30, mazzetti: 30, mazzo: 30,
  bustina: 15, bustine: 15, cubetto: 10, cubetti: 10, dado: 10, dadi: 10,
  fetta: 25, fette: 25, fettina: 100, fettine: 100, filetto: 150, filetti: 150, costa: 40, coste: 40, gambo: 40, gambi: 40, testa: 40, teste: 40,
  vasetto: 125, vasetti: 125, lattina: 80, lattine: 80, barattolo: 400, barattoli: 400, scatola: 400, scatole: 400, confezione: 250, confezioni: 250,
  rotolo: 230, rotoli: 230, panetto: 250, panetti: 250, oz: 28, lb: 454, lbs: 454,
};
const PIECE_UNITS = new Set(['pezzo', 'pezzi', 'pz', '']);

function findFood(name) {
  const t = normText(name).replace(/^(di|d|del|della|dei|delle)\s+/, '');
  for (const f of FOODS) if (f[0].test(t)) return f;
  return null;
}

/**
 * Calorie di una riga di ingrediente.
 * Restituisce { kcal, grams, known, note } oppure null per i titoli di sezione.
 */
export function ingredientKcal(line, servings = 4) {
  // Misure "di casa" scritte per esteso: "4 cucchiai da tavola", "1 cucchiaio da tè"
  const text = String(line || '')
    .replace(/cucchiai[oi]?\s+da\s+(t[eè]|caff[eè])/gi, 'cucchiaino')
    .replace(/(cucchiai[oi]?)\s+da\s+tavola/gi, '$1');
  const p = parseIngredient(text);
  // Quantità scritta in mezzo alla riga ("Olio EVO 4 cucchiai")
  if (p.qty == null && !p.header) {
    const m = text.toLowerCase().replace(/(\d),(\d)/g, '$1.$2').match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${Object.keys(UNIT_G).sort((a, b) => b.length - a.length).join('|')})\\b`));
    if (m) { p.qty = parseFloat(m[1]); p.unit = m[2]; }
  }
  if (p.header || !p.raw) return null;
  const food = findFood(p.name || p.raw);
  if (!food) return { kcal: 0, grams: null, known: false, line: p.raw };
  const [, k100, piece, qbPerServing, opt] = food;
  if (k100 === 0) return { kcal: 0, grams: 0, known: true, line: p.raw };
  let grams = null;
  const unit = (p.unit || '').toLowerCase().replace(/\.$/, '');
  const qty = p.qty != null ? (p.qty2 != null ? (p.qty + p.qty2) / 2 : p.qty) : null;
  if (opt?.fry) grams = (qbPerServing || 15) * servings; // olio per friggere: conta solo quello assorbito
  else if (qty != null && unit && UNIT_G[unit] != null) {
    grams = qty * (/^(fett|fettin)/.test(unit) && piece && piece < 40 ? piece : unit.startsWith('lattin') && piece ? piece : UNIT_G[unit]);
  } else if (qty != null && PIECE_UNITS.has(unit)) {
    if (piece) grams = qty * piece;
    else if (qty >= 20) grams = qty; // "Pecorino 50" senza unità: grammi
  } else if (qty == null && p.qb && qbPerServing != null) grams = qbPerServing * servings;
  else if (qty == null && p.qb) return { kcal: 0, grams: 0, known: true, line: p.raw, note: 'q.b.' };
  else if (qty == null && piece) grams = piece; // "un uovo" già gestito; "limone" senza numero = 1
  if (grams == null) return { kcal: 0, grams: null, known: false, line: p.raw, note: 'quantità non chiara' };
  return { kcal: (grams * k100) / 100, grams, known: true, line: p.raw };
}

const cache = new Map();
/**
 * Stima delle calorie a porzione: { perServing, total, coverage (0-1), items, unknown: [righe] }.
 * coverage = quota di ingredienti riconosciuti con una quantità.
 */
export function estimateKcal(r) {
  const key = (r.id || '') + ':' + (r.updatedAt || 0) + ':' + (r.servings || 4) + ':' + (r.ingredients || []).join('|').length;
  if (r.id && cache.has(key)) return cache.get(key);
  const servings = Math.max(1, r.servings || 4);
  const items = (r.ingredients || []).map((l) => ingredientKcal(l, servings)).filter(Boolean);
  const total = items.reduce((s, x) => s + x.kcal, 0);
  const known = items.filter((x) => x.known).length;
  const out = {
    perServing: items.length ? Math.round(total / servings / 5) * 5 : null,
    total: Math.round(total),
    coverage: items.length ? known / items.length : 0,
    items,
    unknown: items.filter((x) => !x.known).map((x) => x.line + (x.note ? ` (${x.note})` : '')),
  };
  if (r.id) cache.set(key, out);
  return out;
}

/** Calorie da usare per una ricetta: quelle inserite, altrimenti la stima se abbastanza affidabile. */
export function recipeKcal(r) {
  if (r.calories) return { kcal: r.calories, estimated: false };
  const e = estimateKcal(r);
  if (e.perServing && e.coverage >= 0.6) return { kcal: e.perServing, estimated: true, coverage: e.coverage };
  return { kcal: null, estimated: true, coverage: e.coverage };
}
