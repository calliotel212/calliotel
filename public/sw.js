// Calliotel Service Worker — push notifications only.
// NEVER intercept fetches: wrapping all GETs broke webpack chunk loading
// and stuck the site on "Loading latest version...".
var CACHE_NAME = 'calliotel-sw-v6-20260813-push';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Push notifications — wakes the app even when it's closed
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  var title = data.title || 'Calliotel';
  var body = data.body || 'You have a new notification';
  var icon = data.icon || '/logo192.png';
  var badge = data.badge || '/logo192.png';
  var tag = data.tag || 'calliotel-notification';
  var nested = data.data || {};
  var url = nested.url || data.url || '/sms';
  var vibrate = data.vibrate || [200, 100, 200];

  // Tell open tabs to play in-app sound / refresh inbox
  event.waitUntil(
    Promise.all([
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
        list.forEach(function(c) {
          try {
            c.postMessage({
              type: 'CALLIOTEL_PUSH',
              title: title,
              body: body,
              url: url,
              data: nested,
            });
          } catch (e) {}
        });
      }),
      self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: badge,
        tag: tag,
        vibrate: vibrate,
        requireInteraction: !!data.requireInteraction,
        data: { url: url },
        actions: data.actions || [],
        silent: false,
      }),
    ])
  );
});

self.addEventListener('message', function(event) {
  // Heartbeat from KeepAlive — no-op, just keeps SW warm
  try {
    if (event.data && event.data.type === 'KEEPALIVE') return;
  } catch (e) {}
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/sms';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

























