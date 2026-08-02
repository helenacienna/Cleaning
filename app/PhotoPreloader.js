'use client';

import { useEffect } from 'react';

const DEFAULT_LIMIT = 36;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_DELAY_MS = 1200;

function uniqueUrls(urls = []) {
  const seen = new Set();
  return urls
    .map((url) => String(url || '').trim())
    .filter((url) => url && !url.startsWith('data:'))
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function shouldSkipPreload() {
  if (typeof navigator === 'undefined') return true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean(connection?.saveData);
}

export default function PhotoPreloader({ urls = [], limit = DEFAULT_LIMIT, concurrency = DEFAULT_CONCURRENCY, delayMs = DEFAULT_DELAY_MS }) {
  useEffect(() => {
    const photoUrls = uniqueUrls(urls).slice(0, Math.max(0, limit));
    if (!photoUrls.length || shouldSkipPreload()) return undefined;

    let cancelled = false;
    let active = 0;
    let cursor = 0;
    let timer = null;
    let idleHandle = null;

    function preloadNext() {
      if (cancelled) return;
      while (active < concurrency && cursor < photoUrls.length) {
        const url = photoUrls[cursor];
        cursor += 1;
        active += 1;
        fetch(url, { method: 'GET', cache: 'force-cache', priority: 'low' })
          .catch(() => null)
          .finally(() => {
            active -= 1;
            if (!cancelled && cursor < photoUrls.length) {
              preloadNext();
            }
          });
      }
    }

    function startPreload() {
      if (cancelled || !navigator.onLine) return;
      if ('requestIdleCallback' in window) {
        idleHandle = window.requestIdleCallback(preloadNext, { timeout: 2500 });
        return;
      }
      preloadNext();
    }

    timer = window.setTimeout(startPreload, delayMs);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (idleHandle && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [urls, limit, concurrency, delayMs]);

  return null;
}
