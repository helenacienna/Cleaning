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
  return Number(task?.score) > 0 && Number(task?.score) <= 2;
}

function renderProgressBar(completed, total, issues = 0) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const completedWidth = safeTotal ? Math.max(0, Math.min(100, Math.round((completed / safeTotal) * 100))) : 0;
  const issueWidth = safeTotal ? Math.max(0, Math.min(100, Math.round((issues / safeTotal) * 100))) : 0;

  return (
    <div className="progress progress-with-issues">
      <span style={{ width: `${completedWidth}%` }} />
      {issueWidth ? <em style={{ width: `${issueWidth}%` }} /> : null}
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
            <p className="muted">Your assigned facilities, shown in a board-style layout.</p>
          </div>
          <div className="workflow-banner-actions" style={{ justifyContent: 'center' }}>
            <Link className="button secondary" href="/cleaner">All staff lists</Link>
            <Link className="button secondary" href="/">Admin dashboard</Link>
          </div>
        </div>

        <div className="cleaner-strip">
          <div>
            <span className="muted">Day</span>
            <strong>{list.day ?? 'Current run'}</strong>
          </div>
          <div>
            <span className="muted">Shift</span>
            <strong>{list.shift}</strong>
          </div>
          <div>
            <span className="muted">Roster</span>
            <strong>{list.roster?.summary || 'Not set yet'}</strong>
          </div>
        </div>
        {renderProgressBar(list.stats.completed, list.stats.total, list.stats.issues)}
        <div className="stat-row">
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
                  {section.shiftWindow ? <div className="muted" style={{ marginTop: 6 }}>{section.shiftWindow}</div> : null}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                {isTodayBoard ? (
                  <CleanerChecklistModal tasks={section.tasks} label={section.facility} />
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
                        <div className="task-group-progress task-group-progress-with-issues">
                          <span style={{ width: `${section.stats.total ? Math.round((section.stats.completed / section.stats.total) * 100) : 0}%` }} />
                          {section.stats.issues ? <em style={{ width: `${section.stats.total ? Math.round((section.stats.issues / section.stats.total) * 100) : 0}%` }} /> : null}
                        </div>
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
        {previousBoardDay ? (
          <Link className="button secondary slim" href={buildDayHref(staffSlug, previousBoardDay, { historic: true })}>← Prev</Link>
        ) : (
          <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">← Prev</span>
        )}
        <div className="sticky-board-center-stack">
          <div className="sticky-board-date">{list.day ?? 'Current run'}</div>
          {todayHref && activeBoardDay !== todayBoardDay ? (
            <Link className="button secondary slim sticky-board-today-button" href={todayHref}>Back to today</Link>
          ) : (
            <span className="button secondary slim sticky-board-today-button sticky-board-link-disabled" aria-disabled="true">Back to today</span>
          )}
        </div>
        {nextBoardDay ? (
          <Link className="button secondary slim" href={buildDayHref(staffSlug, nextBoardDay, { historic: true })}>Next →</Link>
        ) : (
          <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">Next →</span>
        )}
      </div>
    </main>
  );
}
