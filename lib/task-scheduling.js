import {
  getTaskInstanceBoardDate as getTaskInstanceBoardDateFromEffectiveDay,
  getTaskInstanceEffectiveDueAt as getTaskInstanceEffectiveDueAtFromEffectiveDay,
} from './task-effective-day.mjs';

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

function applyDateParts(baseDate, datePartsSource) {
  const next = new Date(baseDate);
  const source = new Date(datePartsSource);
  next.setFullYear(source.getFullYear(), source.getMonth(), source.getDate());
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

export function getRecurrenceBasis(taskTemplate) {
  const configuredMode = String(
    taskTemplate?.recurrenceRule?.recurrenceBasis
      ?? taskTemplate?.recurrenceRule?.cadenceMode
      ?? 'anchored',
  ).toLowerCase();

  if (configuredMode === 'suggested' || configuredMode === 'rolling') {
    return 'suggested';
  }

  return 'anchored';
}

export function getCadenceDisplayLabel(taskTemplate) {
  return getRecurrenceBasis(taskTemplate) === 'suggested' ? 'Suggested' : 'Anchored';
}

function getDesignatedWeekday(taskTemplate) {
  const configured = String(taskTemplate?.recurrenceRule?.designatedDay ?? taskTemplate?.targetDays?.[0] ?? 'mon').toLowerCase();
  return Number.isInteger(WEEKDAY_INDEX[configured]) ? WEEKDAY_INDEX[configured] : 1;
}

function getNextAnchoredWeeklyDueAt(referenceAt, taskTemplate) {
  const base = startOfDay(referenceAt);
  const designatedWeekday = getDesignatedWeekday(taskTemplate);
  const next = addDays(base, 1);
  const currentWeekday = next.getDay();
  const offset = (designatedWeekday - currentWeekday + 7) % 7;
  return setPreferredTime(addDays(next, offset), taskTemplate?.preferredTimeWindow);
}

export function alignAnchoredWeeklyDueAt(referenceAt, taskTemplate) {
  if (!referenceAt) {
    return null;
  }

  const base = startOfDay(referenceAt);
  const designatedWeekday = getDesignatedWeekday(taskTemplate);
  let bestOffset = null;

  for (let offset = -6; offset <= 6; offset += 1) {
    const candidate = addDays(base, offset);
    if (candidate.getDay() !== designatedWeekday) {
      continue;
    }

    if (bestOffset === null || Math.abs(offset) < Math.abs(bestOffset) || (Math.abs(offset) === Math.abs(bestOffset) && offset > bestOffset)) {
      bestOffset = offset;
    }
  }

  return setPreferredTime(addDays(base, bestOffset ?? 0), taskTemplate?.preferredTimeWindow);
}

export function calculateNextDueAt(taskTemplate, referenceAt = new Date()) {
  const anchor = new Date(referenceAt);
  const recurrenceType = taskTemplate?.recurrenceType ?? 'none';
  const recurrenceBasis = getRecurrenceBasis(taskTemplate);

  if (recurrenceType === 'daily') {
    return setPreferredTime(addDays(startOfDay(anchor), 1), taskTemplate?.preferredTimeWindow);
  }

  if (recurrenceType === 'weekly') {
    if (recurrenceBasis === 'suggested') {
      return setPreferredTime(addDays(startOfDay(anchor), 7), taskTemplate?.preferredTimeWindow);
    }

    return getNextAnchoredWeeklyDueAt(anchor, taskTemplate);
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

  return 'scheduled';
}

export function getTaskInstanceBoardDate(taskInstance) {
  return getTaskInstanceBoardDateFromEffectiveDay(taskInstance);
}

export function getTaskInstanceEffectiveDueAt(taskInstance) {
  return getTaskInstanceEffectiveDueAtFromEffectiveDay(taskInstance);
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
  const date = new Date(dueAt);
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const time = `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return `${templateCode}-D${stamp}-T${time}`;
}

function isSameMinute(left, right) {
  if (!left || !right) {
    return false;
  }

  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 60 * 1000;
}

function formatIssue(taskTemplate, taskInstance, code, detail, expectedDueAt = null) {
  return {
    code,
    detail,
    templateId: taskTemplate.id,
    templateCode: taskTemplate.taskTemplateCode,
    templateTitle: taskTemplate.title,
    instanceId: taskInstance.id,
    instanceCode: taskInstance.instanceCode,
    dueAt: taskInstance.dueAt,
    expectedDueAt,
  };
}

export function validateTaskInstanceSequence(taskInstances = []) {
  const grouped = new Map();

  taskInstances.forEach((taskInstance) => {
    if (!taskInstance?.taskTemplateId || !taskInstance?.taskTemplate || !taskInstance?.dueAt) {
      return;
    }

    const existing = grouped.get(taskInstance.taskTemplateId) ?? [];
    existing.push(taskInstance);
    grouped.set(taskInstance.taskTemplateId, existing);
  });

  const issues = [];

  grouped.forEach((instances) => {
    const ordered = [...instances].sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt));

    ordered.forEach((taskInstance, index) => {
      const taskTemplate = taskInstance.taskTemplate;
      const recurrenceType = taskTemplate?.recurrenceType ?? 'none';
      const recurrenceBasis = getRecurrenceBasis(taskTemplate);
      const previousInstance = index > 0 ? ordered[index - 1] : null;

      if (previousInstance && isSameMinute(previousInstance.dueAt, taskInstance.dueAt)) {
        issues.push(
          formatIssue(
            taskTemplate,
            taskInstance,
            'duplicate_due_at',
            'Multiple task instances for this template share the same due time.',
            previousInstance.dueAt,
          ),
        );
      }

      if (recurrenceType === 'weekly' && recurrenceBasis === 'anchored') {
        const expectedWeekday = getDesignatedWeekday(taskTemplate);
        if (new Date(taskInstance.dueAt).getDay() !== expectedWeekday) {
          issues.push(
            formatIssue(
              taskTemplate,
              taskInstance,
              'anchored_weekday_mismatch',
              'Anchored weekly task is scheduled on the wrong weekday.',
            ),
          );
        }
      }

      if (!previousInstance || !['daily', 'weekly', 'monthly'].includes(recurrenceType)) {
        return;
      }

      const expectedDueAt = calculateNextDueAt(taskTemplate, previousInstance.dueAt);
      if (expectedDueAt && !isSameMinute(taskInstance.dueAt, expectedDueAt)) {
        issues.push(
          formatIssue(
            taskTemplate,
            taskInstance,
            'recurrence_gap_mismatch',
            `Task instance does not align with the expected ${recurrenceType} recurrence gap.`,
            expectedDueAt,
          ),
        );
      }
    });
  });

  return {
    issues,
    templatesAffected: new Set(issues.map((issue) => issue.templateId)).size,
    instancesAffected: new Set(issues.map((issue) => issue.instanceId)).size,
  };
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
          plannedRunDate: true,
          scheduledForAt: true,
          shiftRun: {
            select: {
              runDate: true,
            },
          },
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
  const openInstances = taskTemplate.taskInstances.filter((instance) => openStatuses.has(instance.status));
  const latestOpenDueAt = openInstances
    .map((instance) => instance.dueAt)
    .sort((a, b) => new Date(a) - new Date(b))[0] ?? null;
  const nextOperationalDueAt = openInstances
    .map((instance) => getTaskInstanceEffectiveDueAt(instance))
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b))[0] ?? null;

  const nextDueAt = overrides.nextDueAt ?? latestOpenDueAt ?? taskTemplate.status?.nextDueAt ?? null;
  const effectiveNextDueAt = nextOperationalDueAt ?? nextDueAt;
  const overdueSinceAt = overrides.overdueSinceAt ?? (effectiveNextDueAt && new Date(effectiveNextDueAt) < new Date() && openInstanceCount > 0 ? effectiveNextDueAt : null);
  const lastCompletedAt = overrides.lastCompletedAt ?? taskTemplate.status?.lastCompletedAt ?? null;
  const lastCompletedInstanceId = overrides.lastCompletedInstanceId ?? taskTemplate.status?.lastCompletedInstanceId ?? null;
  const nextPlanningDueAt = overrides.nextPlanningDueAt ?? calculatePlanningDueAt(nextDueAt);
  const statusBucket = getTemplateStatusBucket({ nextDueAt: effectiveNextDueAt, overdueSinceAt, unscheduledInstanceCount, lastCompletedAt });

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

  const recurrenceBasis = getRecurrenceBasis(taskInstance.taskTemplate);
  const shouldAnchorFromDueAt = taskInstance.taskTemplate?.recurrenceType === 'weekly' && recurrenceBasis === 'anchored';
  const nextDueAt = calculateNextDueAt(
    taskInstance.taskTemplate,
    shouldAnchorFromDueAt ? taskInstance.dueAt : completedAt,
  );

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
  const configuredHorizonDays = Number.parseInt(process.env.TASK_INSTANCE_HORIZON_DAYS ?? '', 10);
  const horizonDays = Number.isInteger(options.horizonDays)
    ? options.horizonDays
    : (Number.isInteger(configuredHorizonDays) ? configuredHorizonDays : 42);
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

  return { created, horizonDays };
}
