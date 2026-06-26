const CACHE_NAME = 'ilgin-insani-cache-v1';
const ASSETS_TO_CACHE = [
  'index.html',
  'esnaf.html',
  'dashboard.html',
  'istatistik.html',
  'manifest.json',
  'bulcuk.jpg',
  'yalburt.jpg',
  'kulliye.jpg',
  'kaplica.jfif',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

// Install Service Worker and cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker and clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept fetch requests
self.addEventListener('fetch', event => {
  // Only cache GET requests and do not cache API requests or webhooks (e.g. open-meteo, n8n)
  const requestUrl = new URL(event.request.url);
  const isApiRequest = requestUrl.hostname.includes('api.open-meteo.com') || requestUrl.hostname.includes('n8n.ilgininsani.com');
  
  if (event.request.method !== 'GET' || isApiRequest) {
    // Network-only for APIs, POST requests
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve static asset from cache, but update it in background (stale-while-revalidate)
          fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          }).catch(() => {/* Ignore network failures on background sync */});
          
          return cachedResponse;
        }
        
        // Network fallback
        return fetch(event.request)
          .then(response => {
            // Cache newly fetched valid static assets
            if (response && response.status === 200 && response.type === 'basic') {
              const responseCopy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
            }
            return response;
          })
          .catch(() => {
            // Fallback for offline mode if HTML page is requested
            const acceptHeader = event.request.headers.get('accept');
            if (acceptHeader && acceptHeader.includes('text/html')) {
              return caches.match('index.html');
            }
          });
      })
  );
});
