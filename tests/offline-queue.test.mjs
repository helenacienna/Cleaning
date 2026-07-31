import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

class FakeIdbRequest {
  constructor(executor) {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
    setTimeout(() => {
      try {
        this.result = executor();
        this.onsuccess?.({ target: this });
      } catch (error) {
        this.error = error;
        this.onerror?.({ target: this });
      }
    }, 0);
  }
}

class FakeObjectStore {
  constructor(data) {
    this.data = data;
  }

  createIndex() {}

  put(value) {
    return new FakeIdbRequest(() => {
      this.data.set(value.id, value);
      return value.id;
    });
  }

  delete(id) {
    return new FakeIdbRequest(() => {
      this.data.delete(id);
      return undefined;
    });
  }

  count() {
    return new FakeIdbRequest(() => this.data.size);
  }

  getAll() {
    return new FakeIdbRequest(() => Array.from(this.data.values()));
  }
}

class FakeTransaction {
  constructor(data) {
    this.data = data;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    setTimeout(() => this.oncomplete?.(), 5);
  }

  objectStore() {
    return new FakeObjectStore(this.data);
  }
}

class FakeDatabase {
  constructor(data) {
    this.data = data;
    this.objectStoreNames = {
      contains: () => true,
    };
  }

  createObjectStore() {
    return new FakeObjectStore(this.data);
  }

  transaction(_name, _mode) {
    return new FakeTransaction(this.data);
  }
}

function installBrowserHarness({ online = true } = {}) {
  const data = new Map();
  const listeners = new Map();
  const fakeDb = new FakeDatabase(data);

  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  globalThis.window = {
    indexedDB: {
      open() {
        const request = {
          result: fakeDb,
          error: null,
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        };
        setTimeout(() => {
          request.onupgradeneeded?.({ target: request });
          request.onsuccess?.({ target: request });
        }, 0);
        return request;
      },
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: online },
  });

  return { data, listeners };
}

async function importFreshOfflineQueue() {
  const url = pathToFileURL(new URL('../app/scan/[zoneId]/offlineQueue.js', import.meta.url).pathname).href;
  return import(`${url}?test=${Date.now()}-${Math.random()}`);
}

test('offline queue stores and flushes JSON checklist saves in order', async () => {
  installBrowserHarness({ online: true });
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const queue = await importFreshOfflineQueue();
  await queue.enqueueJsonRequest({ url: '/api/cleaner-tasks', body: { taskInstanceId: 'task-1', grade: 4 }, label: 'Grade save' });
  await queue.enqueueJsonRequest({ url: '/api/cleaner-tasks', body: { taskInstanceId: 'task-2', grade: 5 }, label: 'Grade save' });

  assert.equal(await queue.getPendingOfflineCount(), 2);

  const result = await queue.flushOfflineQueue();
  assert.deepEqual(result, { ok: true, synced: 2, remaining: 0, conflict: false });
  assert.equal(await queue.getPendingOfflineCount(), 0);
  assert.equal(sent.length, 2);
  assert.deepEqual(JSON.parse(sent[0].options.body), { taskInstanceId: 'task-1', grade: 4 });
  assert.deepEqual(JSON.parse(sent[1].options.body), { taskInstanceId: 'task-2', grade: 5 });
});

test('offline queue keeps pending entries when the device is offline', async () => {
  installBrowserHarness({ online: false });
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200 });
  };

  const queue = await importFreshOfflineQueue();
  await queue.enqueueJsonRequest({ url: '/api/cleaner-tasks', body: { taskInstanceId: 'task-1', grade: 3 } });

  const result = await queue.flushOfflineQueue();
  assert.equal(result.ok, false);
  assert.equal(result.offline, true);
  assert.equal(result.remaining, 1);
  assert.equal(fetchCalled, false);
  assert.equal(await queue.getPendingOfflineCount(), 1);
});

test('offline queue stores photo uploads as files and replays multipart form data', async () => {
  installBrowserHarness({ online: true });
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url, options });
    return new Response(JSON.stringify({ ok: true, photoId: 'photo-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const queue = await importFreshOfflineQueue();
  const file = new File(['image-bytes'], 'issue.jpg', { type: 'image/jpeg' });
  await queue.enqueuePhotoUpload({ taskInstanceId: 'task-1', photoType: 'exception', file, label: 'Before photo' });

  assert.equal(await queue.getPendingOfflineCount(), 1);

  const result = await queue.flushOfflineQueue();
  assert.equal(result.synced, 1);
  assert.equal(await queue.getPendingOfflineCount(), 0);
  assert.equal(sent[0].url, '/api/task-photos');
  assert.equal(sent[0].options.method, 'POST');
  assert.equal(sent[0].options.body.get('taskInstanceId'), 'task-1');
  assert.equal(sent[0].options.body.get('photoType'), 'exception');
  assert.equal(sent[0].options.body.get('file').name, 'issue.jpg');
});

test('offline queue marks HTTP 409 flushes as conflicts and keeps the entry pending', async () => {
  installBrowserHarness({ online: true });
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: 'Task changed on another device. Refresh this checklist before saving this item.',
    conflict: true,
    currentTaskUpdatedAt: '2026-07-31T00:00:00.000Z',
  }), { status: 409, headers: { 'Content-Type': 'application/json' } });

  const queue = await importFreshOfflineQueue();
  await queue.enqueueJsonRequest({
    url: '/api/cleaner-tasks',
    body: { taskInstanceId: 'task-1', grade: 4, expectedTaskUpdatedAt: '2026-07-30T00:00:00.000Z' },
  });

  const result = await queue.flushOfflineQueue();
  assert.equal(result.ok, true);
  assert.equal(result.synced, 0);
  assert.equal(result.remaining, 1);
  assert.equal(result.conflict, true);

  const [entry] = await queue.listPendingOfflineRequests();
  assert.equal(entry.conflict, true);
  assert.match(entry.lastError, /Task changed/);
});
