import { getPrisma } from '../lib/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 10 * 60 * 60 * 1000;
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
function boardDate(date) { return new Date(new Date(date).getTime() + TZ_OFFSET_MS); }
function boardDayKey(date) { return boardDate(date).toISOString().slice(0, 10); }
function boardWeekday(date) { return boardDate(date).getUTCDay(); }
function designatedWeekday(template) {
  const configured = String(template?.recurrenceRule?.designatedDay ?? template?.targetDays?.[0] ?? '').toLowerCase();
  return Number.isInteger(WEEKDAY_INDEX[configured]) ? WEEKDAY_INDEX[configured] : null;
}
function targetDueAtForWeekday(existingDueAt, targetWeekday) {
  const local = boardDate(existingDueAt);
  const currentWeekday = local.getUTCDay();
  const offset = targetWeekday - currentWeekday;
  const targetLocal = new Date(local.getTime() + offset * DAY_MS);
  return new Date(targetLocal.getTime() - TZ_OFFSET_MS);
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
const result = { mode: apply ? 'apply' : 'dry-run', startDay, horizonDays, facilities: [] };
for (const facility of facilities) {
  const instances = await prisma.taskInstance.findMany({
    where: {
      facilityId: facility.id,
      dueAt: { gte: start, lt: end },
      status: { in: SAFE_STATUSES },
      taskTemplate: { recurrenceType: 'weekly' },
    },
    include: { taskTemplate: { select: { id: true, title: true, targetDays: true, recurrenceRule: true } } },
    orderBy: [{ taskTemplateId: 'asc' }, { dueAt: 'asc' }],
  });
  const moves = [];
  for (const instance of instances) {
    const target = designatedWeekday(instance.taskTemplate);
    if (target === null || boardWeekday(instance.dueAt) === target) continue;
    const nextDueAt = targetDueAtForWeekday(instance.dueAt, target);
    if (nextDueAt < start || nextDueAt >= end) continue;
    moves.push({
      id: instance.id,
      title: instance.taskTemplate.title,
      fromDay: boardDayKey(instance.dueAt),
      toDay: boardDayKey(nextDueAt),
      fromDueAt: instance.dueAt,
      toDueAt: nextDueAt,
      targetDays: instance.taskTemplate.targetDays,
    });
  }
  let updated = 0;
  if (apply) {
    for (const move of moves) {
      await prisma.taskInstance.update({ where: { id: move.id }, data: { dueAt: move.toDueAt, scheduledForAt: move.toDueAt, plannedRunDate: startOfBoardDay(move.toDay) } });
      updated += 1;
    }
  }
  result.facilities.push({ facility: facility.name, inspectedWeeklyInstances: instances.length, movesNeeded: moves.length, updated, sampleMoves: moves.slice(0, 20) });
}
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
