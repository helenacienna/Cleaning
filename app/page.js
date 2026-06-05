'use client';

import {
  appSummary,
  cleanerAssignments,
  supervisorCards,
  taskCardTemplates,
  taskLibrary,
  reports,
  scheduleBuilder,
} from '../data/demo-data';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function statusClass(status) {
  return `task-status status-${status}`;
}

function formatTaskLabel(status = '') {
  return status.replace('-', ' ');
}

function groupAssignmentTasks(tasks = []) {
  const groups = new Map();

  tasks.forEach((task, index) => {
    const key = `${task.zone}__${task.taskGroup}`;
    if (!groups.has(key)) {
      groups.set(key, {
        zone: task.zone,
        taskGroup: task.taskGroup,
        tasks: [],
      });
    }

    groups.get(key).tasks.push({ ...task, displayOrder: index + 1 });
  });

  return Array.from(groups.values()).map((group) => {
    const completed = group.tasks.filter((task) => task.status === 'completed').length;
    const total = group.tasks.length;
    return {
      ...group,
      completed,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });
}

function formatRequirement(task) {
  if (task.required) {
    return task.required;
  }
  if (task.photoRequired) {
    return 'Photo required';
  }
  if (task.commentRequired) {
    return 'Comment required';
  }
  return 'Standard';
}

function formatEstimatedMinutes(task) {
  if (!task.estimatedMinutes) {
    return '—';
  }
  return `${task.estimatedMinutes} min`;
}

function formatTaskNumber(task) {
  if (typeof task.displayOrder === 'number') {
    return String(task.displayOrder).padStart(3, '0');
  }
  if (task.jobOrderNumber) {
    return String(task.jobOrderNumber).padStart(3, '0');
  }
  return '—';
}

function parseDemoDate(value) {
  if (!value || value === '—' || value === 'As triggered') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function diffInDays(targetDate, baseDate = new Date()) {
  if (!targetDate) {
    return null;
  }

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - base.getTime()) / DAY_IN_MS);
}

function formatLastCompletedAge(value) {
  const days = diffInDays(parseDemoDate(value));

  if (days === null) {
    return 'Not completed yet';
  }

  if (days === 0) {
    return 'Done today';
  }

  if (days < 0) {
    return `${Math.abs(days)} days ago`;
  }

  return `In ${days} days`;
}

function formatNextScheduleTiming(value) {
  const days = diffInDays(parseDemoDate(value));

  if (days === null) {
    return 'Triggered manually';
  }

  if (days === 0) {
    return 'Due today';
  }

  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }

  return `Due in ${days} days`;
}

function formatBoardDateLabel(dayKey) {
  return dayKey || 'No board day selected';
}

function getTodayBoardDayKey() {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
  }).replace(',', '');
}

function getLastCompletedSortValue(task) {
  const days = diffInDays(parseDemoDate(task.lastCompleted));

  if (days === null) {
    return -1;
  }

  return -days;
}

function getUnscheduledFacilityTasks(assignment) {
  const scheduledTemplateIds = new Set(assignment.tasks.map((task) => task.templateId).filter(Boolean));

  return taskCardTemplates
    .filter((task) => task.facility === assignment.location && !scheduledTemplateIds.has(task.templateId))
    .sort((a, b) => {
      const lastCompletedDiff = getLastCompletedSortValue(b) - getLastCompletedSortValue(a);
      if (lastCompletedDiff !== 0) {
        return lastCompletedDiff;
      }
      if (a.zone !== b.zone) {
        return a.zone.localeCompare(b.zone);
      }
      if (a.taskGroup !== b.taskGroup) {
        return a.taskGroup.localeCompare(b.taskGroup);
      }
      return a.title.localeCompare(b.title);
    });
}

