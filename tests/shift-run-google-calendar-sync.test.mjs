import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDesiredShiftRunMirrorEntries,
  buildShiftRunCalendarEvent,
  createEmptyShiftRunSyncState,
  createShiftRunSyncPreflight,
  planShiftRunMirror,
  resolveShiftRunSyncConfig,
} from '../lib/shift-run-google-calendar-sync.mjs';

function sampleShiftRun(overrides = {}) {
  return {
    id: '6a81f9e5-c312-4d18-a6e3-3ac0ec8b8697',
    shiftCode: 'SHIFT-2026-06-11-ALPHA',
    runDate: new Date('2026-06-11T00:00:00.000Z'),
    facilityScope: 'multi_facility',
    shiftLabel: 'Morning run',
    routeLabel: 'Tower sweep',
    shiftStartAt: new Date('2026-06-11T21:00:00.000Z'),
    shiftEndAt: new Date('2026-06-12T05:00:00.000Z'),
    organiserState: 'published',
    updatedAt: new Date('2026-06-10T09:15:00.000Z'),
    assignedStaff: {
      fullName: 'Alex Cleaner',
    },
    ...overrides,
  };
}

test('buildShiftRunCalendarEvent creates timed events when shift times exist', () => {
  const event = buildShiftRunCalendarEvent(sampleShiftRun());

  assert.equal(event.summary, 'Alex Cleaner — Morning run');
  assert.equal(event.start.dateTime, '2026-06-11T21:00:00.000Z');
  assert.equal(event.end.dateTime, '2026-06-12T05:00:00.000Z');
  assert.equal(event.extendedProperties.private.openclawSourceType, 'shiftRun');
});

test('buildShiftRunCalendarEvent falls back to all-day events when times are missing', () => {
  const event = buildShiftRunCalendarEvent(sampleShiftRun({ shiftStartAt: null, shiftEndAt: null }));

  assert.equal(event.start.date, '2026-06-11');
  assert.equal(event.end.date, '2026-06-12');
  assert.equal(event.summary, 'Alex Cleaner — Morning run');
});

test('planShiftRunMirror creates, updates, and deletes idempotently from local state', () => {
  const { desired } = buildDesiredShiftRunMirrorEntries([
    sampleShiftRun(),
    sampleShiftRun({
      id: '2c50b327-4c0f-44fe-bfbc-4427a5297f53',
      shiftCode: 'SHIFT-2026-06-12-BETA',
      runDate: new Date('2026-06-12T00:00:00.000Z'),
      updatedAt: new Date('2026-06-10T10:15:00.000Z'),
    }),
  ]);

  const priorState = createEmptyShiftRunSyncState({ calendarId: 'calendar@example.com' });
  priorState.entries[desired[0].sourceId] = {
    sourceId: desired[0].sourceId,
    shiftCode: desired[0].shiftCode,
    googleEventId: 'google-event-1',
    fingerprint: 'stale-fingerprint',
    sourceUpdatedAt: '2026-06-09T09:15:00.000Z',
  };
  priorState.entries['stale-shift'] = {
    sourceId: 'stale-shift',
    shiftCode: 'SHIFT-OLD',
    googleEventId: 'google-event-old',
    fingerprint: 'old',
    sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
  };

  const plan = planShiftRunMirror({
    desiredEntries: desired,
    priorState,
    calendarId: 'calendar@example.com',
    window: { from: '2026-06-09', to: '2026-06-30' },
    now: new Date('2026-06-10T12:00:00.000Z'),
  });

  assert.deepEqual(plan.summary, {
    totalDesired: 2,
    duplicateSourceIdCount: 0,
    createCount: 1,
    updateCount: 1,
    deleteCount: 1,
    unchangedCount: 0,
  });
  assert.equal(plan.actions.filter((action) => action.type === 'error').length, 0);
  assert.equal(plan.actions.filter((action) => action.type === 'create').length, 1);
  assert.equal(plan.actions.filter((action) => action.type === 'update').length, 1);
  assert.equal(plan.actions.filter((action) => action.type === 'delete').length, 1);
});

test('resolveShiftRunSyncConfig validates window ordering and time zone', () => {
  assert.throws(
    () => resolveShiftRunSyncConfig({ args: { from: '2026-06-30', to: '2026-06-01' } }),
    /from 2026-06-30 is after 2026-06-01/
  );

  assert.throws(
    () => resolveShiftRunSyncConfig({ args: { timeZone: 'Mars/Phobos' } }),
    /Invalid SHIFT_RUN_SYNC_TIME_ZONE/
  );
});

test('createShiftRunSyncPreflight blocks first live commit without bootstrap acknowledgement', () => {
  const { desired } = buildDesiredShiftRunMirrorEntries([sampleShiftRun()]);
  const priorState = createEmptyShiftRunSyncState({ calendarId: 'calendar@example.com' });
  const plan = planShiftRunMirror({
    desiredEntries: desired,
    priorState,
    calendarId: 'calendar@example.com',
    window: { from: '2026-06-09', to: '2026-06-30' },
  });

  const preflight = createShiftRunSyncPreflight({
    config: {
      calendarId: 'calendar@example.com',
      dryRun: false,
      allowBootstrap: false,
    },
    priorState,
    plan,
  });

  assert.equal(preflight.priorEntryCount, 0);
  assert.equal(preflight.warnings.length, 1);
  assert.match(preflight.blockers[0], /--allow-bootstrap/);
});
