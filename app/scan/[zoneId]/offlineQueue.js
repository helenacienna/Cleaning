'use client';

const DB_NAME = 'cienna-cleaning-offline-v1';
const DB_VERSION = 1;
const STORE_NAME = 'pendingActions';
const QUEUE_EVENT = 'cienna-cleaning-offline-queue-change';

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function createActionId(prefix = 'action') {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function openQueueDb() {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('Offline storage unavailable'));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('taskInstanceId', 'taskInstanceId');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open offline queue'));
  });
}

async function withStore(mode, callback) {
  const db = await openQueueDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let callbackResult;

    transaction.oncomplete = () => {
      db.close();
      resolve(callbackResult);
    };
    transaction.onerror = () => {
      const error = transaction.error || new Error('Offline queue transaction failed');
      db.close();
      reject(error);
    };
    transaction.onabort = () => {
      const error = transaction.error || new Error('Offline queue transaction aborted');
      db.close();
      reject(error);
    };

    callbackResult = callback(store);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline queue request failed'));
  });
}

export function emitQueueChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
  }
}

export function onQueueChange(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(QUEUE_EVENT, callback);
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);

  return () => {
    window.removeEventListener(QUEUE_EVENT, callback);
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export async function addOfflineAction(action) {
  const now = new Date().toISOString();
  const record = {
    ...action,
    id: action.id || createActionId(action.type || 'action'),
    taskInstanceId: action.taskInstanceId || action.payload?.taskInstanceId,
    createdAt: action.createdAt || now,
    updatedAt: now,
    attempts: action.attempts || 0,
    lastError: action.lastError || null,
  };

  await withStore('readwrite', (store) => {
    store.put(record);
  });
  emitQueueChange();
  return record;
}

export async function updateOfflineAction(id, updates) {
  await withStore('readwrite', (store) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) return;
      store.put({
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    };
  });
  emitQueueChange();
}

export async function removeOfflineAction(id) {
  await withStore('readwrite', (store) => {
    store.delete(id);
  });
  emitQueueChange();
}

export async function listOfflineActions() {
  if (!canUseIndexedDb()) {
    return [];
  }

  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = Array.isArray(request.result) ? request.result : [];
      records.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      resolve(records);
    };
    request.onerror = () => reject(request.error || new Error('Unable to list offline queue'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    transaction.onabort = () => db.close();
  });
}

async function sendAction(action) {
  if (action.type === 'photo') {
    const formData = new FormData();
    formData.append('taskInstanceId', action.taskInstanceId);
    formData.append('photoType', action.photoType || 'completion');
    formData.append('file', action.file, action.fileName || 'cleaning-photo.jpg');

    const response = await fetch('/api/task-photos', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Photo sync failed');
    }

    return response.json();
  }

  const body = action.type === 'skip'
    ? {
        action: 'skip',
        taskInstanceId: action.taskInstanceId,
        skipReason: action.skipReason,
      }
    : {
        taskInstanceId: action.taskInstanceId,
        grade: action.grade,
        note: action.note || '',
      };

  const response = await fetch('/api/cleaner-tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || 'Task sync failed');
  }

  return response.json();
}

let syncInProgress = false;

export async function syncOfflineActions({ onProgress } = {}) {
  if (syncInProgress || typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, failed: 0, remaining: await listOfflineActions().then((items) => items.length).catch(() => 0) };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;

  try {
    const actions = await listOfflineActions();

    for (const action of actions) {
      try {
        await updateOfflineAction(action.id, {
          attempts: Number(action.attempts || 0) + 1,
          lastError: null,
        });
        await sendAction(action);
        await removeOfflineAction(action.id);
        synced += 1;
        onProgress?.({ action, status: 'synced', synced, failed });
      } catch (error) {
        failed += 1;
        await updateOfflineAction(action.id, {
          lastError: error?.message || 'Sync failed',
        });
        onProgress?.({ action, status: 'failed', error, synced, failed });
        break;
      }
    }

    const remaining = await listOfflineActions().then((items) => items.length).catch(() => 0);
    return { synced, failed, remaining };
  } finally {
    syncInProgress = false;
    emitQueueChange();
  }
}

export async function getOfflineQueueSummary() {
  const actions = await listOfflineActions();
  return {
    count: actions.length,
    actions,
    lastError: actions.find((action) => action.lastError)?.lastError || null,
  };
}
