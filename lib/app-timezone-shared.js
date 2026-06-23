export const DEFAULT_APP_TIME_ZONE = 'Australia/Brisbane';
export const APP_TIME_ZONE_OPTIONS = [
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Halifax',
  'America/St_Johns',
];

const formatterCache = new Map();
const partsCache = new Map();

export function isValidTimeZone(value) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeAppTimeZone(value, fallback = DEFAULT_APP_TIME_ZONE) {
  const candidate = String(value || '').trim();
  return isValidTimeZone(candidate) ? candidate : fallback;
}

export function getTimeZoneFormatter(locale = 'en-AU', timeZone = DEFAULT_APP_TIME_ZONE, options = {}) {
  const normalizedTimeZone = normalizeAppTimeZone(timeZone);
  const cacheKey = JSON.stringify([locale, normalizedTimeZone, options]);
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, { ...options, timeZone: normalizedTimeZone }));
  }
  return formatterCache.get(cacheKey);
}

function getPartsFormatter(timeZone = DEFAULT_APP_TIME_ZONE) {
  const normalizedTimeZone = normalizeAppTimeZone(timeZone);
  const cacheKey = `parts:${normalizedTimeZone}`;
  if (!partsCache.has(cacheKey)) {
    partsCache.set(cacheKey, new Intl.DateTimeFormat('en-US', {
      timeZone: normalizedTimeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }));
  }
  return partsCache.get(cacheKey);
}

export function getTimeZoneOffsetMinutes(date, timeZone = DEFAULT_APP_TIME_ZONE) {
  const formatter = getPartsFormatter(timeZone);
  const parts = formatter.formatToParts(new Date(date));
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((asUtc - new Date(date).getTime()) / 60000);
}

export function zonedDateTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = DEFAULT_APP_TIME_ZONE) {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(guessUtc), timeZone);
  return new Date(guessUtc - (offsetMinutes * 60 * 1000));
}

export function formatBoardDayKeyForTimeZone(value, timeZone = DEFAULT_APP_TIME_ZONE) {
  return getTimeZoneFormatter('sv-SE', timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function formatBoardDayLabelForTimeZone(value, timeZone = DEFAULT_APP_TIME_ZONE) {
  return getTimeZoneFormatter('en-AU', timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value)).replace(',', '');
}
