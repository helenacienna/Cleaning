import { getPrisma } from '../lib/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const SAFE_STATUSES = ['scheduled', 'upcoming', 'due', 'unscheduled'];

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
function boardDate(date) { return new Date(new Date(date).getTime() + 10 * 60 * 60 * 1000); }
function boardDayKey(date) { return boardDate(date).toISOString().slice(0, 10); }
function boardWeekday(date) { return boardDate(date).getUTCDay(); }
function monthKey(date) { const d = boardDate(date); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function designatedWeekday(template) {
  const configured = String(template?.recurrenceRule?.designatedDay ?? template?.targetDays?.[0] ?? '').toLowerCase();
  return Number.isInteger(WEEKDAY_INDEX[configured]) ? WEEKDAY_INDEX[configured] : null;
}
function weekBucket(date, startDate) { return Math.floor((new Date(date).getTime() - startDate.getTime()) / (7 * DAY_MS)); }
function chooseKeep(rows, template) {
  const sorted = [...rows].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  if (template.recurrenceType === 'weekly') {
    const target = designatedWeekday(template);
    if (target !== null) {
      const matching = sorted.find((row) => boardWeekday(row.dueAt) === target);
      if (matching) return matching;
    }
  }
  return sorted[0];
}
function bucketFor(instance, template, start) {
  if (template.recurrenceType === 'daily') return boardDayKey(instance.dueAt);
  if (template.recurrenceType === 'weekly') return String(weekBucket(instance.dueAt, start));
  if (template.recurrenceType === 'monthly') return monthKey(instance.dueAt);
  return null;
}

const args = parseArgs(process.argv);
const apply = args.get('apply') === true;
const facilityArg = args.get('facility') || 'all';
const startDay = args.get('start') || new Date().toISOString().slice(0, 10);
const horizonDays = Number.parseInt(args.get('horizon-days') || '90', 10);
const start = startOfBoardDay(startDay);
const end = addDays(start, horizonDays);
const prisma = await getPrisma();
if (!prisma) throw new Error('DATABASE_URL missing');
const facilities = facilityArg === 'all'
  ? await prisma.facility.findMany({ orderBy: { name: 'asc' } })
  : [await prisma.facility.findFirst({ where: { name: facilityArg } })].filter(Boolean);
if (!facilities.length) throw new Error(`No facilities matched: ${facilityArg}`);

const result = { mode: apply ? 'apply' : 'dry-run', startDay, horizonDays, facilities: [] };
for (const facility of facilities) {
  const templates = await prisma.taskTemplate.findMany({
    where: { facilityId: facility.id, active: true, autoGenerateInstances: true, recurrenceType: { in: ['daily', 'weekly', 'monthly'] } },
    select: { id: true, title: true, recurrenceType: true, recurrenceRule: true, targetDays: true },
  });
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const instances = await prisma.taskInstance.findMany({
    where: {
      facilityId: facility.id,
      dueAt: { gte: start, lt: end },
      status: { in: SAFE_STATUSES },
      taskTemplateId: { in: templates.map((template) => template.id) },
    },
    select: { id: true, taskTemplateId: true, dueAt: true, status: true },
    orderBy: [{ taskTemplateId: 'asc' }, { dueAt: 'asc' }],
  });

  const groups = new Map();
  for (const instance of instances) {
    const template = templateById.get(instance.taskTemplateId);
    if (!template) continue;
    const bucket = bucketFor(instance, template, start);
    if (bucket === null) continue;
    const key = `${template.id}::${template.recurrenceType}::${bucket}`;
    const rows = groups.get(key) || [];
    rows.push(instance);
    groups.set(key, rows);
  }

  const deleteIds = [];
  const repairs = [];
  for (const [key, rows] of groups.entries()) {
    if (rows.length <= 1) continue;
    const template = templateById.get(rows[0].taskTemplateId);
    const keep = chooseKeep(rows, template);
    const remove = rows.filter((row) => row.id !== keep.id);
    deleteIds.push(...remove.map((row) => row.id));
    repairs.push({
      key,
      frequency: template.recurrenceType,
      title: template.title,
      kept: { id: keep.id, day: boardDayKey(keep.dueAt), dueAt: keep.dueAt, status: keep.status },
      removed: remove.map((row) => ({ id: row.id, day: boardDayKey(row.dueAt), dueAt: row.dueAt, status: row.status })),
    });
  }

  let deleted = 0;
  if (apply && deleteIds.length) {
    const deleteResult = await prisma.taskInstance.deleteMany({ where: { id: { in: deleteIds } } });
    deleted = deleteResult.count;
  }

  result.facilities.push({
    facility: facility.name,
    templatesInspected: templates.length,
    instancesInspected: instances.length,
    duplicateBuckets: repairs.length,
    duplicateInstancesToDelete: deleteIds.length,
    deleted,
    repairsByFrequency: repairs.reduce((acc, repair) => {
      acc[repair.frequency] = (acc[repair.frequency] || 0) + repair.removed.length;
      return acc;
    }, {}),
    sampleRepairs: repairs.slice(0, 12),
  });
}
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
