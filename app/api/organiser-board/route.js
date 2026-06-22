import { NextResponse } from 'next/server';
import { getOrganiserBoardData } from '../../../lib/app-data';
import { getManagerOverviewData } from '../../../lib/manager-data';
import { getPrisma } from '../../../lib/prisma';
import { alignAnchoredWeeklyDueAt, calculatePlanningDueAt, getRecurrenceBasis, refreshTemplateStatus } from '../../../lib/task-scheduling';
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

function isStaleCardUpdate(card, current) {
  if (!card?.updatedAt || !current?.updatedAt) {
    return false;
  }

  const cardUpdatedAt = new Date(card.updatedAt).getTime();
  const currentUpdatedAt = new Date(current.updatedAt).getTime();

  if (!Number.isFinite(cardUpdatedAt) || !Number.isFinite(currentUpdatedAt)) {
    return false;
  }

  return cardUpdatedAt < currentUpdatedAt;
}

function isAssignmentChangeWithoutVersion(card, current, nextAssignedStaffId, nextShiftRunId) {
  return !card?.updatedAt && (
    (current?.assignedStaffId ?? null) !== (nextAssignedStaffId ?? null)
    || (current?.shiftRunId ?? null) !== (nextShiftRunId ?? null)
  );
}

export async function GET() {
  const [{ board, source }, managerOverview] = await Promise.all([
    getOrganiserBoardData(),
    getManagerOverviewData(),
  ]);

  const summary = {
    totalTasks: managerOverview.totalTasks,
    completedTasks: managerOverview.completedTasks,
    completionRate: managerOverview.completionRate,
  };

  return NextResponse.json({ board, source, summary });
}

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  let cards = Array.isArray(body?.cards) ? body.cards : null;
  const shiftState = body?.shiftState === 'published'
    ? 'published'
    : body?.shiftState === 'draft'
      ? 'draft'
      : null;

  if (!cards?.length && body?.action === 'assignGroup' && Array.isArray(body?.cardIds) && body.cardIds.length) {
    console.warn(JSON.stringify({
      scope: 'organiser-board-assign-group-retired',
      requestedIds: [...new Set(body.cardIds.filter(Boolean))],
      requestedStaff: body?.staff ?? null,
    }));
    return NextResponse.json({
      ok: false,
      error: 'This assignment path has been retired. Refresh the dashboard and try again.',
      retired: true,
    }, { status: 410 });
  }

  if (!cards?.length) {
    return NextResponse.json({ error: 'No board cards supplied' }, { status: 400 });
  }

  console.log(JSON.stringify({
    scope: 'organiser-board-request',
    action: body?.action ?? null,
    cardsCount: Array.isArray(cards) ? cards.length : 0,
    cardIdsCount: Array.isArray(body?.cardIds) ? body.cardIds.length : 0,
    shiftState,
  }));

  const instanceIds = [...new Set(cards.map((card) => card?.id).filter(Boolean))];

  const [instances, staffMembers, shiftRuns, facilities, zones, taskGroups] = await Promise.all([
    prisma.taskInstance.findMany({
      where: { id: { in: instanceIds } },
      select: {
        id: true,
        status: true,
        dueAt: true,
        updatedAt: true,
        assignedStaffId: true,
        shiftRunId: true,
        taskTemplateId: true,
        taskTemplate: {
          select: {
            recurrenceType: true,
            recurrenceRule: true,
          },
        },
      },
    }),
    prisma.staff.findMany({
      where: { active: true },
      select: { id: true, fullName: true },
    }),
    prisma.shiftRun.findMany({
      include: { assignedStaff: true },
    }),
    prisma.facility.findMany({
      select: { id: true, name: true },
    }),
    prisma.zone.findMany({
      select: { id: true, name: true, facilityId: true },
    }),
    prisma.taskGroup.findMany({
      select: { id: true, name: true, zoneId: true, facilityId: true },
    }),
  ]);

  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
  const staffMap = new Map(staffMembers.map((staff) => [staff.fullName, staff]));
  const shiftRunMap = new Map(
    shiftRuns
      .filter((shiftRun) => shiftRun.assignedStaff)
      .map((shiftRun) => [`${shiftRun.assignedStaff.fullName}::${formatBoardDayKey(shiftRun.runDate)}`, shiftRun]),
  );
  const facilityMap = new Map(facilities.map((facility) => [facility.name, facility]));
  const zoneMap = new Map(zones.map((zone) => [`${zone.facilityId}::${zone.name}`, zone]));
  const taskGroupMap = new Map(taskGroups.map((taskGroup) => [`${taskGroup.zoneId}::${taskGroup.name}`, taskGroup]));

  const staleCardIds = [];
  const missingVersionCardIds = [];

  const updates = cards
    .filter((card) => instanceMap.has(card.id))
    .map((card, index) => {
      const current = instanceMap.get(card.id);
      if (isStaleCardUpdate(card, current)) {
        staleCardIds.push(card.id);
        return null;
      }
      const assignedStaff = card.staff && card.staff !== 'Unallocated' ? staffMap.get(card.staff) : null;
      const laneIndex = Number.isInteger(card.laneIndex) ? card.laneIndex : 0;
      const recurrenceBasis = getRecurrenceBasis(current.taskTemplate);
      const isAnchoredWeekly = current.taskTemplate?.recurrenceType === 'weekly' && recurrenceBasis === 'anchored';
      const anchoredDueAt = isAnchoredWeekly
        ? (alignAnchoredWeeklyDueAt(current.dueAt, current.taskTemplate) ?? current.dueAt)
        : current.dueAt;
      const anchorBoardDay = formatBoardDayKey(anchoredDueAt);
      const actualBoardDay = card.day ?? anchorBoardDay;
      const effectiveShiftRun = assignedStaff ? shiftRunMap.get(`${assignedStaff.fullName}::${actualBoardDay}`) : null;
      const { dueAt, plannedRunDate, scheduledForAt } = deriveOrganiserSchedule({
        currentDueAt: current.dueAt,
        anchoredDueAt,
        recurrenceBasis,
        recurrenceType: current.taskTemplate?.recurrenceType,
        actualBoardDay,
        shiftStartAt: effectiveShiftRun?.shiftStartAt ?? null,
        laneIndex,
      });
      const plannedFacility = card.facility ? facilityMap.get(card.facility) : null;
      const plannedZone = plannedFacility && card.zone ? zoneMap.get(`${plannedFacility.id}::${card.zone}`) : null;
      const plannedTaskGroup = plannedZone && card.taskGroup ? taskGroupMap.get(`${plannedZone.id}::${card.taskGroup}`) : null;

      if (isAssignmentChangeWithoutVersion(card, current, assignedStaff?.id ?? null, effectiveShiftRun?.id ?? null)) {
        missingVersionCardIds.push(card.id);
        console.warn(JSON.stringify({
          scope: 'organiser-board-missing-version-skip',
          taskInstanceId: card.id,
          instanceCode: card.instanceCode ?? null,
          fromStaffId: current.assignedStaffId ?? null,
          toStaffId: assignedStaff?.id ?? null,
          fromShiftRunId: current.shiftRunId ?? null,
          toShiftRunId: effectiveShiftRun?.id ?? null,
          day: actualBoardDay,
          facility: card.facility ?? null,
          zone: card.zone ?? null,
          taskGroup: card.taskGroup ?? null,
        }));
        return null;
      }

      if (
        (current.assignedStaffId ?? null) !== (assignedStaff?.id ?? null)
        || (current.shiftRunId ?? null) !== (effectiveShiftRun?.id ?? null)
      ) {
        console.log(JSON.stringify({
          scope: 'organiser-board-assignment-change',
          taskInstanceId: card.id,
          instanceCode: card.instanceCode ?? null,
          fromStaffId: current.assignedStaffId ?? null,
          toStaffId: assignedStaff?.id ?? null,
          toStaffName: assignedStaff?.fullName ?? null,
          fromShiftRunId: current.shiftRunId ?? null,
          toShiftRunId: effectiveShiftRun?.id ?? null,
          day: actualBoardDay,
          facility: card.facility ?? null,
          zone: card.zone ?? null,
          taskGroup: card.taskGroup ?? null,
          staleGuardCardUpdatedAt: card.updatedAt ?? null,
          rowUpdatedAt: current.updatedAt ?? null,
        }));
      }

      return prisma.taskInstance.update({
        where: { id: card.id },
        data: {
          assignedStaffId: assignedStaff?.id ?? null,
          shiftRunId: effectiveShiftRun?.id ?? null,
          plannedRunDate,
          plannedFacilityId: plannedFacility?.id ?? null,
          plannedZoneId: plannedZone?.id ?? null,
          plannedTaskGroupId: plannedTaskGroup?.id ?? null,
          sequence: Number.isFinite(card.jobOrder) ? Number(card.jobOrder) : index + 1,
          scheduledForAt,
          dueAt,
          planningDueAt: calculatePlanningDueAt(dueAt),
          status: getNextStatus(current.status, Boolean(effectiveShiftRun)),
        },
      });
    })
    .filter(Boolean);

  const shiftRunIds = shiftRuns.map((shiftRun) => shiftRun.id);
  const chunkSize = 25;

  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    await prisma.$transaction(chunk, {
      timeout: 20000,
    });
  }

  const taskTemplateIds = [...new Set(
    cards
      .map((card) => instanceMap.get(card.id)?.taskTemplateId)
      .filter(Boolean),
  )];

  for (const taskTemplateId of taskTemplateIds) {
    await prisma.$transaction(async (tx) => {
      await refreshTemplateStatus(tx, taskTemplateId);
    }, {
      timeout: 20000,
    });
  }

  if (shiftState) {
    await prisma.shiftRun.updateMany({
      where: { id: { in: shiftRunIds } },
      data: { organiserState: shiftState },
    });
  }

  return NextResponse.json({
    ok: true,
    message: (staleCardIds.length || missingVersionCardIds.length)
      ? `Live organiser board saved (${staleCardIds.length} stale card updates ignored, ${missingVersionCardIds.length} unversioned assignment updates ignored)`
      : 'Live organiser board saved',
    staleCardIds,
    missingVersionCardIds,
  });
}
