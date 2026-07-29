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

function mapTemplateToRouteTask(card, index) {
  return {
    id: card.id,
    taskTemplateUuid: card.id,
    templateId: card.templateId,
    title: card.title,
    zone: card.zone,
    taskGroup: card.taskGroup,
    staff: 'Route template',
    frequency: card.frequency || 'Template',
    displayOrder: Number.parseInt(String(card.jobOrderNumber ?? '').replace(/\D/g, ''), 10) || (index + 1) * 10,
    jobOrderNumber: Number.parseInt(String(card.jobOrderNumber ?? '').replace(/\D/g, ''), 10) || (index + 1) * 10,
  };
}

function routeItemsToTasks(route) {
  return [...(route?.items ?? [])]
    .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0))
    .map(mapRouteItemToTask);
}

function getOrderedTemplateIds(tasks = [], selectedIds = null) {
  return tasks
    .map((task) => task.taskTemplateUuid)
    .filter((id) => id && (!selectedIds || selectedIds.has(id)));
}

function getTaskSearchText(task = {}) {
  return [
    task.title,
    task.zone,
    task.taskGroup,
    task.staff,
    task.frequency,
    task.templateId,
    task.taskTemplateUuid,
    task.instanceCode,
    getTaskOrder(task),
  ].filter((value) => value !== null && value !== undefined).join(' ').toLowerCase();
}

function filterTasks(tasks = [], searchQuery = '') {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return tasks;

  return tasks.filter((task) => getTaskSearchText(task).includes(query));
}

