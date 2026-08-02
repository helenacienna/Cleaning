import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE_NAME = 'cienna_cleaning_session';
export const AUTH_ROLES = ['admin', 'staff'];

function getSecret() {
  return process.env.CLEANING_AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
}

function base64UrlEncode(value) {
  return Buffer.from(String(value)).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(String(value), 'base64url').toString('utf8');
}

export function getConfiguredUsers() {
  const rawUsers = process.env.CLEANING_AUTH_USERS;
  if (!rawUsers) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawUsers);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((user) => ({
        username: String(user?.username || '').trim().toLowerCase(),
        password: String(user?.password || ''),
        role: AUTH_ROLES.includes(user?.role) ? user.role : 'staff',
        name: String(user?.name || user?.username || '').trim(),
        staffSlug: String(user?.staffSlug || '').trim(),
        landingPath: String(user?.landingPath || '').trim(),
        permissions: Array.isArray(user?.permissions) ? user.permissions.map((permission) => String(permission).trim()).filter(Boolean) : [],
      }))
      .filter((user) => user.username && user.password);
  } catch {
    return [];
  }
}

export function isAuthConfigured() {
  return Boolean(getSecret() && (
    process.env.CLEANING_ADMIN_PASSWORD
    || process.env.CLEANING_STAFF_PASSWORD
    || getConfiguredUsers().length
  ));
}

export function signAuthSession({ role, username = '', name = '', staffSlug = '', landingPath = '', permissions = [], issuedAt = Date.now() }) {
  if (!AUTH_ROLES.includes(role)) {
    throw new Error('Invalid auth role');
  }

  const secret = getSecret();
  if (!secret) {
    throw new Error('Missing CLEANING_AUTH_SECRET');
  }

  const payload = base64UrlEncode(JSON.stringify({ role, username, name, staffSlug, landingPath, permissions, issuedAt }));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAuthSession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const secret = getSecret();
  if (!secret) {
    return null;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!AUTH_ROLES.includes(session?.role)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getUserForCredentials({ username = '', password = '' } = {}) {
  if (!password) {
    return null;
  }

  const normalizedUsername = String(username || '').trim().toLowerCase();
  const configuredUser = getConfiguredUsers().find((user) => user.username === normalizedUsername && user.password === password);
  if (configuredUser) {
    return configuredUser;
  }

  if (process.env.CLEANING_ADMIN_PASSWORD && password === process.env.CLEANING_ADMIN_PASSWORD) {
    return { username: normalizedUsername || 'shared-admin', role: 'admin', name: 'Admin', staffSlug: '', landingPath: '/', permissions: [] };
  }

  if (process.env.CLEANING_STAFF_PASSWORD && password === process.env.CLEANING_STAFF_PASSWORD) {
    return { username: normalizedUsername || 'shared-staff', role: 'staff', name: 'Staff', staffSlug: '', landingPath: '/cleaner', permissions: [] };
  }

  return null;
}

export function getRoleForPassword(password) {
  return getUserForCredentials({ password })?.role || null;
}
