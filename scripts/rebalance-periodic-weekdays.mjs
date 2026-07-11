#!/usr/bin/env node
import { getPrisma } from '../lib/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 10 * 60 * 60 * 1000;
const SAFE_STATUSES = ['scheduled', 'upcoming', 'due', 'unscheduled'];
const PERIODIC_RECURRENCES = ['weekly', 'monthly', 'custom'];
const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WORKDAY_INDEXES = [1, 2, 3, 4, 5];

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
function boardDayOrdinal(date) { return Math.floor(boardDate(date).getTime() / DAY_MS); }
function boardWeekStart(date) {
  const weekday = boardWeekday(date);
  const offsetToMonday = (weekday + 6) % 7;
  return addDays(startOfBoardDay(boardDayKey(date)), -offsetToMonday);
}
function dueAtOnBoardDayKeepingTime(existingDueAt, targetDayKey) {
  const local = boardDate(existingDueAt);
  const targetLocalStart = boardDate(startOfBoardDay(targetDayKey));
  const msSinceLocalMidnight = local.getTime() - new Date(local.toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime();
  return new Date(targetLocalStart.getTime() + msSinceLocalMidnight - TZ_OFFSET_MS);
}
function dateRangeWorkdaysForWeekContaining(date) {
  const monday = boardWeekStart(date);
  return WORKDAY_INDEXES.map((_, index) => boardDayKey(addDays(monday, index)));
}
function countByDay(rows) {
  const out = {};
  for (const row of rows) {
    const day = row.day ?? boardDayKey(row.dueAt);
    const recurrence = row.recurrenceType ?? row.taskTemplate?.recurrenceType ?? 'unknown';
    out[day] ??= { total: 0, weekly: 0, monthly: 0, custom: 0, weekend: [0, 6].includes(boardWeekday(startOfBoardDay(day))) };
    out[day].total += 1;
    out[day][recurrence] = (out[day][recurrence] || 0) + 1;
  }
  return out;
}
function weekdayLoadSummary(dayCounts, start, horizonDays) {
  const totals = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
  for (let i = 0; i < horizonDays; i += 1) {
    const day = boardDayKey(addDays(start, i));
    totals[WEEKDAY_NAMES[boardWeekday(startOfBoardDay(day))]] += dayCounts[day]?.total ?? 0;
  }
  return totals;
}
function chooseLowestLoadDay(candidateDays, load) {
  return [...candidateDays]
    .sort((a, b) => (load.get(a) || 0) - (load.get(b) || 0) || boardDayOrdinal(startOfBoardDay(a)) - boardDayOrdinal(startOfBoardDay(b)))[0];
}
function recurrenceRuleWithDay(rule, weekdayName) {
  const base = rule && typeof rule === 'object' && !Array.isArray(rule) ? { ...rule } : {};
  base.designatedDay = weekdayName;
  return base;
}

const args = parseArgs(process.argv);
const apply = args.get('apply') === true;
const facilityArg = args.get('facility') || 'Cienna';
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
    where: { facilityId: facility.id, active: true, autoGenerateInstances: true, recurrenceType: { in: PERIODIC_RECURRENCES } },
    select: { id: true, title: true, recurrenceType: true, recurrenceRule: true, targetDays: true },
    orderBy: [{ recurrenceType: 'asc' }, { title: 'asc' }],
  });
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const instances = await prisma.taskInstance.findMany({
    where: {
      facilityId: facility.id,
      dueAt: { gte: start, lt: end },
      status: { in: SAFE_STATUSES },
      taskTemplateId: { in: templates.map((template) => template.id) },
    },
    select: { id: true, taskTemplateId: true, dueAt: true, scheduledForAt: true, plannedRunDate: true, status: true },
    orderBy: [{ dueAt: 'asc' }, { taskTemplateId: 'asc' }],
  });

  const beforeRows = instances.map((instance) => ({ ...instance, recurrenceType: templateById.get(instance.taskTemplateId)?.recurrenceType }));
  const load = new Map();
  const moves = [];
  const weeklyTemplateUpdates = new Map();

  const weeklyGroups = new Map();
  const otherInstances = [];
  for (const instance of instances) {
    const template = templateById.get(instance.taskTemplateId);
    if (!template) continue;
    if (template.recurrenceType === 'weekly') {
      const group = weeklyGroups.get(template.id) || { template, rows: [] };
      group.rows.push(instance);
      weeklyGroups.set(template.id, group);
    } else {
      otherInstances.push({ template, instance });
    }
  }

  const weeklyGroupsSorted = [...weeklyGroups.values()].sort((a, b) => b.rows.length - a.rows.length || a.template.title.localeCompare(b.template.title));
  for (const group of weeklyGroupsSorted) {
    const candidateScores = WORKDAY_INDEXES.map((weekday) => {
      let score = 0;
      const candidateMoves = [];
      for (const instance of group.rows) {
        const weekStart = boardWeekStart(instance.dueAt);
        const targetDay = boardDayKey(addDays(weekStart, weekday - 1));
        if (startOfBoardDay(targetDay) < start || startOfBoardDay(targetDay) >= end) {
          score += 9999;
          continue;
        }
        score += load.get(targetDay) || 0;
        candidateMoves.push({ instance, targetDay });
      }
      return { weekday, score, candidateMoves };
    }).sort((a, b) => a.score - b.score || a.weekday - b.weekday)[0];

    const weekdayName = WEEKDAY_NAMES[candidateScores.weekday];
    weeklyTemplateUpdates.set(group.template.id, { template: group.template, weekdayName });
    for (const item of candidateScores.candidateMoves) {
      load.set(item.targetDay, (load.get(item.targetDay) || 0) + 1);
      const fromDay = boardDayKey(item.instance.dueAt);
      if (fromDay !== item.targetDay) {
        moves.push({
          id: item.instance.id,
          templateId: group.template.id,
          title: group.template.title,
          recurrenceType: 'weekly',
          fromDay,
          toDay: item.targetDay,
          fromDueAt: item.instance.dueAt,
          toDueAt: dueAtOnBoardDayKeepingTime(item.instance.dueAt, item.targetDay),
        });
      }
    }
  }

  for (const { template, instance } of otherInstances) {
    const candidates = dateRangeWorkdaysForWeekContaining(instance.dueAt).filter((day) => startOfBoardDay(day) >= start && startOfBoardDay(day) < end);
    if (!candidates.length) continue;
    const targetDay = chooseLowestLoadDay(candidates, load);
    load.set(targetDay, (load.get(targetDay) || 0) + 1);
    const fromDay = boardDayKey(instance.dueAt);
    if (fromDay !== targetDay) {
      moves.push({
        id: instance.id,
        templateId: template.id,
        title: template.title,
        recurrenceType: template.recurrenceType,
        fromDay,
        toDay: targetDay,
        fromDueAt: instance.dueAt,
        toDueAt: dueAtOnBoardDayKeepingTime(instance.dueAt, targetDay),
      });
    }
  }

  let updatedInstances = 0;
  let updatedTemplates = 0;
  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const move of moves) {
        await tx.taskInstance.update({
          where: { id: move.id },
          data: { dueAt: move.toDueAt, scheduledForAt: move.toDueAt, plannedRunDate: startOfBoardDay(move.toDay) },
        });
        updatedInstances += 1;
      }
      for (const { template, weekdayName } of weeklyTemplateUpdates.values()) {
        await tx.taskTemplate.update({
          where: { id: template.id },
          data: { targetDays: [weekdayName], recurrenceRule: recurrenceRuleWithDay(template.recurrenceRule, weekdayName) },
        });
        updatedTemplates += 1;
      }
    }, { timeout: 180000 });
  }

  const afterRows = beforeRows.map((row) => {
    const move = moves.find((candidate) => candidate.id === row.id);
    return move ? { ...row, day: move.toDay } : { ...row, day: boardDayKey(row.dueAt) };
  });
  const beforeByDay = countByDay(beforeRows);
  const afterByDay = countByDay(afterRows);
  const weekendBefore = Object.entries(beforeByDay).filter(([day, stats]) => stats.weekend && stats.total > 0).map(([day, stats]) => ({ day, total: stats.total }));
  const weekendAfter = Object.entries(afterByDay).filter(([day, stats]) => stats.weekend && stats.total > 0).map(([day, stats]) => ({ day, total: stats.total }));

  result.facilities.push({
    facility: facility.name,
    templatesInspected: templates.length,
    instancesInspected: instances.length,
    movesNeeded: moves.length,
    updatedInstances,
    weeklyTemplateDayUpdates: weeklyTemplateUpdates.size,
    updatedTemplates,
    weekdayTotalsBefore: weekdayLoadSummary(beforeByDay, start, horizonDays),
    weekdayTotalsAfter: weekdayLoadSummary(afterByDay, start, horizonDays),
    weekendBefore,
    weekendAfter,
    first28DaysBefore: Object.fromEntries([...Array(Math.min(28, horizonDays)).keys()].map((i) => {
      const day = boardDayKey(addDays(start, i));
      return [day, beforeByDay[day]?.total || 0];
    })),
    first28DaysAfter: Object.fromEntries([...Array(Math.min(28, horizonDays)).keys()].map((i) => {
      const day = boardDayKey(addDays(start, i));
      return [day, afterByDay[day]?.total || 0];
    })),
    sampleMoves: moves.slice(0, 25),
  });
}

console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
