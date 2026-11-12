/*
 * Service worker — makes the site installable and usable offline, and shows
 * push notifications. Served from /sw.js (routes/push.js) so its scope is the
 * whole site; registered from footer.ejs on App Engine only.
 *
 * Strategies:
 *   - Page navigations: network-first (fixtures change daily), fall back to the
 *     last cached copy, then to /offline.
 *   - Same-origin CSS/JS (/public/style.css, /static/js, /scripts/…): network-
 *     first too — none of it is content-hashed, so serving a cached copy first
 *     would pair new HTML with old styles for one load after every deploy.
 *   - Images, icons, manifest, Google Fonts: stale-while-revalidate.
 *   - /push/*, non-GET, cross-origin (other than fonts): untouched.
 *
 * Bump VERSION when changing caching logic; old caches are purged on activate.
 * Ported from the remnants-badminton site's public/sw.js.
 */
const VERSION = 'v1';
const PRECACHE = `precache-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const MAX_PAGES = 30;
const MAX_ASSETS = 60;

const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [OFFLINE_URL, '/public/style.css', '/static/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, PAGES, ASSETS]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (!sameOrigin && !isFont) return;
  if (sameOrigin && (url.pathname.startsWith('/push/') || url.pathname === '/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES, MAX_PAGES));
  } else if (sameOrigin && /\.(css|js)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, ASSETS, MAX_ASSETS));
  } else {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function networkFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      trim(cacheName, max);
    }
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await caches.match(request));
    if (cached) return cached;
    if (request.mode === 'navigate') return (await caches.match(OFFLINE_URL)) || Response.error();
    return Response.error();
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone()).then(() => trim(ASSETS, MAX_ASSETS));
      }
      return response;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return network;
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/* ── Push notifications ──────────────────────────────────────────────────────
 * Payload (from routes/push.js → lib/push/send.js): { title, body, url, tag }
 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  const title = data.title || 'Hyde Badminton Club';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,          // same tag replaces rather than stacks
      icon: '/static/icons/icon-192.png',
      badge: '/static/icons/badge-96.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) return existing.navigate(target).then((w) => (w || existing).focus());
      return self.clients.openWindow(target);
    }),
  );
});
