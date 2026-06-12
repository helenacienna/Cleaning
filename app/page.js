'use client';

import {
  appSummary,
  cleanerAssignments,
  supervisorCards,
  taskCardTemplates,
} from '../data/demo-data';
import Link from 'next/link';
import { memo, useEffect, useMemo, useState } from 'react';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function statusClass(status) {
  return `task-status status-${status}`;
}

function formatTaskLabel(status = '') {
  return status.replace('-', ' ');
}

function buildTaskGroupCollection(tasks = []) {
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

function groupAssignmentTasks(tasks = []) {
  const taskGroups = buildTaskGroupCollection(tasks);
  const dailyTaskGroups = [];
  const otherTaskGroups = [];

  taskGroups.forEach((group) => {
    const allDaily = group.tasks.every((task) => !task.frequency || String(task.frequency).toLowerCase() === 'daily');
    if (allDaily) {
      dailyTaskGroups.push(group);
    } else {
      otherTaskGroups.push(group);
    }
  });

  const zoneMap = new Map();
  dailyTaskGroups.forEach((group) => {
    if (!zoneMap.has(group.zone)) {
      zoneMap.set(group.zone, {
        zone: group.zone,
        taskGroups: [],
      });
    }
    zoneMap.get(group.zone).taskGroups.push(group);
  });

  const dailyZones = Array.from(zoneMap.values()).map((zoneEntry) => {
    const completed = zoneEntry.taskGroups.reduce((sum, group) => sum + group.completed, 0);
    const total = zoneEntry.taskGroups.reduce((sum, group) => sum + group.total, 0);
    return {
      ...zoneEntry,
      completed,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });

  const dailyCompleted = dailyZones.reduce((sum, zone) => sum + zone.completed, 0);
  const dailyTotal = dailyZones.reduce((sum, zone) => sum + zone.total, 0);

  return {
    dailyZones,
    otherTaskGroups,
    dailySummary: {
      completed: dailyCompleted,
      total: dailyTotal,
      progress: dailyTotal ? Math.round((dailyCompleted / dailyTotal) * 100) : 0,
    },
  };
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
  if (task.instanceCode) {
    return task.instanceCode;
  }
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
  if (!dayKey) {
    return 'No board day selected';
  }

  const date = new Date(`${dayKey}T00:00:00+10:00`);
  if (Number.isNaN(date.getTime())) {
    return dayKey;
  }

  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Australia/Brisbane',
  }).replace(',', '');
}

function getTodayBoardDayKey() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDashboardRefreshLabel(value) {
  if (!value) {
    return 'Waiting for board data';
  }

  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Brisbane',
  }).replace(',', ' ·');
}

