import { NextResponse } from 'next/server';
import { markInboxThreadRead } from '../../../../../../lib/inbox-data';
import { getCurrentStaffSession } from '../../../../../../lib/session-staff.js';

export async function POST(request, { params }) {
  const body = await request.json().catch(() => null);
  const { session, staff } = await getCurrentStaffSession();
  const participantStaffCode = session?.role === 'staff' ? staff?.staffCode : (typeof body?.participantStaffCode === 'string' ? body.participantStaffCode : null);

  try {
    const result = await markInboxThreadRead({
      threadId: params.threadId,
      participantStaffCode,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to mark thread as read';
    return NextResponse.json({ error: message }, { status: message === 'Thread not found' ? 404 : 400 });
  }
}
