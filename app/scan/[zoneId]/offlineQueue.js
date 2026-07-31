const DB_NAME = 'cienna-cleaning-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingRequests';
const QUEUE_CHANGE_EVENT = 'cienna-offline-queue-change';

let dbPromise = null;
let flushPromise = null;

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function createId(prefix = 'queue') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emitQueueChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGE_EVENT));
  }
}

function openDb() {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open offline queue'));
  });

  return dbPromise;
}

async function withStore(mode, callback) {
  const db = await openDb();
  if (!db) {
    throw new Error('Offline queue is not available on this device');
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let callbackResult;

    transaction.oncomplete = () => resolve(callbackResult);
    transaction.onerror = () => reject(transaction.error || new Error('Offline queue transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Offline queue transaction aborted'));

    callbackResult = callback(store);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline queue request failed'));
  });
}

export function subscribeOfflineQueue(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener(QUEUE_CHANGE_EVENT, listener);
  return () => window.removeEventListener(QUEUE_CHANGE_EVENT, listener);
}

export async function getPendingOfflineCount() {
  if (!canUseIndexedDb()) {
    return 0;
  }

  const db = await openDb();
  if (!db) return 0;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => reject(request.error || new Error('Unable to count offline queue'));
  });
}

export async function listPendingOfflineRequests() {
  if (!canUseIndexedDb()) {
    return [];
  }

  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
    request.onerror = () => reject(request.error || new Error('Unable to read offline queue'));
  });
}

export async function enqueueJsonRequest({ url, method = 'POST', body, label = 'Checklist save' }) {
  const entry = {
    id: createId('json'),
    type: 'json',
    url,
    method,
    headers: { 'Content-Type': 'application/json' },
    body,
    label,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await withStore('readwrite', (store) => store.put(entry));
  emitQueueChange();
  return entry;
}

export async function enqueuePhotoUpload({ taskInstanceId, photoType = 'completion', file, label = 'Photo upload' }) {
  if (!file) {
    throw new Error('Missing photo file');
  }

  const entry = {
    id: createId('photo'),
    type: 'photo',
    url: '/api/task-photos',
    method: 'POST',
    label,
    createdAt: new Date().toISOString(),
    attempts: 0,
    photo: {
      taskInstanceId,
      photoType,
      file,
      name: file.name || `offline-photo-${Date.now()}.jpg`,
      mimeType: file.type || 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
      size: file.size || 0,
    },
  };

  await withStore('readwrite', (store) => store.put(entry));
  emitQueueChange();
  return entry;
}

async function deleteEntry(id) {
  await withStore('readwrite', (store) => store.delete(id));
  emitQueueChange();
}

async function updateEntry(entry) {
  await withStore('readwrite', (store) => store.put(entry));
  emitQueueChange();
}

async function sendEntry(entry) {
  if (entry.type === 'json') {
    return fetch(entry.url, {
      method: entry.method || 'POST',
      headers: entry.headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry.body || {}),
    });
  }

  if (entry.type === 'photo') {
    const formData = new FormData();
    formData.append('taskInstanceId', entry.photo.taskInstanceId);
    formData.append('photoType', entry.photo.photoType || 'completion');
    formData.append('file', entry.photo.file, entry.photo.name || 'offline-photo.jpg');
    return fetch(entry.url || '/api/task-photos', {
      method: entry.method || 'POST',
      body: formData,
    });
  }

  throw new Error(`Unknown offline queue entry type: ${entry.type}`);
}

export async function flushOfflineQueue() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, offline: true, synced: 0, remaining: await getPendingOfflineCount() };
  }

  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
    let synced = 0;
    const entries = await listPendingOfflineRequests();

    for (const entry of entries) {
      try {
        const response = await sendEntry(entry);
        if (!response.ok) {
          entry.attempts = (entry.attempts || 0) + 1;
          entry.lastError = `HTTP ${response.status}`;
          entry.lastAttemptAt = new Date().toISOString();
          await updateEntry(entry);
          if (response.status >= 400 && response.status < 500) {
            break;
          }
          break;
        }
        await deleteEntry(entry.id);
        synced += 1;
      } catch (error) {
        entry.attempts = (entry.attempts || 0) + 1;
        entry.lastError = error?.message || 'Sync failed';
        entry.lastAttemptAt = new Date().toISOString();
        await updateEntry(entry);
        break;
      }
    }

    return { ok: true, synced, remaining: await getPendingOfflineCount() };
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

export function createOfflinePhotoPreview(file, photoType = 'completion') {
  const photoUrl = typeof URL !== 'undefined' ? URL.createObjectURL(file) : '';
  return {
    id: createId('offline-photo'),
    photoType,
    photoUrl,
    offline: true,
  };
}
