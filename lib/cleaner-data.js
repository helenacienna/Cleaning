import { cleanerAssignments, cleanerProfile, cleanerShiftAssignments } from '../data/demo-data.js';
import { DEFAULT_APP_TIME_ZONE, formatBoardDayLabelForTimeZone, getAppTimeZone } from './app-timezone.js';
import { getPrisma } from './prisma.js';
import { getStaffRosterOverrides } from './app-settings.js';
import { getOperationalWindow, getOperationalWindowConfig } from './operational-window.mjs';
import { getTaskInstanceBoardDate } from './task-scheduling.js';
import { formatBoardDayKey } from './task-effective-day.mjs';
import { normalizeWeeklyRoster, resolveRosterForBoardDay, WEEKDAY_OPTIONS, formatRosterWindow, formatRosterTime } from './staff-roster.js';

const demoAssignments = [...cleanerAssignments, ...cleanerShiftAssignments];
const HOLIDAY_TESTING_RESET_COOLDOWN_MS = 10 * 1000;
const globalForHolidayTesting = globalThis;

function shouldUsePrisma() {
  return process.env.ENABLE_PRISMA_DATA !== 'false';
}

function slugifyValue(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeCleanerShiftAssignmentId({ staff, day, facility, zone = 'facility' }) {
  return `shift-${slugifyValue(day)}-${slugifyValue(staff)}-${slugifyValue(facility)}-${slugifyValue(zone)}`;
}

function formatBoardDay(value, timeZone = DEFAULT_APP_TIME_ZONE) {
  return formatBoardDayLabelForTimeZone(value, timeZone);
}

function parseBoardDayKey(boardDayKey) {
  if (!boardDayKey || !/^\d{4}-\d{2}-\d{2}$/.test(boardDayKey)) {
    return null;
  }

  return new Date(`${boardDayKey}T00:00:00+10:00`);
}

function parseBoardDayKeyUtc(boardDayKey) {
  if (!boardDayKey || !/^\d{4}-\d{2}-\d{2}$/.test(boardDayKey)) {
    return null;
  }

  const [year, month, day] = boardDayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toBoardDayKeyUtc(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getWeekBoardDays(boardDayKey) {
  const base = parseBoardDayKeyUtc(boardDayKey);
  if (!base) {
    return [];
  }

  const weekday = base.getUTCDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const monday = addUtcDays(base, diffToMonday);

  return Array.from({ length: 7 }, (_, index) => toBoardDayKeyUtc(addUtcDays(monday, index)));
}

function buildWeeklyShiftSummary({ boardDayKey, weeklyRoster, overrides, preferredShiftLabel = '' }) {
  return getWeekBoardDays(boardDayKey).map((dayKey, index) => {
    const roster = resolveRosterForBoardDay({
      boardDayKey: dayKey,
      weeklyRoster,
      overrides,
      preferredShiftLabel,
    });

    const shiftLines = roster.shifts?.length
      ? roster.shifts
          .map((shift) => [shift.facilityName, formatRosterWindow(shift.start, shift.finish)].filter(Boolean).join(' · '))
          .filter(Boolean)
      : [];

    return {
      key: WEEKDAY_OPTIONS[index]?.key ?? dayKey,
      label: WEEKDAY_OPTIONS[index]?.label ?? dayKey,
      boardDayKey: dayKey,
      isWorking: Boolean(roster.isWorking),
      start: roster.start || '',
      finish: roster.finish || '',
      startLabel: formatRosterTime(roster.start) || '',
      finishLabel: formatRosterTime(roster.finish) || '',
      summary: roster.summary || (roster.isWorking ? 'Scheduled' : 'Off'),
      shiftLines,
    };
  });
}

function differenceInDaysFromToday(boardDayKey, timeZone = DEFAULT_APP_TIME_ZONE) {
  const targetDate = parseBoardDayKey(boardDayKey);
  if (!targetDate) {
    return null;
  }

  const now = new Date();
  const todayDate = parseBoardDayKey(formatBoardDayKey(now, timeZone));
  if (!todayDate) {
    return null;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((targetDate.getTime() - todayDate.getTime()) / millisecondsPerDay);
}

function getCleanerOperationalWindow(requestedBoardDay, timeZone = DEFAULT_APP_TIME_ZONE) {
  const { futureDays } = getOperationalWindowConfig();
  const requestedOffset = differenceInDaysFromToday(requestedBoardDay, timeZone);
  const requiredFutureDays = Number.isInteger(requestedOffset)
    ? Math.max(futureDays, requestedOffset, 62)
    : Math.max(futureDays, 62);

  return getOperationalWindow({
    timeZone,
    env: {
      ...process.env,
      OPERATIONAL_WINDOW_DAYS_FUTURE: String(requiredFutureDays),
    },
  });
}

function formatBoardDayLabelFromKey(boardDayKey, timeZone = DEFAULT_APP_TIME_ZONE) {
  if (!boardDayKey) {
    return null;
  }

  return formatBoardDay(new Date(`${boardDayKey}T00:00:00Z`), timeZone);
}

function formatShiftWindow(startAt, endAt) {
  if (!startAt || !endAt) {
    return '';
  }

  const formatClock = (value) => {
    const date = new Date(value);
    const hours24 = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const suffix = hours24 >= 12 ? 'pm' : 'am';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, '0')}${suffix}`;
  };

  return `${formatClock(startAt)} – ${formatClock(endAt)}`;
}

function selectActiveBoardDay(availableBoardDays = [], requestedBoardDay, todayKey) {
  if (!availableBoardDays.length) {
    return null;
  }

  if (requestedBoardDay && availableBoardDays.includes(requestedBoardDay)) {
    return requestedBoardDay;
  }

  if (todayKey && availableBoardDays.includes(todayKey)) {
    return todayKey;
  }

  return availableBoardDays[availableBoardDays.length - 1] ?? null;
}

function parseExecutionGrade(comment = '') {
  const match = comment.match(/\[grade:(\d)\/5\]/i);
  return match ? Number(match[1]) : null;
}

function parseInitialExecutionGrade(comment = '') {
  const match = comment.match(/\[initial-grade:(\d)\/5\]/i);
  return match ? Number(match[1]) : null;
}

function parseCorrectedExecutionGrade(comment = '') {
  const match = comment.match(/\[corrected-score:(\d)\/5\]/i);
  return match ? Number(match[1]) : null;
}

function parseCorrectionLater(comment = '') {
  return /\[correction-later:true\]/i.test(comment);
}

function parseExecutionNote(comment = '') {
  return comment
    .replace(/\[grade:\d\/5\]\s*/ig, '')
    .replace(/\[initial-grade:\d\/5\]\s*/ig, '')
    .replace(/\[issue-resolved:true\]\s*/ig, '')
    .replace(/\[correction-later:true\]\s*/ig, '')
    .replace(/\[corrected-score:\d\/5\]\s*/ig, '')
    .trim();
}

function buildComment({ grade, note }) {
  const parts = [];
  if (Number.isInteger(grade)) {
    parts.push(`[grade:${grade}/5]`);
  }
  if (note?.trim()) {
    parts.push(note.trim());
  }
  return parts.join('\n');
}

function mapInstanceTask(instance) {
  const comment = instance.execution?.completionComment ?? '';
  const grade = parseExecutionGrade(comment);
  const initialGrade = parseInitialExecutionGrade(comment);
  const correctedGrade = parseCorrectedExecutionGrade(comment);
  const correctionLater = parseCorrectionLater(comment);
  const note = parseExecutionNote(comment);

  return {
    id: instance.id,
    title: instance.titleSnapshot,
    status: instance.status === 'in_progress' ? 'in-progress' : instance.status,
    photoRequired: instance.evidenceRequirement === 'required_photo' || instance.evidenceRequirement === 'multi_photo',
    commentRequired: instance.commentRequirement === 'always' || instance.commentRequirement === 'on_exception',
    commentRequirement: instance.commentRequirement,
    facility: instance.plannedFacility?.name ?? instance.facility.name,
    zone: instance.plannedZone?.name ?? instance.zone.name,
    taskGroup: instance.plannedTaskGroup?.name ?? instance.taskGroup.name,
    jobOrderNumber: instance.sequence ?? null,
    score: grade,
    initialGrade,
    correctedGrade,
    correctionLater,
    note,
    photoCount: instance.execution?.photos?.length ?? 0,
    photos: (instance.execution?.photos ?? []).map((photo) => ({
      id: photo.id,
      photoType: photo.photoType,
      photoUrl: `/api/task-photos/${photo.id}`,
    })),
  };
}

function isCleanerTaskCompleted(task) {
  return task?.status === 'completed' || Number(task?.score) >= 3;
}

function isCleanerTaskIssue(task) {
  return Number(task?.score) > 0 && Number(task?.score) <= 2;
}

function buildPrismaAssignment(id, instances, timeZone = DEFAULT_APP_TIME_ZONE) {
  const first = instances[0];
  const orderedInstances = [...instances].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const total = orderedInstances.length;
  const photoRequired = instances.filter((instance) => instance.evidenceRequirement === 'required_photo' || instance.evidenceRequirement === 'multi_photo').length;
  const zoneNames = [...new Set(instances.map((instance) => instance.plannedZone?.name ?? instance.zone.name).filter(Boolean))];
  const tasks = orderedInstances.map((instance) => {
    const mapped = mapInstanceTask(instance);
    return mapped;
  });

  const completedCount = tasks.filter((task) => isCleanerTaskCompleted(task)).length;
  const issueCount = tasks.filter((task) => isCleanerTaskIssue(task)).length;

  const boardDayKey = formatBoardDayKey(getTaskInstanceBoardDate(first), timeZone);

  return {
    id,
    location: first.plannedFacility?.name ?? first.facility.name,
    zone: zoneNames[0] ?? (first.plannedZone?.name ?? first.zone.name),
    zones: zoneNames,
    staff: first.assignedStaff?.fullName ?? cleanerProfile.name,
    day: formatBoardDay(getTaskInstanceBoardDate(first), timeZone),
    boardDayKey,
    shift: first.shiftRun?.shiftLabel ?? cleanerProfile.nextShift,
    shiftWindow: formatShiftWindow(first.shiftRun?.shiftStartAt, first.shiftRun?.shiftEndAt),
    shiftStartAt: first.shiftRun?.shiftStartAt ?? first.scheduledForAt ?? first.dueAt ?? null,
    routeLabel: first.shiftRun?.routeLabel ?? '',
    progress: total ? Math.round((completedCount / total) * 100) : 0,
    stats: {
      total,
      completed: completedCount,
      issues: issueCount,
      photoRequired,
    },
    tasks,
  };
}

async function getPrismaAssignments(requestedBoardDay, timeZone = DEFAULT_APP_TIME_ZONE) {
  const window = getCleanerOperationalWindow(requestedBoardDay, timeZone);
  const prisma = await getPrisma();
  if (!prisma) {
    return null;
  }

  const instances = await prisma.taskInstance.findMany({
    where: {
      assignedStaffId: { not: null },
      plannedFacilityId: { not: null },
      plannedZoneId: { not: null },
      OR: [
        {
          shiftRun: {
            is: {
              runDate: {
                gte: window.runDateGte,
                lte: window.runDateLte,
              },
            },
          },
        },
        {
          plannedRunDate: {
            gte: window.runDateGte,
            lte: window.runDateLte,
          },
        },
      ],
    },
    include: {
      assignedStaff: true,
      shiftRun: true,
      facility: true,
      zone: true,
      taskGroup: true,
      plannedFacility: true,
      plannedZone: true,
      plannedTaskGroup: true,
      execution: {
        include: {
          photos: true,
        },
      },
    },
    orderBy: [
      { dueAt: 'asc' },
      { sequence: 'asc' },
    ],
  });

  const grouped = new Map();

  for (const instance of instances) {
    const staff = instance.assignedStaff?.fullName;
    const facility = instance.plannedFacility?.name ?? instance.facility.name;
    const day = formatBoardDay(getTaskInstanceBoardDate(instance));

    if (!staff || !facility) {
      continue;
    }

    const id = makeCleanerShiftAssignmentId({ staff, day, facility, zone: 'facility' });
    if (!grouped.has(id)) {
      grouped.set(id, []);
    }
    grouped.get(id).push(instance);
  }

  return Array.from(grouped.entries()).map(([id, assignmentInstances]) => buildPrismaAssignment(id, assignmentInstances, timeZone));
}


async function resetHolidayTestingResultsIfEnabled({ requested = true } = {}) {
  if (!requested || process.env.HOLIDAY_TESTING_RESET_ON_LOAD !== 'true') {
    return { reset: false };
  }

  const now = Date.now();
  const lastResetAt = globalForHolidayTesting.__holidayTestingLastResetAt ?? 0;
  if (now - lastResetAt < HOLIDAY_TESTING_RESET_COOLDOWN_MS) {
    return { reset: false, reason: 'cooldown' };
  }

  if (globalForHolidayTesting.__holidayTestingResetPromise) {
    return globalForHolidayTesting.__holidayTestingResetPromise;
  }

  globalForHolidayTesting.__holidayTestingResetPromise = (async () => {
    const prisma = await getPrisma();
    if (!prisma) {
      return { reset: false, reason: 'no-prisma' };
    }

    const holidayInstances = await prisma.taskInstance.findMany({
      where: {
        OR: [
          { facility: { name: 'Holiday' } },
          { plannedFacility: { name: 'Holiday' } },
        ],
      },
      select: {
        id: true,
        execution: {
          select: { id: true },
        },
      },
    });

    const taskInstanceIds = holidayInstances.map((instance) => instance.id);
    const executionIds = holidayInstances.map((instance) => instance.execution?.id).filter(Boolean);

    if (!taskInstanceIds.length) {
      globalForHolidayTesting.__holidayTestingLastResetAt = Date.now();
      return { reset: true, tasks: 0, executions: 0 };
    }

    await prisma.$transaction(async (tx) => {
      if (executionIds.length) {
        await tx.taskPhoto.deleteMany({ where: { taskExecutionId: { in: executionIds } } });
        await tx.taskAudit.deleteMany({ where: { taskInstanceId: { in: taskInstanceIds } } });
        await tx.taskExecution.deleteMany({ where: { id: { in: executionIds } } });
      }

      await tx.taskInstance.updateMany({
        where: { id: { in: taskInstanceIds } },
        data: {
          status: 'scheduled',
          exceptionReason: null,
        },
      });
    }, {
      timeout: 20000,
    });

    globalForHolidayTesting.__holidayTestingLastResetAt = Date.now();
    return { reset: true, tasks: taskInstanceIds.length, executions: executionIds.length };
  })();

  try {
    return await globalForHolidayTesting.__holidayTestingResetPromise;
  } finally {
    globalForHolidayTesting.__holidayTestingResetPromise = null;
  }
}

export async function getCleanerAssignments(selectedBoardDay) {
  const timeZone = await getAppTimeZone();
  if (!shouldUsePrisma()) {
    return { assignments: demoAssignments, source: 'demo', timeZone };
  }

  try {
    const assignments = await getPrismaAssignments(selectedBoardDay, timeZone);
    if (!assignments?.length) {
      return { assignments: demoAssignments, source: 'demo-fallback', timeZone };
    }
    return { assignments, source: 'prisma', timeZone };
  } catch {
    return { assignments: demoAssignments, source: 'demo-fallback', timeZone };
  }
}

export async function getCleanerAssignment(zoneId) {
  const { assignments, source } = await getCleanerAssignments();
  return {
    assignment: assignments.find((item) => item.id === zoneId) ?? null,
    source,
  };
}

function buildStaffListFromAssignments(staffName, assignments = [], selectedBoardDay, todayKey, options = {}) {
  const { staffRecordsByName = new Map(), rosterOverridesByStaffId = {} } = options;
  const staffAssignments = assignments.filter((assignment) => assignment.staff === staffName);
  if (!staffAssignments.length) {
    return null;
  }

  const availableBoardDays = [...new Set(staffAssignments
    .map((assignment) => assignment.boardDayKey)
    .filter(Boolean))].sort();
  const activeBoardDay = selectActiveBoardDay(availableBoardDays, selectedBoardDay, todayKey);
  const activeAssignments = activeBoardDay
    ? staffAssignments.filter((assignment) => assignment.boardDayKey === activeBoardDay)
    : staffAssignments;

  const allTasks = activeAssignments.flatMap((assignment) => (
    (assignment.tasks ?? []).map((task) => ({
      ...task,
      facility: assignment.location,
      day: assignment.day,
      shift: assignment.shift,
      shiftWindow: assignment.shiftWindow ?? '',
      shiftStartAt: assignment.shiftStartAt ?? null,
      routeLabel: assignment.routeLabel,
    }))
  ));
  const sectionsMap = new Map();
  for (const task of allTasks) {
    const facility = task.facility || 'Unassigned facility';
    if (!sectionsMap.has(facility)) {
      sectionsMap.set(facility, []);
    }
    sectionsMap.get(facility).push(task);
  }

  const sections = Array.from(sectionsMap.entries()).map(([facility, tasks]) => {
    const orderedTasks = [...tasks].sort((a, b) => {
      const leftOrder = Number.isFinite(Number(a.jobOrderNumber)) ? Number(a.jobOrderNumber) : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(Number(b.jobOrderNumber)) ? Number(b.jobOrderNumber) : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      if ((a.zone || '') !== (b.zone || '')) return String(a.zone || '').localeCompare(String(b.zone || ''));
      if ((a.taskGroup || '') !== (b.taskGroup || '')) return String(a.taskGroup || '').localeCompare(String(b.taskGroup || ''));
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    const completed = orderedTasks.filter((task) => isCleanerTaskCompleted(task)).length;
    const issues = orderedTasks.filter((task) => isCleanerTaskIssue(task)).length;
    const sortTimestamp = orderedTasks
      .map((task) => Date.parse(task.shiftStartAt || ''))
      .find((value) => Number.isFinite(value)) ?? Number.POSITIVE_INFINITY;
    return {
      facility,
      shiftWindow: orderedTasks.find((task) => task.shiftWindow)?.shiftWindow || '',
      tasks: orderedTasks,
      sortTimestamp,
      stats: {
        total: orderedTasks.length,
        completed,
        issues,
      },
    };
  }).sort((a, b) => {
    if (a.sortTimestamp !== b.sortTimestamp) {
      return a.sortTimestamp - b.sortTimestamp;
    }
    return String(a.facility || '').localeCompare(String(b.facility || ''));
  });

  const total = allTasks.length;
  const completed = allTasks.filter((task) => isCleanerTaskCompleted(task)).length;
  const issues = allTasks.filter((task) => isCleanerTaskIssue(task)).length;
  const photoRequired = allTasks.filter((task) => task.photoRequired).length;
  const commentRequired = allTasks.filter((task) => task.commentRequired).length;
  const firstAssignment = activeAssignments[0] ?? staffAssignments[0];
  const staffRecord = staffRecordsByName.get(staffName) ?? null;
  const roster = resolveRosterForBoardDay({
    boardDayKey: activeBoardDay,
    weeklyRoster: normalizeWeeklyRoster(staffRecord?.weeklyAvailability),
    overrides: rosterOverridesByStaffId?.[staffRecord?.id] ?? {},
    preferredShiftLabel: staffRecord?.preferredShiftLabel ?? '',
  });
  const weeklyShifts = buildWeeklyShiftSummary({
    boardDayKey: activeBoardDay,
    weeklyRoster: staffRecord?.weeklyAvailability,
    overrides: rosterOverridesByStaffId?.[staffRecord?.id] ?? {},
    preferredShiftLabel: staffRecord?.preferredShiftLabel ?? '',
  });

  return {
    id: slugifyValue(staffName),
    staffId: staffRecord?.id ?? '',
    staff: staffName,
    day: firstAssignment?.day ?? formatBoardDayLabelFromKey(activeBoardDay, options.timeZone),
    activeBoardDay,
    boardDays: availableBoardDays,
    shift: firstAssignment?.shift ?? cleanerProfile.nextShift,
    routeLabel: firstAssignment?.routeLabel ?? '',
    roster,
    weeklyShifts,
    progress: total ? Math.round((completed / total) * 100) : 0,
    stats: {
      total,
      completed,
      issues,
      photoRequired,
      commentRequired,
      facilities: sections.length,
    },
    sections,
  };
}

export async function getCleanerStaffLists(selectedBoardDay) {
  const { assignments, source, timeZone } = await getCleanerAssignments(selectedBoardDay);
  const { todayKey } = getCleanerOperationalWindow(selectedBoardDay, timeZone);
  const prisma = shouldUsePrisma() ? await getPrisma() : null;
  const [staffRows, rosterOverrides] = prisma
    ? await Promise.all([
        prisma.staff.findMany({ where: { active: true }, select: { id: true, fullName: true, weeklyAvailability: true, preferredShiftLabel: true } }).catch(() => []),
        getStaffRosterOverrides().catch(() => ({})),
      ])
    : [[], {}];
  const staffRecordsByName = new Map(staffRows.map((row) => [row.fullName, row]));
  const staffNames = [...new Set(assignments.map((assignment) => assignment.staff).filter(Boolean))].sort();
  const lists = staffNames
    .map((staffName) => buildStaffListFromAssignments(staffName, assignments, selectedBoardDay, todayKey, {
      staffRecordsByName,
      rosterOverridesByStaffId: rosterOverrides,
      timeZone,
    }))
    .filter(Boolean);

  return { lists, source, timeZone };
}

export async function getCleanerStaffList(staffSlug, selectedBoardDay, options = {}) {
  await resetHolidayTestingResultsIfEnabled({ requested: options.resetHolidayTesting !== false });
  const { lists, source, timeZone } = await getCleanerStaffLists(selectedBoardDay);
  return {
    list: lists.find((item) => item.id === staffSlug) ?? null,
    source,
    timeZone,
  };
}

export { buildComment, parseExecutionGrade, parseExecutionNote };
