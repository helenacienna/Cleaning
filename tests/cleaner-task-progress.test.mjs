import test from 'node:test';
import assert from 'node:assert/strict';

import { isCleanerTaskResolvedForProgress } from '../lib/cleaner-task-progress.js';

test('open task without grade or skip is not resolved for progress', () => {
  assert.equal(isCleanerTaskResolvedForProgress({ status: 'scheduled', score: null, saved: false }), false);
});

test('saved grade resolves a task for progress even when follow-up is needed', () => {
  assert.equal(isCleanerTaskResolvedForProgress({ status: 'in_progress', grade: 1, saved: true }), true);
});

test('submitted skip resolves a task for progress', () => {
  assert.equal(isCleanerTaskResolvedForProgress({ status: 'skipped', saved: true }), true);
});
