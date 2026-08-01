'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'cienna-cleaning-manager-setup-checklist-v1';

const SETUP_SECTIONS = [
  {
    id: 'site-foundation',
    title: '1. Site foundation',
    description: 'Confirm the customer/site basics before staff use the app.',
    items: [
      { id: 'facilities', label: 'Facilities/buildings are added and named clearly', href: '/admin/facilities' },
      { id: 'zones', label: 'Zones and task groups match the real cleaning areas', href: '/facility-board/cienna?view=tasks' },
      { id: 'time-zone', label: 'Operating timezone and current-day behaviour are correct', href: '/admin/settings' },
    ],
  },
  {
    id: 'staff-roster',
    title: '2. Staff and roster',
    description: 'Make sure each cleaner has the right shift and access path.',
    items: [
      { id: 'staff-list', label: 'Staff members, roles, and phone details are entered', href: '/admin/staff' },
      { id: 'weekly-roster', label: 'Weekly roster is checked for the launch week', href: '/admin/staff' },
      { id: 'staff-links', label: 'Each cleaner can open their own staff page', href: '/cleaner' },
    ],
  },
  {
    id: 'tasks-routes',
    title: '3. Tasks, routes, and requirements',
    description: 'Check the work list is complete and in a sensible field order.',
    items: [
      { id: 'task-cards', label: 'Task cards are named clearly and duplicates cleaned up', href: '/admin/task-cards' },
      { id: 'photo-comment-rules', label: 'Photo/comment requirements are set for critical tasks', href: '/admin/task-cards' },
      { id: 'routes', label: 'Route/order view matches how cleaners walk the site', href: '/facility-board/cienna?view=order' },
    ],
  },
  {
    id: 'devices-training',
    title: '4. Devices and training',
    description: 'Prepare phones before cleaners enter poor-signal areas.',
    items: [
      { id: 'home-screen', label: 'App added to Home Screen on staff devices', href: '/help' },
      { id: 'fast-mode', label: 'Fast mode / Prepare device has been run for each staff device', href: '/help' },
      { id: 'training-run', label: 'Cleaner has completed one supervised test checklist', href: '/cleaner' },
    ],
  },
  {
    id: 'reports-support',
    title: '5. Reports and support',
    description: 'Confirm managers can review outcomes and support issues.',
    items: [
      { id: 'daily-report', label: 'Daily report opens with grades, issues, and photos', href: '/reports/daily' },
      { id: 'sync-support', label: 'Manager knows how to read pending sync / stuck sync messages', href: '/help' },
      { id: 'go-live-backup', label: 'Go-live date, backup/export, and support contact process are agreed', href: '/admin/manager' },
    ],
  },
];

function loadState() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export default function SetupChecklistClient() {
  const [checked, setChecked] = useState({});

  useEffect(() => {
    setChecked(loadState());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // Best-effort only.
    }
  }, [checked]);

  const totals = useMemo(() => {
    const items = SETUP_SECTIONS.flatMap((section) => section.items);
    const done = items.filter((item) => checked[item.id]).length;
    return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
  }, [checked]);

  function toggleItem(itemId) {
    setChecked((current) => ({ ...current, [itemId]: !current[itemId] }));
  }

  function resetChecklist() {
    setChecked({});
  }

  return (
    <main className="page setup-page">
      <section className="card setup-hero">
        <div>
          <span className="badge tone-green">Manager setup</span>
          <h1>First-time setup checklist</h1>
          <p className="muted">Use this before launching the app at a new building/customer. Progress is saved on this device.</p>
        </div>
        <div className="setup-progress-card">
          <strong>{totals.percent}% ready</strong>
          <span>{totals.done}/{totals.total} setup checks complete</span>
          <div className="progress setup-progress-bar"><span style={{ width: `${totals.percent}%` }} /></div>
        </div>
      </section>

      <section className="setup-actions card">
        <Link className="button primary" href="/help">Open Help & setup</Link>
        <Link className="button secondary" href="/">Admin dashboard</Link>
        <Link className="button secondary" href="/cleaner">Staff landing</Link>
        <button className="button secondary" type="button" onClick={resetChecklist}>Reset checklist</button>
      </section>

      <section className="setup-section-list">
        {SETUP_SECTIONS.map((section) => (
          <article className="card setup-section-card" key={section.id}>
            <div className="panel-title">
              <div>
                <h2>{section.title}</h2>
                <p className="muted">{section.description}</p>
              </div>
            </div>
            <div className="setup-check-list">
              {section.items.map((item) => (
                <label className={`setup-check-row ${checked[item.id] ? 'setup-check-row-done' : ''}`} key={item.id}>
                  <input type="checkbox" checked={Boolean(checked[item.id])} onChange={() => toggleItem(item.id)} />
                  <span>{item.label}</span>
                  <Link className="button secondary slim" href={item.href}>Open</Link>
                </label>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
