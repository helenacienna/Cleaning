import { getPrisma } from './prisma.js';
import {
  APP_TIME_ZONE_OPTIONS,
  DEFAULT_APP_TIME_ZONE,
  formatBoardDayKeyForTimeZone,
  formatBoardDayLabelForTimeZone,
  getTimeZoneFormatter,
  getTimeZoneOffsetMinutes,
  isValidTimeZone,
  normalizeAppTimeZone,
  zonedDateTimeToUtc,
} from './app-timezone-shared.js';

export const APP_TIME_ZONE_SETTING_KEY = 'business_time_zone';

export async function getAppTimeZone() {
  const prisma = await getPrisma();
  if (!prisma) {
    return DEFAULT_APP_TIME_ZONE;
  }

  const record = await prisma.appSetting.findUnique({ where: { key: APP_TIME_ZONE_SETTING_KEY } }).catch(() => null);
  return normalizeAppTimeZone(record?.value?.timeZone ?? record?.value ?? DEFAULT_APP_TIME_ZONE);
}

export async function saveAppTimeZone(timeZone) {
  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error('Database unavailable');
  }

  const normalized = normalizeAppTimeZone(timeZone);
  await prisma.appSetting.upsert({
    where: { key: APP_TIME_ZONE_SETTING_KEY },
    create: { key: APP_TIME_ZONE_SETTING_KEY, value: { timeZone: normalized } },
    update: { value: { timeZone: normalized } },
  });

  return normalized;
}

export {
  APP_TIME_ZONE_OPTIONS,
  DEFAULT_APP_TIME_ZONE,
  formatBoardDayKeyForTimeZone,
  formatBoardDayLabelForTimeZone,
  getTimeZoneFormatter,
  getTimeZoneOffsetMinutes,
  isValidTimeZone,
  normalizeAppTimeZone,
  zonedDateTimeToUtc,
};
