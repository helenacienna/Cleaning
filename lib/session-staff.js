import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifyAuthSession } from './auth-cookie.js';
import { getPrisma } from './prisma.js';

export function slugifyStaffName(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function getAuthSessionFromCookies() {
  const cookieStore = await cookies();
  return verifyAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value || '');
}

export async function getStaffForSession(session) {
  if (!session) return null;
  const prisma = await getPrisma();
  if (!prisma) return null;

  const staff = await prisma.staff.findMany({ where: { active: true }, orderBy: { fullName: 'asc' } });
  const wantedSlug = String(session.staffSlug || '').trim();
  const wantedName = String(session.name || '').trim().toLowerCase();
  const wantedUsername = String(session.username || '').trim().toLowerCase();

  return staff.find((member) => slugifyStaffName(member.fullName) === wantedSlug)
    || staff.find((member) => member.fullName.toLowerCase() === wantedName)
    || staff.find((member) => member.staffCode.toLowerCase() === wantedUsername)
    || null;
}

export async function getCurrentStaffSession() {
  const session = await getAuthSessionFromCookies();
  const staff = await getStaffForSession(session);
  return { session, staff };
}
