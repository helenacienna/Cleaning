import { getPrisma } from './prisma';
import { normalizeRosterOverrides } from './staff-roster';
import { APP_TIME_ZONE_OPTIONS, getAppTimeZone, saveAppTimeZone } from './app-timezone.js';

const BOARD_THEME_SETTING_KEY = 'board_theme';
const DASHBOARD_STAFF_ORDER_SETTING_KEY = 'dashboard_staff_order';
const STAFF_ROSTER_OVERRIDES_SETTING_KEY = 'staff_roster_overrides';

const DEFAULT_BOARD_THEME = {
  staff: {
    Tony: { background: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
    Loretta: { background: '#fce7f3', border: '#ec4899', text: '#be185d' },
    Luke: { background: '#dcfce7', border: '#22c55e', text: '#15803d' },
    Chris: { background: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  },
  facilities: {
    Cienna: { background: '#cdefff', border: '#59c3ff' },
    Boheme: { background: '#c9f7d8', border: '#22c55e' },
    Holiday: { background: '#fde68a', border: '#f59e0b' },
    'Best Stays': { background: '#fde68a', border: '#f59e0b' },
    'Cienna North': { background: '#cdefff', border: '#59c3ff' },
    'Cienna Central': { background: '#c9f7d8', border: '#22c55e' },
    'Cienna South': { background: '#fde68a', border: '#f59e0b' },
  },
  sections: {
    daily: { background: '#dbeafe', border: '#60a5fa' },
    periodic: { background: '#dcfce7', border: '#4ade80' },
    unscheduled: { background: '#ffedd5', border: '#fb923c' },
  },
};

function slugifyThemeKey(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function withAlpha(hex, alphaHex) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }
  return `${normalized}${alphaHex}`;
}

function normalizeHex(value, fallback = '') {
  const trimmed = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split('').map((char) => `${char}${char}`).join('').toUpperCase()}`;
  }
  return fallback;
}

function mergeThemeMap(defaultMap = {}, savedMap = {}, normalizer) {
  const merged = { ...defaultMap };
  for (const [key, value] of Object.entries(savedMap || {})) {
    merged[key] = normalizer({ ...(defaultMap[key] || {}), ...(value || {}) });
  }
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, normalizer(value)]),
  );
}

function normalizeStaffTheme(theme = {}) {
  return {
    background: normalizeHex(theme.background, '#E2E8F0'),
    border: normalizeHex(theme.border, '#94A3B8'),
    text: normalizeHex(theme.text, '#0F172A'),
  };
}

function normalizeSurfaceTheme(theme = {}) {
  return {
    background: normalizeHex(theme.background, '#FFFFFF'),
    border: normalizeHex(theme.border, '#CBD5E1'),
  };
}

export function normalizeBoardThemeSettings(settings = {}) {
  return {
    staff: mergeThemeMap(DEFAULT_BOARD_THEME.staff, settings.staff, normalizeStaffTheme),
    facilities: mergeThemeMap(DEFAULT_BOARD_THEME.facilities, settings.facilities, normalizeSurfaceTheme),
    sections: mergeThemeMap(DEFAULT_BOARD_THEME.sections, settings.sections, normalizeSurfaceTheme),
  };
}

export async function getBoardThemeSettings() {
  const prisma = await getPrisma();
  if (!prisma) {
    return normalizeBoardThemeSettings(DEFAULT_BOARD_THEME);
  }

  const record = await prisma.appSetting.findUnique({ where: { key: BOARD_THEME_SETTING_KEY } }).catch(() => null);
  return normalizeBoardThemeSettings(record?.value || DEFAULT_BOARD_THEME);
}

export async function saveBoardThemeSettings(settings = {}) {
  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error('Database unavailable');
  }

  const normalized = normalizeBoardThemeSettings(settings);
  await prisma.appSetting.upsert({
    where: { key: BOARD_THEME_SETTING_KEY },
    create: { key: BOARD_THEME_SETTING_KEY, value: normalized },
    update: { value: normalized },
  });

  return normalized;
}

export function normalizeDashboardStaffOrderSettings(settings = {}) {
  const sections = ['daily', 'periodic'];
  const normalized = {};

  for (const section of sections) {
    const sectionValue = settings?.[section] && typeof settings[section] === 'object' ? settings[section] : {};
    normalized[section] = Object.fromEntries(
      Object.entries(sectionValue).map(([facilityName, staffNames]) => [
        facilityName,
        Array.isArray(staffNames) ? [...new Set(staffNames.map((name) => String(name || '').trim()).filter(Boolean))] : [],
      ]),
    );
  }

  return normalized;
}

export async function getDashboardStaffOrderSettings() {
  const prisma = await getPrisma();
  if (!prisma) {
    return normalizeDashboardStaffOrderSettings({});
  }

  const record = await prisma.appSetting.findUnique({ where: { key: DASHBOARD_STAFF_ORDER_SETTING_KEY } }).catch(() => null);
  return normalizeDashboardStaffOrderSettings(record?.value || {});
}

export async function saveDashboardStaffOrderSettings(settings = {}) {
  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error('Database unavailable');
  }

  const normalized = normalizeDashboardStaffOrderSettings(settings);
  await prisma.appSetting.upsert({
    where: { key: DASHBOARD_STAFF_ORDER_SETTING_KEY },
    create: { key: DASHBOARD_STAFF_ORDER_SETTING_KEY, value: normalized },
    update: { value: normalized },
  });

  return normalized;
}

export async function getStaffRosterOverrides() {
  const prisma = await getPrisma();
  if (!prisma) {
    return normalizeRosterOverrides({});
  }

  const record = await prisma.appSetting.findUnique({ where: { key: STAFF_ROSTER_OVERRIDES_SETTING_KEY } }).catch(() => null);
  return normalizeRosterOverrides(record?.value || {});
}

export async function saveStaffRosterOverrides(settings = {}) {
  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error('Database unavailable');
  }

  const normalized = normalizeRosterOverrides(settings);
  await prisma.appSetting.upsert({
    where: { key: STAFF_ROSTER_OVERRIDES_SETTING_KEY },
    create: { key: STAFF_ROSTER_OVERRIDES_SETTING_KEY, value: normalized },
    update: { value: normalized },
  });

  return normalized;
}

export async function getBoardThemeEditorData() {
  const prisma = await getPrisma();
  const settings = await getBoardThemeSettings();

  if (!prisma) {
    return {
      settings,
      source: 'unavailable',
      staffNames: Object.keys(settings.staff),
      facilityNames: Object.keys(settings.facilities),
    };
  }

  const [staffRows, facilityRows] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, orderBy: { fullName: 'asc' }, select: { fullName: true } }).catch(() => []),
    prisma.facility.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { name: true } }).catch(() => []),
  ]);

  const staffNames = [...new Set([...Object.keys(settings.staff), ...staffRows.map((row) => row.fullName).filter(Boolean)])].sort();
  const facilityNames = [...new Set([...Object.keys(settings.facilities), ...facilityRows.map((row) => row.name).filter(Boolean)])].sort();

  return {
    settings,
    source: 'prisma',
    staffNames,
    facilityNames,
  };
}

export async function getAppSettingsEditorData() {
  const [themeEditorData, timeZone] = await Promise.all([
    getBoardThemeEditorData(),
    getAppTimeZone(),
  ]);

  return {
    ...themeEditorData,
    timeZone,
    timeZoneOptions: APP_TIME_ZONE_OPTIONS,
  };
}

export async function saveAppSettings({ settings = null, timeZone = null } = {}) {
  const result = {};

  if (settings && typeof settings === 'object') {
    result.settings = await saveBoardThemeSettings(settings);
  } else {
    result.settings = await getBoardThemeSettings();
  }

  result.timeZone = timeZone ? await saveAppTimeZone(timeZone) : await getAppTimeZone();
  result.timeZoneOptions = APP_TIME_ZONE_OPTIONS;

  return result;
}

export function buildBoardThemeCss(settings = {}) {
  const normalized = normalizeBoardThemeSettings(settings);
  const css = [];

  css.push(':root {');
  css.push(`  --section-daily-background: ${withAlpha(normalized.sections.daily.background, 'E6')};`);
  css.push(`  --section-daily-border: ${withAlpha(normalized.sections.daily.border, '66')};`);
  css.push(`  --section-periodic-background: ${withAlpha(normalized.sections.periodic.background, 'E6')};`);
  css.push(`  --section-periodic-border: ${withAlpha(normalized.sections.periodic.border, '66')};`);
  css.push(`  --section-unscheduled-background: ${withAlpha(normalized.sections.unscheduled.background, 'EB')};`);
  css.push(`  --section-unscheduled-border: ${withAlpha(normalized.sections.unscheduled.border, '73')};`);
  css.push('}');

  for (const [staffName, theme] of Object.entries(normalized.staff)) {
    const slug = slugifyThemeKey(staffName);
    if (!slug) continue;
    css.push(`.staff-theme-${slug} { --staff-tag-background: ${theme.background}; --staff-tag-border: ${theme.border}; --staff-tag-text: ${theme.text}; }`);
  }

  for (const [facilityName, theme] of Object.entries(normalized.facilities)) {
    const slug = slugifyThemeKey(facilityName);
    if (!slug) continue;
    css.push(`.facility-theme-${slug} { --facility-theme-background-soft: ${withAlpha(theme.background, 'F2')}; --facility-theme-background-strong: ${withAlpha(theme.background, 'D9')}; --facility-theme-border: ${theme.border}; --facility-theme-progress-border: ${theme.border}; }`);
  }

  return css.join('\n');
}

export { BOARD_THEME_SETTING_KEY, DASHBOARD_STAFF_ORDER_SETTING_KEY, STAFF_ROSTER_OVERRIDES_SETTING_KEY, DEFAULT_BOARD_THEME, slugifyThemeKey };
