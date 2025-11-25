const CACHE_NAME = 'pos-v2-archsell-logo';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/css/global.css',
  '/src/css/pos.css',
  '/src/css/admin.css',
  '/src/css/login.css'
];

// 1. INSTALACIÓN
self.addEventListener('install', (e) => {
  // Guardamos los archivos críticos
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Activar inmediatamente
});

// 2. ACTIVACIÓN (Limpieza)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim(); // Tomar control de las pestañas abiertas
});

// 3. FETCH (ESTRATEGIA: NETWORK FIRST / RED PRIMERO)
// Intenta ir a internet. Si falla (offline), usa la caché.
self.addEventListener('fetch', (e) => {
  // Solo interceptamos peticiones http/https (evita errores con chrome-extension://)
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si la red responde bien, guardamos una copia fresca en caché para la próxima
        if (response && response.status === 200 && e.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red (OFFLINE), devolvemos lo que haya en caché
        return caches.match(e.request);
      })
  );
});