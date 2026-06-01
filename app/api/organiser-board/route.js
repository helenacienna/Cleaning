import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

const boardDayFormatter = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'Australia/Brisbane',
});

function formatBoardDay(value) {
  return boardDayFormatter.format(new Date(value)).replace(',', '');
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function getNextStatus(currentStatus, hasShiftRun) {
  if (['completed', 'in_progress', 'cancelled', 'skipped', 'carried_forward'].includes(currentStatus)) {
    return currentStatus;
  }

  return hasShiftRun ? 'scheduled' : 'unscheduled';
}

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const cards = Array.isArray(body?.cards) ? body.cards : null;
  const shiftState = body?.shiftState === 'published' ? 'published' : 'draft';

  if (!cards?.length) {
    return NextResponse.json({ error: 'No board cards supplied' }, { status: 400 });
  }

  const instanceIds = [...new Set(cards.map((card) => card?.id).filter(Boolean))];

  const [instances, staffMembers, shiftRuns, facilities, zones, taskGroups] = await Promise.all([
    prisma.taskInstance.findMany({
      where: { id: { in: instanceIds } },
      select: { id: true, status: true },
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
      .map((shiftRun) => [`${shiftRun.assignedStaff.fullName}::${formatBoardDay(shiftRun.runDate)}`, shiftRun]),
  );
  const facilityMap = new Map(facilities.map((facility) => [facility.name, facility]));
  const zoneMap = new Map(zones.map((zone) => [`${zone.facilityId}::${zone.name}`, zone]));
  const taskGroupMap = new Map(taskGroups.map((taskGroup) => [`${taskGroup.zoneId}::${taskGroup.name}`, taskGroup]));

  const updates = cards
    .filter((card) => instanceMap.has(card.id))
    .map((card, index) => {
      const current = instanceMap.get(card.id);
      const assignedStaff = card.staff && card.staff !== 'Unallocated' ? staffMap.get(card.staff) : null;
      const shiftRun = assignedStaff ? shiftRunMap.get(`${assignedStaff.fullName}::${card.day}`) : null;
      const laneIndex = Number.isInteger(card.laneIndex) ? card.laneIndex : 0;
      const plannedFacility = card.facility ? facilityMap.get(card.facility) : null;
      const plannedZone = plannedFacility && card.zone ? zoneMap.get(`${plannedFacility.id}::${card.zone}`) : null;
      const plannedTaskGroup = plannedZone && card.taskGroup ? taskGroupMap.get(`${plannedZone.id}::${card.taskGroup}`) : null;

      return prisma.taskInstance.update({
        where: { id: card.id },
        data: {
          assignedStaffId: assignedStaff?.id ?? null,
          shiftRunId: shiftRun?.id ?? null,
          plannedFacilityId: plannedFacility?.id ?? null,
          plannedZoneId: plannedZone?.id ?? null,
          plannedTaskGroupId: plannedTaskGroup?.id ?? null,
          sequence: Number.isFinite(card.jobOrder) ? Number(card.jobOrder) : index + 1,
          scheduledForAt: shiftRun?.shiftStartAt ? addMinutes(new Date(shiftRun.shiftStartAt), laneIndex * 60) : null,
          status: getNextStatus(current.status, Boolean(shiftRun)),
        },
      });
    });

  const shiftRunIds = shiftRuns.map((shiftRun) => shiftRun.id);
  const chunkSize = 25;

  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    await prisma.$transaction(chunk, {
      timeout: 20000,
    });
  }

  await prisma.shiftRun.updateMany({
    where: { id: { in: shiftRunIds } },
    data: { organiserState: shiftState },
  });

  return NextResponse.json({ ok: true, message: 'Live organiser board saved' });
}
