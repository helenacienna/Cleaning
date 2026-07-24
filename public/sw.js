const CACHE_VERSION = 'cienna-cleaning-offline-v3';
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const PRECACHE_URLS = [
  '/',
  '/cleaner',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('cienna-cleaning-offline-') && !key.startsWith(CACHE_VERSION))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function wantsHtml(request) {
  return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

function wantsJson(request) {
  return request.headers.get('accept')?.includes('application/json') || request.headers.get('content-type')?.includes('application/json');
}

async function cacheResponse(request, response) {
  if (!response || !response.ok || response.status === 206) {
    return response;
  }

  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl = null) {
  try {
    const response = await fetch(request);
    return await cacheResponse(request, response);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return cacheResponse(request, response);
}

function offlineJson(message, status = 503) {
  return new Response(JSON.stringify({
    error: message,
    offline: true,
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => wantsJson(request)
        ? offlineJson('You are offline. Reconnect before saving this change.')
        : caches.match('/offline.html'))
    );
    return;
  }

  if (wantsHtml(request)) {
    event.respondWith(networkFirst(request, '/offline.html'));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.match(/\.(?:png|svg|ico|jpg|jpeg|webp|css|js|woff2?)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(request).catch(() => offlineJson('Offline and no cached data is available for this request.'))
    );
    return;
  }

  event.respondWith(networkFirst(request));
});
