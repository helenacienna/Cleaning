import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveOrganiserSchedule,
  getTaskInstanceEffectiveDueAt,
  isTaskInstancePastEffectiveDue,
} from '../lib/task-effective-day.mjs';

test('anchored weekly task moved earlier than its anchor keeps dueAt and records plannedRunDate', () => {
  const result = deriveOrganiserSchedule({
    currentDueAt: new Date('2026-06-10T09:00:00+10:00'),
    anchoredDueAt: new Date('2026-06-10T09:00:00+10:00'),
    recurrenceBasis: 'anchored',
    recurrenceType: 'weekly',
    actualBoardDay: '2026-06-08',
    laneIndex: 0,
  });

  assert.equal(result.dueAt.toISOString(), '2026-06-09T23:00:00.000Z');
  assert.equal(result.plannedRunDate.toISOString(), '2026-06-07T14:00:00.000Z');
  assert.equal(result.scheduledForAt, null);
});

test('anchored weekly task moved later than its anchor keeps dueAt and records plannedRunDate', () => {
  const result = deriveOrganiserSchedule({
    currentDueAt: new Date('2026-06-10T09:00:00+10:00'),
    anchoredDueAt: new Date('2026-06-10T09:00:00+10:00'),
    recurrenceBasis: 'anchored',
    recurrenceType: 'weekly',
    actualBoardDay: '2026-06-12',
    laneIndex: 0,
  });

  assert.equal(result.dueAt.toISOString(), '2026-06-09T23:00:00.000Z');
  assert.equal(result.plannedRunDate.toISOString(), '2026-06-11T14:00:00.000Z');
  assert.equal(result.scheduledForAt, null);
});

test('plannedRunDate-only instances derive their effective due day from the planned run date', () => {
  const effectiveDueAt = getTaskInstanceEffectiveDueAt({
    dueAt: new Date('2026-06-10T09:00:00+10:00'),
    plannedRunDate: new Date('2026-06-08T00:00:00+10:00'),
    scheduledForAt: null,
    shiftRun: null,
  });

  assert.equal(effectiveDueAt.toISOString(), '2026-06-07T23:00:00.000Z');
  assert.equal(
    isTaskInstancePastEffectiveDue(
      {
        dueAt: new Date('2026-06-10T09:00:00+10:00'),
        plannedRunDate: new Date('2026-06-08T00:00:00+10:00'),
      },
      new Date('2026-06-08T10:00:00+10:00'),
    ),
    true,
  );
});

test('shiftRun-only instances derive their effective due day from the shift run date and scheduled time', () => {
  const effectiveDueAt = getTaskInstanceEffectiveDueAt({
    dueAt: new Date('2026-06-10T09:00:00+10:00'),
    scheduledForAt: new Date('2026-06-12T14:00:00+10:00'),
    shiftRun: {
      runDate: new Date('2026-06-12T00:00:00+10:00'),
    },
  });

  assert.equal(effectiveDueAt.toISOString(), '2026-06-12T04:00:00.000Z');
  assert.equal(
    isTaskInstancePastEffectiveDue(
      {
        dueAt: new Date('2026-06-10T09:00:00+10:00'),
        scheduledForAt: new Date('2026-06-12T14:00:00+10:00'),
        shiftRun: {
          runDate: new Date('2026-06-12T00:00:00+10:00'),
        },
      },
      new Date('2026-06-12T13:30:00+10:00'),
    ),
    false,
  );
});

test('candidate selection does not treat later-moved work as overdue before its effective day', () => {
  const candidate = {
    dueAt: new Date('2026-06-10T09:00:00+10:00'),
    plannedRunDate: new Date('2026-06-12T00:00:00+10:00'),
  };

  assert.equal(isTaskInstancePastEffectiveDue(candidate, new Date('2026-06-11T12:00:00+10:00')), false);
  assert.equal(isTaskInstancePastEffectiveDue(candidate, new Date('2026-06-12T10:00:00+10:00')), true);
});
