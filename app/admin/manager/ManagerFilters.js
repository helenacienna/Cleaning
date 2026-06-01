'use client';

import { useMemo, useState } from 'react';

function matchesFilter(task, filter) {
  if (filter === 'all') return true;
  if (filter === 'rework') return task.latestManagerAction === 'reassign' || task.status === 'carried_forward';
  if (filter === 'open') return task.status !== 'completed';
  if (filter === 'closed') return task.status === 'completed';
  return true;
}

export default function ManagerFilters({ exceptionTasks, lowScoreTasks }) {
  const [filter, setFilter] = useState('all');
  const filteredExceptions = useMemo(
    () => exceptionTasks.filter((task) => matchesFilter(task, filter)),
    [exceptionTasks, filter],
  );

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h3>Review filters</h3>
          <p className="muted">Slice the manager queue by open work, rework, or closed items.</p>
        </div>
        <span className="badge">{filteredExceptions.length} shown</span>
      </div>

      <div className="flag-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          ['all', 'All exceptions'],
          ['open', 'Open only'],
          ['rework', 'Rework queue'],
          ['closed', 'Closed'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'button primary' : 'button secondary'}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="task-list">
        {filteredExceptions.slice(0, 6).map((task) => (
          <div className="task-row" key={`filter-${task.id}`}>
            <div>
              <strong>{task.title}</strong>
              <div className="muted">{task.shift.location} · {task.shift.zone}</div>
            </div>
            <div className="flag-row">
              <span className={`task-status status-${task.status}`}>{task.status.replace('-', ' ')}</span>
              <span className="flag">{task.latestManagerAction}</span>
            </div>
          </div>
        ))}
        {!filteredExceptions.length && <div className="muted">No exception items match this filter.</div>}
      </div>

      <div style={{ marginTop: 12 }} className="muted">
        {lowScoreTasks.length} low-score tasks are still tracked separately below.
      </div>
    </section>
  );
}
