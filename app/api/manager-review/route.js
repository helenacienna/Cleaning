import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

const ACTION_MAP = {
  monitor: {
    managerAction: 'monitor',
    auditStatus: 'pending',
    taskStatus: 'in_progress',
  },
  reassign: {
    managerAction: 'reassign',
    auditStatus: 'needs_followup',
    taskStatus: 'carried_forward',
  },
  close: {
    managerAction: 'close',
    auditStatus: 'passed',
    taskStatus: 'completed',
  },
};

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const taskExecutionId = body?.taskExecutionId;
  const managerAction = body?.managerAction;
  const reviewNote = typeof body?.reviewNote === 'string' ? body.reviewNote.trim() : '';
  const actionConfig = ACTION_MAP[managerAction];

  if (!taskExecutionId || !actionConfig) {
    return NextResponse.json({ error: 'Invalid manager review payload' }, { status: 400 });
  }

  const execution = await prisma.taskExecution.findUnique({
    where: { id: taskExecutionId },
    include: {
      taskInstance: true,
    },
  });

  if (!execution) {
    return NextResponse.json({ error: 'Task execution not found' }, { status: 404 });
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.taskExecution.update({
      where: { id: taskExecutionId },
      data: {
        completionComment: reviewNote
          ? `${execution.completionComment ?? ''}\n[manager] ${reviewNote}`.trim()
          : execution.completionComment,
      },
    });

    await tx.taskInstance.update({
      where: { id: execution.taskInstanceId },
      data: {
        status: actionConfig.taskStatus,
      },
    });

    await tx.taskAudit.create({
      data: {
        taskInstanceId: execution.taskInstanceId,
        auditScore: actionConfig.managerAction === 'close' ? 5 : actionConfig.managerAction === 'monitor' ? 3 : 2,
        auditStatus: actionConfig.auditStatus,
        auditComment: reviewNote || `Manager marked action: ${managerAction}`,
        reworkRequired: managerAction === 'reassign',
        reworkReason: managerAction === 'reassign' ? reviewNote || 'Manager requested reassignment' : null,
        managerAction: actionConfig.managerAction,
        auditedAt: now,
      },
    });
  }, {
    timeout: 20000,
  });

  return NextResponse.json({ ok: true, message: `Manager action saved: ${managerAction}` });
}
