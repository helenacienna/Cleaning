import { getPrisma } from './prisma.js';

export function normalizeStaffLoginValue(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function slugifyStaffName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildStaffLoginUser(staff) {
  if (!staff?.fullName) return null;
  const staffSlug = slugifyStaffName(staff.fullName);
  return {
    username: normalizeStaffLoginValue(staff.fullName),
    role: 'staff',
    name: staff.fullName,
    staffSlug,
    landingPath: staffSlug ? `/cleaner/${staffSlug}` : '/cleaner',
    permissions: [],
  };
}

export async function getStaffUserForNameCredentials({ username = '', password = '' } = {}) {
  const normalizedUsername = normalizeStaffLoginValue(username);
  const normalizedPassword = normalizeStaffLoginValue(password);
  if (!normalizedUsername || !normalizedPassword || normalizedUsername !== normalizedPassword) {
    return null;
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return null;
  }

  const staff = await prisma.staff.findMany({
    where: { active: true },
    select: { id: true, fullName: true, staffCode: true, role: true },
    orderBy: { fullName: 'asc' },
  });
  const matchingStaff = staff.find((member) => normalizeStaffLoginValue(member.fullName) === normalizedUsername);
  return buildStaffLoginUser(matchingStaff);
}
