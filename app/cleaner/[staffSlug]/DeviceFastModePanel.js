'use client';

import { useEffect, useMemo, useState } from 'react';

const FAST_MODE_CACHE = 'cienna-cleaning-device-fast-mode-v1';
const CORE_URLS = [
  '/',
  '/cleaner',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/sw.js',
];

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone);
}

function formatStorageSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function collectSameOriginAssetUrls() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return [];
  }

  const urls = new Set();
  const selectors = [
    'script[src]',
    'link[rel="stylesheet"][href]',
    'link[rel="preload"][href]',
    'link[rel="modulepreload"][href]',
    'img[src]',
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      const rawUrl = element.getAttribute('src') || element.getAttribute('href');
      if (!rawUrl) return;
      try {
        const url = new URL(rawUrl, window.location.origin);
        if (url.origin === window.location.origin) {
          urls.add(`${url.pathname}${url.search}`);
        }
      } catch {
        // Ignore malformed asset URLs.
      }
    });
  });

  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    performance.getEntriesByType('resource').forEach((entry) => {
      try {
        const url = new URL(entry.name);
        if (url.origin === window.location.origin && !url.pathname.startsWith('/api/')) {
          urls.add(`${url.pathname}${url.search}`);
        }
      } catch {
        // Ignore non-URL performance entries.
      }
    });
  }

  return [...urls];
}

export default function DeviceFastModePanel({ staffName = 'this staff member', staffHref = '' }) {
  const [canPrepare, setCanPrepare] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [lastPrepared, setLastPrepared] = useState('');
  const [storageLabel, setStorageLabel] = useState('');

  const installHint = useMemo(() => (
    isStandalone
      ? 'Installed on this device.'
      : 'For best speed, staff should also use Add to Home Screen.'
  ), [isStandalone]);

  useEffect(() => {
    setCanPrepare(typeof window !== 'undefined' && 'caches' in window && 'serviceWorker' in navigator);
    setIsStandalone(isStandaloneDisplay());
    try {
      const saved = window.localStorage.getItem('cienna-cleaning-fast-mode-prepared-at') || '';
      setLastPrepared(saved);
    } catch {
      setLastPrepared('');
    }

    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((estimate) => {
        const used = formatStorageSize(estimate.usage || 0);
        if (used) setStorageLabel(`${used} saved on this device`);
      }).catch(() => {});
    }
  }, []);

  async function prepareDevice() {
    if (!canPrepare || status === 'preparing') return;

    setStatus('preparing');
    setMessage('Preparing this device… keep this page open for a moment.');

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await registration.update().catch(() => {});

      const currentPath = `${window.location.pathname}${window.location.search}`;
      const staffPath = staffHref || currentPath;
      const urls = [...new Set([
        ...CORE_URLS,
        staffPath,
        currentPath,
        ...collectSameOriginAssetUrls(),
      ])].filter(Boolean);

      const cache = await caches.open(FAST_MODE_CACHE);
      const results = await Promise.allSettled(urls.map(async (url) => {
        const request = new Request(url, { cache: 'reload', credentials: 'same-origin' });
        const response = await fetch(request);
        if (!response.ok) {
          throw new Error(`${url} returned ${response.status}`);
        }
        await cache.put(url, response);
        return url;
      }));

      const savedCount = results.filter((result) => result.status === 'fulfilled').length;
      const preparedAt = new Intl.DateTimeFormat('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
        timeZone: 'Australia/Brisbane',
      }).format(new Date());

      window.localStorage.setItem('cienna-cleaning-fast-mode-prepared-at', preparedAt);
      setLastPrepared(preparedAt);
      setStatus('ready');
      setMessage(`Fast mode ready for ${staffName}. Saved ${savedCount} app files/pages on this device.`);

      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate().catch(() => null);
        const used = formatStorageSize(estimate?.usage || 0);
        if (used) setStorageLabel(`${used} saved on this device`);
      }
    } catch (error) {
      setStatus('error');
      setMessage(error?.message || 'Could not prepare this device. Check internet, then try again.');
    }
  }

  return (
    <section className={`card device-fast-mode-card device-fast-mode-${status}`}>
      <div className="panel-title device-fast-mode-title">
        <div>
          <span className="badge tone-green">Fast mode</span>
          <h3>Prepare this device</h3>
          <p className="muted">Downloads the app shell and this staff list so repeat opens feel faster and poor-signal areas behave better.</p>
        </div>
        <button className="button primary" type="button" onClick={prepareDevice} disabled={!canPrepare || status === 'preparing'}>
          {status === 'preparing' ? 'Preparing…' : 'Prepare device'}
        </button>
      </div>
      <div className="device-fast-mode-status">
        <span>{canPrepare ? installHint : 'This browser does not support device caching.'}</span>
        {lastPrepared ? <span>Last prepared: {lastPrepared}</span> : null}
        {storageLabel ? <span>{storageLabel}</span> : null}
      </div>
      {message ? <p className={`device-fast-mode-message ${status === 'error' ? 'tone-red' : 'tone-green'}`}>{message}</p> : null}
      {!isStandalone ? <p className="muted device-fast-mode-help">iPhone: Share button → Add to Home Screen. Android: browser menu → Add to Home screen / Install app.</p> : null}
    </section>
  );
}
