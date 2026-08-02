'use client';

import { useState } from 'react';

export default function ExpandAllZonesButton() {
  const [expanded, setExpanded] = useState(false);

  function toggleZones(event) {
    const column = event.currentTarget.closest('.facility-board-task-column');
    const zones = Array.from(column?.querySelectorAll('details.facility-board-zone-card-daily') ?? []);
    const nextExpanded = !expanded;

    column?.classList.toggle('facility-board-daily-list-expanded', nextExpanded);
    zones.forEach((zone) => {
      zone.open = nextExpanded;
    });

    setExpanded(nextExpanded);
  }

  return (
    <button className="button secondary slim facility-board-expand-button" type="button" onClick={toggleZones}>
      {expanded ? 'Collapse daily list' : 'Show daily list'}
    </button>
  );
}
