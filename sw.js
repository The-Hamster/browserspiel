// Offline-Speicher für Kernwacht (App-Modus)
const CACHE = 'kernwacht-1.0.7';
const FILES = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './js/main.js', './js/util.js', './js/data.js', './js/storage.js', './js/waves.js', './js/kachel.js', './js/audio.js', './js/particles.js',
  './js/sprites.js', './js/game.js', './js/terrain.js', './js/render.js', './js/ui.js', './js/editor.js', './js/rank.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // erst Netz (für Updates), bei Ausfall aus dem Speicher
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
