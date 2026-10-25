// Service worker: rende l'app disponibile offline.
// VERSION viene aumentata da pubblica.bat a ogni rilascio: il browser vede che questo file è cambiato,
// installa la nuova versione scaricando i file direttamente dal server e l'app mostra "Aggiorna".
const VERSION = 'ricettario-v10';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/utils.js', './js/db.js', './js/store.js', './js/github.js',
  './js/parser.js', './js/match.js', './js/ui.js', './js/views.js', './js/views-home.js', './js/samples.js', './js/season.js', './js/version.js', './js/menu.js', './js/websearch.js', './js/nutrition.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './fonts/dm-sans.woff2', './fonts/fraunces.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// L'app chiede quale versione è attiva (mostrata in Altro e nella barra laterale)
self.addEventListener('message', (e) => {
  if (e.data?.type === 'version') e.ports[0]?.postMessage(VERSION.replace('ricettario-', ''));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API GitHub, proxy e immagini esterne: sempre dalla rete
  if (url.origin !== self.location.origin) return;

  // Navigazioni (anche dalla condivisione Android con ?share_url=...): servi la shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // File dell'app: prima la rete (così gli aggiornamenti arrivano subito), poi la cache
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
