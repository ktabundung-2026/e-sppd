const CACHE_NAME = 'e-sppd-eperdin-tabundung-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './perdin.html', // <-- Ditambahkan agar E-Perdin bisa dibuka offline
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tinos:ital,wght@0,400;0,700;1,400&display=swap',
  'https://www.sumbatimurkab.go.id/public/img/konfigurasi/logo/1747657288_a8dff28fb3906c556fac.png'
];

// Instalasi Service Worker & Caching Aset Utama
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all integrated app assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Aktivasi & Pembersihan Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategi Caching: Network First dengan Fallback ke Cache saat Offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Toleransi status 200 (OK) dan 0 (Opaque CDN External)
        if (event.request.method === 'GET' && (response.status === 200 || response.status === 0)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Jika offline, ambil dari Cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback navigasi halaman utama saat offline
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
