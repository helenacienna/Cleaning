import { scheduleBuilder, taskCardTemplates } from '../data/demo-data.js';
import { DEFAULT_APP_TIME_ZONE, formatBoardDayKeyForTimeZone, formatBoardDayLabelForTimeZone, getAppTimeZone, getTimeZoneFormatter } from './app-timezone.js';
import { getPrisma } from './prisma.js';
import { listInboxThreads } from './inbox-data.js';
import { getOperationalWindow } from './operational-window.mjs';
import { runRuntimeMaintenance } from './runtime-maintenance.js';
import { getCadenceDisplayLabel, getTaskInstanceBoardDate, validateTaskInstanceSequence } from './task-scheduling.js';

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

function getDemoOrganiserData(source = 'demo', timeZone = DEFAULT_APP_TIME_ZONE) {
  return {
    board: {
      ...scheduleBuilder.allocationBoard,
      source,
      timeZone,
      automationSummary: { scanned: 0, changed: 0, skipped: 0 },
      inboxSummary: { unread: 3, cleanerUnread: 1, supervisorUnread: 2 },
    },
    source,
  };
}

function getTodayBoardDayKey(timeZone = DEFAULT_APP_TIME_ZONE) {
  return formatBoardDayKey(new Date(), timeZone);
}

function formatBoardDayLabel(value, timeZone = DEFAULT_APP_TIME_ZONE) {
  return formatBoardDayLabelForTimeZone(value, timeZone);
}

function formatBoardDayKey(value, timeZone = DEFAULT_APP_TIME_ZONE) {
  return formatBoardDayKeyForTimeZone(value, timeZone);
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
    case 'scheduled':
    case 'upcoming':
      return 'scheduled';
    default:
      return 'pending';
  }
}

function formatRequirement(taskLike) {
  if (taskLike?.evidenceRequirement === 'required_photo' || taskLike?.evidenceRequirement === 'multi_photo') {
    return 'Photo required';
  }

  if (taskLike?.commentRequirement === 'always' || taskLike?.commentRequirement === 'on_exception') {
    return 'Comment required';
  }

  if (taskLike?.evidenceRequirement === 'optional_photo') {
    return 'Random photo eligible';
  }

  return 'Standard';
}

function formatPriorityType(priority) {
  switch (priority) {
    case 'critical':
      return 'Critical';
    case 'optional':
      return 'Optional';
    case 'standard':
    default:
      return 'Standard';
  }
}

