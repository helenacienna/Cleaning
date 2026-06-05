const WEEKDAY_INDEX = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function setPreferredTime(date, preferredTimeWindow) {
  const next = new Date(date);

  if (preferredTimeWindow === 'morning') {
    next.setHours(9, 0, 0, 0);
    return next;
  }

  if (preferredTimeWindow === 'afternoon') {
    next.setHours(13, 0, 0, 0);
    return next;
  }

  next.setHours(9, 0, 0, 0);
  return next;
}

function getTargetWeekdays(targetDays) {
  if (!Array.isArray(targetDays) || !targetDays.length) {
    return [1, 2, 3, 4, 5];
  }

  return targetDays
    .map((day) => WEEKDAY_INDEX[String(day).toLowerCase()])
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b);
}

export function calculateNextDueAt(taskTemplate, completedAt = new Date()) {
  const anchor = new Date(completedAt);
  const recurrenceType = taskTemplate?.recurrenceType ?? 'none';

  if (recurrenceType === 'daily') {
    return setPreferredTime(addDays(startOfDay(anchor), 1), taskTemplate?.preferredTimeWindow);
  }

  if (recurrenceType === 'weekly') {
    const targetWeekdays = getTargetWeekdays(taskTemplate?.targetDays);
    const anchorDay = anchor.getDay();

    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = addDays(startOfDay(anchor), offset);
      if (targetWeekdays.includes(candidate.getDay()) && (candidate.getDay() !== anchorDay || offset > 0)) {
        return setPreferredTime(candidate, taskTemplate?.preferredTimeWindow);
      }
    }

    return setPreferredTime(addDays(startOfDay(anchor), 7), taskTemplate?.preferredTimeWindow);
  }

  if (recurrenceType === 'monthly') {
    return setPreferredTime(addMonths(startOfDay(anchor), 1), taskTemplate?.preferredTimeWindow);
  }

  return null;
}

export function calculatePlanningDueAt(nextDueAt) {
  if (!nextDueAt) {
    return null;
  }

  return addDays(new Date(nextDueAt), -1);
}

export function getTaskInstanceStatusForDueDate(dueAt, now = new Date()) {
  const dueTime = new Date(dueAt).getTime();
  const nowTime = new Date(now).getTime();

  if (dueTime <= nowTime) {
    return 'due';
  }

  return 'upcoming';
}

export function getTemplateStatusBucket({ nextDueAt, overdueSinceAt, unscheduledInstanceCount, lastCompletedAt }, now = new Date()) {
  if (overdueSinceAt) {
    return 'overdue';
  }

  if (unscheduledInstanceCount > 0) {
    return 'unscheduled';
  }

  if (nextDueAt && new Date(nextDueAt).getTime() <= new Date(now).getTime()) {
    return 'due';
  }

  if (lastCompletedAt && new Date(now).getTime() - new Date(lastCompletedAt).getTime() < 2 * 24 * 60 * 60 * 1000) {
    return 'completed_recently';
  }

  return 'upcoming';
}

function buildInstanceCode(templateCode, dueAt) {
  const stamp = new Date(dueAt).toISOString().slice(0, 10).replace(/-/g, '');
  return `${templateCode}-${stamp}-AUTO`;
}

