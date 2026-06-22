import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrganiserBoardData } from '../../../lib/app-data';
import { DEFAULT_APP_TIME_ZONE, formatBoardDayKeyForTimeZone, getTimeZoneFormatter } from '../../../lib/app-timezone.js';

export const dynamic = 'force-dynamic';

const FACILITY_NAME_ALIASES = {
  'Cienna North': 'Cienna',
  'Cienna Central': 'Boheme',
  'Cienna South': 'Best Stays',
};

const FACILITY_ROUTE_ALIASES = {
  'assignment-1': 'cienna',
  'assignment-2': 'boheme',
  'assignment-3': 'holiday',
  'board-cienna': 'cienna',
  'board-boheme': 'boheme',
  'board-holiday': 'holiday',
};

function getFacilityDisplayName(value = '') {
  return FACILITY_NAME_ALIASES[value] ?? value;
}

function slugifyValue(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeFacilityRouteId(value = '') {
  return FACILITY_ROUTE_ALIASES[value] ?? value;
}

function statusClass(status) {
  return `task-status status-${status}`;
}

function formatTaskLabel(status = '') {
  return status.replace('-', ' ');
}

function normalizeTaskStatus(status = '') {
  if (status === 'in_progress') {
    return 'in-progress';
  }

  if (status === 'carried_forward') {
    return 'carried-forward';
  }

  return status;
}

function formatAssignedStaffLabel(tasks = []) {
  const staffNames = [...new Set(tasks.map((task) => task.staff || 'Unallocated'))];
  const allocatedStaffNames = staffNames.filter((staff) => staff !== 'Unallocated');

  const displayNames = allocatedStaffNames.length ? allocatedStaffNames : staffNames;

  if (!displayNames.length) {
    return 'Unallocated';
  }

  if (displayNames.length === 1) {
    return displayNames[0];
  }

  if (displayNames.length === 2) {
    return `${displayNames[0]} + ${displayNames[1]}`;
  }

  return `${displayNames[0]} + ${displayNames.length - 1} more`;
}

function formatGroupStatusLabel(tasks = []) {
  if (!tasks.length) {
    return 'On board';
  }

  if (tasks.every((task) => task.status === 'completed')) {
    return 'Completed';
  }

  if (tasks.some((task) => task.status === 'in-progress')) {
    return 'In progress';
  }

  if (tasks.some((task) => task.status === 'carried-forward')) {
    return 'Carried forward';
  }

  if (tasks.some((task) => task.status === 'overdue')) {
    return 'Overdue';
  }

  return 'On board';
}

function formatGroupSummaryLabel(tasks = []) {
  return `${formatGroupStatusLabel(tasks)} ${formatAssignedStaffLabel(tasks)}`;
}

function formatBoardDateLabel(dayKey, timeZone = DEFAULT_APP_TIME_ZONE) {
  if (!dayKey) {
    return 'No board day selected';
  }

  const date = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return dayKey;
  }

  return getTimeZoneFormatter('en-AU', timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date).replace(',', '');
}

function groupStatusToneClass(tasks = []) {
  return `facility-board-group-tone-${slugifyValue(formatGroupStatusLabel(tasks))}`;
}

function formatMinutesLabel(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '0m';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatClockLabel(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) {
    return '—';
  }

  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')}${suffix}`;
}

function floorToHour(totalMinutes) {
  return Math.floor(totalMinutes / 60) * 60;
}

function ceilToHour(totalMinutes) {
  return Math.ceil(totalMinutes / 60) * 60;
}

function floorToStep(totalMinutes, stepMinutes) {
  return Math.floor(totalMinutes / stepMinutes) * stepMinutes;
}

