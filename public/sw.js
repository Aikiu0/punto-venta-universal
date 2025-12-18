// sw.js — ArchSell POS (Vite + Netlify)

const VERSION = '1.0.1'; // 🔴 CAMBIA EN CADA DEPLOY
const STATIC_CACHE = `archsell-static-${VERSION}`;
const RUNTIME_CACHE = 'archsell-runtime';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

// ================= INSTALL =================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ================= ACTIVATE =================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (![STATIC_CACHE, RUNTIME_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// ================= FETCH =================
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  if (req.url.includes('supabase') || req.url.includes('/api')) return;

  if (req.url.includes('/assets/')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
  }
});

// ================= MESSAGE =================
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
