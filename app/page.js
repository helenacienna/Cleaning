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

function getUnscheduledFacilityTasks(assignment) {
  const scheduledTemplateIds = new Set(assignment.tasks.map((task) => task.templateId).filter(Boolean));

  return taskCardTemplates
    .filter((task) => task.facility === assignment.location && !scheduledTemplateIds.has(task.templateId))
    .sort((a, b) => {
      if (a.zone !== b.zone) {
        return a.zone.localeCompare(b.zone);
      }
      if (a.taskGroup !== b.taskGroup) {
        return a.taskGroup.localeCompare(b.taskGroup);
      }
      return a.title.localeCompare(b.title);
    });
}

export default function HomePage() {
  const [activeTaskCard, setActiveTaskCard] = useState(null);

  useEffect(() => {
    document.body.classList.toggle('modal-open', Boolean(activeTaskCard));
    return () => document.body.classList.remove('modal-open');
  }, [activeTaskCard]);

  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <p>{appSummary.suiteLabel}</p>
          <h1>{appSummary.appName}</h1>
        </div>
        <div className="dashboard-top-right">
          <div className="badge-row">
            <span className="badge">Mobile-first cleaner workflow</span>
            <span className="badge">Railway-ready</span>
            <span className="badge">Audit-grade history</span>
          </div>
          <div className="dashboard-update-card">
            <span className="muted">Last update</span>
            <strong>1 Jun 2026 · 12:28 PM</strong>
            <div className="muted">QR zone codes moved off the dashboard into a separate page.</div>
          </div>
        </div>
      </div>

      <section className="hero">
        <div className="card hero-copy">
          <div className="tab-row">
            <span className="tab active">Cleaner app</span>
            <span className="tab">Supervisor dashboard</span>
            <span className="tab">Admin controls</span>
          </div>
          <h2>Reusable task cards, QR zones, and proof-driven cleaning operations.</h2>
          <p>
            This first build pass is designed as a Cienna-suite style operations app: task-card based,
            schedule-aware, historically auditable, and simple enough for cleaners to move through fast.
          </p>
          <div className="kpi-grid">
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
          </div>
          <div className="cta-row">
            <a className="button primary" href="#schedule-builder">Start scheduling workflow</a>
            <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
            <Link className="button secondary" href="/scan/assignment-1">Open cleaner QR flow</Link>
            <Link className="button secondary" href="/admin/manager">Open manager view</Link>
            <Link className="button secondary" href="/admin/inbox">Open operations inbox</Link>
            <Link className="button secondary" href="/admin/task-cards">Task cards</Link>
            <Link className="button secondary" href="/qr-zones">QR zone codes</Link>
          </div>
        </div>

        <div className="card">
          <div className="panel-title">
            <div>
              <h3>Today</h3>
              <p className="muted">{appSummary.today}</p>
            </div>
            <span className="badge">Random photo verification enabled</span>
          </div>
          <div className="task-list">
            <div className="task-row">
              <div>
                <strong>Overdue tasks</strong>
                <div className="muted">Require carry-forward review</div>
              </div>
              <strong className="tone-red">{appSummary.overdueTasks}</strong>
            </div>
            <div className="task-row">
              <div>
                <strong>Audit evidence</strong>
                <div className="muted">Photos and comments attached to completions</div>
              </div>
              <strong className="tone-blue">Live</strong>
            </div>
            <div className="task-row">
              <div>
                <strong>QR zone access</strong>
                <div className="muted">Cleaner opens task list by scanning zone code</div>
              </div>
              <strong className="tone-green">Ready</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="workflow-strip">
        <div className="workflow-card">
          <span className="badge">Step 1</span>
          <strong>Build the run</strong>
          <p className="muted">Set task order, cleaner, and repeat pattern in the schedule builder.</p>
          <a className="button secondary" href="#schedule-builder">Open schedule builder</a>
        </div>
        <div className="workflow-card">
          <span className="badge">Step 2</span>
          <strong>Organise the shift</strong>
          <p className="muted">Use the organiser board as the main planning surface to drag, reorder, and shape the day.</p>
          <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
        </div>
        <div className="workflow-card">
          <span className="badge">Step 3</span>
          <strong>Manager oversight</strong>
          <p className="muted">Track published shifts, live completion, low scores, and open exceptions.</p>
          <Link className="button secondary" href="/admin/manager">Open manager view</Link>
        </div>
        <div className="workflow-card">
          <span className="badge">Step 4</span>
          <strong>Run the cleaner flow</strong>
          <p className="muted">Open the same checklist view the cleaner uses during the shift.</p>
          <Link className="button secondary" href="/scan/assignment-1">Open cleaner checklist</Link>
        </div>
      </section>

      <section className="supervisor-grid">
        {supervisorCards.map((card) => (
          <div className="card" key={card.title}>
            <span className="muted">{card.title}</span>
            <strong className={`metric tone-${card.tone}`}>{card.value}</strong>
            <div className="muted">{card.note}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="panel-title">
          <div>
            <h3>Facility board</h3>
            <p className="muted">Three live facility columns with grouped tasks, progress, and quick task-card access.</p>
          </div>
        </div>

        <div className="assignment-grid">
        {cleanerAssignments.map((assignment) => {
          const unscheduledTasks = getUnscheduledFacilityTasks(assignment);

          return (
          <div className="card" key={assignment.id}>
            <div className="facility-card-header">
              <Link className="button secondary facility-card-title-button" href={`/facility-board/${assignment.id}`}>
                {assignment.location}
              </Link>
              <p className="muted facility-card-zones">{(assignment.zones?.length ? assignment.zones : [assignment.zone]).join(' · ')}</p>
              <span className="badge facility-card-shift-badge">{assignment.shift}</span>
            </div>
            <div className="stat-row">
              <span className="flag">{assignment.stats.completed}/{assignment.stats.total} done</span>
              <span className="flag">{assignment.stats.photoRequired} photo checks</span>
            </div>
            <div className="progress"><span style={{ width: `${assignment.progress}%` }} /></div>
            <div className="qr-link-row">
              <Link className="button secondary" href={`/scan/${assignment.id}`}>Simulate QR scan</Link>
              <span className="muted">/{assignment.id}</span>
            </div>
            <div className="task-list task-list-nested">
              {groupAssignmentTasks(assignment.tasks).map((group) => (
                <details className="task-group-disclosure" key={`${assignment.id}-${group.zone}-${group.taskGroup}`}>
                  <summary className="task-group-summary">
                    <div className="task-group-summary-copy">
                      <strong>{group.taskGroup}</strong>
                      <div className="muted">{group.zone} · {group.tasks.length} tasks</div>
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
