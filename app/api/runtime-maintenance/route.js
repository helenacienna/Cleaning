import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { runRuntimeMaintenance } from '../../../lib/runtime-maintenance';

function isAuthorized(request) {
  const expected = process.env.MAINTENANCE_API_TOKEN;
  if (!expected) return true;
  const provided = request.headers.get('x-maintenance-token') || new URL(request.url).searchParams.get('token');
  return provided === expected;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const result = await runRuntimeMaintenance(prisma, { force: true });
  return NextResponse.json({ ok: true, result });
}
