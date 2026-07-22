// MK AI OS PWA Service Worker
const CACHE_NAME = "mk-ai-os-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Offline first fallback)
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and avoid chrome-extension or third party api schemes
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        // Cache newly fetched assets dynamically
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback or offline page
        return caches.match("/");
      });
    })
  );
});

// Push Notification Event Listener
self.addEventListener("push", (event) => {
  let data = { title: "MK AI OS Notification", body: "New automated executive dispatch received." };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "MK AI OS Notification", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "https://cdn-icons-png.flaticon.com/512/8649/8649607.png",
    badge: "https://cdn-icons-png.flaticon.com/512/8649/8649607.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: "explore", title: "Open AI OS Dashboard" },
      { action: "close", title: "Dismiss" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action !== "close") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === "/" && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow("/");
        }
      })
    );
  }
});
