const globalForNotifications = globalThis;

function makeKey(scope, identifier) {
  return `${scope}:${identifier}`;
}

function getStore() {
  if (!globalForNotifications.__ciennaNotifications) {
    globalForNotifications.__ciennaNotifications = new Map();
  }
  return globalForNotifications.__ciennaNotifications;
}

export function recordNotification(scope, identifier, payload) {
  const store = getStore();
  const key = makeKey(scope, identifier);
  if (store.has(key)) {
    return false;
  }
  store.set(key, {
    id: key,
    scope,
    identifier,
    ...payload,
    createdAt: new Date().toISOString(),
  });
  return true;
}

export function listNotifications(limit = 20) {
  return Array.from(getStore().values()).slice(-limit).reverse();
}

export function clearNotifications() {
  getStore().clear();
}
