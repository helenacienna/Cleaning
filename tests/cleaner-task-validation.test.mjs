import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCleanerTaskEvidenceFailures,
  isValidSkipReason,
  normaliseSkipReason,
} from '../lib/cleaner-task-validation.js';

test('forced photo blocks grading until evidence exists', () => {
  const taskInstance = {
    evidenceRequirement: 'required_photo',
    commentRequirement: 'none',
    execution: { photos: [] },
  };

  assert.deepEqual(getCleanerTaskEvidenceFailures({ taskInstance, grade: 5, note: '' }), ['photo']);
  assert.deepEqual(getCleanerTaskEvidenceFailures({
    taskInstance: {
      ...taskInstance,
      execution: { photos: [{ id: 'photo-1' }] },
    },
    grade: 5,
    note: '',
  }), []);
});

test('always comment blocks grading until note exists', () => {
  const taskInstance = {
    evidenceRequirement: 'none',
    commentRequirement: 'always',
    execution: { photos: [] },
  };

  assert.deepEqual(getCleanerTaskEvidenceFailures({ taskInstance, grade: 4, note: '   ' }), ['comment']);
  assert.deepEqual(getCleanerTaskEvidenceFailures({ taskInstance, grade: 4, note: 'Checked and completed.' }), []);
});

test('exception comments only block low exception grades', () => {
  const taskInstance = {
    evidenceRequirement: 'none',
    commentRequirement: 'on_exception',
    execution: { photos: [] },
  };

  assert.deepEqual(getCleanerTaskEvidenceFailures({ taskInstance, grade: 2, note: '' }), ['comment']);
  assert.deepEqual(getCleanerTaskEvidenceFailures({ taskInstance, grade: 4, note: '' }), []);
});


test('existing incident photo satisfies compulsory photo evidence', () => {
  const taskInstance = {
    evidenceRequirement: 'required_photo',
    commentRequirement: 'none',
    execution: {
      photos: [{ id: 'incident-photo-1', photoType: 'exception' }],
    },
  };

  assert.deepEqual(getCleanerTaskEvidenceFailures({ taskInstance, grade: 5, note: '' }), []);
});

test('passing grades still block compulsory photo tasks when no photo exists', () => {
  const taskInstance = {
    evidenceRequirement: 'required_photo',
    commentRequirement: 'none',
    execution: { photos: [] },
  };

  for (const grade of [3, 4, 5]) {
    assert.deepEqual(getCleanerTaskEvidenceFailures({ taskInstance, grade, note: '' }), ['photo']);
  }
});

test('skip reasons are trimmed and require useful explanation length', () => {
  assert.equal(normaliseSkipReason('  access blocked  '), 'access blocked');
  assert.equal(isValidSkipReason('no'), false);
  assert.equal(isValidSkipReason('door locked'), true);
});