function buildDashboardAssignmentsFromBoard(board, selectedDay) {
  if (!board?.cards?.length || !selectedDay) {
    return [];
  }

  const dayCards = board.cards.filter((card) => card.day === selectedDay && card.staff !== 'Unallocated');
  const facilityMap = new Map();

  dayCards.forEach((card) => {
    const facilityKey = card.facility || 'Unassigned facility';
    if (!facilityMap.has(facilityKey)) {
      const shiftMeta = board.staffMeta?.[card.staff];
      facilityMap.set(facilityKey, {
        id: facilityKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        location: facilityKey,
        shift: shiftMeta?.shiftLabel ?? card.staff,
        sourceDay: selectedDay,
        sourceCards: [],
      });
    }

    facilityMap.get(facilityKey).sourceCards.push(card);
  });

  return Array.from(facilityMap.values()).map((assignment, index) => {
    const tasks = assignment.sourceCards
      .sort((a, b) => a.jobOrder - b.jobOrder)
      .map((card) => ({
        id: card.id,
        title: card.title,
        templateId: card.templateId,
        zone: card.zone,
        taskGroup: card.groupName || card.taskGroup,
        status: formatBoardStatusForDashboard(card.status),
        photoRequired: card.type === 'critical',
        commentRequired: Boolean(card.issueNote),
        displayOrder: card.jobOrder,
      }));

    const completed = tasks.filter((task) => task.status === 'completed').length;

    return {
      id: `board-${assignment.id || index + 1}`,
      location: assignment.location,
      shift: assignment.shift,
      tasks,
      stats: {
        completed,
        total: tasks.length,
      },
    };
  });
}

function formatBoardStatusForDashboard(status) {
  switch (status) {
    case 'in_progress':
      return 'in-progress';
    case 'carried_forward':
      return 'carried-forward';
    default:
      return status;
  }
}

