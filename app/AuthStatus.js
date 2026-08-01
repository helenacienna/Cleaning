import { getConfiguredUsers, isAuthConfigured } from '../lib/auth-cookie';

export default function AuthStatus() {
  const configured = isAuthConfigured();
  const userCount = getConfiguredUsers().length;
  return (
    <div className={`auth-status-pill ${configured ? 'auth-status-enabled' : 'auth-status-disabled'}`}>
      <strong>{configured ? 'Security active' : 'Security ready, not active'}</strong>
      <span>{configured
        ? userCount ? `${userCount} individual login${userCount === 1 ? '' : 's'} configured with role protection.` : 'Shared admin/staff login and role protection are enabled.'
        : 'Set individual users or shared auth passwords in Railway to activate login protection.'}</span>
    </div>
  );
}
