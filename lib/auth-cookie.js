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

export function isAuthConfigured() {
  return Boolean(getSecret() && (process.env.CLEANING_ADMIN_PASSWORD || process.env.CLEANING_STAFF_PASSWORD));
}

export function signAuthSession({ role, name = '', issuedAt = Date.now() }) {
  if (!AUTH_ROLES.includes(role)) {
    throw new Error('Invalid auth role');
  }

  const secret = getSecret();
  if (!secret) {
    throw new Error('Missing CLEANING_AUTH_SECRET');
  }

  const payload = base64UrlEncode(JSON.stringify({ role, name, issuedAt }));
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

export function getRoleForPassword(password) {
  if (!password) {
    return null;
  }

  if (process.env.CLEANING_ADMIN_PASSWORD && password === process.env.CLEANING_ADMIN_PASSWORD) {
    return 'admin';
  }

  if (process.env.CLEANING_STAFF_PASSWORD && password === process.env.CLEANING_STAFF_PASSWORD) {
    return 'staff';
  }

  return null;
}
