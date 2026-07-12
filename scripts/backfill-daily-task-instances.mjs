#!/usr/bin/env node
import { getPrisma } from '../lib/prisma.js';
import { calculatePlanningDueAt, getTaskInstanceStatusForDueDate, refreshTemplateStatus } from '../lib/task-scheduling.js';
import { formatBoardDayKeyForTimeZone, DEFAULT_APP_TIME_ZONE } from '../lib/app-timezone.js';
import { getTaskInstanceBoardDate } from '../lib/task-scheduling.js';

const TZ_OFFSET_MS = 10 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['scheduled', 'upcoming', 'due', 'unscheduled', 'in_progress', 'overdue', 'carried_forward'];

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function startOfBoardDay(dayKey) { return new Date(`${dayKey}T00:00:00+10:00`); }
function addDays(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function boardDate(date) { return new Date(new Date(date).getTime() + TZ_OFFSET_MS); }
function boardDayKey(date) { return boardDate(date).toISOString().slice(0, 10); }
function localTimeParts(date) {
  const local = boardDate(date);
  return { hours: local.getUTCHours(), minutes: local.getUTCMinutes(), seconds: local.getUTCSeconds(), ms: local.getUTCMilliseconds() };
}
function dueAtForBoardDay(dayKey, timeParts) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, timeParts.hours - 10, timeParts.minutes, timeParts.seconds ?? 0, timeParts.ms ?? 0));
}
function defaultTimeParts(template) {
  if (template.preferredTimeWindow === 'afternoon') return { hours: 13, minutes: 0, seconds: 0, ms: 0 };
  return { hours: 9, minutes: 0, seconds: 0, ms: 0 };
}
function instanceCode(templateCode, dueAt, suffix = '') {
  const date = new Date(dueAt);
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const time = `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return `${templateCode}-D${stamp}-T${time}${suffix}`;
}

const args = parseArgs(process.argv);
const apply = args.get('apply') === true;
const facilityName = args.get('facility') || 'Cienna';
const startDay = args.get('start') || new Date().toISOString().slice(0, 10);
const horizonDays = Number.parseInt(args.get('horizon-days') || '90', 10);
const start = startOfBoardDay(startDay);
const end = addDays(start, horizonDays);
const prisma = await getPrisma();
if (!prisma) throw new Error('DATABASE_URL missing');

const facility = await prisma.facility.findFirst({ where: { name: facilityName } });
if (!facility) throw new Error(`Facility not found: ${facilityName}`);

const templates = await prisma.taskTemplate.findMany({
  where: { facilityId: facility.id, active: true, autoGenerateInstances: true, recurrenceType: 'daily' },
  include: { zone: true, taskGroup: true },
  orderBy: [{ zone: { name: 'asc' } }, { taskGroup: { name: 'asc' } }, { defaultSequence: 'asc' }],
});
const instances = await prisma.taskInstance.findMany({
  where: {
    facilityId: facility.id,
    taskTemplateId: { in: templates.map((template) => template.id) },
    status: { in: ACTIVE_STATUSES },
    OR: [
      { dueAt: { gte: start, lt: end } },
      { plannedRunDate: { gte: start, lt: end } },
      { shiftRun: { is: { runDate: { gte: start, lt: end } } } },
    ],
  },
  include: { shiftRun: { select: { runDate: true } } },
  orderBy: [{ taskTemplateId: 'asc' }, { dueAt: 'asc' }],
});

const present = new Set();
const existingTimesByTemplate = new Map();
for (const instance of instances) {
  const boardDay = formatBoardDayKeyForTimeZone(getTaskInstanceBoardDate(instance), DEFAULT_APP_TIME_ZONE);
  present.add(`${instance.taskTemplateId}::${boardDay}`);
  if (!existingTimesByTemplate.has(instance.taskTemplateId)) {
    existingTimesByTemplate.set(instance.taskTemplateId, localTimeParts(instance.dueAt));
  }
}

const missing = [];
for (const template of templates) {
  const timeParts = existingTimesByTemplate.get(template.id) ?? defaultTimeParts(template);
  for (let i = 0; i < horizonDays; i += 1) {
    const day = boardDayKey(addDays(start, i));
    if (present.has(`${template.id}::${day}`)) continue;
    const dueAt = dueAtForBoardDay(day, timeParts);
    missing.push({ template, day, dueAt });
  }
}

const byDay = {};
for (let i = 0; i < horizonDays; i += 1) {
  const day = boardDayKey(addDays(start, i));
  byDay[day] = { before: 0, created: 0, after: 0 };
}
for (const key of present) {
  const day = key.split('::')[1];
  if (byDay[day]) byDay[day].before += 1;
}
for (const item of missing) byDay[item.day].created += 1;
for (const stats of Object.values(byDay)) stats.after = stats.before + stats.created;

let created = 0;
if (apply && missing.length) {
  const rows = missing.map((item) => ({
    instanceCode: instanceCode(item.template.taskTemplateCode, item.dueAt, `-BF${item.day.replace(/-/g, '')}`),
    taskTemplateId: item.template.id,
    facilityId: item.template.facilityId,
    zoneId: item.template.zoneId,
    taskGroupId: item.template.taskGroupId,
    plannedFacilityId: null,
    plannedZoneId: null,
    plannedTaskGroupId: null,
    titleSnapshot: item.template.title,
    descriptionSnapshot: item.template.description,
    sourceType: 'auto_generated',
    dueAt: item.dueAt,
    planningDueAt: calculatePlanningDueAt(item.dueAt),
    scheduledForAt: null,
    plannedRunDate: null,
    shiftRunId: null,
    status: getTaskInstanceStatusForDueDate(item.dueAt),
    priority: item.template.priority,
    evidenceRequirement: item.template.evidenceRequirement,
    commentRequirement: item.template.commentRequirement,
    estimatedMinutes: item.template.estimatedMinutes,
    manuallyCreated: false,
    isExceptionTask: false,
  }));
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const result = await prisma.taskInstance.createMany({ data: rows.slice(i, i + batchSize), skipDuplicates: true });
    created += result.count;
  }
  if (args.get('refresh-status') === true) {
    const changedTemplateIds = new Set(missing.map((item) => item.template.id));
    for (const templateId of changedTemplateIds) {
      await refreshTemplateStatus(prisma, templateId);
    }
  }
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  facility: facilityName,
  startDay,
  horizonDays,
  templates: templates.length,
  existingInstancesInWindow: instances.length,
  missingInstances: missing.length,
  created,
  first14Days: Object.fromEntries(Object.entries(byDay).slice(0, 14)),
  sampleMissing: missing.slice(0, 25).map((item) => ({ title: item.template.title, zone: item.template.zone?.name, group: item.template.taskGroup?.name, day: item.day, dueAt: item.dueAt })),
}, null, 2));

await prisma.$disconnect();
