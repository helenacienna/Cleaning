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
    case 'multi photo':
      return {
        evidenceRequirement: 'multi_photo',
        commentRequirement: 'none',
      };
    case 'comment always':
      return {
        evidenceRequirement: 'none',
        commentRequirement: 'always',
      };
    case 'comment on exception only':
      return {
        evidenceRequirement: 'none',
        commentRequirement: 'on_exception',
      };
    default:
      return {
        evidenceRequirement: 'none',
        commentRequirement: 'none',
      };
  }
}

function parseServiceType(value) {
  switch (String(value ?? '').toLowerCase()) {
    case 'periodic':
      return 'periodic';
    case 'ad_hoc':
    case 'ad hoc':
      return 'ad_hoc';
    default:
      return 'routine';
  }
}

function parseServiceLevel(value) {
  switch (String(value ?? '').toLowerCase()) {
    case 'check':
      return 'check';
    case 'detailed_clean':
    case 'detailed clean':
    case 'detail clean':
      return 'detailed_clean';
    default:
      return 'clean';
  }
}

function parseMissedTaskPolicy(value) {
  switch (String(value ?? '').toLowerCase()) {
    case 'stay_overdue':
      return 'stay_overdue';
    case 'skip_and_regenerate':
      return 'skip_and_regenerate';
    case 'manager_review':
      return 'manager_review';
    default:
      return 'carry_forward';
  }
}

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
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

function parseRecurrenceBasis(value) {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'suggested' || normalized === 'rolling' ? 'suggested' : 'anchored';
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
  const recurrenceBasis = parseRecurrenceBasis(body.cadenceMode);
  const estimatedMinutes = Number.parseInt(String(body.estimatedMinutes ?? '').trim(), 10);
  const defaultSequence = Number.parseInt(String(body.jobOrderNumber ?? '').trim(), 10);
  const rescheduleWindowDays = Number.parseInt(String(body.rescheduleWindowDays ?? '').trim(), 10);

  const existing = await prisma.taskTemplate.findUnique({
    where: { id: templateId },
    include: { facility: true, zone: true, taskGroup: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Task template not found' }, { status: 404 });
  }

  const facilityId = String(body.facilityId ?? existing.facilityId).trim();
  const zoneId = String(body.zoneId ?? existing.zoneId).trim();
  const taskGroupId = String(body.taskGroupId ?? existing.taskGroupId).trim();
  const [facility, zone, taskGroup] = await Promise.all([
    prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } }),
    prisma.zone.findUnique({ where: { id: zoneId }, select: { id: true, facilityId: true } }),
    prisma.taskGroup.findUnique({ where: { id: taskGroupId }, select: { id: true, facilityId: true, zoneId: true } }),
  ]);

  if (!facility) {
    return NextResponse.json({ error: 'Selected facility was not found' }, { status: 400 });
  }
  if (!zone || zone.facilityId !== facilityId) {
    return NextResponse.json({ error: 'Selected zone does not belong to the selected facility' }, { status: 400 });
  }
  if (!taskGroup || taskGroup.facilityId !== facilityId || taskGroup.zoneId !== zoneId) {
    return NextResponse.json({ error: 'Selected task group does not belong to the selected zone' }, { status: 400 });
  }

  const updated = await prisma.taskTemplate.update({
    where: { id: templateId },
    data: {
      title: String(body.title ?? '').trim() || existing.title,
      description: optionalText(body.notes),
      facilityId,
      zoneId,
      taskGroupId,
      serviceType: parseServiceType(body.serviceType),
      serviceLevel: parseServiceLevel(body.serviceLevel),
      recurrenceType,
      recurrenceRule: recurrenceType === 'weekly'
        ? {
            ...(existing.recurrenceRule && typeof existing.recurrenceRule === 'object' ? existing.recurrenceRule : {}),
            recurrenceBasis,
            cadenceMode: recurrenceBasis === 'suggested' ? 'rolling' : 'anchored',
            designatedDay: String(body.designatedDay ?? 'MON').toLowerCase(),
          }
        : null,
      targetDays: recurrenceType === 'weekly' ? parseTargetDays(body.designatedDay) : null,
      defaultSequence: Number.isFinite(defaultSequence) ? defaultSequence : existing.defaultSequence,
      estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : null,
      priority,
      evidenceRequirement: requirement.evidenceRequirement,
      commentRequirement: requirement.commentRequirement,
      passCriteria: optionalText(body.passCriteria),
      safetyNotes: optionalText(body.safetyNotes),
      autoGenerateInstances: Boolean(body.autoGenerateInstances),
      requiresPlanning: Boolean(body.requiresPlanning),
      canBeSplit: Boolean(body.canBeSplit),
      canBeMovedBetweenStaff: Boolean(body.canBeMovedBetweenStaff),
      requiresManagerApprovalToSkip: Boolean(body.requiresManagerApprovalToSkip),
      missedTaskPolicy: parseMissedTaskPolicy(body.missedTaskPolicy),
      rescheduleWindowDays: Number.isFinite(rescheduleWindowDays) ? rescheduleWindowDays : null,
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
