import Link from 'next/link';
import { redirect } from 'next/navigation';
import ForceTodayRedirect from '../ForceTodayRedirect';
import CleanerChecklistModal from '../../scan/[zoneId]/CleanerChecklistModal';
import { getCleanerStaffList } from '../../../lib/cleaner-data';
import { formatBoardDayKeyForTimeZone } from '../../../lib/app-timezone.js';

export const dynamic = 'force-dynamic';

function formatTaskStatus(status = '') {
  return String(status).replace(/-/g, ' ');
}

function isCompletedTask(task) {
  return task?.status === 'completed' || Number(task?.score) >= 3;
}

function isIssueTask(task) {
  return !task?.resolvedIssue && Number(task?.score) > 0 && Number(task?.score) <= 2;
}

function getOutcomeCounts(tasks = []) {
  return tasks.reduce((counts, task) => {
    const score = Number(task?.score);
    const initialGrade = Number(task?.initialGrade);
    if (task?.resolvedIssue && initialGrade === 1) counts.resolvedGrade1 += 1;
    else if (task?.resolvedIssue && initialGrade === 2) counts.resolvedGrade2 += 1;
    else if (score >= 3 || task?.status === 'completed') counts.pass += 1;
    else if (score === 2) counts.unresolvedGrade2 += 1;
    else if (score === 1) counts.unresolvedGrade1 += 1;
    else counts.pending += 1;
    return counts;
  }, {
    resolvedGrade1: 0,
    resolvedGrade2: 0,
    pass: 0,
    pending: 0,
    unresolvedGrade2: 0,
    unresolvedGrade1: 0,
  });
}

function renderOutcomeProgressBar(tasks = []) {
  const counts = getOutcomeCounts(tasks);
  const total = Math.max(0, tasks.length);
  const segments = [
    ['resolvedGrade1', 'progress-segment-resolved-grade-1'],
    ['resolvedGrade2', 'progress-segment-resolved-grade-2'],
    ['pass', 'progress-segment-pass'],
    ['pending', 'progress-segment-pending'],
    ['unresolvedGrade2', 'progress-segment-unresolved-grade-2'],
    ['unresolvedGrade1', 'progress-segment-unresolved-grade-1'],
  ];

  return (
    <div className="progress outcome-progress">
      {segments.map(([key, className]) => counts[key] ? (
        <span key={key} className={className} style={{ width: `${total ? (counts[key] / total) * 100 : 0}%` }} />
      ) : null)}
    </div>
  );
}

function shortenFacilityName(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  const aliasMap = {
    'Cienna Central': 'Boheme',
    'Cienna North': 'Cienna',
    'Cienna South': 'Best Stays',
  };

  const aliased = aliasMap[trimmed] || trimmed;
  return aliased.length > 12 ? aliased.slice(0, 12).trim() : aliased;
}

function getWeeklyShiftDisplay(day) {
  if (!day?.isWorking) {
    return { start: 'Off', finish: '—' };
  }

  if (day.startLabel || day.finishLabel) {
    return {
      start: day.startLabel || 'On',
      finish: day.finishLabel || '—',
    };
  }

  const firstLine = day.shiftLines?.[0] || '';
  const [facilityRaw = '', timeRaw = ''] = firstLine.split(' · ');
  const rawWindow = timeRaw || day.summary || '';
  const [startRaw = '', finishRaw = ''] = rawWindow.split('–');

  return {
    start: startRaw || 'On',
    finish: finishRaw || shortenFacilityName(facilityRaw) || '—',
  };
}

function formatShiftTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Brisbane',
  }).format(date).replace(' am', 'am').replace(' pm', 'pm');
}

function groupFacilityTasks(tasks = []) {
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
    const completed = group.tasks.filter((task) => isCompletedTask(task)).length;
    const issues = group.tasks.filter((task) => isIssueTask(task)).length;
    const total = group.tasks.length;
    return {
      ...group,
      completed,
      issues,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });
}

function buildDayHref(staffSlug, day, { historic = false } = {}) {
  if (!day) {
    return `/cleaner/${staffSlug}`;
  }

  const params = new URLSearchParams({ day });
  if (historic) {
    params.set('view', 'history');
  }

  return `/cleaner/${staffSlug}?${params.toString()}`;
}

