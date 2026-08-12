// MySafeOps Service Worker — Offline Mode
// Place this file at: /public/service-worker.js
// Version — bump to force cache refresh
const SW_VERSION = "mysafeops-v1.3.7";
const CACHE_NAME = `mysafeops-cache-${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";

function isCacheableResponse(res) {
  return res && res.ok && res.status >= 200 && res.status < 300;
}

/** Never resolve fetch handlers with Response.error() — Chromium logs a FetchEvent network error. */
function offlineFallbackResponse(status = 503) {
  return new Response("Offline", {
    status,
    statusText: "Offline",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Clone synchronously — Response bodies can only be read once. */
function scheduleCachePut(request, response) {
  if (!isCacheableResponse(response)) return;
  let copy;
  try {
    copy = response.clone();
  } catch {
    return;
  }
  void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
}

async function fetchWithOptionalRetry(request) {
  try {
    return await fetch(request);
  } catch {
    try {
      return await fetch(request, { cache: "no-store" });
    } catch {
      return null;
    }
  }
}

function shouldBypassSw(url) {
  const p = url.pathname;
  return (
    p.startsWith("/api/") ||
    p.includes("feedback") ||
    p.includes("hot-update") ||
    p.includes("__vite")
  );
}

// Vite build: hashed assets live under /assets/; precache only shell + manifest + icons
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/vite.svg",
  "/branding/fess-group-logo.png",
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

  // Cross-origin requests — do not intercept (CSP + API calls should bypass the SW)
  if (url.origin !== self.location.origin) {
    return;
  }

  if (shouldBypassSw(url)) {
    return;
  }

  // Navigation requests — network first, fallback to cached index, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          scheduleCachePut(request, res);
          return res;
        })
        .catch(() =>
          caches.match("/index.html")
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((fallback) => fallback || offlineFallbackResponse())
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
      caches.match(request).then(async (cached) => {
        if (cached) return cached;
        const res = await fetchWithOptionalRetry(request);
        if (res) {
          scheduleCachePut(request, res);
          return res;
        }
        return offlineFallbackResponse();
      })
    );
    return;
  }

  // Default (same-origin): network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        scheduleCachePut(request, res);
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || offlineFallbackResponse();
      })
  );
});

// ─── Push notifications ───────────────────────────────────────────────────────
// Offline write sync is owned by the D1 outbox (useD1OrgArraySync), not this SW.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: "MySafeOps", body: event.data.text() }; }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/badge-72.png",
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
