/* Service worker: tiene l'app disponibile anche senza internet. Cambiare VERSIONE a ogni rilascio. */
const VERSIONE = 'sim-v2.2.0';
const FILE = ['./', './index.html', './style.css', './calc.js', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './lib/chart.umd.min.js',
  './lib/xlsx.full.min.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSIONE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Rete prima (così gli aggiornamenti arrivano), cache se offline.
  const stessoSito = new URL(e.request.url).origin === location.origin;
  // no-cache: chiede sempre al server se il file è cambiato, così la nuova versione arriva subito.
  e.respondWith(fetch(e.request, stessoSito ? { cache: 'no-cache' } : undefined).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSIONE).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
});
