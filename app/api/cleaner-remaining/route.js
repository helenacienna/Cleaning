import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { getTaskInstanceBoardDate } from '../../../lib/task-scheduling';
import { formatBoardDayKeyForTimeZone } from '../../../lib/app-timezone';
import { parseExecutionGrade, parseExecutionNote } from '../../../lib/cleaner-data';

const ACTIVE_STATUSES = ['scheduled', 'upcoming', 'due', 'unscheduled', 'in_progress', 'overdue', 'carried_forward', 'completed'];

function mapTask(instance, timeZone = 'Australia/Brisbane') {
  const comment = instance.execution?.completionComment ?? '';
  const score = parseExecutionGrade(comment);
  return {
    id: instance.id,
    title: instance.titleSnapshot,
    status: instance.status === 'in_progress' ? 'in-progress' : instance.status,
    frequency: instance.taskTemplate?.recurrenceType ?? null,
    score,
    note: parseExecutionNote(comment),
    facility: instance.plannedFacility?.name ?? instance.facility.name,
    zone: instance.plannedZone?.name ?? instance.zone.name,
    taskGroup: instance.plannedTaskGroup?.name ?? instance.taskGroup.name,
    assignedStaff: instance.assignedStaff?.fullName ?? 'Unallocated',
    boardDayKey: formatBoardDayKeyForTimeZone(getTaskInstanceBoardDate(instance), timeZone),
    photoRequired: instance.evidenceRequirement === 'required_photo' || instance.evidenceRequirement === 'multi_photo',
    commentRequired: instance.commentRequirement === 'always' || instance.commentRequirement === 'on_exception',
    photoCount: instance.execution?.photos?.length ?? 0,
    photos: (instance.execution?.photos ?? []).map((photo) => ({
      id: photo.id,
      photoType: photo.photoType,
      photoUrl: `/api/task-photos/${photo.id}`,
    })),
  };
}

export async function GET(request) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const url = new URL(request.url);
  const facilityName = url.searchParams.get('facility');
  const day = url.searchParams.get('day');

  if (!facilityName || !/^\d{4}-\d{2}-\d{2}$/.test(day || '')) {
    return NextResponse.json({ error: 'facility and day are required' }, { status: 400 });
  }

  const staff = await prisma.staff.findMany({
    where: { active: true, role: 'cleaner' },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });

  const windowStart = new Date(`${day}T00:00:00+10:00`);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 1);

  const instances = await prisma.taskInstance.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      OR: [
        { dueAt: { gte: windowStart, lt: windowEnd } },
        { plannedRunDate: { gte: windowStart, lt: windowEnd } },
        { shiftRun: { is: { runDate: { gte: windowStart, lt: windowEnd } } } },
      ],
      plannedFacility: { is: { name: facilityName } },
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
      taskTemplate: { select: { recurrenceType: true } },
      execution: { include: { photos: true } },
    },
    orderBy: [{ dueAt: 'asc' }, { sequence: 'asc' }],
  });

  const dayInstances = instances.filter((instance) => formatBoardDayKeyForTimeZone(getTaskInstanceBoardDate(instance), 'Australia/Brisbane') === day);
  const tasks = dayInstances.map((instance) => mapTask(instance));
  const periodicTasks = tasks.filter((task) => task.frequency && task.frequency !== 'daily');
  const revisitTasks = tasks.filter((task) => task.frequency === 'daily' && Number(task.score) >= 1 && Number(task.score) <= 3);

  return NextResponse.json({ ok: true, staff, periodicTasks, revisitTasks });
}

export async function POST(request) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
  if (!assignments.length) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const staffRows = await prisma.staff.findMany({ where: { active: true }, select: { id: true, fullName: true } });
  const staffByName = new Map(staffRows.map((staff) => [staff.fullName, staff]));

  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const assignment of assignments) {
      const taskInstanceId = assignment?.taskInstanceId;
      const staffName = assignment?.staffName;
      if (!taskInstanceId) continue;
      const staff = staffName && staffName !== 'Unallocated' ? staffByName.get(staffName) : null;
      await tx.taskInstance.update({
        where: { id: taskInstanceId },
        data: { assignedStaffId: staff?.id ?? null, shiftRunId: null, updatedAt: new Date() },
      });
      updated += 1;
    }
  }, { timeout: 20000 });

  return NextResponse.json({ ok: true, updated });
}
