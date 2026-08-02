import { getPrisma } from './prisma';
import { DEFAULT_APP_TIME_ZONE, formatBoardDayLabelForTimeZone } from './app-timezone';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function parseDayKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function getTodayDayKey() {
  return toDayKey(new Date());
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfWeek(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(start, offset);
}

export function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function buildWeeklyPeriod(weekParam = '') {
  const anchor = parseDayKey(weekParam) ?? parseDayKey(getTodayDayKey());
  const start = startOfWeek(anchor);
  const end = addDays(start, 7);
  return {
    type: 'weekly',
    paramName: 'week',
    paramValue: toDayKey(start),
    start,
    end,
    title: 'Weekly report',
    label: `${formatBoardDayLabelForTimeZone(start, DEFAULT_APP_TIME_ZONE)} – ${formatBoardDayLabelForTimeZone(addDays(end, -1), DEFAULT_APP_TIME_ZONE)}`,
  };
}

export function buildMonthlyPeriod(monthParam = '') {
  const parsedMonth = /^\d{4}-\d{2}$/.test(String(monthParam || '')) ? parseDayKey(`${monthParam}-01`) : null;
  const start = startOfMonth(parsedMonth ?? parseDayKey(getTodayDayKey()));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return {
    type: 'monthly',
    paramName: 'month',
    paramValue: toDayKey(start).slice(0, 7),
    start,
    end,
    title: 'Monthly report',
    label: start.toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

export function parseCompletionGrade(task) {
  const gradeMatch = task.execution?.completionComment?.match(/grade\s*:?\s*(\d)\/5/i);
  return gradeMatch ? Number(gradeMatch[1]) : null;
}

export function parseInitialGrade(task) {
  const match = task.execution?.completionComment?.match(/initial-grade\s*:?\s*(\d)\/5/i);
  return match ? Number(match[1]) : null;
}

export function parseResolvedIssue(task) {
  return /\[issue-resolved:true\]/i.test(task.execution?.completionComment ?? '');
}

export function parseIssueNote(task) {
  return String(task.execution?.completionComment ?? '')
    .replace(/\[grade:\d\/5\]\s*/ig, '')
    .replace(/\[initial-grade:\d\/5\]\s*/ig, '')
    .replace(/\[issue-resolved:true\]\s*/ig, '')
    .replace(/\[resolution-note\]\s*[^\n]+\s*/ig, '')
    .trim();
}

export function parseResolutionNote(task) {
  const match = task.execution?.completionComment?.match(/\[resolution-note\]\s*([^\n]+)/i);
  const note = match ? match[1].trim() : '';
  return /^Corrected during checklist\.?$/i.test(note) ? '' : note;
}

export function hasMeaningfulNote(task) {
  return Boolean(parseIssueNote(task) || parseResolutionNote(task));
}

export function hasNumericGrade(grade) {
  return grade !== null && grade !== undefined && grade !== '' && Number.isFinite(Number(grade));
}

export function parseGrade(task) {
  const latestAudit = task.audits?.[0] ?? null;
  const completionGrade = parseCompletionGrade(task);
  if (parseResolvedIssue(task) && completionGrade !== null) {
    return completionGrade;
  }
  return latestAudit?.auditScore ?? completionGrade;
}

export function taskDayKey(task) {
  return toDayKey(task.plannedRunDate ?? task.dueAt ?? task.createdAt);
}

export function taskFacilityName(task) {
  return task.plannedFacility?.name ?? task.facility?.name ?? 'Unknown facility';
}

export function taskStaffName(task) {
  return task.assignedStaff?.fullName ?? task.execution?.completedByStaff?.fullName ?? 'Unallocated';
}

export function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function scoreLabel(grade, task) {
  const initialGrade = parseInitialGrade(task);
  if (parseResolvedIssue(task) && initialGrade) return `Resolved ${initialGrade}→${grade}`;
  if (Number(grade) >= 1) return `${grade}/5`;
  if (task.status === 'completed') return 'Complete';
  return 'Not graded';
}

function buildGroupMap(scored, getKey) {
  const groups = new Map();
  scored.forEach((entry) => {
    const key = getKey(entry);
    if (!groups.has(key)) {
      groups.set(key, { key, total: 0, completed: 0, partial: 0, unresolvedIssues: 0, resolvedIssues: 0, photos: 0, notes: 0 });
    }
    const group = groups.get(key);
    group.total += 1;
    if (Number(entry.grade) >= 3 || entry.task.status === 'completed') group.completed += 1;
    if (hasNumericGrade(entry.grade) && Number(entry.grade) === 3) group.partial += 1;
    if (entry.resolvedIssue) group.resolvedIssues += 1;
    if (!entry.resolvedIssue && hasNumericGrade(entry.grade) && Number(entry.grade) <= 2) group.unresolvedIssues += 1;
    group.photos += entry.photoCount;
    if (entry.hasNote) group.notes += 1;
  });

  return [...groups.values()].map((group) => ({ ...group, completionPercent: percent(group.completed, group.total) }));
}

export async function loadPeriodReport({ period, facility = '' }) {
  const prisma = await getPrisma();
  if (!prisma) {
    return { source: 'no-db', tasks: [], scored: [], totals: emptyTotals(), dayGroups: [], facilityGroups: [], staffGroups: [], issueEntries: [] };
  }

  const facilityFilter = facility ? {
    OR: [
      { plannedFacility: { name: facility } },
      { facility: { name: facility } },
    ],
  } : {};

  const tasks = await prisma.taskInstance.findMany({
    where: {
      ...facilityFilter,
      OR: [
        { plannedRunDate: { gte: period.start, lt: period.end } },
        { dueAt: { gte: period.start, lt: period.end } },
      ],
      status: { not: 'cancelled' },
    },
    include: {
      facility: true,
      plannedFacility: true,
      zone: true,
      plannedZone: true,
      taskGroup: true,
      plannedTaskGroup: true,
      assignedStaff: true,
      execution: {
        include: {
          completedByStaff: true,
          photos: true,
        },
      },
      audits: {
        orderBy: { auditedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { plannedRunDate: 'asc' },
      { dueAt: 'asc' },
      { sequence: 'asc' },
      { titleSnapshot: 'asc' },
    ],
  });

  const scored = tasks.map((task, originalIndex) => {
    const grade = parseGrade(task);
    const resolvedIssue = parseResolvedIssue(task);
    const photoCount = task.execution?.photos?.length ?? 0;
    return {
      task,
      grade,
      resolvedIssue,
      originalIndex,
      day: taskDayKey(task),
      facility: taskFacilityName(task),
      staff: taskStaffName(task),
      photoCount,
      hasNote: hasMeaningfulNote(task),
    };
  });

  const totals = buildTotals(scored);
  const dayGroups = buildGroupMap(scored, (entry) => entry.day).sort((a, b) => a.key.localeCompare(b.key));
  const facilityGroups = buildGroupMap(scored, (entry) => entry.facility).sort((a, b) => a.key.localeCompare(b.key));
  const staffGroups = buildGroupMap(scored, (entry) => entry.staff).sort((a, b) => {
    if (a.key === 'Unallocated') return 1;
    if (b.key === 'Unallocated') return -1;
    return a.key.localeCompare(b.key);
  });
  const issueEntries = scored
    .filter((entry) => entry.resolvedIssue || (!entry.resolvedIssue && hasNumericGrade(entry.grade) && Number(entry.grade) <= 2))
    .sort((a, b) => {
      if (a.day !== b.day) return a.day.localeCompare(b.day);
      const aGrade = hasNumericGrade(a.grade) ? Number(a.grade) : 99;
      const bGrade = hasNumericGrade(b.grade) ? Number(b.grade) : 99;
      return aGrade - bGrade;
    });

  return { source: 'prisma', tasks, scored, totals, dayGroups, facilityGroups, staffGroups, issueEntries };
}

export function emptyTotals() {
  return {
    total: 0,
    completed: 0,
    completionPercent: 0,
    partial: 0,
    unresolvedIssues: 0,
    resolvedIssues: 0,
    photoCount: 0,
    noteCount: 0,
    grades: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, notScored: 0 },
  };
}

export function buildTotals(scored) {
  const totals = emptyTotals();
  totals.total = scored.length;
  scored.forEach((entry) => {
    if (Number(entry.grade) >= 3 || entry.task.status === 'completed') totals.completed += 1;
    if (hasNumericGrade(entry.grade) && Number(entry.grade) === 3) totals.partial += 1;
    if (entry.resolvedIssue) totals.resolvedIssues += 1;
    if (!entry.resolvedIssue && hasNumericGrade(entry.grade) && Number(entry.grade) <= 2) totals.unresolvedIssues += 1;
    totals.photoCount += entry.photoCount;
    if (entry.hasNote) totals.noteCount += 1;
    const gradeKey = hasNumericGrade(entry.grade) && Number(entry.grade) >= 1 && Number(entry.grade) <= 5 ? Number(entry.grade) : 'notScored';
    totals.grades[gradeKey] = (totals.grades[gradeKey] ?? 0) + 1;
  });
  totals.completionPercent = percent(totals.completed, totals.total);
  return totals;
}

export function previousPeriodHref(period, route) {
  if (period.type === 'weekly') {
    return `${route}?week=${toDayKey(addDays(period.start, -7))}`;
  }
  const previous = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() - 1, 1));
  return `${route}?month=${toDayKey(previous).slice(0, 7)}`;
}

export function nextPeriodHref(period, route) {
  if (period.type === 'weekly') {
    return `${route}?week=${toDayKey(addDays(period.start, 7))}`;
  }
  const next = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() + 1, 1));
  return `${route}?month=${toDayKey(next).slice(0, 7)}`;
}

