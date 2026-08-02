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
  const [username, setUsername] = useState('');
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
        body: JSON.stringify({ username, password, next }),
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
      <span className="badge tone-green">One login for everyone</span>
      <h1>Cienna Cleaning login</h1>
      <p className="muted">Sign in once and the system will send you to the right workspace for your role and permissions.</p>
      <div className="login-route-preview" aria-label="Login routing summary">
        <div><strong>Cleaners</strong><span>Your personal work list</span></div>
        <div><strong>Managers</strong><span>Admin dashboard and setup tools</span></div>
      </div>
      <label className="login-field">
        <span>Username</span>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoFocus
        />
      </label>
      <label className="login-field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button primary" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Checking access…' : 'Sign in and continue'}
      </button>
    </form>
  );
}
