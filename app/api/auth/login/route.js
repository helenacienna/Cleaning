import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getUserForCredentials, signAuthSession } from '../../../../lib/auth-cookie';

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

function safeNextPath(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }
  return value;
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const nextPath = safeNextPath(body?.next);
  const user = getUserForCredentials({ username, password });

  if (!user) {
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role: user.role, name: user.name, next: nextPath });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: signAuthSession(user),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_WEEK_SECONDS,
  });
  return response;
}
