export function parseTaskGradeFromComment(comment = '') {
  const match = String(comment || '').match(/\[grade:(\d)\/5\]/i);
  return match ? Number(match[1]) : null;
}

export function parseInitialGradeFromComment(comment = '') {
  const match = String(comment || '').match(/\[initial-grade:(\d)\/5\]/i);
  return match ? Number(match[1]) : null;
}

export function parseResolvedIssueFromComment(comment = '') {
  return /\[issue-resolved:true\]/i.test(String(comment || ''));
}

export function isTaskPassed(task = {}) {
  const score = Number(task.score ?? task.auditScore);
  return task.status === 'completed' || Number.isFinite(score) && score >= 3;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function getIssueState({ issueRaised = false, initialGrade = null, score = null, reworkRequired = false, managerAction = null, resolvedIssue = false } = {}) {
  const numericScore = parseOptionalNumber(score);
  const numericInitialGrade = parseOptionalNumber(initialGrade);
  const hadIssue = Boolean(issueRaised)
    || Boolean(numericInitialGrade)
    || (numericScore !== null && numericScore <= 2)
    || Boolean(reworkRequired);
  const hasOpenIssue = hadIssue && !resolvedIssue && managerAction !== 'close';

  return {
    hadIssue,
    resolvedIssue: Boolean(resolvedIssue),
    hasOpenIssue,
  };
}

export function getTaskOutcome(task = {}) {
  const score = Number(task.score ?? task.auditScore);
  const initialGrade = Number(task.initialGrade ?? task.initialAuditScore);
  const resolvedIssue = Boolean(task.resolvedIssue);

  if (resolvedIssue && initialGrade === 1) return 'resolvedGrade1';
  if (resolvedIssue && initialGrade === 2) return 'resolvedGrade2';
  if (Number.isFinite(score) && score >= 3 || task.status === 'completed') return 'pass';
  if (Number.isFinite(score) && score === 2) return 'unresolvedGrade2';
  if (Number.isFinite(score) && score === 1) return 'unresolvedGrade1';
  return 'pending';
}

export function getOutcomeCounts(tasks = []) {
  return tasks.reduce((counts, task) => {
    const outcome = getTaskOutcome(task);
    counts[outcome] += 1;
    return counts;
  }, {
    resolvedGrade1: 0,
    resolvedGrade2: 0,
    pass: 0,
    pending: 0,
    unresolvedGrade2: 0,
    unresolvedGrade1: 0,
  });
}

export function getOutcomeCompletedCount(tasks = []) {
  const counts = getOutcomeCounts(tasks);
  return counts.resolvedGrade1 + counts.resolvedGrade2 + counts.pass;
}

export function getOutcomeIssueCount(tasks = []) {
  const counts = getOutcomeCounts(tasks);
  return counts.unresolvedGrade1 + counts.unresolvedGrade2;
}

export const OUTCOME_PROGRESS_SEGMENTS = [
  ['resolvedGrade1', 'progress-segment-resolved-grade-1'],
  ['resolvedGrade2', 'progress-segment-resolved-grade-2'],
  ['pass', 'progress-segment-pass'],
  ['pending', 'progress-segment-pending'],
  ['unresolvedGrade2', 'progress-segment-unresolved-grade-2'],
  ['unresolvedGrade1', 'progress-segment-unresolved-grade-1'],
];
