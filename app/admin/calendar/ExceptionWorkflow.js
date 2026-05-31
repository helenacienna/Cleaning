'use client';

import { useState } from 'react';

function formatJobOrder(jobOrder) {
  return String(jobOrder).padStart(3, '0');
}

export default function ExceptionWorkflow({ workflow }) {
  const [groups, setGroups] = useState(workflow.groups);
  const [detachedTasks, setDetachedTasks] = useState(workflow.detachedTasks);

  function moveGroup(groupId, direction) {
    setGroups((existing) => existing.map((group) => (
      group.id === groupId
        ? {
            ...group,
            day: direction === 'next' ? 'Tue 2' : 'Mon 1',
            staff: direction === 'next' ? 'Leo Nguyen' : group.staff,
          }
        : group
    )));
  }

  function detachExampleTask(group) {
    const newTask = {
      id: `detached-${group.id}`,
      title: `Exception task from ${group.name}`,
      groupId: group.id,
      groupName: group.name,
      day: 'Thu 4',
      jobOrder: group.jobOrderEnd + 2,
      staff: group.staff,
      facility: group.facility,
      zone: group.zone,
      type: group.type,
      detached: true,
      reason: 'Detached from task group and rescheduled as individual work',
    };

    setDetachedTasks((existing) => existing.some((task) => task.id === newTask.id) ? existing : [newTask, ...existing]);
  }

  return (
    <section className="card exception-workflow-shell">
      <div className="admin-calendar-header">
        <div>
          <h2>Expected schedule + exception rescheduling</h2>
          <p className="muted">Move normal task groups quickly, but detach individual task cards when an incident or missed item needs separate scheduling.</p>
        </div>
        <div className="hierarchy-strip">
          <span>Facility</span>
          <b>→</b>
          <span>Zone</span>
          <b>→</b>
          <span>Task group</span>
          <b>→</b>
          <span>Task card</span>
        </div>
      </div>

      <div className="exception-grid">
        <div className="exception-column">
          <div className="column-title">
            <h3>Task groups</h3>
            <span className="badge">Move as one</span>
          </div>
          <div className="group-card-list">
            {groups.map((group) => (
              <article className={`task-group-card ${group.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} key={group.id}>
                <div className="group-card-top">
                  <div>
                    <strong>{group.name}</strong>
                    <span>{group.facility} · {group.zone}</span>
                  </div>
                  <span className="badge">Jobs {formatJobOrder(group.jobOrderStart)}–{formatJobOrder(group.jobOrderEnd)}</span>
                </div>
                <div className="group-meta-row">
                  <span>{group.day}</span>
                  <span>{group.staff}</span>
                  <span>{group.taskCount} task cards</span>
                  <span>{group.type}</span>
                </div>
                <div className="group-actions">
                  <button className="button secondary" type="button" onClick={() => moveGroup(group.id, 'next')}>Move group</button>
                  <button className="button secondary" type="button" onClick={() => detachExampleTask(group)}>Detach one task</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="exception-column">
          <div className="column-title">
            <h3>Detached individual tasks</h3>
            <span className="badge">Exception queue</span>
          </div>
          <div className="group-card-list">
            {detachedTasks.map((task) => (
              <article className={`detached-task-card ${task.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} key={task.id}>
                <div className="group-card-top">
                  <div>
                    <strong>{task.title}</strong>
                    <span>Originally from: {task.groupName}</span>
                  </div>
                  <span className="frequency-type frequency-critical">Detached</span>
                </div>
                <div className="group-meta-row">
                  <span>{task.day}</span>
                  <span>Job #{formatJobOrder(task.jobOrder)}</span>
                  <span>{task.staff}</span>
                  <span>{task.facility} · {task.zone}</span>
                </div>
                <p className="muted">{task.reason}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
