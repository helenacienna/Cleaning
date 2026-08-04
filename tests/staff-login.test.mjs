import test from 'node:test';
import assert from 'node:assert/strict';

async function importFreshStaffLogin() {
  return import(`../lib/staff-login.js?test=${Date.now()}-${Math.random()}`);
}

test('staff login normalises name credentials', async () => {
  const staffLogin = await importFreshStaffLogin();
  assert.equal(staffLogin.normalizeStaffLoginValue('  Tony   Smith  '), 'tony smith');
  assert.equal(staffLogin.normalizeStaffLoginValue('TONY SMITH'), 'tony smith');
});

test('staff login builds staff user landing from full name', async () => {
  const staffLogin = await importFreshStaffLogin();
  const user = staffLogin.buildStaffLoginUser({ fullName: 'Tony Smith' });
  assert.equal(user.role, 'staff');
  assert.equal(user.name, 'Tony Smith');
  assert.equal(user.username, 'tony smith');
  assert.equal(user.staffSlug, 'tony-smith');
  assert.equal(user.landingPath, '/cleaner/tony-smith');
});
