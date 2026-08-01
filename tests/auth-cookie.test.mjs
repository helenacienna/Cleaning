import test from 'node:test';
import assert from 'node:assert/strict';

async function importFreshAuthCookie() {
  return import(`../lib/auth-cookie.js?test=${Date.now()}-${Math.random()}`);
}

test('auth cookie signs and verifies admin sessions', async () => {
  process.env.CLEANING_AUTH_SECRET = 'test-secret';
  const auth = await importFreshAuthCookie();
  const token = auth.signAuthSession({ role: 'admin', name: 'Admin', issuedAt: 123 });
  const session = auth.verifyAuthSession(token);
  assert.equal(session.role, 'admin');
  assert.equal(session.name, 'Admin');
  assert.equal(session.issuedAt, 123);
});

test('auth cookie rejects tampered sessions', async () => {
  process.env.CLEANING_AUTH_SECRET = 'test-secret';
  const auth = await importFreshAuthCookie();
  const token = auth.signAuthSession({ role: 'staff', issuedAt: 123 });
  assert.equal(auth.verifyAuthSession(`${token}tampered`), null);
});

test('auth role resolves from configured passwords', async () => {
  process.env.CLEANING_AUTH_SECRET = 'test-secret';
  process.env.CLEANING_ADMIN_PASSWORD = 'admin-pass';
  process.env.CLEANING_STAFF_PASSWORD = 'staff-pass';
  const auth = await importFreshAuthCookie();
  assert.equal(auth.isAuthConfigured(), true);
  assert.equal(auth.getRoleForPassword('admin-pass'), 'admin');
  assert.equal(auth.getRoleForPassword('staff-pass'), 'staff');
  assert.equal(auth.getRoleForPassword('wrong'), null);
});