export async function generateMetadata({ params }) {
  const { staffSlug } = await params;
  const { list } = await getCleanerStaffList(staffSlug);
  return {
    title: list ? `${list.staff} · My Work` : 'Cleaner list',
  };
}

export default async function CleanerStaffListPage({ params, searchParams }) {
  const { staffSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedDay = typeof resolvedSearchParams?.day === 'string' ? resolvedSearchParams.day : '';
  const allowHistoricView = resolvedSearchParams?.view === 'history';
  const { list, source, timeZone } = await getCleanerStaffList(staffSlug, selectedDay);

  if (!list) {
    return (
      <main className="page compact-page">
        <section className="card">
          <span className="badge">Staff list not found</span>
          <h1>Unknown staff list</h1>
          <p className="muted">This staff link does not match an active cleaner list.</p>
          <Link className="button primary" href="/cleaner">Back to staff landing</Link>
        </section>
      </main>
    );
  }

  const boardDays = list.boardDays ?? [];
  const activeBoardDay = list.activeBoardDay ?? null;
  const activeBoardDayIndex = boardDays.findIndex((day) => day === activeBoardDay);
  const previousBoardDay = activeBoardDayIndex > 0 ? boardDays[activeBoardDayIndex - 1] : null;
  const nextBoardDay = activeBoardDayIndex >= 0 && activeBoardDayIndex < boardDays.length - 1 ? boardDays[activeBoardDayIndex + 1] : null;
  const todayBoardDay = formatBoardDayKeyForTimeZone(new Date(), timeZone);
  const todayHref = boardDays.includes(todayBoardDay) ? buildDayHref(staffSlug, todayBoardDay) : null;
  const isTodayBoard = activeBoardDay === todayBoardDay;

  if (todayHref && activeBoardDay !== todayBoardDay && (!selectedDay || !allowHistoricView)) {
    redirect(todayHref);
  }

  return (
    <main className="page dashboard-page compact-page cleaner-staff-page">
      <ForceTodayRedirect enabled={Boolean(todayHref && activeBoardDay !== todayBoardDay && selectedDay && !allowHistoricView)} href={todayHref ?? ''} />
      <section className="card scan-hero" style={{ marginBottom: 16 }}>
        <div className="scan-header" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h1>{list.staff}</h1>
            {list.weeklyShifts?.length ? (
              <div className="staff-week-strip">
                {list.weeklyShifts.map((day) => {
                  const display = getWeeklyShiftDisplay(day);
                  return (
                  <div
                    key={day.boardDayKey}
                    className={`staff-week-day ${day.boardDayKey === activeBoardDay ? 'staff-week-day-current' : ''} ${day.isWorking ? '' : 'staff-week-day-off'}`}
                  >
                    <strong>{day.label}</strong>
                    <span className="staff-week-time">{display.start}</span>
                    <em>{display.finish}</em>
                  </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {renderOutcomeProgressBar(list.sections.flatMap((section) => section.tasks))}
        <div className="stat-row cleaner-stat-row">
          <span className="flag">{list.stats.completed}/{list.stats.total} completed</span>
          <span className="flag">{list.stats.photoRequired} photo checks</span>
          <span className="flag">{list.stats.commentRequired} comment checks</span>
        </div>
      </section>

      <div className="assignment-grid">
        {list.sections.map((section) => {
          const taskGroups = groupFacilityTasks(section.tasks);
          const zoneCount = new Set(section.tasks.map((task) => task.zone).filter(Boolean)).size;

          return (
            <div className="card facility-board-card" key={section.facility}>
              <div className="facility-card-header">
                <div>
                  <div className="button secondary facility-card-title-button" style={{ pointerEvents: 'none' }}>
                    {section.facility}
                  </div>
                  {section.shiftStartAt || section.shiftEndAt ? (
                    <div className="muted" style={{ marginTop: 6, display: 'grid', gap: 2 }}>
                      {section.shiftStartAt ? <div>{formatShiftTime(section.shiftStartAt)}</div> : null}
                      {section.shiftEndAt ? <div>{formatShiftTime(section.shiftEndAt)}</div> : null}
                    </div>
                  ) : section.shiftWindow ? <div className="muted" style={{ marginTop: 6 }}>{section.shiftWindow}</div> : null}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                {isTodayBoard ? (
                  <CleanerChecklistModal tasks={section.tasks} label={section.facility} staffName={list.staff} />
                ) : (
                  <section className="card checklist-launch-card">
                    {todayHref ? (
                      <Link className="button secondary launch-checklist-button" href={todayHref}>
                        Back to today
                      </Link>
                    ) : null}
                  </section>
                )}
              </div>

              <div className="task-list task-list-nested">
                <details className="task-group-disclosure facility-section facility-section-daily" open>
                  <summary className="task-group-summary">
                    <div className="task-group-summary-copy">
                      <strong>Assigned work</strong>
                      <div className="muted">{zoneCount} zones · {section.stats.total} tasks in this facility</div>
                      <div className="task-group-progress-row">
                        {renderOutcomeProgressBar(section.tasks)}
                        <span className="task-group-progress-label">{section.stats.completed}/{section.stats.total} completed</span>
                      </div>
                    </div>
                    <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                  </summary>

                  <div className="task-group-body">
                    {taskGroups.map((group) => (
                      <details className="task-disclosure task-disclosure-compact" key={`${section.facility}-${group.zone}-${group.taskGroup}`}>
                        <summary className="task-row task-row-disclosure task-row-disclosure-compact task-group-summary-row">
                          <div>
                            <strong>{group.taskGroup}</strong>
                            <div className="muted">{group.zone}</div>
                          </div>
                          <div className="task-disclosure-summary-right task-disclosure-summary-right-compact task-group-summary-right">
                            <span className="task-group-progress-label">{group.completed}/{group.total} completed</span>
                            <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                          </div>
                        </summary>

                        <div className="task-disclosure-body">
                          {group.tasks.map((task) => (
                            <details className="task-disclosure task-disclosure-compact" key={task.id}>
                              <summary className="task-row task-row-disclosure task-row-disclosure-compact">
                                <div className="task-inline-main">
                                  <span className="task-inline-order">#{String(task.displayOrder).padStart(3, '0')}</span>
                                  <strong>{task.title}</strong>
                                </div>
                                <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
                                  {task.photoRequired ? <span className="flag task-inline-flag">Photo</span> : null}
                                  {task.commentRequired ? <span className="flag task-inline-flag">Comment</span> : null}
                                  <span className={`task-status status-${task.status} task-inline-status`}>{formatTaskStatus(task.status)}</span>
                                  <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                                </div>
                              </summary>

                              <div className="task-disclosure-body">
                                <div className="task-detail-grid">
                                  <div>
                                    <span className="muted">Zone</span>
                                    <strong>{task.zone}</strong>
                                  </div>
                                  <div>
                                    <span className="muted">Group</span>
                                    <strong>{task.taskGroup}</strong>
                                  </div>
                                  <div>
                                    <span className="muted">Status</span>
                                    <strong>{formatTaskStatus(task.status)}</strong>
                                  </div>
                                  <div>
                                    <span className="muted">Requirements</span>
                                    <strong>
                                      {task.photoRequired ? 'Photo' : 'Standard'}
                                      {task.commentRequired ? ' · Comment' : ''}
                                    </strong>
                                  </div>
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky-board-action-bar sticky-board-action-bar-staff">
        <div className="sticky-board-nav-row">
          {previousBoardDay ? (
            <Link className="button secondary slim sticky-board-nav-button" href={buildDayHref(staffSlug, previousBoardDay, { historic: true })}>← Prev</Link>
          ) : (
            <span className="button secondary slim sticky-board-nav-button sticky-board-link-disabled" aria-disabled="true">← Prev</span>
          )}
          <div className="button secondary slim sticky-board-nav-date">{list.day ?? 'Current run'}</div>
          {nextBoardDay ? (
            <Link className="button secondary slim sticky-board-nav-button" href={buildDayHref(staffSlug, nextBoardDay, { historic: true })}>Next →</Link>
          ) : (
            <span className="button secondary slim sticky-board-nav-button sticky-board-link-disabled" aria-disabled="true">Next →</span>
          )}
        </div>
        <div className="sticky-board-center-stack">
          {todayHref && activeBoardDay !== todayBoardDay ? (
            <Link className="button secondary slim sticky-board-today-button" href={todayHref}>Back to today</Link>
          ) : (
            <span className="button secondary slim sticky-board-today-button sticky-board-link-disabled" aria-disabled="true">Back to today</span>
          )}
        </div>
      </div>
    </main>
  );
}
