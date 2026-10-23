// Versione dell'app e aggiornamenti (service worker)
import { toast } from './utils.js';

const PREFIX = 'ricettario-';
const SEEN_KEY = 'ricettario.version';
const swOk = () => 'serviceWorker' in navigator && location.protocol !== 'file:';

/** Versione attiva (es. "v5"): la chiede al service worker, altrimenti la legge dal nome della cache. */
export async function appVersion() {
  if (!swOk()) return '';
  const ctl = navigator.serviceWorker.controller;
  if (ctl) {
    const v = await new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve(e.data || '');
      ctl.postMessage({ type: 'version' }, [ch.port2]);
      setTimeout(() => resolve(''), 1500);
    });
    if (v) return v;
  }
  try {
    const k = (await caches.keys()).find((x) => new RegExp(`^${PREFIX}v\\d+$`).test(x));
    return k ? k.slice(PREFIX.length) : '';
  } catch { return ''; }
}

function showUpdateBanner() {
  if (document.getElementById('update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'update-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>✨ È disponibile una nuova versione del Ricettario</span><button type="button" class="btn sm">Aggiorna</button>';
  bar.querySelector('button').addEventListener('click', () => location.reload());
  document.body.append(bar);
}

/** Controlla subito se c'è una versione nuova. Restituisce 'found', 'latest' o 'offline'. */
export async function checkForUpdate() {
  if (!swOk()) return 'latest';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'latest';
  try { await reg.update(); } catch { return 'offline'; }
  if (reg.installing || reg.waiting) { showUpdateBanner(); return 'found'; }
  return 'latest';
}

/**
 * Aggiornamento forzato: elimina service worker e file salvati dell'app e ricarica dal server.
 * Ricette, dispensa, spesa e impostazioni (salvate in IndexedDB) non vengono toccate.
 */
export async function forceUpdate() {
  try {
    if (swOk()) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) if (k.startsWith(PREFIX)) await caches.delete(k);
  } catch (e) { console.warn(e); }
  location.reload();
}

/** Mostra la versione nella barra laterale e avvisa dopo un aggiornamento. */
async function showVersion() {
  const v = await appVersion();
  const el = document.getElementById('app-ver');
  if (el) el.textContent = v ? `Ricettario ${v}` : '';
  if (!v) return;
  let prev = '';
  try { prev = localStorage.getItem(SEEN_KEY) || ''; localStorage.setItem(SEEN_KEY, v); } catch {}
  if (prev && prev !== v) toast(`Ricettario aggiornato alla versione ${v} ✓`, 4000);
}

/** Registra il service worker e tiene d'occhio gli aggiornamenti. */
export function initServiceWorker() {
  if (!swOk()) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Una versione nuova si è attivata mentre l'app era aperta
    if (hadController) showUpdateBanner(); else showVersion();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    showVersion();
    // Su telefono l'app resta aperta a lungo: controlla quando torna in primo piano e ogni ora
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch((e) => console.warn('Service worker non registrato', e));
}
