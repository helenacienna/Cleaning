'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegistration() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    function updateOnlineState() {
      setIsOffline(!navigator.onLine);
    }

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
          console.warn('Cienna Cleaning offline support could not be enabled', error);
        });
      }, { once: true });
    }

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="offline-status-banner" role="status">
      Offline mode — opened pages may keep working, but saves and photo uploads need connection.
    </div>
  );
}
