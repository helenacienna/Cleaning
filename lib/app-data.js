import { scheduleBuilder, taskCardTemplates } from '../data/demo-data';
import { getPrisma } from './prisma';
import { runRuntimeMaintenance } from './runtime-maintenance';

const boardDayFormatter = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'Australia/Brisbane',
});

function shouldUsePrisma() {
  return process.env.ENABLE_PRISMA_DATA !== 'false';
}

function getDemoLibraryData(source = 'demo') {
  return {
    cards: taskCardTemplates,
    zones: [...new Set(taskCardTemplates.map((card) => card.zone))].sort(),
    source,
  };
}

function getDemoOrganiserData(source = 'demo') {
  return {
    board: {
      ...scheduleBuilder.allocationBoard,
      source,
      automationSummary: { scanned: 0, changed: 0, skipped: 0 },
    },
    source,
  };
}

function formatBoardDay(value) {
  return boardDayFormatter.format(new Date(value)).replace(',', '');
}

function formatBoardStatus(status) {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'in-progress';
    case 'carried_forward':
      return 'carried-forward';
    case 'overdue':
      return 'overdue';
    default:
      return 'pending';
  }
}

function formatShiftWindow(startAt, endAt) {
  if (!startAt || !endAt) {
    return 'Flexible shift';
  }

  const formatter = new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Brisbane',
  });

  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

function getLaneIndex(instance) {
  if (!instance.shiftRun?.shiftStartAt || !instance.scheduledForAt) {
    return 0;
  }

  const shiftStart = new Date(instance.shiftRun.shiftStartAt).getTime();
  const scheduledFor = new Date(instance.scheduledForAt).getTime();
  const diffMinutes = Math.round((scheduledFor - shiftStart) / (60 * 1000));
  return Math.max(0, Math.floor(diffMinutes / 60));
}

