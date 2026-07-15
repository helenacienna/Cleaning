import Link from 'next/link';
import ViewOptionsMenu from './ViewOptionsMenu';
import ExtraTaskScheduleCard from './ExtraTaskScheduleCard';
import ExpandAllZonesButton from './ExpandAllZonesButton';
import FacilityTaskOrderView from './FacilityTaskOrderView';
import { taskCardTemplates as demoTaskCardTemplates } from '../../../data/demo-data';
import { notFound } from 'next/navigation';
import { getOrganiserBoardData } from '../../../lib/app-data';
import { DEFAULT_APP_TIME_ZONE, formatBoardDayKeyForTimeZone, getTimeZoneFormatter } from '../../../lib/app-timezone.js';
import { getOutcomeCompletedCount, getOutcomeCounts, OUTCOME_PROGRESS_SEGMENTS } from '../../../lib/task-outcomes.js';

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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseScheduleDate(value) {
  if (!value || value === '—' || value === 'As triggered') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function parseBoardDayDate(dayKey) {
  return dayKey ? new Date(`${dayKey}T00:00:00+10:00`) : new Date();
}

function formatLastCompletedAge(value, baseDate = new Date()) {
  const days = diffInDays(parseScheduleDate(value), baseDate);
  if (days === null) return 'Not completed yet';
  if (days === 0) return 'Done today';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `In ${days} days`;
}

function formatNextScheduleTiming(value, baseDate = new Date()) {
  const days = diffInDays(parseScheduleDate(value), baseDate);
  if (days === null) return 'Triggered manually';
  if (days === 0) return 'Due today';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `Due in ${days} days`;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getStandbySuitability(task, baseDate = new Date()) {
  const nextDueDate = parseScheduleDate(task.suggestedDue);
  const lastCompletedDate = parseScheduleDate(task.lastCompleted);
  const daysUntilDue = diffInDays(nextDueDate, baseDate);
  const daysSinceDone = lastCompletedDate ? Math.max(0, -diffInDays(lastCompletedDate, baseDate)) : 999;
  const estimatedMinutes = Number(task.estimatedMinutes) || 0;

  let urgencyScore = 20;
  if (daysUntilDue === null) urgencyScore = 45;
  else if (daysUntilDue <= 0) urgencyScore = 100;
  else if (daysUntilDue <= 2) urgencyScore = 85;
  else if (daysUntilDue <= 7) urgencyScore = 65;
  else if (daysUntilDue <= 14) urgencyScore = 45;

  let staleScore = 35;
  if (!lastCompletedDate) staleScore = 100;
  else if (daysSinceDone >= 30) staleScore = 90;
  else if (daysSinceDone >= 14) staleScore = 70;
  else if (daysSinceDone >= 7) staleScore = 50;
  else if (daysSinceDone >= 3) staleScore = 30;
  else staleScore = 10;

  let effortScore = 60;
  if (!estimatedMinutes) effortScore = 50;
  else if (estimatedMinutes <= 10) effortScore = 100;
  else if (estimatedMinutes <= 20) effortScore = 80;
  else if (estimatedMinutes <= 30) effortScore = 60;
  else if (estimatedMinutes <= 45) effortScore = 40;
  else effortScore = 20;

  const score = clampScore((urgencyScore * 0.45) + (staleScore * 0.35) + (effortScore * 0.20));
  const label = score >= 80 ? 'Strong standby' : score >= 60 ? 'Good standby' : score >= 40 ? 'Possible standby' : 'Low standby';
  return { score, label, urgencyScore, staleScore, effortScore, daysUntilDue, daysSinceDone };
}

function getLastCompletedSortValue(task) {
  const days = diffInDays(parseScheduleDate(task.lastCompleted));
  return days === null ? -1 : -days;
}

function getExtraFacilityTasks(assignment, options = {}) {
  const scheduledTemplateIds = new Set(assignment.tasks.map((task) => task.templateId).filter(Boolean));
  const baseDate = options.baseDate ?? new Date();
  const facilityName = getFacilityDisplayName(assignment.location);
  const allTaskTemplates = Array.isArray(options.taskTemplates) && options.taskTemplates.length ? options.taskTemplates : demoTaskCardTemplates;

  return allTaskTemplates
    .filter((task) => getFacilityDisplayName(task.facility) === facilityName && !scheduledTemplateIds.has(task.templateId))
    .map((task) => ({ ...task, standbySuitability: getStandbySuitability(task, baseDate) }))
    .sort((a, b) => {
      const scoreDiff = (b.standbySuitability?.score ?? 0) - (a.standbySuitability?.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const lastCompletedDiff = getLastCompletedSortValue(b) - getLastCompletedSortValue(a);
      if (lastCompletedDiff !== 0) return lastCompletedDiff;
      if (a.zone !== b.zone) return String(a.zone || '').localeCompare(String(b.zone || ''));
      if (a.taskGroup !== b.taskGroup) return String(a.taskGroup || '').localeCompare(String(b.taskGroup || ''));
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
}

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

  return Array.from(groups.values())
    .map((group) => {
      const completed = getOutcomeCompletedCount(group.tasks);
      const total = group.tasks.length;
      return {
        ...group,
        completed,
        total,
        progress: total ? Math.round((completed / total) * 100) : 0,
      };
    })
    .sort((left, right) => {
      const progressDiff = right.progress - left.progress;
      if (progressDiff !== 0) return progressDiff;

      const completedDiff = right.completed - left.completed;
      if (completedDiff !== 0) return completedDiff;

      const zoneDiff = String(left.zone || '').localeCompare(String(right.zone || ''));
      if (zoneDiff !== 0) return zoneDiff;

      return String(left.taskGroup || '').localeCompare(String(right.taskGroup || ''));
    });
}

function renderOutcomeProgress(tasks = [], className = 'progress') {
  const counts = getOutcomeCounts(tasks);
  const total = Math.max(0, tasks.length);

  return (
    <div className={`${className} outcome-progress`}>
      {OUTCOME_PROGRESS_SEGMENTS.map(([key, segmentClass]) => counts[key] ? (
        <span key={key} className={segmentClass} style={{ width: `${total ? (counts[key] / total) * 100 : 0}%` }} />
      ) : null)}
    </div>
  );
}

function hasNumericGrade(grade) {
  return Number.isFinite(Number(grade));
}

function getFacilityReportTotals(tasks = []) {
  const total = tasks.length;
  const completed = getOutcomeCompletedCount(tasks);
  const partial = tasks.filter((task) => hasNumericGrade(task.score) && Number(task.score) === 3).length;
  const resolvedIssues = tasks.filter((task) => task.resolvedIssue).length;
  const unresolvedIssues = tasks.filter((task) => !task.resolvedIssue && hasNumericGrade(task.score) && Number(task.score) <= 2).length;
  const photoCount = tasks.reduce((sum, task) => sum + (task.photoCount ?? taskPhotos(task).length), 0);
  const noteCount = tasks.filter((task) => String(task.issueNote ?? '').trim().length > 0).length;

  return {
    total,
    completed,
    completionPercent: total ? Math.round((completed / total) * 100) : 0,
    partial,
    resolvedIssues,
    unresolvedIssues,
    photoCount,
    noteCount,
  };
}

function taskPhotos(task = {}) {
  return task.photos ?? [];
}

function TaskPhotoIndicator({ task }) {
  const count = task.photoCount ?? taskPhotos(task).length;
  if (!count) return null;

  return <span className="facility-board-photo-indicator" title={`${count} photo${count === 1 ? '' : 's'} attached`} aria-label={`${count} photo${count === 1 ? '' : 's'} attached`}>📷</span>;
}

function ZonePhotoIndicator({ tasks = [] }) {
  const count = tasks.reduce((sum, task) => sum + (task.photoCount ?? taskPhotos(task).length), 0);
  if (!count) return null;

  return <span className="facility-board-photo-indicator facility-board-zone-photo-indicator" title={`${count} photo${count === 1 ? '' : 's'} attached in this zone`} aria-label={`${count} photo${count === 1 ? '' : 's'} attached in this zone`}>📷</span>;
}

function TaskPhotoGallery({ task }) {
  const photos = taskPhotos(task);
  if (!photos.length) return null;

  return (
    <div className="facility-board-photo-gallery">
      {photos.map((photo, index) => (
        <figure className="facility-board-photo-card" key={photo.id ?? `${task.id}-photo-${index}`}>
          <img src={photo.photoUrl || `/api/task-photos/${photo.id}`} alt={`${task.title} evidence photo ${index + 1}`} loading="lazy" />
          <figcaption>{photo.photoType === 'exception' ? 'Before issue photo' : photo.photoType === 'completion' ? 'After correction photo' : `Photo ${index + 1}`}</figcaption>
        </figure>
      ))}
    </div>
  );
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
      const completed = getOutcomeCompletedCount(staffTasks);
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
      templateId: card.templateId,
      status: normalizeTaskStatus(card.status),
      photoRequired: String(card.required || '').toLowerCase().includes('photo'),
      commentRequired: Boolean(card.issueNote),
      taskGroup: card.groupName || card.taskGroup,
      score: card.auditScore ?? null,
      initialGrade: card.initialGrade ?? null,
      resolvedIssue: Boolean(card.resolvedIssue),
      photoCount: card.photoCount ?? card.photos?.length ?? 0,
      photos: card.photos ?? [],
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
  const completed = getOutcomeCompletedCount(tasks);
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
  const view = resolvedSearchParams?.view === 'staff' ? 'staff' : resolvedSearchParams?.view === 'time' ? 'time' : resolvedSearchParams?.view === 'order' ? 'order' : 'tasks';
  const { board, source } = await getOrganiserBoardData();
  const timeZone = board?.timeZone ?? DEFAULT_APP_TIME_ZONE;
  const boardDay = getActiveBoardDay(board?.days ?? [], requestedDay, timeZone);
  const assignment = buildFacilityAssignmentFromBoard(board, resolvedAssignmentId, boardDay);

  if (!assignment) {
    notFound();
  }

  const dailyTasks = assignment.tasks.filter((task) => !task.frequency || String(task.frequency).toLowerCase() === 'daily');
  const periodicTasks = assignment.tasks.filter((task) => task.frequency && String(task.frequency).toLowerCase() !== 'daily');
  const extraTasks = getExtraFacilityTasks(assignment, { baseDate: parseBoardDayDate(assignment.boardDay) });
  const dailyGroups = groupAssignmentTasks(dailyTasks);
  const periodicGroups = groupAssignmentTasks(periodicTasks);
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
  const reportTotals = getFacilityReportTotals(assignment.tasks);
  const facilityResultLabel = reportTotals.unresolvedIssues
    ? 'Supervisor review required'
    : reportTotals.resolvedIssues ? 'Issues found and resolved' : 'No low-score issues';

  return (
    <main className="page facility-board-detail-shell">
      <section className="card facility-board-detail-hero">
        <div className="facility-board-detail-top">
          <div className="facility-board-detail-title-block">
            <span className="badge">{source === 'prisma' ? 'Facility board · live' : 'Facility board · demo task content'}</span>
            <h1>{assignment.location} facility tasks</h1>
            <p className="muted">{formatBoardDateLabel(assignment.boardDay, timeZone)} · {assignment.stats.staffCount || 0} assigned staff · {totalZones} zones · {facilityResultLabel}</p>
          </div>
        </div>

        <div className="cta-row no-top-gap facility-board-detail-actions facility-board-header-nav-row">
          <ViewOptionsMenu queryBase={queryBase} view={view} />
          <div className="facility-board-inline-day-nav">
            <div className="facility-board-inline-day-nav-row">
              {previousBoardDay ? <Link className="button secondary slim" href={`?day=${previousBoardDay}&view=${view}`}>← Prev</Link> : <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">← Prev</span>}
              <div className="button secondary slim facility-board-inline-day-label">{formatBoardDateLabel(assignment.boardDay, timeZone)}</div>
              {nextBoardDay ? <Link className="button secondary slim" href={`?day=${nextBoardDay}&view=${view}`}>Next →</Link> : <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">Next →</span>}
            </div>
            <div className="facility-board-day-chip-row">
              {boardDays.map((day) => (
                <Link key={day} className={`button slim ${day === assignment.boardDay ? 'primary' : 'secondary'}`} href={`?day=${day}&view=${view}`}>
                  {formatBoardDateLabel(day, timeZone)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <section className="facility-board-report-metrics" aria-label="Facility task summary">
          <div className="daily-report-score-card facility-board-report-score-card">
            <span>Completion</span>
            <strong>{reportTotals.completionPercent}%</strong>
            <div>{reportTotals.completed}/{reportTotals.total} complete</div>
          </div>
          <div className="daily-report-metric"><span>Total tasks</span><strong>{reportTotals.total}</strong></div>
          <div className="daily-report-metric"><span>Completed</span><strong className="tone-green">{reportTotals.completed}</strong></div>
          <div className="daily-report-metric"><span>Partial</span><strong className="tone-amber">{reportTotals.partial}</strong></div>
          <div className="daily-report-metric"><span>Resolved issues</span><strong className={reportTotals.resolvedIssues ? 'tone-amber' : 'tone-green'}>{reportTotals.resolvedIssues}</strong></div>
          <div className="daily-report-metric"><span>Unresolved</span><strong className={reportTotals.unresolvedIssues ? 'tone-red' : 'tone-green'}>{reportTotals.unresolvedIssues}</strong></div>
          <div className="daily-report-metric"><span>Photos</span><strong>{reportTotals.photoCount}</strong></div>
          <div className="daily-report-metric"><span>Notes</span><strong>{reportTotals.noteCount}</strong></div>
        </section>

        {renderOutcomeProgress(assignment.tasks)}
      </section>

      {source !== 'prisma' && (
        <section className="card" style={{ marginBottom: 16 }}>
          <strong>Live assignment data unavailable</strong>
          <div className="muted">This detail view is using demo task content until the runtime assignment path is available.</div>
        </section>
      )}

      {view === 'order' ? (
        <FacilityTaskOrderView tasks={assignment.tasks} facility={assignment.location} />
      ) : view === 'tasks' ? (
        <section className="facility-board-task-columns">
          {[{
            key: 'daily',
            title: 'Daily tasks',
            subtitle: 'Routine work for this board day',
            groups: dailyGroups,
            summary: {
              completed: getOutcomeCompletedCount(dailyTasks),
              total: dailyTasks.length,
              progress: dailyTasks.length ? Math.round((getOutcomeCompletedCount(dailyTasks) / dailyTasks.length) * 100) : 0,
            },
          }, {
            key: 'periodic',
            title: 'Periodic tasks',
            subtitle: '',
            groups: periodicGroups,
            summary: {
              completed: getOutcomeCompletedCount(periodicTasks),
              total: periodicTasks.length,
              progress: periodicTasks.length ? Math.round((getOutcomeCompletedCount(periodicTasks) / periodicTasks.length) * 100) : 0,
            },
          }, {
            key: 'extra',
            title: 'Extra tasks',
            subtitle: 'Suitable standby work',
            groups: [],
            tasks: extraTasks,
            summary: { count: extraTasks.length },
          }].map((section) => (
            <article className={`card facility-board-task-column facility-board-task-column-${section.key}`} key={`${assignment.id}-${section.key}`}>
              <div className="facility-board-task-column-header">
                <div>
                  <h2>{section.title}</h2>
                  {section.subtitle ? <p className="muted">{section.subtitle}</p> : null}
                </div>
                <div className="facility-board-task-column-header-actions">
                  {section.key === 'daily' ? <ExpandAllZonesButton /> : null}
                  {section.key === 'extra' ? <div className="badge">{section.summary.count} tasks</div> : <div className="badge">{section.summary.completed}/{section.summary.total} complete</div>}
                </div>
              </div>
              {section.key !== 'extra' ? renderOutcomeProgress(section.groups.flatMap((group) => group.tasks)) : null}

              {section.key === 'extra' ? (
                <div className="facility-board-extra-list">
                  {section.tasks.length ? section.tasks.map((task) => (
                    <ExtraTaskScheduleCard
                      key={`${assignment.id}-extra-${task.templateId}`}
                      task={{
                        ...task,
                        lastCompletedLabel: formatLastCompletedAge(task.lastCompleted, parseBoardDayDate(assignment.boardDay)),
                      }}
                      facility={assignment.location}
                      day={assignment.boardDay}
                    />
                  )) : (
                    <div className="task-row unscheduled-task-empty">
                      <div>
                        <strong>No extra tasks available</strong>
                        <div className="muted">Everything in this facility is already on the board for this day.</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="facility-board-task-column-groups">
                  {section.groups.length ? section.groups.map((group, groupIndex) => {
                    const isDaily = section.key === 'daily';
                    return (
                      <details
                        className={`task-disclosure facility-board-zone-card ${isDaily ? 'facility-board-zone-card-daily' : ''}`}
                        key={`${assignment.id}-${section.key}-${group.zone}-${group.taskGroup}`}
                        open={!isDaily}
                      >
                        <summary className={`task-row task-row-disclosure zone-summary-row ${isDaily ? 'zone-summary-row-compact' : ''}`}>
                          <div className={`zone-summary-left ${isDaily ? 'zone-summary-left-compact' : ''}`}>
                            {isDaily ? (
                              <div className="zone-summary-top-row">
                                <strong className="zone-summary-title-with-photo">{group.zone}<ZonePhotoIndicator tasks={group.tasks} /></strong>
                                <span className="task-group-progress-label zone-summary-progress-label-compact">{group.completed}/{group.total} complete</span>
                              </div>
                            ) : <strong className="zone-summary-title-with-photo">{group.zone}<ZonePhotoIndicator tasks={group.tasks} /></strong>}
                            {isDaily ? <div className="task-group-progress-stack">{renderOutcomeProgress(group.tasks, 'task-group-progress')}</div> : null}
                          </div>
                          {section.key === 'periodic' ? <div className="task-disclosure-summary-right zone-summary-right" /> : null}
                        </summary>
                        <div className="task-group-body">
                          {isDaily ? group.tasks.map((task) => {
                            const showStatus = String(task.status || '').toLowerCase() !== 'scheduled';
                            return (
                              <details className="task-disclosure task-disclosure-compact" key={task.id}>
                                <summary className="task-row task-row-disclosure task-row-disclosure-compact task-row-disclosure-daily-tight">
                                  <div className="task-inline-top-row">
                                    <div className="task-inline-main"><span className="facility-board-task-bullet" aria-hidden="true">•</span><strong>{task.title}</strong></div>
                                    <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
                                      <TaskPhotoIndicator task={task} />
                                      {showStatus ? <span className={`${statusClass(task.status)} task-inline-status task-inline-status-info`}>{formatTaskLabel(task.status)}</span> : null}
                                      <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                                    </div>
                                  </div>
                                </summary>
                                <div className="task-disclosure-body">
                                  <div className="task-detail-grid">
                                    <div><span className="muted">Task #</span><strong>{String(task.displayOrder).padStart(3, '0')}</strong></div>
                                    <div><span className="muted">Group</span><strong>{task.taskGroup}</strong></div>
                                    <div><span className="muted">Zone</span><strong>{task.zone}</strong></div>
                                    <div><span className="muted">Status</span><strong>{formatTaskLabel(task.status)}</strong></div>
                                    <div><span className="muted">Assigned</span><strong>{task.staff || 'Unallocated'}</strong></div>
                                    <div><span className="muted">Photos</span><strong>{task.photoCount ?? taskPhotos(task).length}</strong></div>
                                  </div>
                                  <TaskPhotoGallery task={task} />
                                </div>
                              </details>
                            );
                          }) : (
                            <div className={`facility-board-task-list ${section.key === 'periodic' ? 'facility-board-task-list-periodic' : ''} ${group.tasks.length === 1 ? 'facility-board-task-list-single' : ''}`}>
                              {group.tasks.map((task) => {
                                const showStatus = String(task.status || '').toLowerCase() !== 'scheduled';
                                return (
                                  <details className="task-disclosure task-disclosure-compact" key={task.id}>
                                    <summary className="task-row task-row-disclosure task-row-disclosure-compact task-row-disclosure-daily-tight">
                                      <div className="task-inline-top-row">
                                        <div className="task-inline-main"><span className="facility-board-task-bullet" aria-hidden="true">•</span><strong>#{String(task.displayOrder).padStart(3, '0')} · {task.title}</strong></div>
                                        <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
                                          <TaskPhotoIndicator task={task} />
                                          {showStatus ? <span className={`${statusClass(task.status)} task-inline-status task-inline-status-info`}>{formatTaskLabel(task.status)}</span> : null}
                                          <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                                        </div>
                                      </div>
                                    </summary>
                                    <div className="task-disclosure-body">
                                      <div className="task-detail-grid">
                                        <div><span className="muted">Task #</span><strong>{String(task.displayOrder).padStart(3, '0')}</strong></div>
                                        <div><span className="muted">Group</span><strong>{task.taskGroup}</strong></div>
                                        <div><span className="muted">Zone</span><strong>{task.zone}</strong></div>
                                        <div><span className="muted">Status</span><strong>{formatTaskLabel(task.status)}</strong></div>
                                        <div><span className="muted">Assigned</span><strong>{task.staff || 'Unallocated'}</strong></div>
                                        <div><span className="muted">Frequency</span><strong>{task.frequency || 'Periodic'}</strong></div>
                                        <div><span className="muted">Photos</span><strong>{task.photoCount ?? taskPhotos(task).length}</strong></div>
                                      </div>
                                      <div className="facility-board-task-meta-row">
                                        {task.photoRequired ? <span className="flag">Photo</span> : null}
                                        {task.commentRequired ? <span className="flag">Comment</span> : null}
                                      </div>
                                      <TaskPhotoGallery task={task} />
                                    </div>
                                  </details>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  }) : (
                    <div className="task-row unscheduled-task-empty"><div><strong>No {section.key} tasks in this facility run</strong><div className="muted">Nothing is scheduled here for this board day.</div></div></div>
                  )}
                </div>
              )}
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

              {renderOutcomeProgress(staffGroup.tasks)}

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

                      {renderOutcomeProgress(staffGroup.tasks)}

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
                            {renderOutcomeProgress(group.tasks)}
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

    </main>
  );
}
