const globalForRuntimeMaintenance = globalThis;
const MAINTENANCE_INTERVAL_MS = 30 * 1000;

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

export async function runRuntimeMaintenance(prisma) {
  if (!prisma) {
    return;
  }

  const now = Date.now();
  if (globalForRuntimeMaintenance.__ciennaMaintenancePromise) {
    return globalForRuntimeMaintenance.__ciennaMaintenancePromise;
  }
  if (globalForRuntimeMaintenance.__ciennaMaintenanceLastRunAt && now - globalForRuntimeMaintenance.__ciennaMaintenanceLastRunAt < MAINTENANCE_INTERVAL_MS) {
    return;
  }

  const task = (async () => {
    const candidates = await prisma.taskInstance.findMany({
      where: {
        dueAt: { lt: new Date() },
        status: { in: ['scheduled', 'unscheduled', 'due', 'in_progress'] },
      },
      include: {
        taskTemplate: true,
        execution: true,
      },
      take: 100,
      orderBy: { dueAt: 'asc' },
    });

    for (const candidate of candidates) {
      if (candidate.execution?.completionStatus === 'completed') {
        continue;
      }

      const outcome = getAutomationOutcome(candidate);
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
            startedAt: candidate.scheduledForAt ?? candidate.dueAt,
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
    }

    globalForRuntimeMaintenance.__ciennaMaintenanceLastRunAt = Date.now();
  })();

  globalForRuntimeMaintenance.__ciennaMaintenancePromise = task;

  try {
    await task;
  } finally {
    globalForRuntimeMaintenance.__ciennaMaintenancePromise = null;
  }
}
