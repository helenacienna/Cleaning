import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

const ALLOWED_TEST_TASK_ID = '89ddab05-96b9-43bc-afdc-cd319656dc02';
const ALLOWED_TEST_TITLE = 'TEST allocation Helena 2026-07-29 2143';

export async function POST(request) {
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '').trim();

  if (id !== ALLOWED_TEST_TASK_ID) {
    return NextResponse.json({ error: 'Unsupported cleanup target' }, { status: 400 });
  }

  const task = await prisma.taskInstance.findUnique({
    where: { id },
    select: {
      id: true,
      titleSnapshot: true,
      manuallyCreated: true,
      sourceType: true,
      status: true,
    },
  });

  if (!task) {
    return NextResponse.json({ ok: true, alreadyGone: true });
  }

  if (task.titleSnapshot !== ALLOWED_TEST_TITLE || !task.manuallyCreated || task.sourceType !== 'ad_hoc') {
    return NextResponse.json({ error: 'Cleanup target did not match expected test task' }, { status: 400 });
  }

  const deleted = await prisma.taskInstance.delete({
    where: { id },
    select: {
      id: true,
      titleSnapshot: true,
      status: true,
    },
  });

  return NextResponse.json({ ok: true, deleted });
}