function formatShiftWindow(startAt, endAt) {
  if (!startAt || !endAt) {
    return 'Flexible shift';
  }

  const formatUtcClock = (value) => {
    const date = new Date(value);
    const hours24 = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const suffix = hours24 >= 12 ? 'pm' : 'am';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, '0')}${suffix}`;
  };

  return `${formatUtcClock(startAt)} – ${formatUtcClock(endAt)}`;
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

function buildTemplateHistoryRecommendations(executions = [], staffMembers = []) {
  const activeCleanerIds = new Set(staffMembers.map((staff) => staff.id));
  const byTemplate = new Map();

  executions.forEach((execution) => {
    const templateId = execution.taskInstance?.taskTemplateId;
    const completedByStaffId = execution.completedByStaffId;
    const completedByStaffName = execution.completedByStaff?.fullName;

    if (!templateId || !completedByStaffId || !completedByStaffName || !activeCleanerIds.has(completedByStaffId)) {
      return;
    }

    const history = byTemplate.get(templateId) ?? [];
    if (history.length >= 20) {
      return;
    }

    history.push({
      staffId: completedByStaffId,
      staffName: completedByStaffName,
      completedAt: execution.completedAt ?? execution.updatedAt ?? execution.createdAt ?? null,
    });
    byTemplate.set(templateId, history);
  });

  const recommendations = new Map();

  byTemplate.forEach((history, templateId) => {
    const scoreByStaff = new Map();

    history.forEach((entry, index) => {
      const existing = scoreByStaff.get(entry.staffId) ?? {
        staffId: entry.staffId,
        staffName: entry.staffName,
        count: 0,
        latestCompletedAt: null,
        latestIndex: Number.POSITIVE_INFINITY,
      };

      existing.count += 1;
      if (!existing.latestCompletedAt || new Date(entry.completedAt).getTime() > new Date(existing.latestCompletedAt).getTime()) {
        existing.latestCompletedAt = entry.completedAt;
      }
      if (index < existing.latestIndex) {
        existing.latestIndex = index;
      }
      scoreByStaff.set(entry.staffId, existing);
    });

    const winner = [...scoreByStaff.values()].sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (left.latestIndex !== right.latestIndex) {
        return left.latestIndex - right.latestIndex;
      }

      return String(left.staffName).localeCompare(String(right.staffName));
    })[0];

    if (!winner) {
      return;
    }

    recommendations.set(templateId, {
      staffId: winner.staffId,
      staffName: winner.staffName,
      count: winner.count,
      sampleSize: history.length,
      latestCompletedAt: winner.latestCompletedAt,
      source: 'recent-completions',
    });
  });

  return recommendations;
}

export function mapTaskTemplateToLibraryCard(taskTemplate) {
  return {
    id: taskTemplate.id,
    title: taskTemplate.title,
    templateId: taskTemplate.taskTemplateCode,
    jobOrderNumber: String(taskTemplate.defaultSequence).padStart(3, '0'),
    taskGroup: taskTemplate.taskGroup?.name ?? '',
    zone: taskTemplate.zone?.name ?? '',
    facility: taskTemplate.facility?.name ?? '',
    facilityId: taskTemplate.facility?.id ?? null,
    frequency: taskTemplate.recurrenceType,
    cadenceMode: taskTemplate.recurrenceType === 'weekly'
      ? getCadenceDisplayLabel(taskTemplate)
      : '—',
    designatedDay: taskTemplate.recurrenceType === 'weekly'
      ? String(taskTemplate.recurrenceRule?.designatedDay ?? taskTemplate.targetDays?.[0] ?? 'mon').toUpperCase()
      : '—',
    frequencyType: taskTemplate.priority === 'critical' ? 'Critical' : 'Suggestive',
    required: taskTemplate.evidenceRequirement === 'required_photo'
      ? 'Forced photo'
      : taskTemplate.commentRequirement === 'always'
        ? 'Comment on exception'
        : taskTemplate.evidenceRequirement === 'optional_photo'
          ? 'Random photo eligible'
          : 'Standard',
    estimatedMinutes: taskTemplate.estimatedMinutes ?? 5,
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

function buildPrismaOrganiserBoard({ staffMembers, shiftRuns, taskInstances, automationSummary, validationSummary, templateRecommendations = new Map(), timeZone = DEFAULT_APP_TIME_ZONE }) {
  const safeTaskInstances = taskInstances.filter((instance) => instance?.facility && instance?.zone && instance?.taskGroup);
  const days = [...new Set(safeTaskInstances.map((instance) => formatBoardDayKey(getTaskInstanceBoardDate(instance), timeZone)))]
    .sort((left, right) => left.localeCompare(right));

  const getTimeMinutes = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return (date.getUTCHours() * 60) + date.getUTCMinutes();
  };

  const staffMeta = Object.fromEntries(staffMembers.map((staff) => {
    const sampleShift = shiftRuns.find((shiftRun) => shiftRun.assignedStaffId === staff.id);
    const shiftMinutes = sampleShift?.shiftStartAt && sampleShift?.shiftEndAt
      ? Math.max(0, Math.round((new Date(sampleShift.shiftEndAt).getTime() - new Date(sampleShift.shiftStartAt).getTime()) / 60000))
      : null;
    const shiftStartMinutes = getTimeMinutes(sampleShift?.shiftStartAt);
    const shiftEndMinutes = getTimeMinutes(sampleShift?.shiftEndAt);
    return [staff.fullName, {
      shiftLabel: sampleShift?.shiftLabel ?? 'Flexible shift',
      shiftWindow: formatShiftWindow(sampleShift?.shiftStartAt, sampleShift?.shiftEndAt),
      shiftMinutes,
      shiftStartMinutes,
      shiftEndMinutes,
      facility: 'Multi-facility',
      routeLabel: sampleShift?.routeLabel ?? 'Daily route',
    }];
  }));

  const cards = safeTaskInstances.map((instance, index) => {
    const latestAudit = instance.audits?.[0] ?? null;
    const hasOpenIssue = Boolean(instance.execution?.issueRaised);
    const reworkRequired = latestAudit?.reworkRequired || instance.status === 'carried_forward';
    const recommendation = templateRecommendations.get(instance.taskTemplateId) ?? null;

    return {
      id: instance.id,
      title: instance.titleSnapshot,
      templateId: instance.taskTemplate?.taskTemplateCode ?? instance.instanceCode,
      instanceCode: instance.instanceCode,
      staff: instance.assignedStaff?.fullName ?? 'Unallocated',
      day: formatBoardDayKey(getTaskInstanceBoardDate(instance), timeZone),
      dayLabel: formatBoardDayLabel(getTaskInstanceBoardDate(instance), timeZone),
      jobOrder: instance.sequence ?? index + 1,
      status: formatBoardStatus(instance.status),
      facility: instance.plannedFacility?.name ?? instance.facility.name,
      zone: instance.plannedZone?.name ?? instance.zone.name,
      taskGroup: instance.plannedTaskGroup?.name ?? instance.taskGroup.name,
      frequency: instance.taskTemplate?.recurrenceType ?? null,
      cadenceMode: instance.taskTemplate?.recurrenceType === 'weekly'
        ? getCadenceDisplayLabel(instance.taskTemplate)
        : '—',
      designatedDay: instance.taskTemplate?.recurrenceType === 'weekly'
        ? String(instance.taskTemplate?.recurrenceRule?.designatedDay ?? instance.taskTemplate?.targetDays?.[0] ?? 'mon').toUpperCase()
        : '—',
      required: formatRequirement(instance),
      frequencyType: formatPriorityType(instance.priority),
      estimatedMinutes: instance.estimatedMinutes,
      notes: instance.descriptionSnapshot,
      type: instance.priority === 'critical' ? 'critical' : 'suggestive',
      groupId: instance.plannedTaskGroupId ?? instance.taskGroupId,
      groupName: instance.plannedTaskGroup?.name ?? instance.taskGroup.name,
      laneIndex: getLaneIndex(instance),
      sourceFacility: instance.facility.name,
      sourceZone: instance.zone.name,
      sourceTaskGroup: instance.taskGroup.name,
      updatedAt: instance.updatedAt,
      auditScore: latestAudit?.auditScore ?? null,
      managerAction: latestAudit?.managerAction ?? 'none',
      issueNote: latestAudit?.reworkReason ?? latestAudit?.auditComment ?? instance.execution?.exceptionReason ?? instance.exceptionReason,
      reworkRequired,
      hasOpenIssue,
      recommendedStaff: recommendation?.staffName ?? null,
      recommendationReason: recommendation ? `${recommendation.staffName} completed ${recommendation.count} of the last ${recommendation.sampleSize}` : null,
      recommendationCount: recommendation?.count ?? 0,
      recommendationSampleSize: recommendation?.sampleSize ?? 0,
      recommendationSource: recommendation?.source ?? null,
      recommendationLatestCompletedAt: recommendation?.latestCompletedAt ?? null,
    };
  });

  return {
    staff: [...staffMembers.map((staff) => staff.fullName), 'Unallocated'],
    staffMeta: {
      ...staffMeta,
      Unallocated: { shiftLabel: 'Rework queue', shiftWindow: 'Flexible shift', shiftMinutes: null, shiftStartMinutes: null, shiftEndMinutes: null, facility: 'Needs organiser action', routeLabel: 'Unallocated / rework' },
    },
    days,
    cards,
    automationSummary,
    validationSummary,
    timeZone,
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

async function fetchOrganiserRuntimeSnapshot(prisma, window = getOperationalWindow()) {
  const [staffMembers, shiftRuns, taskInstances] = await Promise.all([
    prisma.staff.findMany({
      where: {
        active: true,
        role: 'cleaner',
      },
      orderBy: { staffCode: 'asc' },
    }),
    prisma.shiftRun.findMany({
      where: {
        runDate: {
          gte: window.runDateGte,
          lte: window.runDateLte,
        },
      },
      include: {
        assignedStaff: true,
      },
      orderBy: [
        { runDate: 'asc' },
        { shiftCode: 'asc' },
      ],
    }),
    prisma.taskInstance.findMany({
      where: {
        OR: [
          {
            shiftRun: {
              is: {
                runDate: {
                  gte: window.runDateGte,
                  lte: window.runDateLte,
                },
              },
            },
          },
          {
            plannedRunDate: {
              gte: window.runDateGte,
              lte: window.runDateLte,
            },
          },
          {
            dueAt: {
              gte: window.dueAtGte,
              lt: window.dueAtLt,
            },
          },
        ],
      },
      include: {
        assignedStaff: true,
        shiftRun: true,
        facility: true,
        zone: true,
        taskGroup: true,
        plannedFacility: true,
        plannedZone: true,
        plannedTaskGroup: true,
        taskTemplate: {
          select: {
            taskTemplateCode: true,
            recurrenceType: true,
            recurrenceRule: true,
            targetDays: true,
          },
        },
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

  const templateIds = [...new Set(taskInstances.map((instance) => instance.taskTemplateId).filter(Boolean))];
  const recentExecutions = templateIds.length
    ? await prisma.taskExecution.findMany({
        where: {
          completionStatus: 'completed',
          completedByStaffId: { not: null },
          taskInstance: {
            taskTemplateId: { in: templateIds },
          },
        },
        select: {
          completedAt: true,
          updatedAt: true,
          createdAt: true,
          completedByStaffId: true,
          completedByStaff: {
            select: {
              fullName: true,
            },
          },
          taskInstance: {
            select: {
              taskTemplateId: true,
            },
          },
        },
        orderBy: [
          { completedAt: 'desc' },
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
      })
    : [];

  const templateRecommendations = buildTemplateHistoryRecommendations(recentExecutions, staffMembers);

  return { staffMembers, shiftRuns, taskInstances, templateRecommendations };
}

export async function getOrganiserBoardData(options = {}) {
  const {
    includeMaintenance = false,
    includeInboxSummary = false,
  } = options;

  const timeZone = await getAppTimeZone();

  if (!shouldUsePrisma()) {
    return getDemoOrganiserData('demo', timeZone);
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return getDemoOrganiserData('demo-no-db', timeZone);
  }

  try {
    const operationalWindow = getOperationalWindow({ timeZone });
    const automationSummary = includeMaintenance
      ? await runRuntimeMaintenance(prisma, { readOnly: true }).catch((error) => {
          console.error('runRuntimeMaintenance failed during organiser board load; continuing without maintenance summary', error);
          return { scanned: 0, changed: 0, skipped: 0, failed: true };
        })
      : { scanned: 0, changed: 0, skipped: 0, deferred: true };

    const { staffMembers, shiftRuns, taskInstances, templateRecommendations } = await fetchOrganiserRuntimeSnapshot(prisma, operationalWindow);

    if (!staffMembers.length || !taskInstances.length) {
      return getDemoOrganiserData('demo-no-runtime-data', timeZone);
    }

    const validationSummary = (() => {
      try {
        return validateTaskInstanceSequence(taskInstances);
      } catch {
        return { issues: [], templatesAffected: 0, instancesAffected: 0 };
      }
    })();

    const board = buildPrismaOrganiserBoard({ staffMembers, shiftRuns, taskInstances, automationSummary, validationSummary, templateRecommendations, timeZone });

    if (includeInboxSummary) {
      const [managerInbox, supervisorInbox, cleanerInbox] = await Promise.all([
        listInboxThreads({ audience: 'manager', limit: 12 }).catch(() => []),
        listInboxThreads({ audience: 'supervisor', limit: 12 }).catch(() => []),
        listInboxThreads({ audience: 'cleaner', limit: 12 }).catch(() => []),
      ]);

      board.inboxSummary = {
        unread: managerInbox.reduce((sum, thread) => sum + thread.unreadCount, 0),
        supervisorUnread: supervisorInbox.reduce((sum, thread) => sum + thread.unreadCount, 0),
        cleanerUnread: cleanerInbox.reduce((sum, thread) => sum + thread.unreadCount, 0),
      };
    }

    return {
      board,
      timeZone,
      source: 'prisma',
    };
  } catch (error) {
    console.error('getOrganiserBoardData failed; returning demo fallback', error);
    return getDemoOrganiserData('demo-fallback', timeZone);
  }
}
