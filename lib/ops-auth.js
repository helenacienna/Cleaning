export function isOpsAuthorized(request) {
  const expected = process.env.OPS_API_TOKEN || process.env.MAINTENANCE_API_TOKEN;
  if (!expected) return true;

  const url = new URL(request.url);
  const provided =
    request.headers.get('x-ops-token') ||
    request.headers.get('x-maintenance-token') ||
    url.searchParams.get('token');

  return provided === expected;
}
