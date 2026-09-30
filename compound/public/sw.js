/* LeapPath service worker — app-shell cache, network-first for API. */
var CACHE = 'compound-v7';
var SHELL = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/app.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // cache: 'reload' skips the browser's HTTP cache so a new version never stores old files
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })).catch(function () {});
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // never cache POST/PUT/DELETE
  var url = new URL(req.url);

  // API + uploads: always go to network (fresh data, auth).
  if (url.pathname.indexOf('/api/') !== -1) {
    e.respondWith(fetch(req).catch(function () {
      return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }

  // App shell / assets: cache-first, then update in background.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
