import { NextResponse } from 'next/server';
import { getTaskCardLibraryData } from '../../../lib/app-data';
import { getPrisma } from '../../../lib/prisma';
import { parseExtraTaskBoardDay } from '../../../lib/extra-task-board-day';

async function getScheduledTemplateIds({ facilityName, day }) {
  const parsedDay = parseExtraTaskBoardDay(day);
  if (!facilityName || !parsedDay) {
    return new Set();
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return new Set();
  }

  const scheduledTasks = await prisma.taskInstance.findMany({
    where: {
      taskTemplateId: { not: null },
      plannedFacility: { name: facilityName },
      status: { notIn: ['cancelled', 'skipped'] },
      OR: [
        { plannedRunDate: parsedDay.dateOnly },
        { dueAt: { gte: parsedDay.localStart, lt: parsedDay.localEnd } },
        { shiftRun: { is: { runDate: parsedDay.dateOnly } } },
      ],
    },
    select: { taskTemplateId: true },
  });

  return new Set(scheduledTasks.map((task) => task.taskTemplateId).filter(Boolean));
}

export async function GET(request) {
  const payload = await getTaskCardLibraryData();
  const { searchParams } = new URL(request.url);
  const facilityName = searchParams.get('facility') ?? '';
  const day = searchParams.get('day') ?? '';
  const scheduledTemplateIds = await getScheduledTemplateIds({ facilityName, day }).catch(() => new Set());

  if (!scheduledTemplateIds.size) {
    return NextResponse.json({ ok: true, ...payload });
  }

  return NextResponse.json({
    ok: true,
    ...payload,
    cards: payload.cards.map((card) => ({
      ...card,
      scheduledToday: scheduledTemplateIds.has(card.id),
    })),
  });
}
