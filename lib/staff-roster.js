const WEEKDAY_OPTIONS = [
  { key: 'mon', label: 'Mon', index: 1 },
  { key: 'tue', label: 'Tue', index: 2 },
  { key: 'wed', label: 'Wed', index: 3 },
  { key: 'thu', label: 'Thu', index: 4 },
  { key: 'fri', label: 'Fri', index: 5 },
  { key: 'sat', label: 'Sat', index: 6 },
  { key: 'sun', label: 'Sun', index: 0 },
];

const DEFAULT_SHIFT = {
  facilityId: '',
  facilityName: '',
  start: '',
  finish: '',
};

const DEFAULT_DAY_ROSTER = {
  enabled: false,
  start: '',
  finish: '',
  label: '',
  shifts: [],
};

function normalizeTime(value) {
  const trimmed = String(value ?? '').trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : '';
}

function normalizeShift(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    facilityId: String(source.facilityId ?? '').trim(),
    facilityName: String(source.facilityName ?? source.location ?? '').trim(),
    start: normalizeTime(source.start),
    finish: normalizeTime(source.finish),
  };
}

function normalizeDayRoster(value, fallback = {}) {
  if (typeof value === 'boolean') {
    return {
      ...DEFAULT_DAY_ROSTER,
      enabled: value,
      start: normalizeTime(fallback.start),
      finish: normalizeTime(fallback.finish),
      label: String(fallback.label ?? '').trim(),
      shifts: Array.isArray(fallback.shifts) ? fallback.shifts.map(normalizeShift) : [],
    };
  }

  const source = value && typeof value === 'object' ? value : {};
  const shifts = Array.isArray(source.shifts) ? source.shifts.map(normalizeShift) : [];
  const enabled = Boolean(source.enabled) || Boolean(source.start) || Boolean(source.finish) || shifts.length > 0;

  return {
    enabled,
    start: normalizeTime(source.start),
    finish: normalizeTime(source.finish),
    label: String(source.label ?? '').trim(),
    shifts,
  };
}

export function normalizeWeeklyRoster(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    WEEKDAY_OPTIONS.map(({ key }) => [key, normalizeDayRoster(source[key], fallback[key] || {})]),
  );
}

export function getRosterDayKey(boardDayKey) {
  if (!boardDayKey || !/^\d{4}-\d{2}-\d{2}$/.test(boardDayKey)) {
    return null;
  }

  const date = new Date(`${boardDayKey}T00:00:00+10:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const dayIndex = date.getUTCDay();
  return WEEKDAY_OPTIONS.find((day) => day.index === dayIndex)?.key ?? null;
}

export function formatRosterTime(value) {
  const normalized = normalizeTime(value);
  if (!normalized) {
    return '';
  }

  const [hourText, minuteText] = normalized.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return normalized;
  }

  const suffix = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 || 12;
  return minute === 0 ? `${displayHour}${suffix}` : `${displayHour}:${String(minute).padStart(2, '0')}${suffix}`;
}

export function formatRosterWindow(start, finish) {
  const formattedStart = formatRosterTime(start);
  const formattedFinish = formatRosterTime(finish);
  if (formattedStart && formattedFinish) {
    return `${formattedStart}–${formattedFinish}`;
  }
  if (formattedStart) {
    return `Starts ${formattedStart}`;
  }
  if (formattedFinish) {
    return `Until ${formattedFinish}`;
  }
  return '';
}

export function normalizeRosterOverrides(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = {};

  for (const [staffId, entries] of Object.entries(source)) {
    if (!staffId || !entries || typeof entries !== 'object') {
      continue;
    }
    const nextEntries = {};
    for (const [dateKey, entry] of Object.entries(entries)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !entry || typeof entry !== 'object') {
        continue;
      }
      const type = ['off', 'leave', 'custom'].includes(String(entry.type || '').toLowerCase())
        ? String(entry.type).toLowerCase()
        : 'custom';
      nextEntries[dateKey] = {
        type,
        start: normalizeTime(entry.start),
        finish: normalizeTime(entry.finish),
        label: String(entry.label ?? '').trim(),
        note: String(entry.note ?? '').trim(),
      };
    }
    normalized[staffId] = nextEntries;
  }

  return normalized;
}

export function resolveRosterForBoardDay({ boardDayKey, weeklyRoster, overrides, preferredShiftLabel = '' }) {
  const normalizedWeekly = normalizeWeeklyRoster(weeklyRoster);
  const normalizedOverrides = normalizeRosterOverrides(overrides);
  const override = boardDayKey ? normalizedOverrides?.[boardDayKey] : null;

  if (override?.type === 'off' || override?.type === 'leave') {
    return {
      source: 'override',
      status: override.type === 'leave' ? 'On leave' : 'Off today',
      isWorking: false,
      start: '',
      finish: '',
      label: override.label || '',
      note: override.note || '',
      summary: override.type === 'leave' ? 'On leave' : 'Off today',
      shifts: [],
    };
  }

  if (override?.type === 'custom') {
    const windowLabel = formatRosterWindow(override.start, override.finish);
    return {
      source: 'override',
      status: override.start || override.finish ? 'On today' : 'Custom',
      isWorking: true,
      start: override.start,
      finish: override.finish,
      label: override.label || preferredShiftLabel || '',
      note: override.note || '',
      summary: [windowLabel, override.label || preferredShiftLabel].filter(Boolean).join(' · ') || 'Custom shift',
      shifts: [],
    };
  }

  const dayKey = getRosterDayKey(boardDayKey);
  const dayRoster = dayKey ? normalizedWeekly[dayKey] : null;

  if (!dayRoster?.enabled) {
    return {
      source: 'weekly',
      status: 'Off today',
      isWorking: false,
      start: '',
      finish: '',
      label: '',
      note: '',
      summary: 'Off today',
      shifts: [],
    };
  }

  const windowLabel = formatRosterWindow(dayRoster.start, dayRoster.finish);
  return {
    source: 'weekly',
    status: 'On today',
    isWorking: true,
    start: dayRoster.start,
    finish: dayRoster.finish,
    label: dayRoster.label || preferredShiftLabel || '',
    note: '',
    summary: [windowLabel, dayRoster.label || preferredShiftLabel].filter(Boolean).join(' · ') || 'Scheduled today',
    shifts: dayRoster.shifts || [],
  };
}

export { DEFAULT_DAY_ROSTER, DEFAULT_SHIFT, WEEKDAY_OPTIONS };