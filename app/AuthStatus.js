import { isAuthConfigured } from '../lib/auth-cookie';

export default function AuthStatus() {
  const configured = isAuthConfigured();
  return (
    <div className={`auth-status-pill ${configured ? 'auth-status-enabled' : 'auth-status-disabled'}`}>
      <strong>{configured ? 'Security active' : 'Security ready, not active'}</strong>
      <span>{configured ? 'Login and role protection are enabled.' : 'Set auth passwords in Railway to activate login protection.'}</span>
    </div>
  );
}
