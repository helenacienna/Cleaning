'use client';

import { useEffect, useState } from 'react';

const SERVICE_WORKER_UPDATE_CHECK_MS = 15 * 60 * 1000;

export default function ServiceWorkerRegistration() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    function updateOnlineState() {
      setIsOffline(!navigator.onLine);
    }

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('online', updateOnlineState);
        window.removeEventListener('offline', updateOnlineState);
      };
    }

    let updateInterval = null;
    let refreshedForControllerChange = false;

    function refreshForActivatedUpdate() {
      if (refreshedForControllerChange || !navigator.onLine) return;
      refreshedForControllerChange = true;
      window.location.reload();
    }

    function watchRegistration(registration) {
      if (!registration) return;

      function checkForUpdate() {
        if (!navigator.onLine) return;
        registration.update().catch((error) => {
          console.warn('Cienna Cleaning update check failed', error);
        });
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      checkForUpdate();
      updateInterval = window.setInterval(checkForUpdate, SERVICE_WORKER_UPDATE_CHECK_MS);
      window.addEventListener('focus', checkForUpdate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        }
      });
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(watchRegistration)
        .catch((error) => {
          console.warn('Cienna Cleaning offline support could not be enabled', error);
        });
    }, { once: true });

    navigator.serviceWorker.addEventListener('controllerchange', refreshForActivatedUpdate);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
      navigator.serviceWorker.removeEventListener('controllerchange', refreshForActivatedUpdate);
      if (updateInterval) {
        window.clearInterval(updateInterval);
      }
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="offline-status-banner" role="status">
      Offline mode — opened checklists can keep working. Saves/photos will sync when this device is back online.
    </div>
  );
}
