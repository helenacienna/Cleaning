import { NextResponse } from 'next/server';
import { dispatchPendingNotifications } from '../../../lib/notification-dispatch';
import { isOpsAuthorized } from '../../../lib/ops-auth';

export async function GET(request) {
  if (!isOpsAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await dispatchPendingNotifications();
  return NextResponse.json({ ok: true, result });
}
