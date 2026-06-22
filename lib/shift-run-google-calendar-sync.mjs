import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SYNC_MARKER = 'Managed by Cienna Cleaning Platform';
const DEFAULT_TIME_ZONE = 'Australia/Brisbane';
const DEFAULT_DAYS_PAST = 7;
const DEFAULT_DAYS_FUTURE = 21;
const DEFAULT_STATE_PATH = path.join(process.cwd(), 'data/google-calendar-sync/shift-runs-state.json');

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addDaysToIsoDate(isoDate, days) {
  const next = new Date(`${isoDate}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDate(next);
}

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function normalizeText(value) {
  return value ? String(value).trim() : null;
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

function assertValidIsoDate(value, fieldName) {
  if (!value) {
    return;
  }
  if (!isValidIsoDate(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
}

function assertValidTimeZone(value) {
  try {
    Intl.DateTimeFormat('en-AU', { timeZone: value }).format(new Date());
  } catch {
    throw new Error(`Invalid SHIFT_RUN_SYNC_TIME_ZONE: ${value}`);
  }
}

export function resolveShiftRunWindow({ now = new Date(), from, to, daysPast = DEFAULT_DAYS_PAST, daysFuture = DEFAULT_DAYS_FUTURE } = {}) {
  assertValidIsoDate(from, 'SHIFT_RUN_SYNC_FROM');
  assertValidIsoDate(to, 'SHIFT_RUN_SYNC_TO');

  const resolvedFrom = from ?? toIsoDate(startOfDay(addDays(now, -daysPast)));
  const resolvedTo = to ?? toIsoDate(startOfDay(addDays(now, daysFuture)));

  if (resolvedFrom > resolvedTo) {
    throw new Error(`ShiftRun sync window is invalid: from ${resolvedFrom} is after ${resolvedTo}`);
  }

  return {
    from: resolvedFrom,
    to: resolvedTo,
  };
}

export function resolveShiftRunSyncConfig({ env = process.env, args = {} } = {}) {
  const window = resolveShiftRunWindow({
    now: args.now,
    from: args.from ?? env.SHIFT_RUN_SYNC_FROM,
    to: args.to ?? env.SHIFT_RUN_SYNC_TO,
    daysPast: parseInteger(args.daysPast ?? env.SHIFT_RUN_SYNC_DAYS_PAST, DEFAULT_DAYS_PAST),
    daysFuture: parseInteger(args.daysFuture ?? env.SHIFT_RUN_SYNC_DAYS_FUTURE, DEFAULT_DAYS_FUTURE),
  });

  const timeZone = args.timeZone ?? env.SHIFT_RUN_SYNC_TIME_ZONE ?? DEFAULT_TIME_ZONE;
  assertValidTimeZone(timeZone);

  return {
    calendarId: args.calendarId ?? env.GOOGLE_CALENDAR_SHIFT_RUNS_ID ?? null,
    statePath: path.resolve(args.statePath ?? env.SHIFT_RUN_SYNC_STATE_PATH ?? DEFAULT_STATE_PATH),
    dryRun: args.commit ? false : parseBoolean(args.dryRun ?? env.SHIFT_RUN_SYNC_DRY_RUN, true),
    allowBootstrap: parseBoolean(args.allowBootstrap ?? env.SHIFT_RUN_SYNC_ALLOW_BOOTSTRAP, false),
    timeZone,
    window,
  };
}

export function buildShiftRunCalendarEvent(shiftRun, { timeZone = DEFAULT_TIME_ZONE } = {}) {
  const assignedStaff = normalizeText(shiftRun.assignedStaff?.fullName) ?? 'Unassigned';
  const shiftLabel = normalizeText(shiftRun.shiftLabel) ?? 'Shift';
  const routeLabel = normalizeText(shiftRun.routeLabel);
  const organiserState = normalizeText(shiftRun.organiserState) ?? 'draft';
  const runDate = shiftRun.runDate ? toIsoDate(shiftRun.runDate) : null;
  const startAt = shiftRun.shiftStartAt ? new Date(shiftRun.shiftStartAt) : null;
  const endAt = shiftRun.shiftEndAt ? new Date(shiftRun.shiftEndAt) : null;
  const summary = `${assignedStaff} — ${shiftLabel}`;
  const descriptionLines = [
    SYNC_MARKER,
    `Shift code: ${shiftRun.shiftCode}`,
    `Shift run ID: ${shiftRun.id}`,
    `Assigned staff: ${assignedStaff}`,
    `Organiser state: ${organiserState}`,
    `Facility scope: ${shiftRun.facilityScope}`,
    `Run date: ${runDate ?? 'unknown'}`,
  ];

  if (routeLabel) {
    descriptionLines.push(`Route: ${routeLabel}`);
  }
  if (startAt) {
    descriptionLines.push(`Shift start: ${startAt.toISOString()}`);
  }
  if (endAt) {
    descriptionLines.push(`Shift end: ${endAt.toISOString()}`);
  }
  descriptionLines.push(`Source updated at: ${new Date(shiftRun.updatedAt).toISOString()}`);

  const baseEvent = {
    summary,
    description: descriptionLines.join('\n'),
    extendedProperties: {
      private: {
        openclawSourceType: 'shiftRun',
        openclawSourceId: shiftRun.id,
        openclawShiftCode: shiftRun.shiftCode,
      },
    },
  };

  if (startAt && endAt) {
    return {
      ...baseEvent,
      start: { dateTime: startAt.toISOString(), timeZone },
      end: { dateTime: endAt.toISOString(), timeZone },
    };
  }

  return {
    ...baseEvent,
    start: { date: runDate },
    end: { date: addDaysToIsoDate(runDate, 1) },
  };
}

export function buildDesiredShiftRunMirrorEntries(shiftRuns, { timeZone = DEFAULT_TIME_ZONE } = {}) {
  const desired = [];
  const skipped = [];

  for (const shiftRun of shiftRuns) {
    if (!shiftRun?.id || !shiftRun?.shiftCode || !shiftRun?.runDate || !shiftRun?.updatedAt) {
      skipped.push({
        shiftRunId: shiftRun?.id ?? null,
        shiftCode: shiftRun?.shiftCode ?? null,
        reason: 'missing-core-fields',
      });
      continue;
    }

    const event = buildShiftRunCalendarEvent(shiftRun, { timeZone });
    const fingerprint = sha256Json(event);

    desired.push({
      sourceId: shiftRun.id,
      shiftCode: shiftRun.shiftCode,
      sourceUpdatedAt: new Date(shiftRun.updatedAt).toISOString(),
      event,
      fingerprint,
    });
  }

  return { desired, skipped };
}

export function createEmptyShiftRunSyncState({ calendarId = null, window = null } = {}) {
  return {
    version: 1,
    mirror: 'shift-runs',
    calendarId,
    window,
    lastSyncedAt: null,
    entries: {},
  };
}

export async function readShiftRunSyncState(statePath, { calendarId = null, window = null } = {}) {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...createEmptyShiftRunSyncState({ calendarId, window }),
      ...parsed,
      entries: parsed?.entries ?? {},
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return createEmptyShiftRunSyncState({ calendarId, window });
    }
    throw error;
  }
}

export async function writeShiftRunSyncState(statePath, state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const tempPath = `${statePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, statePath);
}

export function planShiftRunMirror({ desiredEntries, priorState, window, calendarId = null, now = new Date() }) {
  const priorEntries = priorState?.entries ?? {};
  const desiredMap = new Map();
  const duplicateSourceIds = [];
  const actions = [];

  for (const entry of desiredEntries) {
    if (desiredMap.has(entry.sourceId)) {
      duplicateSourceIds.push(entry.sourceId);
      continue;
    }
    desiredMap.set(entry.sourceId, entry);
  }

  const uniqueDesiredEntries = Array.from(desiredMap.values());

  for (const duplicateSourceId of duplicateSourceIds) {
    actions.push({
      type: 'error',
      sourceId: duplicateSourceId,
      reason: 'duplicate-source-id',
    });
  }

  for (const entry of uniqueDesiredEntries) {
    const prior = priorEntries[entry.sourceId];
    if (!prior?.googleEventId) {
      actions.push({ type: 'create', sourceId: entry.sourceId, shiftCode: entry.shiftCode, fingerprint: entry.fingerprint, sourceUpdatedAt: entry.sourceUpdatedAt, event: entry.event });
      continue;
    }

    if (prior.fingerprint !== entry.fingerprint || prior.sourceUpdatedAt !== entry.sourceUpdatedAt) {
      actions.push({
        type: 'update',
        sourceId: entry.sourceId,
        shiftCode: entry.shiftCode,
        googleEventId: prior.googleEventId,
        fingerprint: entry.fingerprint,
        previousFingerprint: prior.fingerprint ?? null,
        sourceUpdatedAt: entry.sourceUpdatedAt,
        event: entry.event,
      });
    }
  }

  for (const [sourceId, prior] of Object.entries(priorEntries)) {
    if (desiredMap.has(sourceId)) {
      continue;
    }
    if (!prior.googleEventId) {
      continue;
    }
    actions.push({
      type: 'delete',
      sourceId,
      shiftCode: prior.shiftCode ?? null,
      googleEventId: prior.googleEventId,
    });
  }

  const actionableActions = actions.filter((action) => action.type === 'create' || action.type === 'update' || action.type === 'delete');

  const summary = {
    totalDesired: uniqueDesiredEntries.length,
    duplicateSourceIdCount: duplicateSourceIds.length,
    createCount: actions.filter((action) => action.type === 'create').length,
    updateCount: actions.filter((action) => action.type === 'update').length,
    deleteCount: actions.filter((action) => action.type === 'delete').length,
    unchangedCount: uniqueDesiredEntries.length - actionableActions.filter((action) => action.type !== 'delete').length,
  };

  return {
    generatedAt: new Date(now).toISOString(),
    mirror: 'shift-runs',
    calendarId,
    window,
    summary,
    actions,
  };
}

export function createShiftRunSyncPreflight({ config, priorState, plan }) {
  const warnings = [];
  const blockers = [];
  const priorEntryCount = Object.keys(priorState?.entries ?? {}).length;

  if (!config.calendarId) {
    warnings.push('GOOGLE_CALENDAR_SHIFT_RUNS_ID is not configured; dry runs can still plan work, but commits cannot write.');
  }

  if (priorEntryCount === 0) {
    warnings.push('Local sync ledger is empty. First live sync into a reused Google calendar can create duplicates because remote adoption is not implemented yet.');
    if (!config.dryRun && !config.allowBootstrap) {
      blockers.push('First commit is blocked until you confirm bootstrap intent with --allow-bootstrap or SHIFT_RUN_SYNC_ALLOW_BOOTSTRAP=true. Use a fresh dedicated calendar unless you have an adoption plan.');
    }
  }

  if (plan.summary.duplicateSourceIdCount > 0) {
    blockers.push(`Planned sync contains ${plan.summary.duplicateSourceIdCount} duplicate sourceId entries.`);
  }

  return {
    priorEntryCount,
    warnings,
    blockers,
  };
}

export async function applyShiftRunMirrorPlan({ plan, priorState, calendarId, client, dryRun = true, now = new Date() }) {
  const nextState = {
    ...(priorState ?? createEmptyShiftRunSyncState({ calendarId, window: plan.window })),
    calendarId,
    window: plan.window,
    lastSyncedAt: dryRun ? priorState?.lastSyncedAt ?? null : new Date(now).toISOString(),
    entries: { ...(priorState?.entries ?? {}) },
  };

  const results = [];

  for (const action of plan.actions) {
    if (action.type === 'error') {
      results.push({ ...action, status: 'blocked' });
      continue;
    }

    if (dryRun) {
      results.push({ ...action, status: 'planned' });
      continue;
    }

    if (!client) {
      throw new Error('Google Calendar client is required for commit mode');
    }

    if (action.type === 'create') {
      const created = await client.insertEvent(calendarId, action.event);
      nextState.entries[action.sourceId] = {
        sourceId: action.sourceId,
        shiftCode: action.shiftCode,
        googleEventId: created.id,
        fingerprint: action.fingerprint,
        sourceUpdatedAt: action.sourceUpdatedAt ?? null,
        lastAction: 'create',
        lastSyncedAt: new Date(now).toISOString(),
      };
      results.push({ ...action, status: 'created', googleEventId: created.id });
      continue;
    }

    if (action.type === 'update') {
      const updated = await client.patchEvent(calendarId, action.googleEventId, action.event);
      nextState.entries[action.sourceId] = {
        sourceId: action.sourceId,
        shiftCode: action.shiftCode,
        googleEventId: updated.id ?? action.googleEventId,
        fingerprint: action.fingerprint,
        sourceUpdatedAt: action.sourceUpdatedAt ?? null,
        lastAction: 'update',
        lastSyncedAt: new Date(now).toISOString(),
      };
      results.push({ ...action, status: 'updated', googleEventId: updated.id ?? action.googleEventId });
      continue;
    }

    if (action.type === 'delete') {
      await client.deleteEvent(calendarId, action.googleEventId);
      delete nextState.entries[action.sourceId];
      results.push({ ...action, status: 'deleted' });
    }
  }

  if (dryRun) {
    return { nextState: priorState ?? nextState, results };
  }

  for (const action of plan.actions) {
    if (action.type === 'create' || action.type === 'update') {
      nextState.entries[action.sourceId] = {
        ...(nextState.entries[action.sourceId] ?? {}),
        sourceId: action.sourceId,
        shiftCode: action.shiftCode,
        fingerprint: action.fingerprint,
        sourceUpdatedAt: action.sourceUpdatedAt ?? null,
        lastSyncedAt: new Date(now).toISOString(),
      };
    }
  }

  nextState.lastSyncedAt = new Date(now).toISOString();
  return { nextState, results };
}

export async function fetchShiftRunsForMirror(prisma, window) {
  return prisma.shiftRun.findMany({
    where: {
      runDate: {
        gte: new Date(`${window.from}T00:00:00.000Z`),
        lte: new Date(`${window.to}T00:00:00.000Z`),
      },
    },
    include: {
      assignedStaff: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: [
      { runDate: 'asc' },
      { shiftStartAt: 'asc' },
      { shiftCode: 'asc' },
    ],
  });
}
