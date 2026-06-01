import { NextResponse } from 'next/server';
import { setInboxThreadStatus } from '../../../../../../lib/inbox-data';

export async function POST(request, { params }) {
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === 'string' ? body.status : '';

  try {
    const result = await setInboxThreadStatus({ threadId: params.threadId, status });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update thread status';
    return NextResponse.json({ error: message }, { status: message === 'Thread not found' ? 404 : 400 });
  }
}
