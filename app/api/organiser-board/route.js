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

  const [instances, staffMembers, shiftRuns] = await Promise.all([
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
  ]);

  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
  const staffMap = new Map(staffMembers.map((staff) => [staff.fullName, staff]));
  const shiftRunMap = new Map(
    shiftRuns
      .filter((shiftRun) => shiftRun.assignedStaff)
      .map((shiftRun) => [`${shiftRun.assignedStaff.fullName}::${formatBoardDay(shiftRun.runDate)}`, shiftRun]),
  );

  const updates = cards
    .filter((card) => instanceMap.has(card.id))
    .map((card, index) => {
      const current = instanceMap.get(card.id);
      const assignedStaff = card.staff && card.staff !== 'Unallocated' ? staffMap.get(card.staff) : null;
      const shiftRun = assignedStaff ? shiftRunMap.get(`${assignedStaff.fullName}::${card.day}`) : null;
      const laneIndex = Number.isInteger(card.laneIndex) ? card.laneIndex : 0;

      return prisma.taskInstance.update({
        where: { id: card.id },
        data: {
          assignedStaffId: assignedStaff?.id ?? null,
          shiftRunId: shiftRun?.id ?? null,
          sequence: Number.isFinite(card.jobOrder) ? Number(card.jobOrder) : index + 1,
          scheduledForAt: shiftRun?.shiftStartAt ? addMinutes(new Date(shiftRun.shiftStartAt), laneIndex * 60) : null,
          status: getNextStatus(current.status, Boolean(shiftRun)),
        },
      });
    });

  const shiftRunIds = shiftRuns.map((shiftRun) => shiftRun.id);

  await prisma.$transaction([
    ...updates,
    prisma.shiftRun.updateMany({
      where: { id: { in: shiftRunIds } },
      data: { organiserState: shiftState },
    }),
  ], {
    timeout: 20000,
  });

  return NextResponse.json({ ok: true, message: 'Live organiser board saved' });
}
