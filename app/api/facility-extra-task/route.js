import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { calculatePlanningDueAt, refreshTemplateStatus } from '../../../lib/task-scheduling';
import { parseExtraTaskBoardDay } from '../../../lib/extra-task-board-day';

function buildManualInstanceCode(templateCode, day) {
  const stamp = String(day).replace(/-/g, '');
  const suffix = Date.now().toString(36).toUpperCase();
  return `${templateCode}-ADD-${stamp}-${suffix}`;
}

function getTopAssignedStaffId(tasks = []) {
  const counts = new Map();
  tasks.forEach((task) => {
    if (!task.assignedStaffId) return;
    counts.set(task.assignedStaffId, (counts.get(task.assignedStaffId) ?? 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const templateCode = String(body?.templateId ?? '').trim();
  const facilityName = String(body?.facility ?? '').trim();
  const title = String(body?.title ?? '').trim();
  const zone = String(body?.zone ?? '').trim();
  const taskGroup = String(body?.taskGroup ?? '').trim();
  const boardDay = String(body?.day ?? '').trim();
  const parsedDay = parseExtraTaskBoardDay(boardDay);

  if (!facilityName || !parsedDay || (!templateCode && !title)) {
    return NextResponse.json({ error: 'Missing task, facility, or day' }, { status: 400 });
  }

  const taskTemplate = await prisma.taskTemplate.findFirst({
    where: {
      active: true,
      facility: { name: facilityName },
      OR: [
        templateCode ? { taskTemplateCode: templateCode } : null,
        title ? {
          title,
          ...(zone ? { zone: { name: zone } } : {}),
          ...(taskGroup ? { taskGroup: { name: taskGroup } } : {}),
        } : null,
      ].filter(Boolean),
    },
    include: {
      facility: true,
      zone: true,
      taskGroup: true,
    },
  });

  if (!taskTemplate) {
    return NextResponse.json({ error: 'Task template not found' }, { status: 404 });
  }

  const existing = await prisma.taskInstance.findFirst({
    where: {
      taskTemplateId: taskTemplate.id,
      status: { notIn: ['cancelled', 'skipped'] },
      OR: [
        { plannedRunDate: parsedDay.dateOnly },
        { dueAt: { gte: parsedDay.localStart, lt: parsedDay.localEnd } },
        { shiftRun: { is: { runDate: parsedDay.dateOnly } } },
      ],
    },
    select: {
      id: true,
      titleSnapshot: true,
      status: true,
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, alreadyScheduled: true, task: existing });
  }

  const sameDayFacilityTasks = await prisma.taskInstance.findMany({
    where: {
      plannedFacilityId: taskTemplate.facilityId,
      OR: [
        { plannedRunDate: parsedDay.dateOnly },
        { shiftRun: { is: { runDate: parsedDay.dateOnly } } },
      ],
    },
    select: {
      assignedStaffId: true,
      shiftRunId: true,
      sequence: true,
    },
  });

  const assignedStaffId = getTopAssignedStaffId(sameDayFacilityTasks);
  const shiftRun = assignedStaffId
    ? await prisma.shiftRun.findFirst({
        where: {
          runDate: parsedDay.dateOnly,
          assignedStaffId,
        },
        select: { id: true, shiftStartAt: true },
      })
    : null;

  const maxSequence = sameDayFacilityTasks.reduce((max, task) => Math.max(max, Number(task.sequence) || 0), 0);
  const scheduledForAt = shiftRun?.shiftStartAt ?? parsedDay.dueAt;

  const created = await prisma.taskInstance.create({
    data: {
      instanceCode: buildManualInstanceCode(taskTemplate.taskTemplateCode, boardDay),
      taskTemplateId: taskTemplate.id,
      shiftRunId: shiftRun?.id ?? null,
      facilityId: taskTemplate.facilityId,
      zoneId: taskTemplate.zoneId,
      taskGroupId: taskTemplate.taskGroupId,
      plannedFacilityId: taskTemplate.facilityId,
      plannedZoneId: taskTemplate.zoneId,
      plannedTaskGroupId: taskTemplate.taskGroupId,
      titleSnapshot: taskTemplate.title,
      descriptionSnapshot: taskTemplate.description,
      sourceType: 'ad_hoc',
      dueAt: parsedDay.dueAt,
      planningDueAt: calculatePlanningDueAt(parsedDay.dueAt),
      scheduledForAt,
      assignedStaffId,
      plannedRunDate: parsedDay.dateOnly,
      sequence: maxSequence + 1,
      status: 'scheduled',
      priority: taskTemplate.priority,
      evidenceRequirement: taskTemplate.evidenceRequirement,
      commentRequirement: taskTemplate.commentRequirement,
      estimatedMinutes: taskTemplate.estimatedMinutes,
      manuallyCreated: true,
      isExceptionTask: false,
      exceptionReason: 'Added from facility extra tasks',
    },
    select: {
      id: true,
      titleSnapshot: true,
      status: true,
      assignedStaff: { select: { fullName: true } },
    },
  });

  await refreshTemplateStatus(prisma, taskTemplate.id).catch((error) => {
    console.error('refreshTemplateStatus failed after adding extra task', error);
  });

  return NextResponse.json({ ok: true, alreadyScheduled: false, task: created });
}
