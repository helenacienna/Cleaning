'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const POLL_MS = 20_000;
const STAFF_VISIBLE_PATH_PREFIXES = ['/cleaner', '/scan', '/reports/daily'];

function shouldPollHere() {
  if (typeof window === 'undefined') return false;
  return STAFF_VISIBLE_PATH_PREFIXES.some((prefix) => window.location.pathname === prefix || window.location.pathname.startsWith(`${prefix}/`));
}

export default function StaffMessageNotifier() {
  const [threads, setThreads] = useState([]);
  const [dismissedKey, setDismissedKey] = useState('');

  useEffect(() => {
    if (!shouldPollHere()) return undefined;
    let stopped = false;
    let timer = null;

    async function poll() {
      if (stopped || document.visibilityState !== 'visible') return;
      const response = await fetch('/api/inbox/threads?audience=staff&limit=10', { cache: 'no-store' }).catch(() => null);
      const payload = response ? await response.json().catch(() => null) : null;
      if (!stopped && response?.ok && Array.isArray(payload?.threads)) {
        setThreads(payload.threads);
      }
    }

    void poll();
    timer = window.setInterval(() => { void poll(); }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll();
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

  const unreadThreads = useMemo(() => threads.filter((thread) => Number(thread.unreadCount) > 0), [threads]);
  const unreadCount = unreadThreads.reduce((sum, thread) => sum + Number(thread.unreadCount || 0), 0);
  const latest = unreadThreads[0];
  const noticeKey = latest ? `${latest.id}:${unreadCount}:${latest.lastMessageAt}` : '';

  if (!latest || !unreadCount || dismissedKey === noticeKey) return null;

  return (
    <aside className="staff-message-notifier" role="status" aria-live="polite">
      <div>
        <span className="badge">New message</span>
        <strong>{latest.title}</strong>
        <div className="muted">{unreadCount} unread · {latest.lastMessagePreview}</div>
      </div>
      <div className="staff-message-notifier-actions">
        <Link className="button primary slim" href={`/cleaner/messages?thread=${latest.id}`}>Open</Link>
        <button className="button secondary slim" type="button" onClick={() => setDismissedKey(noticeKey)}>Later</button>
      </div>
    </aside>
  );
}
