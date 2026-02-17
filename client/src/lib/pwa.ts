type ServiceWorkerMessage =
  | { type: "SW_VERSION"; version: string }
  | { type: "SW_ACTIVATED"; version: string }
  | { type: "RESULT_SYNC_SUCCESS"; tournamentId?: number | null }
  | { type: "RESULT_SYNC_ERROR"; tournamentId?: number | null; message?: string }
  | { type: "OPEN_URL"; url?: string }
  | Record<string, unknown>;

export const RESULTS_SYNC_TAG = "bn-sync-results-v1";
const DB_NAME = "bn-pwa-db";
const DB_VERSION = 1;
const RESULT_QUEUE_STORE = "result_submission_queue";
const NOTIFICATION_PROMPT_KEY = "bn_notification_prompted_v1";

type QueuedResultSubmission = {
  id?: number;
  tournamentId: number;
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: {
    results: Array<{
      userId: number;
      position: number;
      kills: number;
      prize: number;
    }>;
  };
  createdAt: number;
};

type SubmitResultsInput = {
  tournamentId: number;
  token: string | null;
  results: Array<{ userId: number; position: number; kills: number; prize: number }>;
};

type ServiceWorkerRegistrationOptions = {
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
  onControllerUpdated?: () => void;
  onMessage?: (message: ServiceWorkerMessage) => void;
};

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESULT_QUEUE_STORE)) {
        const store = db.createObjectStore(RESULT_QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open offline queue database"));
  });
}

function isLikelyNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return message.includes("failed to fetch") || message.includes("network") || message.includes("offline");
}

async function addQueuedResultSubmission(item: QueuedResultSubmission): Promise<number> {
  const db = await openQueueDb();
  const id = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(RESULT_QUEUE_STORE, "readwrite");
    const request = tx.objectStore(RESULT_QUEUE_STORE).add(item);
    request.onsuccess = () => resolve(Number(request.result));
    request.onerror = () => reject(request.error || new Error("Failed to add queued result"));
  });
  db.close();
  return id;
}

async function getQueuedResultSubmissions(): Promise<QueuedResultSubmission[]> {
  const db = await openQueueDb();
  const items = await new Promise<QueuedResultSubmission[]>((resolve, reject) => {
    const tx = db.transaction(RESULT_QUEUE_STORE, "readonly");
    const request = tx.objectStore(RESULT_QUEUE_STORE).getAll();
    request.onsuccess = () => resolve((request.result || []) as QueuedResultSubmission[]);
    request.onerror = () => reject(request.error || new Error("Failed to read queued results"));
  });
  db.close();
  return items.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

async function deleteQueuedResultSubmission(id: number): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RESULT_QUEUE_STORE, "readwrite");
    tx.objectStore(RESULT_QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to delete queued result"));
  });
  db.close();
}

async function notifyServiceWorker(message: Record<string, unknown>) {
  if (!("serviceWorker" in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage(message);
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
  registration?.active?.postMessage(message);
}

export async function registerResultsBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const syncManager = (registration as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (syncManager?.register) {
      await syncManager.register(RESULTS_SYNC_TAG);
      return;
    }
  } catch {
    // Fallback handled below.
  }

  await notifyServiceWorker({ type: "SYNC_RESULTS_NOW" });
}

export async function flushQueuedResultsFromClient() {
  const queued = await getQueuedResultSubmissions();
  if (!queued.length) return;

  for (const item of queued) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: JSON.stringify(item.body),
        credentials: "include",
      });

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        if (typeof item.id === "number") {
          await deleteQueuedResultSubmission(item.id);
        }
      }
    } catch {
      return;
    }
  }
}

export async function submitTournamentResultsWithOfflineSupport(input: SubmitResultsInput): Promise<{
  queued: boolean;
  data?: unknown;
}> {
  const endpoint = `/api/admin/tournaments/${input.tournamentId}/results`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.token) {
    headers.Authorization = `Bearer ${input.token}`;
  }

  const payload = { results: input.results };
  const queuePayload: QueuedResultSubmission = {
    tournamentId: input.tournamentId,
    url: endpoint,
    method: "POST",
    headers,
    body: payload,
    createdAt: Date.now(),
  };

  const queueAndSchedule = async () => {
    await addQueuedResultSubmission(queuePayload);
    await notifyServiceWorker({ type: "SYNC_RESULTS_NOW" });
    await registerResultsBackgroundSync();
    return { queued: true as const };
  };

  if (!navigator.onLine) {
    return queueAndSchedule();
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      credentials: "include",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || "Failed to declare results");
    }
    return { queued: false, data };
  } catch (error) {
    if (!isLikelyNetworkError(error)) {
      throw error;
    }
    return queueAndSchedule();
  }
}

export async function registerBattleNestServiceWorker(options: ServiceWorkerRegistrationOptions = {}) {
  if (!("serviceWorker" in navigator)) return;
  const shouldEnable = import.meta.env.PROD || import.meta.env.VITE_ENABLE_PWA_DEV === "true";
  if (!shouldEnable) return;

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

  if (registration.waiting) {
    options.onUpdateAvailable?.(registration);
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;
    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        options.onUpdateAvailable?.(registration);
      }
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    options.onControllerUpdated?.();
  });

  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<ServiceWorkerMessage>) => {
    options.onMessage?.(event.data);
  });

  await notifyServiceWorker({ type: "GET_SW_VERSION" });
}

export function activateWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}

export async function ensurePushPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  if (localStorage.getItem(NOTIFICATION_PROMPT_KEY) === "1") {
    return "default";
  }
  localStorage.setItem(NOTIFICATION_PROMPT_KEY, "1");
  return Notification.requestPermission();
}

export async function pushLocalNotification(
  title: string,
  options: {
    body: string;
    tag: string;
    data?: Record<string, unknown>;
  },
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (registration) {
      await registration.showNotification(title, {
        body: options.body,
        icon: "/favicon-192.png",
        badge: "/favicon-48x48.png",
        tag: options.tag,
        data: options.data || {},
      });
      return;
    }
  } catch {
    // Fall back to in-page notification below.
  }

  new Notification(title, {
    body: options.body,
    icon: "/favicon-192.png",
    tag: options.tag,
    data: options.data,
  });
}
