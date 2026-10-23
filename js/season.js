// Frutta e verdura di stagione (calendario indicativo per l'Italia)
import { normText } from './match.js';
import { isGroupHeader } from './parser.js';

// [nome mostrato, radice da cercare nel testo, mesi (1-12)]
const PRODUCE = [
  ['asparagi', 'asparag', [3, 4, 5, 6]],
  ['carciofi', 'carciof', [11, 12, 1, 2, 3, 4]],
  ['zucchine', 'zucchin', [5, 6, 7, 8, 9]],
  ['melanzane', 'melanzan', [6, 7, 8, 9]],
  ['peperoni', 'peperon(?!cin)', [6, 7, 8, 9]],
  ['pomodori', 'pomodor', [6, 7, 8, 9]],
  ['cetrioli', 'cetriol', [6, 7, 8]],
  ['fagiolini', 'fagiolin', [6, 7, 8, 9]],
  ['piselli', 'pisell', [4, 5, 6]],
  ['fave', 'fave\\b', [4, 5, 6]],
  ['zucca', 'zucc(a|he)\\b', [9, 10, 11, 12]],
  ['funghi', '(fung|porcin|champignon|chiodin)', [9, 10, 11]],
  ['cavolfiore', 'cavolfior', [10, 11, 12, 1, 2, 3]],
  ['cavolo', 'cavol(o|i)\\b', [10, 11, 12, 1, 2, 3]],
  ['broccoli', 'broccol', [10, 11, 12, 1, 2, 3]],
  ['verza', 'verz', [10, 11, 12, 1, 2, 3]],
  ['cime di rapa', 'cime di rap', [10, 11, 12, 1, 2, 3]],
  ['finocchi', 'finocch', [10, 11, 12, 1, 2, 3, 4]],
  ['radicchio', 'radicc', [10, 11, 12, 1, 2, 3]],
  ['spinaci', 'spinac', [10, 11, 12, 1, 2, 3, 4, 5]],
  ['porri', 'porr(o|i)\\b', [10, 11, 12, 1, 2, 3]],
  ['castagne', 'castagn', [10, 11, 12]],
  ['mele', 'mel(a|e)\\b', [8, 9, 10, 11, 12, 1, 2, 3]],
  ['pere', 'per(a|e)\\b', [8, 9, 10, 11, 12]],
  ['uva', 'uva\\b', [8, 9, 10]],
  ['fragole', 'fragol', [4, 5, 6]],
  ['ciliegie', 'cilieg(i|e)', [5, 6, 7]],
  ['albicocche', 'albicocc', [6, 7, 8]],
  ['pesche', 'pesch', [6, 7, 8, 9]],
  ['melone', 'melon', [6, 7, 8, 9]],
  ['anguria', '(anguri|cocomer)', [6, 7, 8]],
  ['arance', 'aranc', [12, 1, 2, 3, 4]],
  ['mandarini', '(mandarin|clementin)', [11, 12, 1, 2]],
  ['kiwi', 'kiwi', [11, 12, 1, 2, 3]],
  ['cachi', 'cach(i|o)\\b', [10, 11, 12]],
  ['melagrana', 'melagran', [10, 11, 12]],
  ['rucola', 'rucol', [4, 5, 6, 7, 8, 9, 10]],
].map(([name, re, months]) => ({ name, re: new RegExp('\\b' + re), months }));

// Prodotti conservati: non contano per la stagionalità
const PRESERVED = /\b(passat|pelat|concentrat|polpa|secch|essiccat|scatol|conserv|surgel|sott ?olio|sciroppo|succo|marmellat|confettur|sugo|disidrat|pesto)/;

export const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const currentMonth = () => new Date().getMonth() + 1;
export const monthName = (m = currentMonth()) => MONTHS[m - 1];

const cache = new Map();

/**
 * Stagionalità di una ricetta: { inSeason: [..], outSeason: [..], seasonal: bool }.
 * "Di stagione" = almeno un prodotto fresco di stagione e nessuno fuori stagione.
 */
export function seasonInfo(r, month = currentMonth()) {
  const key = r.id + ':' + (r.updatedAt || 0) + ':' + month;
  if (cache.has(key)) return cache.get(key);
  const inSeason = new Set(), outSeason = new Set();
  for (const line of r.ingredients || []) {
    if (isGroupHeader(line)) continue;
    const t = normText(line);
    if (PRESERVED.test(t)) continue;
    for (const p of PRODUCE) {
      if (p.re.test(t)) (p.months.includes(month) ? inSeason : outSeason).add(p.name);
    }
  }
  const out = { inSeason: [...inSeason], outSeason: [...outSeason], seasonal: inSeason.size > 0 && outSeason.size === 0 };
  cache.set(key, out);
  return out;
}

/** Prodotti di stagione nel mese, per suggerimenti. */
export const producesOf = (month = currentMonth()) => PRODUCE.filter((p) => p.months.includes(month)).map((p) => p.name);
