import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { mapTaskTemplateToLibraryCard } from '../../../lib/app-data';

const FINISHED_STATUSES = ['completed', 'cancelled', 'skipped'];

async function resolveTemplateIdsFromInstances(prisma, orderedInstanceIds) {
  const instances = await prisma.taskInstance.findMany({
    where: { id: { in: orderedInstanceIds } },
    select: { id: true, taskTemplateId: true },
  });
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
  const missingIds = orderedInstanceIds.filter((id) => !instanceById.has(id));

  if (missingIds.length) {
    return { error: 'Some live tasks could not be found', missingIds };
  }

  return {
    templateIds: orderedInstanceIds
      .map((id) => instanceById.get(id)?.taskTemplateId)
      .filter(Boolean),
  };
}

async function resolveTemplateIdsFromTemplates(prisma, orderedIds) {
  const existing = await prisma.taskTemplate.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((template) => template.id));
  const missingIds = orderedIds.filter((id) => !existingIds.has(id));

  if (missingIds.length) {
    return { error: 'Some task cards could not be found', missingIds };
  }

  return { templateIds: orderedIds };
}

export async function PATCH(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const orderedIds = Array.isArray(body?.orderedIds)
    ? body.orderedIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  const orderedInstanceIds = Array.isArray(body?.orderedInstanceIds)
    ? body.orderedInstanceIds.filter((id) => typeof id === 'string' && id.trim())
    : [];

  if (!orderedIds.length && !orderedInstanceIds.length) {
    return NextResponse.json({ error: 'No task cards supplied' }, { status: 400 });
  }

  const resolution = orderedInstanceIds.length
    ? await resolveTemplateIdsFromInstances(prisma, [...new Set(orderedInstanceIds)])
    : await resolveTemplateIdsFromTemplates(prisma, [...new Set(orderedIds)]);

  if (resolution.error) {
    return NextResponse.json({ error: resolution.error, missingIds: resolution.missingIds }, { status: 404 });
  }

  const uniqueTemplateIds = [...new Set(resolution.templateIds)];

  await prisma.$transaction(
    uniqueTemplateIds.flatMap((id, index) => {
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
            status: { notIn: FINISHED_STATUSES },
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
