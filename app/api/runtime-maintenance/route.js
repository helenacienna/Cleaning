import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { isOpsAuthorized } from '../../../lib/ops-auth';
import { runRuntimeMaintenance } from '../../../lib/runtime-maintenance';

export async function GET(request) {
  if (!isOpsAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const result = await runRuntimeMaintenance(prisma, { force: true });
  return NextResponse.json({ ok: true, result });
}
