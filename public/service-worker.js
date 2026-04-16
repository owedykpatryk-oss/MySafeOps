// MySafeOps Service Worker — Offline Mode
// Place this file at: /public/service-worker.js
// Version — bump to force cache refresh
const SW_VERSION = "mysafeops-v1.2.0";
const CACHE_NAME = `mysafeops-cache-${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";

// Vite build: hashed assets live under /assets/; precache only shell + manifest + icons
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/vite.svg",
];

// ─── Install: pre-cache shell assets ─────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // cache what we can, ignore failures for assets not yet built
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: delete old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k.startsWith("mysafeops-cache-") && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: cache-first for assets, network-first for API/data ───────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // Navigation requests — network first, fallback to cached index, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match("/index.html")
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Static assets (Vite /assets/, legacy /static/, fonts, images) — cache first
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/static/") ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot|png|jpg|svg|ico|webmanifest)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Weather API — network first with cache fallback
  if (url.hostname.includes("open-meteo.com") || url.hostname.includes("api.qrserver.com")) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ─── Background sync — queue actions taken offline ───────────────────────────
const SYNC_QUEUE_KEY = "mysafeops_sync_queue";

self.addEventListener("sync", (event) => {
  if (event.tag === "mysafeops-sync") {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  // Notify all clients that sync is starting
  const clients = await self.clients.matchAll();
  clients.forEach(client =>
    client.postMessage({ type: "SYNC_START" })
  );

  // In a real backend implementation, you would:
  // 1. Read the sync queue from IndexedDB
  // 2. POST each queued action to your API
  // 3. Clear processed items from the queue
  // For localStorage-only apps, just notify clients to merge any pending state

  clients.forEach(client =>
    client.postMessage({ type: "SYNC_COMPLETE" })
  );
}

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: "MySafeOps", body: event.data.text() }; }

  const options = {
    body: data.body || "",
    icon: data.icon || "/vite.svg",
    badge: data.badge || "/vite.svg",
    tag: data.tag || "mysafeops-notification",
    data: data.url ? { url: data.url } : {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "MySafeOps", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || "/app?view=dashboard";
  const targetUrl = new URL(raw, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const appClient = clients.find((c) => {
        try {
          const u = new URL(c.url);
          return u.origin === self.location.origin && u.pathname.startsWith("/app");
        } catch {
          return false;
        }
      });
      if (appClient && "focus" in appClient) {
        return appClient.focus().then(() => {
          appClient.postMessage({ type: "NAVIGATE", url: targetUrl });
        });
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Message handler — communicate with app ───────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "GET_VERSION") {
    event.source.postMessage({ type: "SW_VERSION", version: SW_VERSION });
  }
});
