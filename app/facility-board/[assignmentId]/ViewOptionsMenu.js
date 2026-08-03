'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ViewOptionsMenu({ queryBase, view }) {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <details className="facility-board-view-menu" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="button secondary facility-board-view-trigger">View options<span aria-hidden="true">⌄</span></summary>
      <div className="facility-board-view-dropdown">
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/">Dashboard</Link>
        <Link onClick={closeMenu} className={`facility-board-view-link ${view === 'tasks' ? 'facility-board-view-link-active' : 'facility-board-view-link-view'}`} href={`${queryBase}&view=tasks`}>Facility task view</Link>
        <Link onClick={closeMenu} className={`facility-board-view-link ${view === 'order' ? 'facility-board-view-link-active' : 'facility-board-view-link-view'}`} href={`${queryBase}&view=order`}>Task Card Organiser</Link>
        <Link onClick={closeMenu} className={`facility-board-view-link ${view === 'staff' ? 'facility-board-view-link-active' : 'facility-board-view-link-view'}`} href={`${queryBase}&view=staff`}>Facility staff view</Link>
        <Link onClick={closeMenu} className={`facility-board-view-link ${view === 'time' ? 'facility-board-view-link-active' : 'facility-board-view-link-view'}`} href={`${queryBase}&view=time`}>Facility time view</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/admin/staff">Staff roster</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/admin/facilities">Facilities</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/admin/manager">Manager view</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/admin/inbox">Operations inbox</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/admin/settings">Settings</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/cleaner">Staff landing</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/qr-zones">QR zones</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/reports/daily">Daily reports</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/reports/weekly">Weekly report</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/reports/monthly">Monthly report</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/reports/building-manager">Building manager report</Link>
      </div>
    </details>
  );
}
