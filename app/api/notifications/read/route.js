import { NextResponse } from 'next/server';
import { isOpsAuthorized } from '../../../../lib/ops-auth';
import { markNotificationRead } from '../../../../lib/notification-center';

export async function POST(request) {
  if (!isOpsAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;

  if (!id) {
    return NextResponse.json({ error: 'Notification id is required' }, { status: 400 });
  }

  const result = await markNotificationRead(id);
  return NextResponse.json({ ok: true, notification: result });
}