function isFutureBoardDay(dayKey, boardDays) {
  if (!dayKey || !Array.isArray(boardDays) || !boardDays.length) {
    return false;
  }

  const todayKey = getTodayBoardDayKey();
  const todayIndex = boardDays.indexOf(todayKey);
  const activeIndex = boardDays.indexOf(dayKey);

  if (todayIndex === -1 || activeIndex === -1) {
    return false;
  }

  return activeIndex > todayIndex;
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

function normalizeFutureTaskStatus(status) {
  if (['completed', 'in-progress', 'carried-forward', 'overdue', 'due'].includes(status)) {
    return 'scheduled';
  }

  return status;
}

function buildAssignmentPresentationData(assignments, options = {}) {
  const showProgress = options.showProgress !== false;
  const forceScheduledStatuses = options.forceScheduledStatuses === true;

  return assignments.map((assignment) => {
    const tasks = forceScheduledStatuses
      ? assignment.tasks.map((task) => ({
          ...task,
          status: normalizeFutureTaskStatus(task.status),
        }))
      : assignment.tasks;

    return {
      ...assignment,
      tasks,
      showProgress,
      taskGroups: groupAssignmentTasks(tasks),
      unscheduledTasks: getUnscheduledFacilityTasks({ ...assignment, tasks }),
    };
  });
}

function buildDashboardAssignmentsFromBoard(board, selectedDay) {
  if (!board?.cards?.length || !selectedDay) {
    return [];
  }

  const dayCards = board.cards.filter((card) => card.day === selectedDay);
  const facilityMap = new Map();

  dayCards.forEach((card) => {
    const facilityKey = card.facility || 'Unassigned facility';
    if (!facilityMap.has(facilityKey)) {
      const shiftMeta = board.staffMeta?.[card.staff];
      facilityMap.set(facilityKey, {
        id: facilityKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        location: facilityKey,
        shift: shiftMeta?.shiftLabel ?? (card.staff === 'Unallocated' ? 'Scheduled / unallocated' : card.staff),
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
        instanceCode: card.instanceCode,
        zone: card.zone,
        taskGroup: card.groupName || card.taskGroup,
        frequency: card.frequency,
        cadenceMode: card.cadenceMode,
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

const FacilityBoardCard = memo(function FacilityBoardCard({ assignment, activeBoardDay, onOpenTaskCard }) {
  return (
    <div className="card">
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
        <details className="task-group-disclosure">
          <summary className="task-group-summary">
            <div className="task-group-summary-copy">
              <strong>Daily tasks</strong>
              <div className="muted">Core daily run for {assignment.location}</div>
              {assignment.showProgress ? (
                <div className="task-group-progress-row">
                  <div className="task-group-progress"><span style={{ width: `${assignment.taskGroups.dailySummary.progress}%` }} /></div>
                  <span className="task-group-progress-label">{assignment.taskGroups.dailySummary.completed}/{assignment.taskGroups.dailySummary.total}</span>
                </div>
              ) : (
                <div className="task-group-progress-row">
                  <span className="task-group-progress-label">Scheduled</span>
                </div>
              )}
            </div>
            <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="task-group-body">
            {assignment.taskGroups.dailyZones.length ? assignment.taskGroups.dailyZones.map((zone) => (
              <details className="task-disclosure" key={`${assignment.id}-${zone.zone}`}>
                <summary className="task-row task-row-disclosure">
                  <div>
                    <strong>{zone.zone}</strong>
                    <div className="muted">{zone.taskGroups.length} task groups</div>
                  </div>
                  <div className="task-disclosure-summary-right">
                    {assignment.showProgress ? (
                      <>
                        <div className="task-group-progress"><span style={{ width: `${zone.progress}%` }} /></div>
                        <span className="task-group-progress-label">{zone.completed}/{zone.total}</span>
                      </>
                    ) : (
                      <span className="task-group-progress-label">Scheduled</span>
                    )}
                    <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                  </div>
                </summary>
                <div className="task-group-body">
                  {zone.taskGroups.map((group) => (
                    <details className="task-disclosure task-disclosure-compact" key={`${assignment.id}-${zone.zone}-${group.taskGroup}`}>
                      <summary className="task-row task-row-disclosure task-row-disclosure-compact">
                        <div className="task-inline-main">
                          <strong>{group.taskGroup}</strong>
                        </div>
                        <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
                          {assignment.showProgress ? (
                            <span className="task-group-progress-label">{group.completed}/{group.total}</span>
                          ) : (
                            <span className="task-group-progress-label">Scheduled</span>
                          )}
                          <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                        </div>
                      </summary>
                      <div className="task-disclosure-body">
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
                                      onOpenTaskCard(taskCardDetails);
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
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )) : (
              <div className="task-row unscheduled-task-empty">
                <div>
                  <strong>No daily tasks in this facility run</strong>
                  <div className="muted">This date only has non-daily work scheduled here.</div>
                </div>
              </div>
            )}
          </div>
        </details>

        {assignment.taskGroups.otherTaskGroups.map((group) => (
          <details className="task-group-disclosure" key={`${assignment.id}-${group.zone}-${group.taskGroup}`}>
            <summary className="task-group-summary">
              <div className="task-group-summary-copy">
                <strong>{group.taskGroup}</strong>
                <div className="muted">{group.zone} · {group.tasks[0]?.frequency ?? 'Other frequency'}</div>
                {assignment.showProgress ? (
                  <div className="task-group-progress-row">
                    <div className="task-group-progress"><span style={{ width: `${group.progress}%` }} /></div>
                    <span className="task-group-progress-label">{group.completed}/{group.total}</span>
                  </div>
                ) : (
                  <div className="task-group-progress-row">
                    <span className="task-group-progress-label">Scheduled</span>
                  </div>
                )}
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
                            onOpenTaskCard(taskCardDetails);
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
                );
              })}
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
              <span className="task-group-progress-label">{assignment.unscheduledTasks.length} tasks</span>
            </div>
          </div>
          <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-group-body unscheduled-facility-body">
          {assignment.unscheduledTasks.length ? assignment.unscheduledTasks.map((task) => {
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
                    onClick={() => onOpenTaskCard(taskCardDetails)}
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
});

export default function HomePage() {
  const [activeTaskCard, setActiveTaskCard] = useState(null);
  const [selectedBoardDay, setSelectedBoardDay] = useState(null);
  const [dashboardBoard, setDashboardBoard] = useState(null);
  const [dashboardRefreshedAt, setDashboardRefreshedAt] = useState(() => new Date().toISOString());

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
          setDashboardRefreshedAt(new Date().toISOString());
          setSelectedBoardDay((current) => {
            if (current && boardDays.includes(current)) {
              return current;
            }

            const todayIndex = boardDays.indexOf(todayBoardDay);
            if (todayIndex !== -1) {
              return boardDays[todayIndex];
            }

            return boardDays[boardDays.length - 1] ?? boardDays[0] ?? null;
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
  const dashboardAssignments = useMemo(() => (
    dashboardBoard
      ? buildDashboardAssignmentsFromBoard(dashboardBoard, activeBoardDay)
      : []
  ), [dashboardBoard, activeBoardDay]);
  const visibleAssignments = dashboardBoard ? dashboardAssignments : cleanerAssignments;
  const showingFutureBoardDay = isFutureBoardDay(activeBoardDay, boardDays);
  const assignmentPresentationData = useMemo(
    () => buildAssignmentPresentationData(visibleAssignments, {
      showProgress: !showingFutureBoardDay,
      forceScheduledStatuses: showingFutureBoardDay,
    }),
    [visibleAssignments, showingFutureBoardDay],
  );

  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <h1>{appSummary.appName}</h1>
        </div>
        <details className="dashboard-settings-menu">
          <summary className="button secondary dashboard-settings-trigger">Settings & navigation</summary>
          <div className="dashboard-settings-popover">
            <div className="dashboard-settings-section">
              <span className="muted dashboard-settings-label">Navigate</span>
              <div className="dashboard-settings-links">
                <Link className="button primary slim" href="/admin/daily-hierarchy">Open scheduling workflow</Link>
                <Link className="button secondary slim" href="/admin/daily-hierarchy">Open organiser board</Link>
                <Link className="button secondary slim" href="/scan/assignment-1">Open cleaner QR flow</Link>
                <Link className="button secondary slim" href="/admin/manager">Open manager view</Link>
                <Link className="button secondary slim" href="/admin/inbox">Open operations inbox</Link>
                <Link className="button secondary slim" href="/admin/facilities">Manage facilities</Link>
                <Link className="button secondary slim" href="/qr-zones">QR zone codes</Link>
              </div>
            </div>
          </div>
        </details>
      </div>

      <section className="dashboard-utility-bar card">
        <div className="dashboard-update-card dashboard-update-card-inline">
          <span className="muted">Board refreshed</span>
          <strong>{formatDashboardRefreshLabel(dashboardRefreshedAt)}</strong>
          <div className="dashboard-update-meta">
            <span className="update-pill">{dashboardBoard?.source ?? 'loading'}</span>
            <span className="muted">
              {dashboardBoard?.source === 'prisma'
                ? 'Live organiser data loaded'
                : dashboardBoard?.source
                  ? 'Fallback board active while live runtime data is unavailable'
                  : 'Loading organiser data'}
            </span>
          </div>
        </div>
        <div className="dashboard-action-row">
          <span className="muted dashboard-action-row-note">Navigation moved into the Settings & navigation menu.</span>
        </div>
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
        {assignmentPresentationData.map((assignment) => (
          <FacilityBoardCard
            key={assignment.id}
            assignment={assignment}
            activeBoardDay={activeBoardDay}
            onOpenTaskCard={setActiveTaskCard}
          />
        ))}
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
                <span className="muted">Instance ID</span>
                <strong>{activeTaskCard.instanceCode ?? '—'}</strong>
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

    </main>
  );
}
