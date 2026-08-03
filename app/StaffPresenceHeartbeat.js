'use client';

import { useEffect } from 'react';

const HEARTBEAT_MS = 30_000;

function getDeviceId() {
  try {
    const key = 'cienna-cleaning-device-id';
    let deviceId = window.localStorage.getItem(key);
    if (!deviceId) {
      deviceId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.localStorage.setItem(key, deviceId);
    }
    return deviceId;
  } catch {
    return 'browser';
  }
}

export default function StaffPresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;
    let timer = null;

    async function sendPresence() {
      if (stopped || document.visibilityState !== 'visible') return;
      await fetch('/api/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId(), page: window.location.pathname }),
      }).catch(() => null);
    }

    function schedule() {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => { void sendPresence(); }, HEARTBEAT_MS);
    }

    void sendPresence();
    schedule();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void sendPresence();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);

    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, []);

  return null;
}
