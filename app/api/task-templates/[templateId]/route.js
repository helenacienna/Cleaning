import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';
import { mapTaskTemplateToLibraryCard } from '../../../../lib/app-data';

function parseRequirement(value) {
  switch (String(value ?? '').toLowerCase()) {
    case 'forced photo':
      return {
        evidenceRequirement: 'required_photo',
        commentRequirement: 'none',
      };
    case 'random photo eligible':
      return {
        evidenceRequirement: 'optional_photo',
        commentRequirement: 'none',
      };
    case 'comment on exception':
      return {
        evidenceRequirement: 'none',
        commentRequirement: 'always',
      };
    default:
      return {
        evidenceRequirement: 'none',
        commentRequirement: 'none',
      };
  }
}

function parsePriority(value) {
  switch (String(value ?? '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'optional':
      return 'optional';
    default:
      return 'standard';
  }
}

function parseRecurrenceType(value) {
  switch (String(value ?? '').toLowerCase()) {
    case 'daily':
    case 'weekly':
    case 'monthly':
    case 'custom':
      return String(value).toLowerCase();
    default:
      return 'none';
  }
}

function parseTargetDays(value) {
  if (!value) {
    return null;
  }

  return [String(value).toLowerCase()];
}

export async function PATCH(request, { params }) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { templateId } = await params;
  const body = await request.json().catch(() => null);

  if (!templateId || !body) {
    return NextResponse.json({ error: 'Invalid task template payload' }, { status: 400 });
  }

  const recurrenceType = parseRecurrenceType(body.frequency);
  const priority = parsePriority(body.frequencyType);
  const requirement = parseRequirement(body.required);
  const estimatedMinutes = Number.parseInt(String(body.estimatedMinutes ?? '').trim(), 10);
  const defaultSequence = Number.parseInt(String(body.jobOrderNumber ?? '').trim(), 10);

  const existing = await prisma.taskTemplate.findUnique({
    where: { id: templateId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Task template not found' }, { status: 404 });
  }

  const updated = await prisma.taskTemplate.update({
    where: { id: templateId },
    data: {
      title: String(body.title ?? '').trim() || existing.title,
      description: String(body.notes ?? '').trim() || null,
      recurrenceType,
      recurrenceRule: recurrenceType === 'weekly'
        ? {
            ...(existing.recurrenceRule && typeof existing.recurrenceRule === 'object' ? existing.recurrenceRule : {}),
            cadenceMode: String(body.cadenceMode ?? 'Anchored').toLowerCase(),
            designatedDay: String(body.designatedDay ?? 'MON').toLowerCase(),
          }
        : null,
      targetDays: recurrenceType === 'weekly' ? parseTargetDays(body.designatedDay) : null,
      defaultSequence: Number.isFinite(defaultSequence) ? defaultSequence : existing.defaultSequence,
      estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : null,
      priority,
      evidenceRequirement: requirement.evidenceRequirement,
      commentRequirement: requirement.commentRequirement,
      active: Boolean(body.active),
      version: { increment: 1 },
    },
    include: {
      facility: true,
      zone: true,
      taskGroup: true,
      status: true,
    },
  });

  return NextResponse.json({
    ok: true,
    card: mapTaskTemplateToLibraryCard(updated),
  });
}
