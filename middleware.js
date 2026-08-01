import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'cienna_cleaning_session';
const PUBLIC_FILE = /\.(?:png|jpg|jpeg|webp|svg|ico|css|js|map|woff2?|txt)$/i;
const STAFF_PATHS = ['/cleaner', '/scan', '/reports/daily', '/help'];
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/manifest.webmanifest',
  '/sw.js',
  '/offline.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];
const STAFF_API_PREFIXES = [
  '/api/cleaner-tasks',
  '/api/cleaner-issue',
  '/api/cleaner-remaining',
  '/api/cleaner-daily-report',
  '/api/task-photos',
  '/api/task-library',
  '/api/facility-extra-task',
];

function authEnabled() {
  return Boolean(process.env.CLEANING_AUTH_SECRET && (process.env.CLEANING_ADMIN_PASSWORD || process.env.CLEANING_STAFF_PASSWORD));
}

function pathStartsWith(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.CLEANING_AUTH_SECRET || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function getSession(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value || '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !process.env.CLEANING_AUTH_SECRET) return null;
  const expected = await hmac(payload);
  if (!safeEqual(signature, expected)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!['admin', 'staff'].includes(session?.role)) return null;
    return session;
  } catch {
    return null;
  }
}

function redirectToLogin(request) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function forbiddenJson() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!authEnabled()) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next/') || PUBLIC_FILE.test(pathname) || pathStartsWith(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  const session = await getSession(request);
  const isApi = pathname.startsWith('/api/');

  if (!session) {
    return isApi ? forbiddenJson() : redirectToLogin(request);
  }

  if (session.role === 'admin') {
    return NextResponse.next();
  }

  if (pathStartsWith(pathname, STAFF_PATHS) || pathStartsWith(pathname, STAFF_API_PREFIXES)) {
    return NextResponse.next();
  }

  return isApi ? forbiddenJson() : redirectToLogin(request);
}

export const config = {
  matcher: ['/((?!_next/image).*)'],
};
