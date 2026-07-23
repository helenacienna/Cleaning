export function buildDashboardHealth({ board = null, source = null, timeZone = null } = {}) {
  const cards = Array.isArray(board?.cards) ? board.cards : [];
  const staff = Array.isArray(board?.staff) ? board.staff : [];
  const days = Array.isArray(board?.days) ? board.days : [];
  const sourceValue = source ?? board?.source ?? null;
  const fallback = sourceValue !== 'prisma';
  const resolvedOpenIssueCount = cards.filter((card) => card?.resolvedIssue === true && card?.hasOpenIssue === true).length;
  const openIssueCount = cards.filter((card) => card?.hasOpenIssue === true).length;
  const resolvedIssueCount = cards.filter((card) => card?.resolvedIssue === true).length;
  const minimumCardCount = 1;
  const ok = !fallback && cards.length >= minimumCardCount && resolvedOpenIssueCount === 0;

  return {
    ok,
    source: sourceValue,
    fallback,
    timeZone: timeZone ?? board?.timeZone ?? null,
    cardCount: cards.length,
    staffCount: staff.length,
    dayCount: days.length,
    openIssueCount,
    resolvedIssueCount,
    resolvedOpenIssueCount,
    checks: {
      prismaSource: sourceValue === 'prisma',
      hasCards: cards.length >= minimumCardCount,
      issueStateConsistent: resolvedOpenIssueCount === 0,
    },
    message: ok
      ? 'Dashboard is using live Prisma data'
      : fallback
        ? `Dashboard is using ${sourceValue || 'unknown'} instead of live Prisma data`
        : resolvedOpenIssueCount > 0
          ? 'Resolved issues are also marked open'
          : 'Dashboard health check failed',
  };
}
