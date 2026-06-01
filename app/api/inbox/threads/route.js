import { NextResponse } from 'next/server';
import { createInboxThread, listInboxThreads } from '../../../../lib/inbox-data';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const audience = searchParams.get('audience') || 'manager';
  const limit = Number(searchParams.get('limit') || '12');

  const threads = await listInboxThreads({
    audience,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 12,
  });

  return NextResponse.json({ ok: true, threads });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title : '';
  const subtitle = typeof body?.subtitle === 'string' ? body.subtitle : '';
  const audience = typeof body?.audience === 'string' ? body.audience : 'manager';
  const senderStaffCode = typeof body?.senderStaffCode === 'string' ? body.senderStaffCode : null;
  const participantStaffCodes = Array.isArray(body?.participantStaffCodes)
    ? body.participantStaffCodes.filter((item) => typeof item === 'string')
    : [];

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
