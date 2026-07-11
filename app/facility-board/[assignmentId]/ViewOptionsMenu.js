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
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/">Back to dashboard</Link>
        <Link onClick={closeMenu} className="facility-board-view-link facility-board-view-link-action" href="/">Organise from dashboard</Link>
        <Link onClick={closeMenu} className={`facility-board-view-link ${view === 'tasks' ? 'facility-board-view-link-active' : 'facility-board-view-link-view'}`} href={`${queryBase}&view=tasks`}>Task view</Link>
        <Link onClick={closeMenu} className={`facility-board-view-link ${view === 'staff' ? 'facility-board-view-link-active' : 'facility-board-view-link-view'}`} href={`${queryBase}&view=staff`}>Staff view</Link>
        <Link onClick={closeMenu} className={`facility-board-view-link ${view === 'time' ? 'facility-board-view-link-active' : 'facility-board-view-link-view'}`} href={`${queryBase}&view=time`}>Time view</Link>
      </div>
    </details>
  );
}
