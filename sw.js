const CACHE_NAME = 'iphone-alert-v2';
const ASSETS = ['./index.html', './manifest.json', './icon.svg'];

// ── Install ───────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (cache-first for own assets, network for OLX) ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only cache own assets
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});

// ── Message from page ────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIF') {
    const { title, body, url, tag } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: './icon.svg',
      badge: './icon.svg',
      tag: tag || 'olx-alert',
      renotify: true,
      vibrate: [150, 80, 150, 80, 300],
      data: { url: url || './' },
      actions: [
        { action: 'open', title: '📱 Otwórz ogłoszenie' },
        { action: 'dismiss', title: 'Odrzuć' }
      ]
    });
  }

  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push (from server, if you have one) ──────────────────
self.addEventListener('push', e => {
  let data = { title: '📱 Nowe ogłoszenie iPhone!', body: 'Sprawdź nowe ogłoszenie w Twojej okolicy.' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon.svg',
      badge: './icon.svg',
      vibrate: [150, 80, 150, 80, 300],
      data: { url: data.url || './' },
      actions: [
        { action: 'open', title: '📱 Otwórz ogłoszenie' },
        { action: 'dismiss', title: 'Odrzuć' }
      ]
    })
  );
});

// ── Notification click ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const targetUrl = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window if possible
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ── Periodic Background Sync ──────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-olx-periodic') {
    e.waitUntil(wakeUpApp());
  }
});

// ── Background Sync (one-shot) ────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'check-olx') {
    e.waitUntil(wakeUpApp());
  }
});

async function wakeUpApp() {
  // Tell all open clients to run a check
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (allClients.length > 0) {
    allClients.forEach(c => c.postMessage({ type: 'SW_CHECK_OLX' }));
    return;
  }
  // No window open — do a silent check using stored config from IDB
  // (optional server-side push would go here)
}
