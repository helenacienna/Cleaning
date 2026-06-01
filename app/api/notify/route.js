import { NextResponse } from 'next/server';
import { dispatchPendingNotifications } from '../../../lib/notification-dispatch';

export async function GET() {
  const result = await dispatchPendingNotifications(async () => {
    throw new Error('No runtime messenger configured inside app route');
  });

  return NextResponse.json({ ok: true, result });
}
