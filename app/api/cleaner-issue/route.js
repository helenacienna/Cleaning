import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { recordNotification } from '../../../lib/notification-center';

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const taskInstanceId = body?.taskInstanceId;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const photoNote = typeof body?.photoNote === 'string' ? body.photoNote.trim() : '';

  if (!taskInstanceId || !note) {
    return NextResponse.json({ error: 'Task and issue note are required' }, { status: 400 });
  }

  const taskInstance = await prisma.taskInstance.findUnique({
    where: { id: taskInstanceId },
  });

  if (!taskInstance) {
    return NextResponse.json({ error: 'Task instance not found' }, { status: 404 });
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const execution = await tx.taskExecution.upsert({
      where: { taskInstanceId },
      update: {
        issueRaised: true,
        exceptionReason: note,
        completionComment: note,
        updatedAt: now,
      },
      create: {
        taskInstanceId,
        startedAt: now,
        completionStatus: 'partial',
        completionComment: note,
        exceptionReason: note,
        issueRaised: true,
      },
    });

    await tx.taskInstance.update({
      where: { id: taskInstanceId },
      data: {
        status: 'in_progress',
        exceptionReason: note,
      },
    });

    await tx.taskAudit.create({
      data: {
        taskInstanceId,
        auditScore: 1,
        auditStatus: 'needs_followup',
        auditComment: note,
        reworkRequired: true,
        reworkReason: note,
        managerAction: 'escalate',
        auditedAt: now,
      },
    });

    if (photoNote) {
      await tx.taskPhoto.create({
        data: {
          taskExecutionId: execution.id,
          photoUrl: `local-note://${encodeURIComponent(photoNote)}`,
          photoType: 'exception',
        },
      });
    }
  }, {
    timeout: 20000,
  });

  await recordNotification('issue', taskInstanceId, {
    title: 'Cleaner raised issue',
    tone: 'red',
    note,
  });

  return NextResponse.json({ ok: true, message: 'Issue reported for manager follow-up' });
}
