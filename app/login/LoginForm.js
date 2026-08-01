'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next') || '/');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password || status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, next }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Login failed');
      }
      window.location.href = result.next || '/';
    } catch (loginError) {
      setStatus('idle');
      setError(loginError?.message || 'Login failed');
    }
  }

  return (
    <form className="card login-card" onSubmit={handleSubmit}>
      <span className="badge tone-green">Secure access</span>
      <h1>Cienna Cleaning login</h1>
      <p className="muted">Enter the admin or staff password for this site.</p>
      <label className="login-field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button primary" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
