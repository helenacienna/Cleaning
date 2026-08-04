import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '../../../../lib/auth-cookie';
import { getPrisma } from '../../../../lib/prisma';
import { getCurrentStaffSession } from '../../../../lib/session-staff';
import { findOrCreateStaffDirectThread } from '../../../../lib/inbox-data';

async function getSession() {
  const cookieStore = await cookies();
  return verifyAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value || '');
}

async function getSenderStaffCode(session) {
  if (session?.role === 'staff') {
    const { staff } = await getCurrentStaffSession();
    return staff?.staffCode || '';
  }

  const prisma = await getPrisma();
  if (!prisma) return '';

  const username = String(session?.username || '').trim().toLowerCase();
  const name = String(session?.name || '').trim().toLowerCase();
  const staff = await prisma.staff.findMany({ where: { active: true }, orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
  const matched = staff.find((member) => member.fullName.toLowerCase() === username || member.fullName.toLowerCase() === name)
    || staff.find((member) => member.role === 'manager')
    || staff[0];
  return matched?.staffCode || '';
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const staffCode = typeof body?.staffCode === 'string' ? body.staffCode.trim().toUpperCase() : '';
  if (!staffCode) {
    return NextResponse.json({ error: 'Staff member is required' }, { status: 400 });
  }

  try {
    const senderStaffCode = await getSenderStaffCode(session);
    const result = await findOrCreateStaffDirectThread({ staffCode, senderStaffCode });
    const threadId = result.thread?.id;
    if (!threadId) {
      return NextResponse.json({ error: 'Unable to open staff message thread' }, { status: 400 });
    }
    const href = session.role === 'staff'
      ? `/cleaner/messages?thread=${encodeURIComponent(threadId)}`
      : `/admin/inbox?audience=staff&thread=${encodeURIComponent(threadId)}`;
    return NextResponse.json({ ok: true, threadId, href });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Unable to open staff message thread' }, { status: 400 });
  }
}
