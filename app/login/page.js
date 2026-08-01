import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login · Cienna Cleaning',
};

export default function LoginPage() {
  return (
    <main className="page login-page">
      <Suspense fallback={<section className="card login-card"><h1>Cienna Cleaning login</h1></section>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