export default function FacilityTaskOrderView({ tasks = [], taskTemplates = [], facility }) {
  const templateTasks = useMemo(() => (
    Array.isArray(taskTemplates) && taskTemplates.length
      ? taskTemplates
        .filter((card) => !facility || card.facility === facility)
        .map(mapTemplateToRouteTask)
      : []
  ), [taskTemplates, facility]);
  const baseTasks = useMemo(() => (templateTasks.length ? sortTasks(templateTasks) : sortTasks(tasks)), [templateTasks, tasks]);
  const [orderedTasks, setOrderedTasks] = useState(() => baseTasks);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(() => new Set(baseTasks.map((task) => task.taskTemplateUuid).filter(Boolean)));
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? null;
  const visibleTasks = useMemo(() => filterTasks(orderedTasks, searchQuery), [orderedTasks, searchQuery]);
  const isSearching = searchQuery.trim().length > 0;
  const selectedVisibleCount = visibleTasks.filter((task) => selectedTemplateIds.has(task.taskTemplateUuid)).length;

  const zoneSections = useMemo(() => groupByZone(visibleTasks), [visibleTasks]);

  function applyRouteToTasks(route, nextBaseTasks = baseTasks) {
    const routeTasks = routeItemsToTasks(route);
    const routeTemplateIds = new Set(routeTasks.map((task) => task.taskTemplateUuid).filter(Boolean));
    if (routeTasks.length) {
      const remainingTasks = sortTasks(nextBaseTasks).filter((task) => !routeTemplateIds.has(task.taskTemplateUuid));
      setOrderedTasks([...routeTasks, ...remainingTasks]);
      setSelectedTemplateIds(routeTemplateIds);
      return;
    }

    const fallbackTasks = sortTasks(nextBaseTasks);
    setOrderedTasks(fallbackTasks);
    setSelectedTemplateIds(new Set(fallbackTasks.map((task) => task.taskTemplateUuid).filter(Boolean)));
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
        applyRouteToTasks(defaultRoute, baseTasks);
      } catch (error) {
        if (!cancelled) {
          setNotice(error.message || 'Could not load saved routes.');
        }
      }
    }

    loadRoutes();
    return () => { cancelled = true; };
  }, [facility, baseTasks]);

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

  async function saveNamedRoute(nextTasks, nextSelectedTemplateIds = selectedTemplateIds) {
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
          orderedTemplateIds: getOrderedTemplateIds(nextTasks, nextSelectedTemplateIds),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.routes)) {
        throw new Error(payload?.error || 'Unable to save named route');
      }

      setRoutes(payload.routes);
      const refreshedRoute = payload.routes.find((route) => route.id === selectedRouteId) ?? null;
      if (refreshedRoute) {
        applyRouteToTasks(refreshedRoute, baseTasks);
      }
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
          orderedTemplateIds: getOrderedTemplateIds(orderedTasks, selectedTemplateIds),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.routes)) {
        throw new Error(payload?.error || 'Unable to create route');
      }

      setRoutes(payload.routes);
      setSelectedRouteId(payload.routeId);
      const createdRoute = payload.routes.find((route) => route.id === payload.routeId) ?? null;
      if (createdRoute) {
        applyRouteToTasks(createdRoute, baseTasks);
      }
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
        body: JSON.stringify({ orderedIds: getOrderedTemplateIds(orderedTasks, selectedTemplateIds) }),
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

  function setTaskIncluded(task, included) {
    if (!task?.taskTemplateUuid || isSaving) return;
    const nextSelectedTemplateIds = new Set(selectedTemplateIds);
    if (included) {
      nextSelectedTemplateIds.add(task.taskTemplateUuid);
    } else {
      nextSelectedTemplateIds.delete(task.taskTemplateUuid);
    }

    setSelectedTemplateIds(nextSelectedTemplateIds);
    void saveNamedRoute(orderedTasks, nextSelectedTemplateIds);
  }

  function setVisibleTasksIncluded(included) {
    if (isSaving) return;
    const nextSelectedTemplateIds = new Set(selectedTemplateIds);
    visibleTasks.forEach((task) => {
      if (!task.taskTemplateUuid) return;
      if (included) {
        nextSelectedTemplateIds.add(task.taskTemplateUuid);
      } else {
        nextSelectedTemplateIds.delete(task.taskTemplateUuid);
      }
    });

    setSelectedTemplateIds(nextSelectedTemplateIds);
    void saveNamedRoute(orderedTasks, nextSelectedTemplateIds);
  }

  return (
    <section className="facility-task-order-shell">
      <div className="card facility-task-order-intro">
        <div>
          <h2>Task Card Organiser</h2>
          <p className="muted">Tick the task cards included in this route, then drag them into the order they should be checked. This lets you build focused routes such as a supervisor walkthrough.</p>
        </div>
        <div className="facility-task-order-controls">
          <label className="field-label compact-select-label">
            <span>Route</span>
            <select
              value={selectedRouteId}
              onChange={(event) => {
                const route = routes.find((item) => item.id === event.target.value) ?? null;
                setSelectedRouteId(event.target.value);
                applyRouteToTasks(route, baseTasks);
              }}
            >
              {routes.map((route) => <option key={route.id} value={route.id}>{route.name}{route.isDefault ? ' · default' : ''}</option>)}
            </select>
          </label>
          <button className="button secondary slim" type="button" onClick={createRoute} disabled={isSaving}>New route</button>
          <button className="button secondary slim" type="button" onClick={makeDefaultRoute} disabled={isSaving || !selectedRouteId || selectedRoute?.isDefault}>Make default</button>
          <button className="button primary slim" type="button" onClick={applyRouteToLiveChecklist} disabled={isSaving || !selectedTemplateIds.size}>Apply to live checklist</button>
          <div className="badge">{selectedTemplateIds.size}/{orderedTasks.length} selected</div>
        </div>
      </div>

      <div className="card facility-task-order-search-card">
        <label className="facility-task-order-search-label" htmlFor="facility-task-order-search">
          <span>Search task cards</span>
          <input
            id="facility-task-order-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search zone, task, group, staff, frequency or number…"
            autoComplete="off"
          />
        </label>
        {isSearching ? <button className="button secondary slim" type="button" onClick={() => setSearchQuery('')}>Clear</button> : null}
        <button className="button secondary slim" type="button" onClick={() => setVisibleTasksIncluded(true)} disabled={isSaving || !visibleTasks.length}>Select shown</button>
        <button className="button secondary slim" type="button" onClick={() => setVisibleTasksIncluded(false)} disabled={isSaving || !visibleTasks.length || !selectedVisibleCount}>Deselect shown</button>
      </div>

      <div className="facility-task-order-zones">
        {zoneSections.length ? zoneSections.map((section) => (
          <article className="card facility-task-order-zone" key={section.zone}>
            <div className="facility-task-order-zone-header">
              <h3>{section.zone}</h3>
              <span className="badge">{section.tasks.length} tasks</span>
            </div>
            <div className="facility-task-order-list">
              {section.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`facility-task-order-card ${draggingId === task.id ? 'dragging' : ''} ${selectedTemplateIds.has(task.taskTemplateUuid) ? '' : 'facility-task-order-card-excluded'}`}
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
                  <label className="facility-task-order-include" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.has(task.taskTemplateUuid)}
                      disabled={isSaving || !task.taskTemplateUuid}
                      onChange={(event) => setTaskIncluded(task, event.target.checked)}
                    />
                    <span>{selectedTemplateIds.has(task.taskTemplateUuid) ? 'Included' : 'Excluded'}</span>
                  </label>
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
        )) : (
          <div className="card facility-task-order-empty">
            <strong>No matching tasks</strong>
            <span className="muted">Try a different zone, task name, staff member, frequency, or task number.</span>
          </div>
        )}
      </div>

      {notice ? <div className="save-notice facility-task-order-notice">{notice}</div> : null}
    </section>
  );
}