export default function HomePage() {
  const [activeTaskCard, setActiveTaskCard] = useState(null);
  const [selectedBoardDay, setSelectedBoardDay] = useState(null);
  const [dashboardBoard, setDashboardBoard] = useState(null);

  useEffect(() => {
    document.body.classList.toggle('modal-open', Boolean(activeTaskCard));
    return () => document.body.classList.remove('modal-open');
  }, [activeTaskCard]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/organiser-board', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && payload?.board) {
          const boardDays = payload.board?.days ?? [];
          const todayBoardDay = getTodayBoardDayKey();
          setDashboardBoard(payload.board);
          setSelectedBoardDay((current) => {
            if (current && boardDays.includes(current)) {
              return current;
            }
            return boardDays.find((day) => day === todayBoardDay) ?? boardDays[0] ?? null;
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const boardDays = dashboardBoard?.days ?? [];
  const activeBoardDay = boardDays.includes(selectedBoardDay)
    ? selectedBoardDay
    : boardDays[0] ?? null;
  const activeBoardDayIndex = activeBoardDay ? boardDays.indexOf(activeBoardDay) : -1;
  const dashboardAssignments = dashboardBoard
    ? buildDashboardAssignmentsFromBoard(dashboardBoard, activeBoardDay)
    : [];
  const visibleAssignments = dashboardAssignments.length ? dashboardAssignments : cleanerAssignments;

  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <h1>{appSummary.appName}</h1>
        </div>
      </div>

      <section className="dashboard-utility-bar card">
        <div className="dashboard-update-card dashboard-update-card-inline">
          <span className="muted">Last deploy</span>
          <strong>4 Jun 2026 · 1:54 PM</strong>
          <div className="dashboard-update-meta">
            <span className="update-pill">0d3dae1e</span>
            <span className="muted">Restored 3 facility columns while keeping unification work in place</span>
          </div>
        </div>
        <div className="dashboard-action-row">
          <a className="button primary slim" href="#schedule-builder">Start scheduling workflow</a>
          <Link className="button secondary slim" href="/admin/daily-hierarchy">Open organiser board</Link>
          <Link className="button secondary slim" href="/scan/assignment-1">Open cleaner QR flow</Link>
          <Link className="button secondary slim" href="/admin/manager">Open manager view</Link>
          <Link className="button secondary slim" href="/admin/inbox">Open operations inbox</Link>
          <Link className="button secondary slim" href="/admin/task-cards">Task cards</Link>
          <Link className="button secondary slim" href="/qr-zones">QR zone codes</Link>
        </div>
      </section>

      <section className="dashboard-info-row">
        <div className="card kpi">
          <span className="muted">Completion rate</span>
          <strong>{appSummary.completionRate}%</strong>
        </div>
        <div className="card kpi">
          <span className="muted">Completed today</span>
          <strong>{appSummary.completedTasks}</strong>
        </div>
        <div className="card kpi">
          <span className="muted">Pending</span>
          <strong>{appSummary.pendingTasks}</strong>
        </div>
        <div className="card kpi">
          <span className="muted">Photo checks</span>
          <strong>{appSummary.photoVerifications}</strong>
        </div>
        {supervisorCards.map((card) => (
          <div className="card" key={card.title}>
            <span className="muted">{card.title}</span>
            <strong className={`metric tone-${card.tone}`}>{card.value}</strong>
            <div className="muted">{card.note}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="panel-title facility-board-title-row">
          <div>
            <h3>Facility board</h3>
          </div>
          <div className="facility-board-date-nav">
            <button
              type="button"
              className="button secondary slim"
              onClick={() => setSelectedBoardDay(boardDays[activeBoardDayIndex - 1] ?? activeBoardDay)}
              disabled={activeBoardDayIndex <= 0}
            >
              ← Prev
            </button>
            <div className="facility-board-date-label">{formatBoardDateLabel(activeBoardDay)}</div>
            <button
              type="button"
              className="button secondary slim"
              onClick={() => setSelectedBoardDay(boardDays.find((day) => day === getTodayBoardDayKey()) ?? activeBoardDay)}
              disabled={!boardDays.includes(getTodayBoardDayKey()) || activeBoardDay === getTodayBoardDayKey()}
            >
              Today
            </button>
            <button
              type="button"
              className="button secondary slim"
              onClick={() => setSelectedBoardDay(boardDays[activeBoardDayIndex + 1] ?? activeBoardDay)}
              disabled={activeBoardDayIndex === -1 || activeBoardDayIndex >= boardDays.length - 1}
            >
              Next →
            </button>
          </div>
        </div>

        <div className="assignment-grid">
        {visibleAssignments.map((assignment) => {
          const unscheduledTasks = getUnscheduledFacilityTasks(assignment);

          return (
          <div className="card" key={assignment.id}>
            <div className="facility-card-header">
              <Link className="button secondary facility-card-title-button" href={`/facility-board/${assignment.id}`}>
                {assignment.location}
              </Link>
              <span className="badge facility-card-shift-badge">{assignment.shift}</span>
            </div>
            <div className="qr-link-row">
              <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
              <span className="muted">/{assignment.sourceDay ?? activeBoardDay ?? 'board'}</span>
            </div>
            <div className="task-list task-list-nested">
              {groupAssignmentTasks(assignment.tasks).map((group) => (
                <details className="task-group-disclosure" key={`${assignment.id}-${group.zone}-${group.taskGroup}`}>
                  <summary className="task-group-summary">
                    <div className="task-group-summary-copy">
                      <strong>{group.taskGroup}</strong>
                      <div className="task-group-progress-row">
                        <div className="task-group-progress"><span style={{ width: `${group.progress}%` }} /></div>
                        <span className="task-group-progress-label">{group.completed}/{group.total}</span>
                      </div>
                    </div>
                    <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="task-group-body">
                    {group.tasks.map((task) => {
                      const taskCardDetails = {
                        ...task,
                        facility: assignment.location,
                        shift: assignment.shift,
                        assignmentId: assignment.id,
                      };

                      return (
                      <details className="task-disclosure task-disclosure-compact" key={task.id}>
                        <summary className="task-row task-row-disclosure task-row-disclosure-compact">
                          <div className="task-inline-main">
                            <button
                              type="button"
                              className="task-inline-order task-inline-order-button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setActiveTaskCard(taskCardDetails);
                              }}
                            >
                              #{String(task.displayOrder).padStart(3, '0')}
                            </button>
                            <strong>{task.title}</strong>
                          </div>
                          <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
                            {task.photoRequired && <span className="flag task-inline-flag">Photo</span>}
                            {task.commentRequired && <span className="flag task-inline-flag">Comment</span>}
                            <span className={`${statusClass(task.status)} task-inline-status`}>{formatTaskLabel(task.status)}</span>
                            <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                          </div>
                        </summary>
                        <div className="task-disclosure-body">
                          <div className="task-detail-grid">
                            <div>
                              <span className="muted">Task #</span>
                              <strong>{String(task.displayOrder).padStart(3, '0')}</strong>
                            </div>
                            <div>
                              <span className="muted">Group</span>
                              <strong>{task.taskGroup}</strong>
                            </div>
                            <div>
                              <span className="muted">Zone</span>
                              <strong>{task.zone}</strong>
                            </div>
                            <div>
                              <span className="muted">Status</span>
                              <strong>{formatTaskLabel(task.status)}</strong>
                            </div>
                          </div>
                        </div>
                      </details>
                    );})}
                  </div>
                </details>
              ))}
            </div>
            <details className="task-group-disclosure unscheduled-facility-disclosure">
              <summary className="task-group-summary unscheduled-facility-summary">
                <div className="task-group-summary-copy">
                  <strong>Not scheduled today</strong>
                  <div className="muted">All {assignment.location} tasks not included in this day&apos;s facility board</div>
                  <div className="task-group-progress-row unscheduled-facility-meta-row">
                    <span className="task-group-progress-label">{unscheduledTasks.length} tasks</span>
                  </div>
                </div>
                <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="task-group-body unscheduled-facility-body">
                {unscheduledTasks.length ? unscheduledTasks.map((task) => {
                  const taskCardDetails = {
                    ...task,
                    facility: assignment.location,
                    shift: assignment.shift,
                    assignmentId: assignment.id,
                    status: 'not scheduled',
                  };

                  return (
                    <div className="task-row task-row-disclosure-compact unscheduled-task-row" key={`${assignment.id}-${task.templateId}`}>
                      <div className="task-inline-main">
                        <button
                          type="button"
                          className="task-inline-order task-inline-order-button"
                          onClick={() => setActiveTaskCard(taskCardDetails)}
                        >
                          #{task.jobOrderNumber ?? '—'}
                        </button>
                        <div className="unscheduled-task-copy">
                          <strong>{task.title}</strong>
                          <span className="muted">{task.zone} · {task.taskGroup}</span>
                          <span className="muted unscheduled-task-timing">
                            Last done: {formatLastCompletedAge(task.lastCompleted)} · Next: {formatNextScheduleTiming(task.suggestedDue)}
                          </span>
                        </div>
                      </div>
                      <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
                        <span className="flag task-inline-flag">{task.frequency}</span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="task-row unscheduled-task-empty">
                    <div>
                      <strong>Everything for this facility is already scheduled</strong>
                      <div className="muted">No extra facility tasks sitting outside today&apos;s run.</div>
                    </div>
                  </div>
                )}
              </div>
            </details>
          </div>
          );
        })}
        </div>
      </section>

      {activeTaskCard && (
        <div className="modal-backdrop" role="presentation" onClick={() => setActiveTaskCard(null)}>
          <div className="fullscreen-checklist task-card-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-task-card-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header compact-modal-header">
              <div>
                <span className="badge">Task card details</span>
                <h2 id="dashboard-task-card-modal-title">{activeTaskCard.title}</h2>
                <strong>#{formatTaskNumber(activeTaskCard)} · {activeTaskCard.facility}</strong>
              </div>
              <button type="button" className="button secondary close-modal-button" onClick={() => setActiveTaskCard(null)}>Close</button>
            </div>

            <div className="task-card-modal-grid">
              <div className="task-card-modal-section">
                <span className="muted">Task card number</span>
                <strong>{formatTaskNumber(activeTaskCard)}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Status</span>
                <strong>{formatTaskLabel(activeTaskCard.status)}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Facility</span>
                <strong>{activeTaskCard.facility}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Zone</span>
                <strong>{activeTaskCard.zone}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Task group</span>
                <strong>{activeTaskCard.taskGroup}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Shift</span>
                <strong>{activeTaskCard.shift}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Template ID</span>
                <strong>{activeTaskCard.templateId ?? '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Job order</span>
                <strong>{activeTaskCard.jobOrderNumber ? `#${activeTaskCard.jobOrderNumber}` : '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Requirement</span>
                <strong>{formatRequirement(activeTaskCard)}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Priority type</span>
                <strong>{activeTaskCard.frequencyType ?? '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Frequency</span>
                <strong>{activeTaskCard.frequency ?? '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Estimated time required</span>
                <strong>{formatEstimatedMinutes(activeTaskCard)}</strong>
              </div>
              <div className="task-card-modal-section task-card-modal-section-span-2">
                <span className="muted">Notes</span>
                <strong>{activeTaskCard.notes ?? `${activeTaskCard.taskGroup} · ${activeTaskCard.zone} · ${activeTaskCard.facility}`}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="card schedule-builder" id="schedule-builder">
        <div className="panel-title">
          <div>
            <h3>Schedule builder prototype</h3>
            <p className="muted">Build a repeating run sheet from reusable task templates, then generate dated task instances for history/reporting.</p>
          </div>
          <span className="badge">Draft mode</span>
        </div>

        <div className="schedule-grid">
          <div className="schedule-sidebar">
            <div className="builder-field">
              <span className="muted">Location</span>
              <strong>{scheduleBuilder.selectedLocation}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Zone / QR code</span>
              <strong>{scheduleBuilder.selectedZone}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Frequency</span>
              <strong>{scheduleBuilder.frequency}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Run style</span>
              <strong>{scheduleBuilder.shift}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Assigned cleaner</span>
              <strong>{scheduleBuilder.assignedCleaner}</strong>
            </div>
            <div className="cta-row">
              <span className="button primary">Save schedule draft</span>
              <span className="button secondary">Preview cleaner run sheet</span>
              <Link className="button secondary" href="/admin/task-cards">Edit task cards</Link>
            </div>
          </div>

          <div className="schedule-main">
            <div className="schedule-toolbar">
              <div>
                <h4>Run sheet task order</h4>
                <p className="muted">Job order numbers set the default sequence, but staff can still reorder or split tasks when the day changes.</p>
              </div>
              <span className="badge">{scheduleBuilder.draftTasks.length} task cards</span>
            </div>
            <div className="schedule-task-list">
              {scheduleBuilder.draftTasks.map((task) => (
                <div className="schedule-task" key={task.templateId}>
                  <div className="schedule-task-main">
                    <div className="task-number">{task.order}</div>
                    <div>
                      <strong>{task.title}</strong>
                      <div className="muted">Job #{task.jobOrderNumber} · {task.templateId}</div>
                    </div>
                  </div>
                  <div className="frequency-panel">
                    <span className={`frequency-type ${task.frequencyType === 'Critical' ? 'frequency-critical' : 'frequency-suggestive'}`}>
                      {task.frequencyType}
                    </span>
                    <div>
                      <span className="muted">Task group</span>
                      <strong>{task.taskGroup}</strong>
                    </div>
                    <div>
                      <span className="muted">Zone</span>
                      <strong>{task.zone}</strong>
                    </div>
                    <div>
                      <span className="muted">Facility</span>
                      <strong>{task.facility}</strong>
                    </div>
                  </div>
                  <div className="frequency-panel">
                    <div>
                      <span className="muted">Frequency</span>
                      <strong>{task.frequency}</strong>
                    </div>
                    <div>
                      <span className="muted">Last completed</span>
                      <strong>{task.lastCompleted}</strong>
                    </div>
                    <div>
                      <span className="muted">Suggested due</span>
                      <strong>{task.suggestedDue}</strong>
                    </div>
                  </div>
                  <span className="flag">{task.required}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="generated-panel">
          <div>
            <h4>Generated history keys</h4>
            <p className="muted">The schedule creates unique daily task instances while preserving the reusable task template IDs.</p>
          </div>
          <div className="generated-grid">
            <div className="builder-field strong-field">
              <span className="muted">Repeat rule</span>
              <strong>{scheduleBuilder.repeatRule}</strong>
            </div>
            <div className="builder-field strong-field">
              <span className="muted">Random photo rule</span>
              <strong>{scheduleBuilder.randomPhotoRate}</strong>
            </div>
          </div>
          <div className="instance-list">
            {scheduleBuilder.generatedInstances.map(([date, count, key]) => (
              <div className="instance-row" key={key}>
                <strong>{date}</strong>
                <span className="muted">{count}</span>
                <code>{key}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-panel">
          <div className="schedule-toolbar">
            <div>
              <h4>Calendar planning view</h4>
              <p className="muted">See critical and suggestive work across the week by job order, facility, and zone before publishing schedules.</p>
            </div>
            <div className="calendar-legend">
              <span><i className="legend-dot critical-dot" /> Critical</span>
              <span><i className="legend-dot suggestive-dot" /> Suggestive</span>
            </div>
          </div>

          <div className="calendar-grid">
            {scheduleBuilder.calendarDays.map((day) => (
              <div className={`calendar-day ${day.dayType === 'weekend' ? 'weekend-day' : ''}`} key={day.date}>
                <div className="calendar-date-row">
                  <strong>{day.date}</strong>
                  <span className="muted">{day.jobs.length ? `${day.jobs.length} job groups` : 'No runs'}</span>
                </div>
                <div className="calendar-jobs">
                  {day.jobs.length ? day.jobs.map((job) => (
                    <div className={`calendar-job ${job.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} key={`${day.date}-${job.jobOrderStart}-${job.zone}`}>
                      <strong>Job order {job.jobOrderStart}</strong>
                      <span>{job.groupName}</span>
                      <small>{job.facility} · {job.zone}</small>
                    </div>
                  )) : <span className="empty-day">Unscheduled</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bottom-grid">
        <div className="card">
          <div className="panel-title">
            <div>
              <h3>Task library</h3>
              <p className="muted">Reusable cards that can appear in multiple schedules</p>
            </div>
            <span className="badge">Admin managed</span>
          </div>
          <div className="library-grid">
            {taskLibrary.map((task) => (
              <div className="card" key={task.title}>
                <span className="muted">{task.category}</span>
                <h4>{task.title}</h4>
                <p className="muted">Estimated duration: {task.duration}</p>
                <div className="flag-row">
                  {task.flags.map((flag) => (
                    <span className="flag" key={flag}>{flag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="panel-title">
            <div>
              <h3>Reporting snapshot</h3>
              <p className="muted">Filterable by location, zone, task, cleaner, and date range</p>
            </div>
          </div>
          <div className="report-table">
            {reports.map(([label, value]) => (
              <div className="report-row" key={label}>
                <span className="muted">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="cta-row">
            <span className="button secondary">Supervisor audits</span>
            <span className="button secondary">Issue reports</span>
          </div>
        </div>
      </section>
    </main>
  );
}