export function periodParamForHref(period) {
  return period.type === 'weekly' ? `week=${toDayKey(period.start)}` : `month=${toDayKey(period.start).slice(0, 7)}`;
}

function scoreTaskInstance(task, originalIndex) {
  const grade = parseGrade(task);
  const resolvedIssue = parseResolvedIssue(task);
  const photoCount = task.execution?.photos?.length ?? 0;
  return {
    task,
    grade,
    resolvedIssue,
    originalIndex,
    day: taskDayKey(task),
    facility: taskFacilityName(task),
    staff: taskStaffName(task),
    photoCount,
    hasNote: hasMeaningfulNote(task),
  };
}

export async function loadTaskPeriodReport({ templateId, period }) {
  const prisma = await getPrisma();
  if (!prisma || !templateId) {
    return { source: prisma ? 'missing-input' : 'no-db', template: null, tasks: [], scored: [], totals: emptyTotals(), dayGroups: [], staffGroups: [], issueEntries: [] };
  }

  const template = await prisma.taskTemplate.findUnique({
    where: { id: templateId },
    include: {
      facility: true,
      zone: true,
      taskGroup: true,
    },
  });

  if (!template) {
    return { source: 'not-found', template: null, tasks: [], scored: [], totals: emptyTotals(), dayGroups: [], staffGroups: [], issueEntries: [] };
  }

  const tasks = await prisma.taskInstance.findMany({
    where: {
      taskTemplateId: template.id,
      status: { not: 'cancelled' },
      OR: [
        { plannedRunDate: { gte: period.start, lt: period.end } },
        { dueAt: { gte: period.start, lt: period.end } },
      ],
    },
    include: {
      facility: true,
      plannedFacility: true,
      zone: true,
      plannedZone: true,
      taskGroup: true,
      plannedTaskGroup: true,
      assignedStaff: true,
      execution: {
        include: {
          completedByStaff: true,
          photos: true,
        },
      },
      audits: {
        orderBy: { auditedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { plannedRunDate: 'asc' },
      { dueAt: 'asc' },
      { sequence: 'asc' },
    ],
  });

  const scored = tasks.map(scoreTaskInstance);
  const totals = buildTotals(scored);
  const dayGroups = buildGroupMap(scored, (entry) => entry.day).sort((a, b) => a.key.localeCompare(b.key));
  const staffGroups = buildGroupMap(scored, (entry) => entry.staff).sort((a, b) => {
    if (a.key === 'Unallocated') return 1;
    if (b.key === 'Unallocated') return -1;
    return a.key.localeCompare(b.key);
  });
  const issueEntries = scored
    .filter((entry) => entry.resolvedIssue || (!entry.resolvedIssue && hasNumericGrade(entry.grade) && Number(entry.grade) <= 2))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { source: 'prisma', template, tasks, scored, totals, dayGroups, staffGroups, issueEntries };
}