function mapTaskTemplateToLibraryCard(taskTemplate) {
  return {
    id: taskTemplate.id,
    title: taskTemplate.title,
    templateId: taskTemplate.taskTemplateCode,
    jobOrderNumber: String(taskTemplate.defaultSequence).padStart(3, '0'),
    taskGroup: taskTemplate.taskGroup?.name ?? '',
    zone: taskTemplate.zone?.name ?? '',
    facility: taskTemplate.facility?.name ?? '',
    frequency: taskTemplate.recurrenceType,
    frequencyType: taskTemplate.priority === 'critical' ? 'Critical' : 'Suggestive',
    required: taskTemplate.evidenceRequirement === 'required_photo'
      ? 'Forced photo'
      : taskTemplate.commentRequirement === 'always'
        ? 'Comment on exception'
        : taskTemplate.evidenceRequirement === 'optional_photo'
          ? 'Random photo eligible'
          : 'Standard',
    estimatedEffort: taskTemplate.estimatedMinutes && taskTemplate.estimatedMinutes >= 20
      ? 'Detailed pass'
      : taskTemplate.estimatedMinutes && taskTemplate.estimatedMinutes >= 10
        ? 'Standard pass'
        : 'Quick check',
    lastCompleted: taskTemplate.status?.lastCompletedAt
      ? new Date(taskTemplate.status.lastCompletedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    suggestedDue: taskTemplate.status?.nextDueAt
      ? new Date(taskTemplate.status.nextDueAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    notes: taskTemplate.description ?? '',
    active: taskTemplate.active,
  };
}

function buildPrismaOrganiserBoard({ staffMembers, shiftRuns, taskInstances, automationSummary }) {
  const days = [...new Set(taskInstances.map((instance) => formatBoardDay(instance.shiftRun?.runDate ?? instance.dueAt)))];

  const staffMeta = Object.fromEntries(staffMembers.map((staff) => {
    const sampleShift = shiftRuns.find((shiftRun) => shiftRun.assignedStaffId === staff.id);
    return [staff.fullName, {
      shiftLabel: sampleShift?.shiftLabel ?? 'Flexible shift',
      shiftWindow: formatShiftWindow(sampleShift?.shiftStartAt, sampleShift?.shiftEndAt),
      facility: 'Multi-facility',
      routeLabel: sampleShift?.routeLabel ?? 'Daily route',
    }];
  }));

  const cards = taskInstances.map((instance, index) => {
    const latestAudit = instance.audits?.[0] ?? null;
    const hasOpenIssue = Boolean(instance.execution?.issueRaised);
    const reworkRequired = latestAudit?.reworkRequired || instance.status === 'carried_forward';

    return {
      id: instance.id,
      title: instance.titleSnapshot,
      templateId: instance.taskTemplate?.taskTemplateCode ?? instance.instanceCode,
      staff: instance.assignedStaff?.fullName ?? 'Unallocated',
      day: formatBoardDay(instance.shiftRun?.runDate ?? instance.dueAt),
      jobOrder: instance.sequence ?? index + 1,
      status: formatBoardStatus(instance.status),
      facility: instance.plannedFacility?.name ?? instance.facility.name,
      zone: instance.plannedZone?.name ?? instance.zone.name,
      taskGroup: instance.plannedTaskGroup?.name ?? instance.taskGroup.name,
      type: instance.priority === 'critical' ? 'critical' : 'suggestive',
      groupId: instance.plannedTaskGroupId ?? instance.taskGroupId,
      groupName: instance.plannedTaskGroup?.name ?? instance.taskGroup.name,
      laneIndex: getLaneIndex(instance),
      sourceFacility: instance.facility.name,
      sourceZone: instance.zone.name,
      sourceTaskGroup: instance.taskGroup.name,
      auditScore: latestAudit?.auditScore ?? null,
      managerAction: latestAudit?.managerAction ?? 'none',
      issueNote: latestAudit?.reworkReason ?? latestAudit?.auditComment ?? instance.execution?.exceptionReason ?? instance.exceptionReason,
      reworkRequired,
      hasOpenIssue,
    };
  });

  return {
    staff: [...staffMembers.map((staff) => staff.fullName), 'Unallocated'],
    staffMeta: {
      ...staffMeta,
      Unallocated: { shiftLabel: 'Rework queue', shiftWindow: 'Flexible shift', facility: 'Needs organiser action', routeLabel: 'Unallocated / rework' },
    },
    days,
    cards,
    automationSummary,
    source: 'prisma',
  };
}

export async function getTaskCardLibraryData() {
  if (!shouldUsePrisma()) {
    return getDemoLibraryData();
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return getDemoLibraryData('demo-no-db');
  }

  try {
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

    if (!templates.length) {
      return getDemoLibraryData();
    }

    const cards = templates.map(mapTaskTemplateToLibraryCard);

    return {
      cards,
      zones: [...new Set(cards.map((card) => card.zone))].sort(),
      source: 'prisma',
    };
  } catch {
    return getDemoLibraryData('demo-fallback');
  }
}

export async function getOrganiserBoardData() {
  if (!shouldUsePrisma()) {
    return getDemoOrganiserData();
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return getDemoOrganiserData('demo-no-db');
  }

  try {
    const automationSummary = await runRuntimeMaintenance(prisma);

    const [staffMembers, shiftRuns, taskInstances] = await Promise.all([
      prisma.staff.findMany({
        where: {
          active: true,
          role: 'cleaner',
        },
        orderBy: { staffCode: 'asc' },
      }),
      prisma.shiftRun.findMany({
        include: {
          assignedStaff: true,
        },
        orderBy: [
          { runDate: 'asc' },
          { shiftCode: 'asc' },
        ],
      }),
      prisma.taskInstance.findMany({
        include: {
          assignedStaff: true,
          shiftRun: true,
          facility: true,
          zone: true,
          taskGroup: true,
          plannedFacility: true,
          plannedZone: true,
          plannedTaskGroup: true,
          taskTemplate: true,
          execution: true,
          audits: {
            orderBy: { auditedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { dueAt: 'asc' },
          { sequence: 'asc' },
        ],
      }),
    ]);

    if (!staffMembers.length || !shiftRuns.length || !taskInstances.length) {
      return getDemoOrganiserData('demo-no-runtime-data');
    }

    return {
      board: buildPrismaOrganiserBoard({ staffMembers, shiftRuns, taskInstances, automationSummary }),
      source: 'prisma',
    };
  } catch {
    return getDemoOrganiserData('demo-fallback');
  }
}
