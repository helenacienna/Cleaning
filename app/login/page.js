import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '../../lib/auth-cookie';
import { getDefaultLandingPathForUser } from '../../lib/auth-redirects';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login · Cienna Cleaning',
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const existingSession = verifyAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value || '');

  if (existingSession) {
    redirect(getDefaultLandingPathForUser(existingSession));
  }

  return (
    <main className="page login-page">
      <Suspense fallback={<section className="card login-card"><h1>Cienna Cleaning login</h1></section>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
