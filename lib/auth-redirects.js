export const STAFF_ENTRY_PATHS = ['/cleaner', '/scan', '/reports/daily', '/help'];

export function safeNextPath(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }
  return value;
}

export function pathStartsWith(pathname = '', prefixes = []) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getDefaultLandingPathForUser(user = {}) {
  const configuredLandingPath = safeNextPath(user.landingPath);
  if (configuredLandingPath !== '/') {
    return configuredLandingPath;
  }

  if (user.role === 'staff') {
    return user.staffSlug ? `/cleaner/${encodeURIComponent(user.staffSlug)}` : '/cleaner';
  }

  return '/';
}

export function isPathAllowedForUser(user = {}, pathname = '/') {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'staff') {
    return pathStartsWith(pathname, STAFF_ENTRY_PATHS);
  }

  return false;
}

export function getPostLoginPath(user = {}, requestedNext = '/') {
  const nextPath = safeNextPath(requestedNext);
  return isPathAllowedForUser(user, nextPath) ? nextPath : getDefaultLandingPathForUser(user);
}
