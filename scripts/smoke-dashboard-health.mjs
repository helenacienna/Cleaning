#!/usr/bin/env node

const baseUrl = (process.env.CLEANING_BASE_URL || process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const url = `${baseUrl}/api/health`;

async function main() {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  const dashboard = payload?.dashboard;

  if (!response.ok || !payload?.ok || !dashboard?.ok) {
    console.error(JSON.stringify({
      ok: false,
      url,
      status: response.status,
      dashboard,
    }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    url,
    source: dashboard.source,
    cardCount: dashboard.cardCount,
    staffCount: dashboard.staffCount,
    dayCount: dashboard.dayCount,
    openIssueCount: dashboard.openIssueCount,
    resolvedIssueCount: dashboard.resolvedIssueCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
