import test from 'node:test';
import assert from 'node:assert/strict';

import { parseExtraTaskBoardDay } from '../lib/extra-task-board-day.js';
import { formatBoardDayKey } from '../lib/task-effective-day.mjs';

test('extra task board day uses UTC date-only value for plannedRunDate', () => {
  const parsed = parseExtraTaskBoardDay('2026-07-16');

  assert.equal(parsed.dateOnly.toISOString(), '2026-07-16T00:00:00.000Z');
  assert.equal(formatBoardDayKey(parsed.dateOnly), '2026-07-16');
});

test('extra task board day keeps Brisbane operational window for dueAt lookup', () => {
  const parsed = parseExtraTaskBoardDay('2026-07-16');

  assert.equal(parsed.localStart.toISOString(), '2026-07-15T14:00:00.000Z');
  assert.equal(parsed.localEnd.toISOString(), '2026-07-16T14:00:00.000Z');
  assert.equal(parsed.dueAt.toISOString(), '2026-07-15T23:00:00.000Z');
});

test('extra task board day rejects invalid day strings', () => {
  assert.equal(parseExtraTaskBoardDay('16/07/2026'), null);
  assert.equal(parseExtraTaskBoardDay(''), null);
});
