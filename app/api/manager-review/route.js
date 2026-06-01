import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { recordNotification } from '../../../lib/notification-center';

const ACTION_MAP = {
  monitor: {
    managerAction: 'monitor',
    auditStatus: 'pending',
    taskStatus: 'in_progress',
    issueRaised: true,
    completionStatus: 'partial',
  },
  reassign: {
    managerAction: 'reassign',
    auditStatus: 'needs_followup',
    taskStatus: 'carried_forward',
    issueRaised: true,
    completionStatus: 'partial',
  },
  close: {
    managerAction: 'close',
    auditStatus: 'passed',
    taskStatus: 'completed',
    issueRaised: false,
    completionStatus: 'completed',
  },
};

function appendManagerNote(existingComment, reviewNote) {
  if (!reviewNote) {
    return existingComment;
  }

  return `${existingComment ?? ''}\n[manager] ${reviewNote}`.trim();
}

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
  const note = reviewNote || `Manager marked action: ${managerAction}`;

  await prisma.$transaction(async (tx) => {
    await tx.taskExecution.update({
      where: { id: taskExecutionId },
      data: {
        completionComment: appendManagerNote(execution.completionComment, reviewNote),
        exceptionReason: actionConfig.managerAction === 'close' ? null : note,
        issueRaised: actionConfig.issueRaised,
        completionStatus: actionConfig.completionStatus,
        completedAt: now,
      },
    });

    await tx.taskInstance.update({
      where: { id: execution.taskInstanceId },
      data: {
        status: actionConfig.taskStatus,
        sourceType: actionConfig.managerAction === 'reassign' ? 'carry_forward' : execution.taskInstance.sourceType,
        assignedStaffId: actionConfig.managerAction === 'reassign' ? null : execution.taskInstance.assignedStaffId,
        shiftRunId: actionConfig.managerAction === 'reassign' ? null : execution.taskInstance.shiftRunId,
        scheduledForAt: actionConfig.managerAction === 'reassign' ? null : execution.taskInstance.scheduledForAt,
        exceptionReason: actionConfig.managerAction === 'close' ? null : note,
      },
    });

    await tx.taskAudit.create({
      data: {
        taskInstanceId: execution.taskInstanceId,
        auditScore: actionConfig.managerAction === 'close' ? 5 : actionConfig.managerAction === 'monitor' ? 3 : 2,
        auditStatus: actionConfig.auditStatus,
        auditComment: note,
        reworkRequired: managerAction === 'reassign',
        reworkReason: managerAction === 'reassign' ? note : null,
        managerAction: actionConfig.managerAction,
        auditedAt: now,
      },
    });
  }, {
    timeout: 20000,
  });

  await recordNotification('manager-review', taskExecutionId, {
    title: `Manager action: ${managerAction}`,
    tone: managerAction === 'close' ? 'green' : managerAction === 'reassign' ? 'amber' : 'blue',
    note,
  });

  return NextResponse.json({
    ok: true,
    message: managerAction === 'reassign'
      ? 'Task moved back into organiser rework queue'
      : `Manager action saved: ${managerAction}`,
  });
}
