import { DEFAULT_APP_TIME_ZONE, zonedDateTimeToUtc } from './app-timezone-shared.js';
import { formatBoardDayKey } from './task-effective-day.mjs';
const DEFAULT_PAST_DAYS = 3;
const DEFAULT_FUTURE_DAYS = 14;
const DEFAULT_TOP_UP_BUFFER_DAYS = 4;

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function parseWindowInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function getOperationalWindowConfig(env = process.env) {
  return {
    pastDays: parseWindowInteger(env.OPERATIONAL_WINDOW_DAYS_PAST, DEFAULT_PAST_DAYS),
    futureDays: parseWindowInteger(env.OPERATIONAL_WINDOW_DAYS_FUTURE, DEFAULT_FUTURE_DAYS),
    topUpBufferDays: parseWindowInteger(env.OPERATIONAL_WINDOW_TOP_UP_BUFFER_DAYS, DEFAULT_TOP_UP_BUFFER_DAYS),
  };
}

export function getOperationalWindow({ now = new Date(), env = process.env, timeZone = DEFAULT_APP_TIME_ZONE } = {}) {
  const { pastDays, futureDays, topUpBufferDays } = getOperationalWindowConfig(env);
  const todayKey = formatBoardDayKey(now, timeZone);
  const fromKey = formatBoardDayKey(addDays(now, -pastDays), timeZone);
  const toKey = formatBoardDayKey(addDays(now, futureDays), timeZone);
  const topUpThresholdKey = formatBoardDayKey(addDays(now, futureDays - topUpBufferDays), timeZone);
  const [fromYear, fromMonth, fromDay] = fromKey.split('-').map(Number);
  const [nextYear, nextMonth, nextDay] = formatBoardDayKey(addDays(now, futureDays + 1), timeZone).split('-').map(Number);
  const dueAtGte = zonedDateTimeToUtc({ year: fromYear, month: fromMonth, day: fromDay, hour: 0, minute: 0, second: 0 }, timeZone);
  const dueAtLt = zonedDateTimeToUtc({ year: nextYear, month: nextMonth, day: nextDay, hour: 0, minute: 0, second: 0 }, timeZone);

  return {
    todayKey,
    fromKey,
    toKey,
    topUpThresholdKey,
    pastDays,
    futureDays,
    topUpBufferDays,
    runDateGte: new Date(`${fromKey}T00:00:00.000Z`),
    runDateLte: new Date(`${toKey}T00:00:00.000Z`),
    dueAtGte,
    dueAtLt,
  };
}
