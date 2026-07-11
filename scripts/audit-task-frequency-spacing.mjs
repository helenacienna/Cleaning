import { getPrisma } from '../lib/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const ACTIVE_STATUSES = ['scheduled', 'upcoming', 'due', 'unscheduled'];

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
function dayKey(date) { return boardDate(date).toISOString().slice(0, 10); }
function boardWeekday(date) { return boardDate(date).getUTCDay(); }
function boardDayOrdinal(date) { return Math.floor(boardDate(date).getTime() / DAY_MS); }
function designatedWeekday(template) {
  const configured = String(template?.recurrenceRule?.designatedDay ?? template?.targetDays?.[0] ?? '').toLowerCase();
  return Number.isInteger(WEEKDAY_INDEX[configured]) ? WEEKDAY_INDEX[configured] : null;
}
function minGapDays(recurrenceType) {
  if (recurrenceType === 'daily') return 1;
  if (recurrenceType === 'weekly') return 7;
  if (recurrenceType === 'monthly') return 25;
  return null;
}
function expectedRange(horizonDays, recurrenceType) {
  if (recurrenceType === 'daily') return { min: horizonDays - 1, max: horizonDays + 1 };
  if (recurrenceType === 'weekly') return { min: Math.floor(horizonDays / 7), max: Math.ceil(horizonDays / 7) + 1 };
  if (recurrenceType === 'monthly') return { min: Math.floor(horizonDays / 31), max: Math.ceil(horizonDays / 25) + 1 };
  return { min: 0, max: horizonDays };
}

const args = parseArgs(process.argv);
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
  where: { facilityId: facility.id, active: true, autoGenerateInstances: true },
  include: { zone: true, taskGroup: true },
  orderBy: [{ recurrenceType: 'asc' }, { title: 'asc' }],
});
const instances = await prisma.taskInstance.findMany({
  where: { facilityId: facility.id, dueAt: { gte: start, lt: end }, status: { in: ACTIVE_STATUSES } },
  select: { id: true, taskTemplateId: true, dueAt: true, status: true },
  orderBy: [{ taskTemplateId: 'asc' }, { dueAt: 'asc' }],
});
const byTemplate = new Map();
for (const instance of instances) {
  const arr = byTemplate.get(instance.taskTemplateId) || [];
  arr.push(instance);
  byTemplate.set(instance.taskTemplateId, arr);
}
const issues = [];
const summaryByFrequency = {};
for (const template of templates) {
  const rows = byTemplate.get(template.id) || [];
  const recurrenceType = template.recurrenceType || 'none';
  summaryByFrequency[recurrenceType] ??= { templates: 0, instances: 0, issueTemplates: 0 };
  summaryByFrequency[recurrenceType].templates += 1;
  summaryByFrequency[recurrenceType].instances += rows.length;
  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) gaps.push(boardDayOrdinal(rows[i].dueAt) - boardDayOrdinal(rows[i - 1].dueAt));
  const minGap = minGapDays(recurrenceType);
  const gapErrors = minGap === null ? [] : gaps.map((gap, index) => ({ gap, from: rows[index], to: rows[index + 1] })).filter((item) => item.gap < minGap - 0.05);
  const range = expectedRange(horizonDays, recurrenceType);
  const countError = rows.length < range.min || rows.length > range.max;
  const weekday = designatedWeekday(template);
  const weekdayErrors = recurrenceType === 'weekly' && weekday !== null
    ? rows.filter((row) => boardWeekday(row.dueAt) !== weekday)
    : [];
  if (gapErrors.length || countError || weekdayErrors.length) {
    summaryByFrequency[recurrenceType].issueTemplates += 1;
    issues.push({
      templateId: template.id,
      title: template.title,
      recurrenceType,
      zone: template.zone?.name,
      targetDays: template.targetDays,
      recurrenceRule: template.recurrenceRule,
      count: rows.length,
      expectedCountRange: range,
      dates: rows.slice(0, 40).map((row) => ({ id: row.id, day: dayKey(row.dueAt), dueAt: row.dueAt, status: row.status })),
      gapErrors: gapErrors.slice(0, 20).map((item) => ({ gapDays: item.gap, from: dayKey(item.from.dueAt), to: dayKey(item.to.dueAt) })),
      weekdayErrors: weekdayErrors.slice(0, 20).map((row) => ({ day: dayKey(row.dueAt), dueAt: row.dueAt })),
    });
  }
}
console.log(JSON.stringify({ facility: facilityName, startDay, horizonDays, templates: templates.length, instances: instances.length, summaryByFrequency, issueTemplateCount: issues.length, issues: issues.slice(0, 80) }, null, 2));
await prisma.$disconnect();
