import { NextResponse } from 'next/server';
import { dispatchPendingNotifications } from '../../../../lib/notification-dispatch';
import { isOpsAuthorized } from '../../../../lib/ops-auth';
import { getPrisma } from '../../../../lib/prisma';
import { runRuntimeMaintenance } from '../../../../lib/runtime-maintenance';

export async function GET(request) {
  if (!isOpsAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const maintenance = await runRuntimeMaintenance(prisma, { force: true });
  const notifications = await dispatchPendingNotifications();

  return NextResponse.json({
    ok: true,
    maintenance,
    notifications,
  });
}
