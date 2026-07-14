'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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

function mapRouteItemToTask(item, index) {
  return {
    id: item.taskTemplateId,
    taskTemplateUuid: item.taskTemplateId,
    templateId: item.taskTemplateCode,
    title: item.title,
    zone: item.zone,
    taskGroup: item.taskGroup,
    staff: 'Route template',
    frequency: 'Template',
    displayOrder: item.sequence ?? (index + 1) * 10,
    jobOrderNumber: item.sequence ?? (index + 1) * 10,
  };
}

function routeItemsToTasks(route) {
  return [...(route?.items ?? [])]
    .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0))
    .map(mapRouteItemToTask);
}

function getOrderedTemplateIds(tasks = []) {
  return tasks.map((task) => task.taskTemplateUuid).filter(Boolean);
}

export default function FacilityTaskOrderView({ tasks = [], facility }) {
  const [orderedTasks, setOrderedTasks] = useState(() => sortTasks(tasks));
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? null;

  const zoneSections = useMemo(() => groupByZone(orderedTasks), [orderedTasks]);

  function applyRouteToTasks(route, baseTasks = tasks) {
    const routeTasks = routeItemsToTasks(route);
    if (routeTasks.length) {
      setOrderedTasks(routeTasks);
      return;
    }

    setOrderedTasks(sortTasks(baseTasks));
  }


  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      try {
        const response = await fetch(`/api/facility-routes?facility=${encodeURIComponent(facility)}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload?.routes)) {
          throw new Error(payload?.error || 'Unable to load saved routes');
        }

        if (cancelled) return;

        setRoutes(payload.routes);
        const defaultRoute = payload.routes.find((route) => route.isDefault) ?? payload.routes[0] ?? null;
        setSelectedRouteId(defaultRoute?.id ?? '');
        applyRouteToTasks(defaultRoute, tasks);
      } catch (error) {
        if (!cancelled) {
          setNotice(error.message || 'Could not load saved routes.');
        }
      }
    }

    loadRoutes();
    return () => { cancelled = true; };
  }, [facility, tasks]);

  async function saveOrder(nextTasks) {
    setIsSaving(true);
    setNotice('Saving route order…');

    try {
      const response = await fetch('/api/task-template-order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: getOrderedTemplateIds(nextTasks) }),
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

  async function saveNamedRoute(nextTasks) {
    if (!selectedRouteId) {
      await saveOrder(nextTasks);
      return;
    }

    setIsSaving(true);
    setNotice('Saving named route…');

    try {
      const response = await fetch('/api/facility-routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: selectedRouteId,
          orderedTemplateIds: getOrderedTemplateIds(nextTasks),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.routes)) {
        throw new Error(payload?.error || 'Unable to save named route');
      }

      setRoutes(payload.routes);
      setNotice(`Saved route: ${selectedRoute?.name ?? 'selected route'}.`);
    } catch (error) {
      setNotice(error.message || 'Could not save named route.');
    } finally {
      setIsSaving(false);
    }
  }

  async function createRoute() {
    if (isSaving) return;

    const name = window.prompt('Name this route');
    if (!name?.trim()) return;

    setIsSaving(true);
    setNotice('Creating route…');

    try {
      const response = await fetch('/api/facility-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility,
          name: name.trim(),
          orderedTemplateIds: getOrderedTemplateIds(orderedTasks),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.routes)) {
        throw new Error(payload?.error || 'Unable to create route');
      }

      setRoutes(payload.routes);
      setSelectedRouteId(payload.routeId);
      setNotice(`Created route: ${name.trim()}.`);
    } catch (error) {
      setNotice(error.message || 'Could not create route.');
    } finally {
      setIsSaving(false);
    }
  }

  async function makeDefaultRoute() {
    if (!selectedRouteId || isSaving) return;

    setIsSaving(true);
    setNotice('Setting default route…');

    try {
      const response = await fetch('/api/facility-routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId: selectedRouteId, isDefault: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.routes)) {
        throw new Error(payload?.error || 'Unable to set default route');
      }
      setRoutes(payload.routes);
      setNotice('Default route updated.');
    } catch (error) {
      setNotice(error.message || 'Could not set default route.');
    } finally {
      setIsSaving(false);
    }
  }

  async function applyRouteToLiveChecklist() {
    if (isSaving) return;

    setIsSaving(true);
    setNotice('Applying route to live checklist…');

    try {
      const response = await fetch('/api/task-template-order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: getOrderedTemplateIds(orderedTasks) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to apply route');
      }
      setNotice(`Applied ${selectedRoute?.name ?? 'selected route'} to the live checklist order.`);
    } catch (error) {
      setNotice(error.message || 'Could not apply route.');
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
    void saveNamedRoute(renumberedTasks);
  }

  return (
    <section className="facility-task-order-shell">
      <div className="card facility-task-order-intro">
        <div>
          <h2>Task order</h2>
          <p className="muted">Drag every facility task into the saved route order for {facility}. Daily checklists use this route as the template, even when only some tasks are scheduled.</p>
        </div>
        <div className="facility-task-order-controls">
          <label className="field-label compact-select-label">
            <span>Route</span>
            <select
              value={selectedRouteId}
              onChange={(event) => {
                const route = routes.find((item) => item.id === event.target.value) ?? null;
                setSelectedRouteId(event.target.value);
                applyRouteToTasks(route, tasks);
              }}
            >
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}{route.isDefault ? ' · default' : ''}</option>)}
            </select>
          </label>
          <button className="button secondary slim" type="button" onClick={createRoute} disabled={isSaving}>New route</button>
          <button className="button secondary slim" type="button" onClick={makeDefaultRoute} disabled={isSaving || !selectedRouteId || selectedRoute?.isDefault}>Make default</button>
          <button className="button primary slim" type="button" onClick={applyRouteToLiveChecklist} disabled={isSaving || !orderedTasks.length}>Apply to live checklist</button>
          <div className="badge">{orderedTasks.length} route tasks</div>
        </div>
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
                  {task.templateId ? (
                    <Link
                      className="button secondary slim facility-task-order-edit-button"
                      href={`/admin/task-cards?templateId=${encodeURIComponent(task.templateId)}`}
                      draggable={false}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Edit
                    </Link>
                  ) : null}
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