function ceilToStep(totalMinutes, stepMinutes) {
  return Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
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

function groupTasksByStaff(tasks = [], staffMeta = {}) {
  const staffMap = new Map();

  tasks.forEach((task) => {
    const staff = task.staff || 'Unallocated';
    if (!staffMap.has(staff)) {
      staffMap.set(staff, []);
    }

    staffMap.get(staff).push(task);
  });

  return Array.from(staffMap.entries())
    .map(([staff, staffTasks]) => {
      const groups = groupAssignmentTasks(staffTasks);
      const completed = staffTasks.filter((task) => task.status === 'completed').length;
      const total = staffTasks.length;
      const totalZones = new Set(staffTasks.map((task) => task.zone)).size;
      const estimatedMinutes = staffTasks.reduce((sum, task) => sum + (Number(task.estimatedMinutes) || 0), 0);
      const shiftMinutes = Number(staffMeta?.[staff]?.shiftMinutes) || 0;

      return {
        staff,
        tasks: staffTasks,
        groups,
        completed,
        total,
        totalZones,
        shiftWindow: staffMeta?.[staff]?.shiftWindow || 'Flexible shift',
        estimatedMinutes,
        shiftMinutes,
        shiftStartMinutes: staffMeta?.[staff]?.shiftStartMinutes ?? null,
        shiftEndMinutes: staffMeta?.[staff]?.shiftEndMinutes ?? null,
        estimatedUtilisation: shiftMinutes > 0 ? Math.round((estimatedMinutes / shiftMinutes) * 100) : null,
        progress: total ? Math.round((completed / total) * 100) : 0,
      };
    })
    .sort((left, right) => {
      if (left.staff === 'Unallocated') return 1;
      if (right.staff === 'Unallocated') return -1;
      return left.staff.localeCompare(right.staff);
    });
}

function getActiveBoardDay(days = [], requestedDay, timeZone = DEFAULT_APP_TIME_ZONE) {
  if (requestedDay && days.includes(requestedDay)) {
    return requestedDay;
  }

  const today = formatBoardDayKeyForTimeZone(new Date(), timeZone);

  if (days.includes(today)) {
    return today;
  }

  return days[days.length - 1] ?? null;
}

function buildFacilityAssignmentFromBoard(board, assignmentId, boardDay) {
  if (!board?.cards?.length || !boardDay) {
    return null;
  }

  const tasks = board.cards
    .filter((card) => card.day === boardDay)
    .filter((card) => slugifyValue(getFacilityDisplayName(card.facility)) === assignmentId)
    .sort((left, right) => left.jobOrder - right.jobOrder)
    .map((card) => ({
      id: card.id,
      title: card.title,
      status: normalizeTaskStatus(card.status),
      photoRequired: String(card.required || '').toLowerCase().includes('photo'),
      commentRequired: Boolean(card.issueNote),
      taskGroup: card.groupName || card.taskGroup,
      score: card.auditScore ?? null,
      zone: card.zone,
      staff: card.staff || 'Unallocated',
      displayOrder: card.jobOrder,
      frequency: card.frequency,
      estimatedMinutes: card.estimatedMinutes,
      issueNote: card.issueNote,
    }));

  if (!tasks.length) {
    return null;
  }

  const location = getFacilityDisplayName(tasks[0]?.facility ?? board.cards.find((card) => slugifyValue(getFacilityDisplayName(card.facility)) === assignmentId)?.facility ?? assignmentId);
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const photoRequired = tasks.filter((task) => task.photoRequired).length;
  const staffSet = new Set(tasks.map((task) => task.staff).filter((staff) => staff && staff !== 'Unallocated'));
  const unallocated = tasks.filter((task) => !task.staff || task.staff === 'Unallocated').length;

  return {
    id: assignmentId,
    location,
    shift: staffSet.size > 1 ? 'Multi-staff facility view' : Array.from(staffSet)[0] ?? 'Unallocated',
    boardDay,
    tasks,
    progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    stats: {
      total: tasks.length,
      completed,
      photoRequired,
      staffCount: staffSet.size,
      unallocated,
    },
  };
}

export async function generateMetadata({ params }) {
  const { assignmentId } = await params;
  const resolvedAssignmentId = normalizeFacilityRouteId(assignmentId);
  const { board } = await getOrganiserBoardData();
  const assignment = buildFacilityAssignmentFromBoard(board, resolvedAssignmentId, getActiveBoardDay(board?.days ?? [], undefined, board?.timeZone ?? DEFAULT_APP_TIME_ZONE));

  return {
    title: assignment ? `${assignment.location} · Facility board` : 'Facility board',
  };
}

export default async function FacilityBoardPage({ params, searchParams }) {
  const { assignmentId } = await params;
  const resolvedAssignmentId = normalizeFacilityRouteId(assignmentId);
  const resolvedSearchParams = await searchParams;
  const requestedDay = typeof resolvedSearchParams?.day === 'string' ? resolvedSearchParams.day : null;
  const view = resolvedSearchParams?.view === 'staff' ? 'staff' : resolvedSearchParams?.view === 'time' ? 'time' : 'tasks';
  const { board, source } = await getOrganiserBoardData();
  const timeZone = board?.timeZone ?? DEFAULT_APP_TIME_ZONE;
  const boardDay = getActiveBoardDay(board?.days ?? [], requestedDay, timeZone);
  const assignment = buildFacilityAssignmentFromBoard(board, resolvedAssignmentId, boardDay);

  if (!assignment) {
    notFound();
  }

  const grouped = groupAssignmentTasks(assignment.tasks);
  const groupedByStaff = groupTasksByStaff(assignment.tasks, board?.staffMeta);
  const totalZones = new Set(grouped.map((group) => group.zone)).size;
  const boardDays = board?.days ?? [];
  const activeBoardDayIndex = boardDays.indexOf(assignment.boardDay);
  const previousBoardDay = activeBoardDayIndex > 0 ? boardDays[activeBoardDayIndex - 1] : null;
  const nextBoardDay = activeBoardDayIndex >= 0 && activeBoardDayIndex < boardDays.length - 1 ? boardDays[activeBoardDayIndex + 1] : null;
  const todayBoardDay = getActiveBoardDay(boardDays, undefined, timeZone);
  const queryBase = `?day=${assignment.boardDay}`;
  const positionedStaff = groupedByStaff.filter((staffGroup) => Number.isFinite(staffGroup.shiftStartMinutes) && Number.isFinite(staffGroup.shiftEndMinutes) && staffGroup.shiftEndMinutes > staffGroup.shiftStartMinutes);
  const unpositionedStaff = groupedByStaff.filter((staffGroup) => !(Number.isFinite(staffGroup.shiftStartMinutes) && Number.isFinite(staffGroup.shiftEndMinutes) && staffGroup.shiftEndMinutes > staffGroup.shiftStartMinutes));
  const defaultEarliestMinute = 360;
  const defaultLatestMinute = 1080;
  const rawEarliestShiftMinute = positionedStaff.length ? Math.min(...positionedStaff.map((staffGroup) => staffGroup.shiftStartMinutes)) : defaultEarliestMinute;
  const rawLatestShiftMinute = positionedStaff.length ? Math.max(...positionedStaff.map((staffGroup) => staffGroup.shiftEndMinutes)) : defaultLatestMinute;
  const scaleStepMinutes = rawLatestShiftMinute - rawEarliestShiftMinute <= 360 ? 15 : rawLatestShiftMinute - rawEarliestShiftMinute <= 720 ? 30 : 60;
  const earliestShiftMinute = Math.min(defaultEarliestMinute, floorToStep(rawEarliestShiftMinute, scaleStepMinutes));
  const latestShiftMinute = Math.max(defaultLatestMinute, ceilToStep(rawLatestShiftMinute, scaleStepMinutes));
  const timelineRangeMinutes = Math.max(60, latestShiftMinute - earliestShiftMinute);
  const timeMarks = Array.from({ length: Math.floor(timelineRangeMinutes / scaleStepMinutes) + 1 }, (_, index) => earliestShiftMinute + (index * scaleStepMinutes));
  const basePixelsPerMinute = timelineRangeMinutes <= 360 ? 3.2 : timelineRangeMinutes <= 720 ? 2.5 : 2;
  const minShiftCardHeight = 160;
  const requiredPixelsPerMinute = positionedStaff.length
    ? Math.max(...positionedStaff.map((staffGroup) => {
        const shiftDurationMinutes = Math.max(1, staffGroup.shiftEndMinutes - staffGroup.shiftStartMinutes);
        return minShiftCardHeight / shiftDurationMinutes;
      }))
    : 0;
  const pixelsPerMinute = Math.max(basePixelsPerMinute, requiredPixelsPerMinute);
  const timelineHeight = Math.max(720, Math.round(timelineRangeMinutes * pixelsPerMinute));
  const tickHeight = Math.max(24, Math.round(scaleStepMinutes * pixelsPerMinute));

  return (
    <main className="page facility-board-detail-shell">
      <section className="card facility-board-detail-hero">
        <div className="facility-board-detail-top">
          <div className="facility-board-detail-title-block">
            <span className="badge">{source === 'prisma' ? 'Facility board · live' : 'Facility board · demo task content'}</span>
            <h1>{assignment.location}</h1>
            <p className="muted">Board day {assignment.boardDay} · {totalZones} zones · {assignment.stats.staffCount || 0} assigned staff</p>
          </div>
          <div className="cta-row no-top-gap facility-board-detail-actions">
            <Link className="button secondary" href="/">Back to dashboard</Link>
            <Link className="button secondary" href="/">Organise from dashboard</Link>
            <Link className={`button ${view === 'tasks' ? 'primary' : 'secondary'}`} href={`${queryBase}&view=tasks`}>Task view</Link>
            <Link className={`button ${view === 'staff' ? 'primary' : 'secondary'}`} href={`${queryBase}&view=staff`}>Staff view</Link>
            <Link className={`button ${view === 'time' ? 'primary' : 'secondary'}`} href={`${queryBase}&view=time`}>Time view</Link>
          </div>
        </div>

        <div className="progress"><span style={{ width: `${assignment.progress}%` }} /></div>
      </section>

      {source !== 'prisma' && (
        <section className="card" style={{ marginBottom: 16 }}>
          <strong>Live assignment data unavailable</strong>
          <div className="muted">This detail view is using demo task content until the runtime assignment path is available.</div>
        </section>
      )}

      {view === 'tasks' ? (
        <section className="facility-board-detail-zones">
          {grouped.map((group) => (
            <article className="card facility-board-zone-card" key={`${assignment.id}-${group.zone}-${group.taskGroup}`}>
              <div className="facility-board-zone-header">
                <div className="facility-board-zone-title">
                  <h3>{group.taskGroup}</h3>
                  <p className="muted">{group.zone}</p>
                </div>
                <div className="badge">{formatGroupSummaryLabel(group.tasks)}</div>
              </div>

              <div className="progress"><span style={{ width: `${group.progress}%` }} /></div>

              <div className="facility-board-task-list">
                {group.tasks.map((task) => (
                  <div className="task-row facility-board-task-row" key={task.id}>
                    <div>
                      <strong>#{String(task.displayOrder).padStart(3, '0')} · {task.title}</strong>
                      <div className="facility-board-task-meta-row">
                        <span className="flag">{task.staff || 'Unallocated'}</span>
                        {task.photoRequired ? <span className="flag">Photo</span> : null}
                        {task.commentRequired ? <span className="flag">Comment</span> : null}
                      </div>
                    </div>
                    <span className={`${statusClass(task.status)}`}>{formatTaskLabel(task.status)}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : view === 'staff' ? (
        <section className="facility-board-staff-grid">
          {groupedByStaff.map((staffGroup) => (
            <article className={`card facility-board-staff-card staff-theme-${slugifyValue(staffGroup.staff)}`} key={`${assignment.id}-${staffGroup.staff}`}>
              <div className="facility-board-staff-header">
                <div>
                  <h3>{staffGroup.staff}</h3>
                  <p className="muted">{staffGroup.shiftWindow}</p>
                  <p className="muted">{staffGroup.totalZones} zones · {staffGroup.total} tasks</p>
                  <p className="muted facility-board-staff-time-summary">Est. {formatMinutesLabel(staffGroup.estimatedMinutes)} · Shift {formatMinutesLabel(staffGroup.shiftMinutes)} · {staffGroup.estimatedUtilisation ?? 0}%</p>
                </div>
                <div className="badge">{staffGroup.completed}/{staffGroup.total} complete</div>
              </div>

              <div className="progress"><span style={{ width: `${staffGroup.progress}%` }} /></div>

              <div className="facility-board-staff-task-list">
                {staffGroup.tasks.map((task) => (
                  <div className="task-row facility-board-task-row" key={task.id}>
                    <div>
                      <strong>#{String(task.displayOrder).padStart(3, '0')} · {task.title}</strong>
                      <div className="muted">{task.zone} · {task.taskGroup}</div>
                      <div className="facility-board-task-meta-row">
                        {task.photoRequired ? <span className="flag">Photo</span> : null}
                        {task.commentRequired ? <span className="flag">Comment</span> : null}
                      </div>
                    </div>
                    <span className={`${statusClass(task.status)}`}>{formatTaskLabel(task.status)}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="facility-board-time-shell card">
          <div className="facility-board-time-grid" style={{ '--time-view-height': `${timelineHeight}px`, '--time-view-step-height': `${tickHeight}px` }}>
            <div className="facility-board-time-axis">
              <div className="facility-board-time-axis-inner">
                {timeMarks.map((minuteMark) => {
                  const topOffset = ((minuteMark - earliestShiftMinute) / timelineRangeMinutes) * timelineHeight;
                  const isHourMark = minuteMark % 60 === 0;
                  return (
                    <div className={`facility-board-time-tick ${isHourMark ? 'is-hour' : 'is-half-hour'}`} key={minuteMark} style={{ top: `${topOffset}px` }}>
                      <span>{isHourMark || scaleStepMinutes < 30 ? formatClockLabel(minuteMark) : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="facility-board-time-columns">
              {positionedStaff.map((staffGroup) => {
                const topOffset = ((staffGroup.shiftStartMinutes - earliestShiftMinute) / timelineRangeMinutes) * timelineHeight;
                const cardHeight = ((staffGroup.shiftEndMinutes - staffGroup.shiftStartMinutes) / timelineRangeMinutes) * timelineHeight;

                return (
                  <div className="facility-board-time-column" key={`${assignment.id}-${staffGroup.staff}`}>
                    <div className="facility-board-time-track" />
                    <article
                      className={`card facility-board-staff-card facility-board-time-card staff-theme-${slugifyValue(staffGroup.staff)}`}
                      style={{ top: `${topOffset}px`, minHeight: `${cardHeight}px`, height: `${cardHeight}px` }}
                    >
                      <div className="facility-board-staff-header">
                        <div>
                          <h3>{staffGroup.staff}</h3>
                          <p className="muted">{staffGroup.shiftWindow}</p>
                          <p className="muted">{staffGroup.totalZones} zones · {staffGroup.total} tasks</p>
                          <p className="muted facility-board-staff-time-summary">Est. {formatMinutesLabel(staffGroup.estimatedMinutes)} · Shift {formatMinutesLabel(staffGroup.shiftMinutes)} · {staffGroup.estimatedUtilisation ?? 0}%</p>
                        </div>
                        <div className="badge">{staffGroup.completed}/{staffGroup.total} complete</div>
                      </div>

                      <div className="progress"><span style={{ width: `${staffGroup.progress}%` }} /></div>

                      <div className="facility-board-staff-groups facility-board-time-groups">
                        {staffGroup.groups.map((group) => (
                          <div className={`facility-board-staff-group ${groupStatusToneClass(group.tasks)}`} key={`${staffGroup.staff}-${group.zone}-${group.taskGroup}`}>
                            <div className="facility-board-zone-header">
                              <div className="facility-board-zone-title">
                                <h3>{group.taskGroup}</h3>
                                <p className="muted">{group.zone}</p>
                              </div>
                              <div className="badge">{group.completed}/{group.total}</div>
                            </div>
                            <div className="progress"><span style={{ width: `${group.progress}%` }} /></div>
                            <div className="muted">{formatGroupStatusLabel(group.tasks)} · {group.total} tasks</div>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>

          {unpositionedStaff.length ? (
            <div className="facility-board-time-unplaced">
              <strong>Staff without shift times</strong>
              <div className="muted">These staff don&apos;t have a usable start/finish time yet, so they can&apos;t be placed on the time scale.</div>
              <div className="facility-board-time-unplaced-list">
                {unpositionedStaff.map((staffGroup) => (
                  <span className={`button slim staff-tag ${staffGroup.staff === 'Unallocated' ? 'secondary' : 'primary'} ${staffGroup.staff !== 'Unallocated' ? `staff-theme-${slugifyValue(staffGroup.staff)}` : ''}`} key={`${assignment.id}-${staffGroup.staff}-unplaced`}>
                    {staffGroup.staff}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      <div className="sticky-board-action-bar facility-board-day-nav-bar">
        {previousBoardDay ? (
          <Link className="button secondary slim" href={`?day=${previousBoardDay}&view=${view}`}>
            ← Prev
          </Link>
        ) : (
          <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">
            ← Prev
          </span>
        )}
        <div className="sticky-board-center-stack facility-board-day-nav-center">
          <div className="sticky-board-date">{formatBoardDateLabel(assignment.boardDay, timeZone)}</div>
          <div className="facility-board-day-chip-row">
            {boardDays.map((day) => (
              <Link
                key={day}
                className={`button slim ${day === assignment.boardDay ? 'primary' : 'secondary'}`}
                href={`?day=${day}&view=${view}`}
              >
                {formatBoardDateLabel(day, timeZone)}
              </Link>
            ))}
          </div>
          {todayBoardDay && todayBoardDay !== assignment.boardDay ? (
            <Link className="button secondary slim sticky-board-today-button" href={`?day=${todayBoardDay}&view=${view}`}>
              Back to today
            </Link>
          ) : null}
        </div>
        {nextBoardDay ? (
          <Link className="button secondary slim" href={`?day=${nextBoardDay}&view=${view}`}>
            Next →
          </Link>
        ) : (
          <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">
            Next →
          </span>
        )}
      </div>
    </main>
  );
}
