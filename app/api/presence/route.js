import { NextResponse } from 'next/server';
import { getCurrentStaffSession } from '../../../lib/session-staff.js';
import { writeStaffPresence } from '../../../lib/staff-presence.js';

export async function POST(request) {
  const { session, staff } = await getCurrentStaffSession();
  if (!session || !staff) {
    return NextResponse.json({ error: 'Staff session required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = await writeStaffPresence({
    staff,
    deviceId: typeof body?.deviceId === 'string' ? body.deviceId : '',
    page: typeof body?.page === 'string' ? body.page : '',
  });

  return NextResponse.json({ ok: true, ...result });
}
