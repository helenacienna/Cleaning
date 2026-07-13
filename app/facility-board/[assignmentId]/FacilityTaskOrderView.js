'use client';

import { useMemo, useState } from 'react';

function getTaskOrder(task) {
  const raw = task?.jobOrderNumber ?? task?.displayOrder ?? task?.instanceCode ?? '';
  const digits = String(raw ?? '').match(/\d+/g)?.join('') ?? '';
  return digits ? Number.parseInt(digits, 10) : Number.MAX_SAFE_INTEGER;
}

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    const orderDiff = getTaskOrder(left) - getTaskOrder(right);
    if (orderDiff !== 0) return orderDiff;
    if ((left.zone || '') !== (right.zone || '')) return String(left.zone || '').localeCompare(String(right.zone || ''));
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

function groupByZone(tasks = []) {
  const zones = new Map();
  sortTasks(tasks).forEach((task) => {
    const zoneName = task.zone || 'Unassigned zone';
    if (!zones.has(zoneName)) {
      zones.set(zoneName, []);
    }
    zones.get(zoneName).push(task);
  });

  return Array.from(zones.entries()).map(([zone, zoneTasks]) => ({ zone, tasks: zoneTasks }));
}

export default function FacilityTaskOrderView({ tasks = [], facility }) {
  const [orderedTasks, setOrderedTasks] = useState(() => sortTasks(tasks));
  const [draggingId, setDraggingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const zoneSections = useMemo(() => groupByZone(orderedTasks), [orderedTasks]);

  async function saveOrder(nextTasks) {
    setIsSaving(true);
    setNotice('Saving route order…');

    try {
      const response = await fetch('/api/task-template-order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedInstanceIds: nextTasks.map((task) => task.id) }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to save route order');
      }

      setNotice('Task order saved for this facility route.');
    } catch (error) {
      setNotice(error.message || 'Could not save task order.');
    } finally {
      setIsSaving(false);
    }
  }

  function moveTask(targetId, position = 'before') {
    if (!draggingId || draggingId === targetId || isSaving) {
      setDraggingId(null);
      return;
    }

    const movingTask = orderedTasks.find((task) => task.id === draggingId);
    const remainingTasks = orderedTasks.filter((task) => task.id !== draggingId);
    const targetIndex = remainingTasks.findIndex((task) => task.id === targetId);

    if (!movingTask || targetIndex === -1) {
      setDraggingId(null);
      return;
    }

    const nextTasks = [...remainingTasks];
    nextTasks.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, movingTask);
    const renumberedTasks = nextTasks.map((task, index) => ({
      ...task,
      displayOrder: (index + 1) * 10,
      jobOrderNumber: (index + 1) * 10,
    }));

    setOrderedTasks(renumberedTasks);
    setDraggingId(null);
    void saveOrder(renumberedTasks);
  }

  return (
    <section className="facility-task-order-shell">
      <div className="card facility-task-order-intro">
        <div>
          <h2>Task order</h2>
          <p className="muted">Drag tasks into the route order for {facility}. Tasks are visually grouped by zone so the list is easier to scan.</p>
        </div>
        <div className="badge">{orderedTasks.length} tasks</div>
      </div>

      <div className="facility-task-order-zones">
        {zoneSections.map((section) => (
          <article className="card facility-task-order-zone" key={section.zone}>
            <div className="facility-task-order-zone-header">
              <h3>{section.zone}</h3>
              <span className="badge">{section.tasks.length} tasks</span>
            </div>
            <div className="facility-task-order-list">
              {section.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`facility-task-order-card ${draggingId === task.id ? 'dragging' : ''}`}
                  draggable={!isSaving}
                  onDragStart={(event) => {
                    setDraggingId(task.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', task.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const position = event.clientY > rect.top + (rect.height / 2) ? 'after' : 'before';
                    moveTask(task.id, position);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <span className="facility-task-order-handle" aria-hidden="true">⋮⋮</span>
                  <strong className="facility-task-order-number">#{String(getTaskOrder(task)).padStart(3, '0')}</strong>
                  <div className="facility-task-order-main">
                    <strong>{task.title}</strong>
                    <span className="muted">{task.taskGroup} · {task.staff || 'Unallocated'} · {task.frequency || 'Daily'}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {notice ? <div className="save-notice facility-task-order-notice">{notice}</div> : null}
    </section>
  );
}
