import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { mapTaskTemplateToLibraryCard } from '../../../lib/app-data';

export async function PATCH(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const orderedIds = Array.isArray(body?.orderedIds)
    ? body.orderedIds.filter((id) => typeof id === 'string' && id.trim())
    : [];

  if (!orderedIds.length) {
    return NextResponse.json({ error: 'No task cards supplied' }, { status: 400 });
  }

  const uniqueIds = [...new Set(orderedIds)];

  const existing = await prisma.taskTemplate.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((template) => template.id));
  const missingIds = uniqueIds.filter((id) => !existingIds.has(id));

  if (missingIds.length) {
    return NextResponse.json({ error: 'Some task cards could not be found', missingIds }, { status: 404 });
  }

  await prisma.$transaction(
    uniqueIds.flatMap((id, index) => {
      const nextSequence = (index + 1) * 10;

      return [
        prisma.taskTemplate.update({
          where: { id },
          data: {
            defaultSequence: nextSequence,
            version: { increment: 1 },
          },
        }),
        prisma.taskInstance.updateMany({
          where: {
            taskTemplateId: id,
            status: { notIn: ['completed', 'cancelled', 'skipped'] },
          },
          data: {
            sequence: nextSequence,
          },
        }),
      ];
    }),
    { timeout: 30000 },
  );

  const templates = await prisma.taskTemplate.findMany({
    include: {
      facility: true,
      zone: true,
      taskGroup: true,
      status: true,
    },
    orderBy: [
      { facilityId: 'asc' },
      { zoneId: 'asc' },
      { defaultSequence: 'asc' },
    ],
  });

  return NextResponse.json({
    ok: true,
    message: 'Task template order and active task instance order updated',
    cards: templates.map(mapTaskTemplateToLibraryCard),
  });
}
