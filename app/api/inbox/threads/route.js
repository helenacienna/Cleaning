import { NextResponse } from 'next/server';
import { createInboxThread, listInboxThreads } from '../../../../lib/inbox-data';
import { getCurrentStaffSession } from '../../../../lib/session-staff.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const { session, staff } = await getCurrentStaffSession();
  const requestedAudience = searchParams.get('audience') || 'manager';
  const audience = session?.role === 'staff' ? 'staff' : requestedAudience;
  const limit = Number(searchParams.get('limit') || '12');

  const threads = await listInboxThreads({
    audience,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 12,
    participantStaffCode: session?.role === 'staff' ? staff?.staffCode : '',
  });

  return NextResponse.json({ ok: true, threads });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title : '';
  const subtitle = typeof body?.subtitle === 'string' ? body.subtitle : '';
  const { session, staff } = await getCurrentStaffSession();
  const audience = session?.role === 'staff' ? 'staff' : (typeof body?.audience === 'string' ? body.audience : 'manager');
  const senderStaffCode = session?.role === 'staff' ? staff?.staffCode : (typeof body?.senderStaffCode === 'string' ? body.senderStaffCode : null);
  const participantStaffCodes = Array.isArray(body?.participantStaffCodes)
    ? body.participantStaffCodes.filter((item) => typeof item === 'string')
    : [];
  if (session?.role === 'staff' && staff?.staffCode && !participantStaffCodes.includes(staff.staffCode)) {
    participantStaffCodes.push(staff.staffCode);
  }

  if (!title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  try {
    const result = await createInboxThread({
      title,
      subtitle,
      audience,
      participantStaffCodes,
      senderStaffCode,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create thread' }, { status: 400 });
  }
}
