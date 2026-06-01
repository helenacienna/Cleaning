import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { runRuntimeMaintenance } from '../../../lib/runtime-maintenance';

export async function GET() {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const result = await runRuntimeMaintenance(prisma, { force: true });
  return NextResponse.json({ ok: true, result });
}
