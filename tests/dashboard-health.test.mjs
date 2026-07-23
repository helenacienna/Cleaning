import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardHealth } from '../lib/dashboard-health.js';

test('dashboard health passes for live prisma board with consistent issue state', () => {
  const health = buildDashboardHealth({
    source: 'prisma',
    timeZone: 'Australia/Brisbane',
    board: {
      staff: ['Tony'],
      days: ['Thu 16 July'],
      cards: [
        { id: 'card-1', resolvedIssue: true, hasOpenIssue: false },
        { id: 'card-2', resolvedIssue: false, hasOpenIssue: true },
      ],
    },
  });

  assert.equal(health.ok, true);
  assert.equal(health.fallback, false);
  assert.equal(health.cardCount, 2);
  assert.equal(health.resolvedOpenIssueCount, 0);
  assert.equal(health.checks.prismaSource, true);
});

test('dashboard health fails for demo fallback', () => {
  const health = buildDashboardHealth({
    source: 'demo-fallback',
    board: {
      staff: ['Demo'],
      days: ['Thu 16 July'],
      cards: [{ id: 'demo-1' }],
    },
  });

  assert.equal(health.ok, false);
  assert.equal(health.fallback, true);
  assert.equal(health.checks.prismaSource, false);
});

test('dashboard health fails when resolved issues are still marked open', () => {
  const health = buildDashboardHealth({
    source: 'prisma',
    board: {
      staff: ['Tony'],
      days: ['Thu 16 July'],
      cards: [{ id: 'card-1', resolvedIssue: true, hasOpenIssue: true }],
    },
  });

  assert.equal(health.ok, false);
  assert.equal(health.resolvedOpenIssueCount, 1);
  assert.equal(health.checks.issueStateConsistent, false);
});
