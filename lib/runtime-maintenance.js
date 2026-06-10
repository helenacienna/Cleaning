import { recordNotification } from './notification-center';
import { ensureUpcomingTaskInstances, getTaskInstanceEffectiveDueAt } from './task-scheduling';
import { isTaskInstancePastEffectiveDue } from './task-effective-day.mjs';

const globalForRuntimeMaintenance = globalThis;
const MAINTENANCE_INTERVAL_MS = 30 * 1000;

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getAutomationOutcome(task) {
  switch (task.taskTemplate?.missedTaskPolicy) {
    case 'carry_forward':
      return {
        status: 'carried_forward',
        sourceType: 'carry_forward',
        assignedStaffId: null,
        shiftRunId: null,
        scheduledForAt: null,
        exceptionReason: 'Automatically moved to carry-forward queue after becoming overdue.',
        auditStatus: 'needs_followup',
        managerAction: 'reassign',
        auditScore: 2,
      };
    case 'skip_and_regenerate':
      return {
        status: 'skipped',
        sourceType: task.sourceType,
        assignedStaffId: task.assignedStaffId,
        shiftRunId: task.shiftRunId,
        scheduledForAt: task.scheduledForAt,
        exceptionReason: 'Automatically skipped after missing the due window.',
        auditStatus: 'failed',
        managerAction: 'escalate',
        auditScore: 2,
      };
    case 'stay_overdue':
    case 'manager_review':
    default:
      return {
        status: 'overdue',
        sourceType: task.sourceType,
        assignedStaffId: task.assignedStaffId,
        shiftRunId: task.shiftRunId,
        scheduledForAt: task.scheduledForAt,
        exceptionReason: 'Task is overdue and awaiting manager review.',
        auditStatus: 'needs_followup',
        managerAction: 'monitor',
        auditScore: 2,
      };
  }
}

function hasSameAutomationState(task, outcome) {
  const latestAudit = task.audits?.[0] ?? null;
  return (
    task.status === outcome.status &&
    task.sourceType === outcome.sourceType &&
    (task.exceptionReason ?? '') === outcome.exceptionReason &&
    (task.execution?.exceptionReason ?? '') === outcome.exceptionReason &&
    latestAudit?.managerAction === outcome.managerAction &&
    latestAudit?.auditStatus === outcome.auditStatus
  );
}

export async function runRuntimeMaintenance(prisma, options = {}) {
  if (!prisma) {
    return { scanned: 0, changed: 0, skipped: 0 };
  }

  if (options.readOnly) {
    return globalForRuntimeMaintenance.__ciennaMaintenanceLastResult ?? { scanned: 0, changed: 0, skipped: 0, cached: true, notRun: true };
  }

  const now = Date.now();
  if (globalForRuntimeMaintenance.__ciennaMaintenancePromise) {
    return globalForRuntimeMaintenance.__ciennaMaintenancePromise;
  }
  if (!options.force && globalForRuntimeMaintenance.__ciennaMaintenanceLastRunAt && now - globalForRuntimeMaintenance.__ciennaMaintenanceLastRunAt < MAINTENANCE_INTERVAL_MS) {
    return globalForRuntimeMaintenance.__ciennaMaintenanceLastResult ?? { scanned: 0, changed: 0, skipped: 0, cached: true };
  }

  const task = (async () => {
    const generationResult = await prisma.$transaction(async (tx) => ensureUpcomingTaskInstances(tx), {
      timeout: 20000,
    });

    const startOfToday = startOfDay(now);
    const candidates = await prisma.taskInstance.findMany({
      where: {
        status: { in: ['scheduled', 'unscheduled', 'due', 'in_progress'] },
        OR: [
          { dueAt: { lt: new Date(now) } },
          { scheduledForAt: { lt: new Date(now) } },
          { plannedRunDate: { lte: startOfToday } },
          { shiftRun: { is: { runDate: { lte: startOfToday } } } },
        ],
      },
      include: {
        taskTemplate: true,
        execution: true,
        shiftRun: {
          select: {
            runDate: true,
          },
        },
        audits: {
          orderBy: { auditedAt: 'desc' },
          take: 1,
        },
      },
      take: 100,
      orderBy: { dueAt: 'asc' },
    });

    let changed = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      if (candidate.execution?.completionStatus === 'completed') {
        skipped += 1;
        continue;
      }

      const effectiveDueAt = getTaskInstanceEffectiveDueAt(candidate);
      if (!isTaskInstancePastEffectiveDue(candidate, now)) {
        skipped += 1;
        continue;
      }

      const outcome = getAutomationOutcome(candidate);
      if (hasSameAutomationState(candidate, outcome)) {
        skipped += 1;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.taskInstance.update({
          where: { id: candidate.id },
          data: {
            status: outcome.status,
            sourceType: outcome.sourceType,
            assignedStaffId: outcome.assignedStaffId,
            shiftRunId: outcome.shiftRunId,
            scheduledForAt: outcome.scheduledForAt,
            exceptionReason: outcome.exceptionReason,
          },
        });

        await tx.taskExecution.upsert({
          where: { taskInstanceId: candidate.id },
          update: {
            issueRaised: outcome.status !== 'skipped',
            exceptionReason: outcome.exceptionReason,
            completionStatus: outcome.status === 'skipped' ? 'skipped' : 'partial',
            completionComment: `${candidate.execution?.completionComment ?? ''}\n[system] ${outcome.exceptionReason}`.trim(),
          },
          create: {
            taskInstanceId: candidate.id,
            startedAt: candidate.scheduledForAt ?? effectiveDueAt ?? candidate.dueAt,
            completionStatus: outcome.status === 'skipped' ? 'skipped' : 'partial',
            completionComment: `[system] ${outcome.exceptionReason}`,
            exceptionReason: outcome.exceptionReason,
            issueRaised: outcome.status !== 'skipped',
          },
        });

        await tx.taskAudit.create({
          data: {
            taskInstanceId: candidate.id,
            auditScore: outcome.auditScore,
            auditStatus: outcome.auditStatus,
            auditComment: outcome.exceptionReason,
            reworkRequired: outcome.status === 'carried_forward',
            reworkReason: outcome.status === 'carried_forward' ? outcome.exceptionReason : null,
            managerAction: outcome.managerAction,
            auditedAt: new Date(),
          },
        });
      }, { timeout: 20000 });

      await recordNotification('maintenance', candidate.id, {
        title: candidate.titleSnapshot,
        tone: outcome.status === 'carried_forward' ? 'amber' : outcome.status === 'overdue' ? 'red' : 'blue',
        note: outcome.exceptionReason,
      });

      changed += 1;
    }

    const result = { scanned: candidates.length, changed, skipped, generated: generationResult.created };
    globalForRuntimeMaintenance.__ciennaMaintenanceLastRunAt = Date.now();
    globalForRuntimeMaintenance.__ciennaMaintenanceLastResult = result;
    return result;
  })();

  globalForRuntimeMaintenance.__ciennaMaintenancePromise = task;

  try {
    return await task;
  } finally {
    globalForRuntimeMaintenance.__ciennaMaintenancePromise = null;
  }
}