export async function ensureFutureTaskInstance(tx, taskTemplate, dueAt) {
  if (!taskTemplate?.autoGenerateInstances || !dueAt) {
    return null;
  }

  const existing = await tx.taskInstance.findFirst({
    where: {
      taskTemplateId: taskTemplate.id,
      dueAt: dueAt,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return tx.taskInstance.create({
    data: {
      instanceCode: buildInstanceCode(taskTemplate.taskTemplateCode, dueAt),
      taskTemplateId: taskTemplate.id,
      facilityId: taskTemplate.facilityId,
      zoneId: taskTemplate.zoneId,
      taskGroupId: taskTemplate.taskGroupId,
      plannedFacilityId: taskTemplate.facilityId,
      plannedZoneId: taskTemplate.zoneId,
      plannedTaskGroupId: taskTemplate.taskGroupId,
      titleSnapshot: taskTemplate.title,
      descriptionSnapshot: taskTemplate.description,
      sourceType: 'auto_generated',
      dueAt,
      planningDueAt: calculatePlanningDueAt(dueAt),
      status: getTaskInstanceStatusForDueDate(dueAt),
      priority: taskTemplate.priority,
      evidenceRequirement: taskTemplate.evidenceRequirement,
      commentRequirement: taskTemplate.commentRequirement,
      estimatedMinutes: taskTemplate.estimatedMinutes,
      manuallyCreated: false,
      isExceptionTask: false,
    },
  });
}

export async function refreshTemplateStatus(tx, taskTemplateId, overrides = {}) {
  const taskTemplate = await tx.taskTemplate.findUnique({
    where: { id: taskTemplateId },
    include: {
      status: true,
      taskInstances: {
        select: {
          id: true,
          status: true,
          dueAt: true,
        },
      },
    },
  });

  if (!taskTemplate) {
    return null;
  }

  const openStatuses = new Set(['upcoming', 'due', 'unscheduled', 'scheduled', 'in_progress', 'overdue', 'carried_forward']);
  const unscheduledStatuses = new Set(['unscheduled', 'overdue', 'carried_forward']);
  const openInstanceCount = taskTemplate.taskInstances.filter((instance) => openStatuses.has(instance.status)).length;
  const unscheduledInstanceCount = taskTemplate.taskInstances.filter((instance) => unscheduledStatuses.has(instance.status)).length;
  const latestOpenDueAt = taskTemplate.taskInstances
    .filter((instance) => openStatuses.has(instance.status))
    .map((instance) => instance.dueAt)
    .sort((a, b) => new Date(a) - new Date(b))[0] ?? null;

  const nextDueAt = overrides.nextDueAt ?? latestOpenDueAt ?? taskTemplate.status?.nextDueAt ?? null;
  const overdueSinceAt = overrides.overdueSinceAt ?? (nextDueAt && new Date(nextDueAt) < new Date() && openInstanceCount > 0 ? nextDueAt : null);
  const lastCompletedAt = overrides.lastCompletedAt ?? taskTemplate.status?.lastCompletedAt ?? null;
  const lastCompletedInstanceId = overrides.lastCompletedInstanceId ?? taskTemplate.status?.lastCompletedInstanceId ?? null;
  const nextPlanningDueAt = overrides.nextPlanningDueAt ?? calculatePlanningDueAt(nextDueAt);
  const statusBucket = getTemplateStatusBucket({ nextDueAt, overdueSinceAt, unscheduledInstanceCount, lastCompletedAt });

  return tx.taskTemplateStatus.upsert({
    where: { taskTemplateId },
    update: {
      lastCompletedAt,
      lastCompletedInstanceId,
      nextDueAt,
      nextPlanningDueAt,
      overdueSinceAt,
      openInstanceCount,
      unscheduledInstanceCount,
      statusBucket,
    },
    create: {
      taskTemplateId,
      lastCompletedAt,
      lastCompletedInstanceId,
      nextDueAt,
      nextPlanningDueAt,
      overdueSinceAt,
      openInstanceCount,
      unscheduledInstanceCount,
      statusBucket,
    },
  });
}

export async function markTaskTemplateCompleted(tx, taskInstanceId, completedAt = new Date()) {
  const taskInstance = await tx.taskInstance.findUnique({
    where: { id: taskInstanceId },
    include: {
      taskTemplate: {
        include: {
          status: true,
        },
      },
    },
  });

  if (!taskInstance?.taskTemplateId || !taskInstance.taskTemplate) {
    return null;
  }

  const nextDueAt = calculateNextDueAt(taskInstance.taskTemplate, completedAt);

  await ensureFutureTaskInstance(tx, taskInstance.taskTemplate, nextDueAt);

  return refreshTemplateStatus(tx, taskInstance.taskTemplateId, {
    lastCompletedAt: completedAt,
    lastCompletedInstanceId: taskInstanceId,
    nextDueAt,
    nextPlanningDueAt: calculatePlanningDueAt(nextDueAt),
    overdueSinceAt: null,
  });
}

export async function ensureUpcomingTaskInstances(tx, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const horizonDays = Number.isInteger(options.horizonDays) ? options.horizonDays : 14;
  const horizon = addDays(now, horizonDays);

  const templates = await tx.taskTemplate.findMany({
    where: {
      active: true,
      autoGenerateInstances: true,
    },
    include: {
      status: true,
    },
  });

  let created = 0;

  for (const template of templates) {
    const currentNextDueAt = template.status?.nextDueAt ?? null;
    if (!currentNextDueAt) {
      continue;
    }

    let cursor = new Date(currentNextDueAt);
    let guard = 0;

    while (cursor <= horizon && guard < 60) {
      const existing = await tx.taskInstance.findFirst({
        where: {
          taskTemplateId: template.id,
          dueAt: cursor,
        },
        select: { id: true },
      });

      if (!existing) {
        await ensureFutureTaskInstance(tx, template, cursor);
        created += 1;
      }

      const nextCursor = calculateNextDueAt(template, cursor);
      if (!nextCursor || nextCursor.getTime() === cursor.getTime()) {
        break;
      }

      cursor = nextCursor;
      guard += 1;
    }

    await refreshTemplateStatus(tx, template.id);
  }

  return { created };
}
