import { NextResponse } from 'next/server';
import { getOrganiserBoardData } from '../../../lib/app-data';
import { buildDashboardHealth } from '../../../lib/dashboard-health';
import { getPrisma } from '../../../lib/prisma';
import { alignAnchoredWeeklyDueAt, calculatePlanningDueAt, getRecurrenceBasis } from '../../../lib/task-scheduling';
import { deriveOrganiserSchedule, formatBoardDayKey, getTaskInstanceBoardDate } from '../../../lib/task-effective-day.mjs';

function getNextStatus(currentStatus, hasShiftRun) {
  if (['completed', 'in_progress', 'cancelled', 'skipped'].includes(currentStatus)) {
    return currentStatus;
  }

  if (hasShiftRun) {
    return 'scheduled';
  }

  if (['carried_forward', 'overdue'].includes(currentStatus)) {
    return currentStatus;
  }

  return 'unscheduled';
}

function parseBoardDayStart(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseBoardDayEnd(value) {
  return new Date(`${value}T23:59:59.999Z`);
}

export async function GET() {
  const { board, source, timeZone } = await getOrganiserBoardData({
    includeMaintenance: false,
    includeInboxSummary: false,
  });

  const health = buildDashboardHealth({ board, source, timeZone });

  return NextResponse.json({ board, source, timeZone, health });
}

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);

  if (!(body?.action === 'assignGroup' && Array.isArray(body?.cardIds) && body.cardIds.length)) {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const targetIds = [...new Set(body.cardIds.filter(Boolean))];
  const expectedUpdatedAtById = body?.expectedUpdatedAtById && typeof body.expectedUpdatedAtById === 'object'
    ? body.expectedUpdatedAtById
    : {};
  const assignedStaff = body?.staff && body.staff !== 'Unallocated'
    ? await prisma.staff.findFirst({ where: { active: true, fullName: body.staff }, select: { id: true, fullName: true } })
    : null;
  const hasVersionPayload = targetIds.every((id) => typeof expectedUpdatedAtById?.[id] === 'string' && expectedUpdatedAtById[id]);

  if (!hasVersionPayload) {
    console.warn(JSON.stringify({
      scope: 'dashboard-board-assign-group-missing-version-reject',
      requestedIds: targetIds,
      requestedStaff: body?.staff ?? null,
    }));
    return NextResponse.json({
      ok: false,
      error: 'Refresh required before assigning staff',
      missingVersion: true,
    }, { status: 409 });
  }

  const instances = await prisma.taskInstance.findMany({
    where: { id: { in: targetIds } },
    select: {
      id: true,
      instanceCode: true,
      status: true,
      dueAt: true,
      updatedAt: true,
      assignedStaffId: true,
      shiftRunId: true,
      scheduledForAt: true,
      plannedRunDate: true,
      sequence: true,
      taskTemplateId: true,
      shiftRun: { select: { runDate: true } },
      taskTemplate: {
        select: {
          recurrenceType: true,
          recurrenceRule: true,
        },
      },
    },
  });
  const staleTargetIds = instances
    .filter((instance) => {
      const expectedUpdatedAt = expectedUpdatedAtById?.[instance.id] ?? null;
      if (!expectedUpdatedAt || !instance.updatedAt) {
        return false;
      }

      return new Date(expectedUpdatedAt).getTime() !== new Date(instance.updatedAt).getTime();
    })
    .map((instance) => instance.id);

  if (staleTargetIds.length) {
    console.warn(JSON.stringify({
      scope: 'dashboard-board-assign-group-stale-reject',
      staleTargetIds,
      requestedIds: targetIds,
      requestedStaff: body?.staff ?? null,
    }));
    return NextResponse.json({
      ok: false,
      error: 'Assignment state changed before save',
      staleTargetIds,
    }, { status: 409 });
  }

  const actualBoardDays = [...new Set(instances.map((instance) => formatBoardDayKey(getTaskInstanceBoardDate(instance))))].sort();
  const shiftRuns = assignedStaff && actualBoardDays.length
    ? await prisma.shiftRun.findMany({
        where: {
          assignedStaffId: assignedStaff.id,
          runDate: {
            gte: parseBoardDayStart(actualBoardDays[0]),
            lte: parseBoardDayEnd(actualBoardDays[actualBoardDays.length - 1]),
          },
        },
        select: {
          id: true,
          runDate: true,
          shiftStartAt: true,
        },
      })
    : [];
  const shiftRunMap = new Map(
    shiftRuns.map((shiftRun) => [formatBoardDayKey(shiftRun.runDate), shiftRun]),
  );

  const updates = instances.map((instance) => {
    const recurrenceBasis = getRecurrenceBasis(instance.taskTemplate);
    const isAnchoredWeekly = instance.taskTemplate?.recurrenceType === 'weekly' && recurrenceBasis === 'anchored';
    const anchoredDueAt = isAnchoredWeekly
      ? (alignAnchoredWeeklyDueAt(instance.dueAt, instance.taskTemplate) ?? instance.dueAt)
      : instance.dueAt;
    const actualBoardDay = formatBoardDayKey(getTaskInstanceBoardDate(instance));
    const effectiveShiftRun = assignedStaff ? shiftRunMap.get(actualBoardDay) : null;
    const laneIndex = Number.isInteger(instance.sequence) ? Math.max(0, Number(instance.sequence) - 1) : 0;
    const { dueAt, plannedRunDate, scheduledForAt } = deriveOrganiserSchedule({
      currentDueAt: instance.dueAt,
      anchoredDueAt,
      recurrenceBasis,
      recurrenceType: instance.taskTemplate?.recurrenceType,
      actualBoardDay,
      shiftStartAt: effectiveShiftRun?.shiftStartAt ?? null,
      laneIndex,
    });

    return prisma.taskInstance.update({
      where: { id: instance.id },
      data: {
        assignedStaffId: assignedStaff?.id ?? null,
        shiftRunId: effectiveShiftRun?.id ?? null,
        plannedRunDate,
        scheduledForAt,
        dueAt,
        planningDueAt: calculatePlanningDueAt(dueAt),
        status: getNextStatus(instance.status, Boolean(effectiveShiftRun)),
      },
      select: {
        id: true,
        updatedAt: true,
        status: true,
      },
    });
  });

  const updatedRows = [];
  for (let index = 0; index < updates.length; index += 25) {
    const batchResults = await prisma.$transaction(updates.slice(index, index + 25), { timeout: 20000 });
    updatedRows.push(...batchResults);
  }

  console.log(JSON.stringify({
    scope: 'dashboard-board-assign-group-direct',
    updatedCount: updatedRows.length,
    requestedIds: targetIds,
    toStaffId: assignedStaff?.id ?? null,
    toStaffName: assignedStaff?.fullName ?? null,
    boardDays: actualBoardDays,
  }));

  return NextResponse.json({
    ok: true,
    message: 'Staff assignment updated',
    updatedIds: targetIds,
    updatedCards: updatedRows.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt,
      status: row.status,
      staff: assignedStaff?.fullName ?? 'Unallocated',
    })),
  });
}
