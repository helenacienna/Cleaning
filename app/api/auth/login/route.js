import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getUserForCredentials, signAuthSession } from '../../../../lib/auth-cookie';
import { getDefaultLandingPathForUser, getPostLoginPath, safeNextPath } from '../../../../lib/auth-redirects';
import { getStaffUserForNameCredentials } from '../../../../lib/staff-login';

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const nextPath = safeNextPath(body?.next);
  const user = getUserForCredentials({ username, password }) || await getStaffUserForNameCredentials({ username, password });

  if (!user) {
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
  }

  const landingPath = getDefaultLandingPathForUser(user);
  const postLoginPath = getPostLoginPath(user, nextPath);
  const response = NextResponse.json({ ok: true, role: user.role, name: user.name, landingPath, next: postLoginPath });
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
