const SW_VERSION = "bn-sw-v1.0.0";
const STATIC_CACHE = `bn-static-${SW_VERSION}`;
const RUNTIME_CACHE = `bn-runtime-${SW_VERSION}`;
const RESULT_SYNC_TAG = "bn-sync-results-v1";
const DB_NAME = "bn-pwa-db";
const DB_VERSION = 1;
const RESULT_QUEUE_STORE = "result_submission_queue";

const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/maskable-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => Promise.resolve()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("bn-static-") || key.startsWith("bn-runtime-"))
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
      broadcastToClients({ type: "SW_ACTIVATED", version: SW_VERSION }),
    ]),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "GET_SW_VERSION") {
    if (event.source && "postMessage" in event.source) {
      event.source.postMessage({ type: "SW_VERSION", version: SW_VERSION });
    }
    return;
  }

  if (data.type === "SHOW_NOTIFICATION") {
    const title = data.title || "Battle Nest";
    const options = {
      body: data.body || "",
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: data.tag || "battle-nest-general",
      renotify: false,
      data: data.data || {},
    };
    event.waitUntil(self.registration.showNotification(title, options));
    return;
  }

  if (data.type === "QUEUE_RESULT_SUBMISSION" && data.payload) {
    event.waitUntil(
      addQueuedResultSubmission(data.payload).then(() => {
        if (self.registration.sync) {
          return self.registration.sync.register(RESULT_SYNC_TAG).catch(() => Promise.resolve());
        }
        return flushQueuedResultSubmissions();
      }),
    );
    return;
  }

  if (data.type === "SYNC_RESULTS_NOW") {
    event.waitUntil(flushQueuedResultSubmissions());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === RESULT_SYNC_TAG) {
    event.waitUntil(flushQueuedResultSubmissions());
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Battle Nest",
      body: event.data ? event.data.text() : "You have a new update.",
    };
  }

  const title = payload.title || "Battle Nest";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.png",
    badge: payload.badge || "/favicon.png",
    tag: payload.tag || "battle-nest-push",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const found = clients.find((client) => client.url.includes(self.location.origin));
      if (found && "focus" in found) {
        found.postMessage({ type: "OPEN_URL", url: targetUrl });
        return found.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/leaderboard")) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const shell = await caches.match("/");
          if (shell) return shell;
          return caches.match("/offline.html");
        }),
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("Network unavailable");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }
  return networkPromise || fetch(request);
}

function openResultQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RESULT_QUEUE_STORE)) {
        const store = db.createObjectStore(RESULT_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function addQueuedResultSubmission(payload) {
  const db = await openResultQueueDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(RESULT_QUEUE_STORE, "readwrite");
    tx.objectStore(RESULT_QUEUE_STORE).add(payload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to queue result submission"));
  });
  db.close();
}

async function getAllQueuedResultSubmissions() {
  const db = await openResultQueueDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(RESULT_QUEUE_STORE, "readonly");
    const req = tx.objectStore(RESULT_QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error("Failed to load queued submissions"));
  });
  db.close();
  return items;
}

async function deleteQueuedResultSubmission(id) {
  const db = await openResultQueueDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(RESULT_QUEUE_STORE, "readwrite");
    tx.objectStore(RESULT_QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to delete queued submission"));
  });
  db.close();
}

async function flushQueuedResultSubmissions() {
  const queued = await getAllQueuedResultSubmissions();
  if (!queued.length) return;

  for (const item of queued) {
    try {
      const response = await fetch(item.url, {
        method: item.method || "POST",
        headers: item.headers || {},
        body: JSON.stringify(item.body || {}),
        credentials: "include",
      });

      if (response.ok) {
        await deleteQueuedResultSubmission(item.id);
        await broadcastToClients({
          type: "RESULT_SYNC_SUCCESS",
          tournamentId: item.tournamentId || null,
        });
        continue;
      }

      if (response.status >= 400 && response.status < 500) {
        await deleteQueuedResultSubmission(item.id);
        await broadcastToClients({
          type: "RESULT_SYNC_ERROR",
          tournamentId: item.tournamentId || null,
          message: `Dropped queued result (${response.status})`,
        });
      }
    } catch {
      return;
    }
  }
}

async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => client.postMessage(message));
}
