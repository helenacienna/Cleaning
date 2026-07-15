import test from 'node:test';
import assert from 'node:assert/strict';

import { getIssueState, getTaskOutcome, parseInitialGradeFromComment, parseResolvedIssueFromComment } from '../lib/task-outcomes.js';

test('resolved issue keeps issue history without being open', () => {
  const state = getIssueState({
    issueRaised: true,
    initialGrade: 1,
    score: 4,
    resolvedIssue: true,
    managerAction: 'close',
    reworkRequired: false,
  });

  assert.deepEqual(state, {
    hadIssue: true,
    resolvedIssue: true,
    hasOpenIssue: false,
  });
});

test('unresolved low score remains an open issue', () => {
  const state = getIssueState({
    issueRaised: true,
    initialGrade: null,
    score: 2,
    resolvedIssue: false,
    managerAction: 'reassign',
    reworkRequired: true,
  });

  assert.deepEqual(state, {
    hadIssue: true,
    resolvedIssue: false,
    hasOpenIssue: true,
  });
});

test('comment markers identify resolved issue outcomes', () => {
  const comment = '[grade:4/5]\n[initial-grade:1/5]\n[issue-resolved:true]\n[resolution-note] Corrected during checklist.';

  assert.equal(parseInitialGradeFromComment(comment), 1);
  assert.equal(parseResolvedIssueFromComment(comment), true);
  assert.equal(getTaskOutcome({ score: 4, initialGrade: 1, resolvedIssue: true }), 'resolvedGrade1');
});
