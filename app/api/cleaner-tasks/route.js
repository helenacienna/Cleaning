import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { buildComment } from '../../../lib/cleaner-data';

function mapGradeToAuditStatus(grade) {
  if (grade >= 4) return 'passed';
  if (grade === 3) return 'pending';
  return 'needs_followup';
}

function mapGradeToManagerAction(grade) {
  if (grade >= 4) return 'none';
  if (grade === 3) return 'monitor';
  return 'reassign';
}

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const taskInstanceId = body?.taskInstanceId;
  const grade = Number(body?.grade);
  const note = typeof body?.note === 'string' ? body.note : '';

  if (!taskInstanceId || !Number.isInteger(grade) || grade < 1 || grade > 5) {
    return NextResponse.json({ error: 'Invalid cleaner task payload' }, { status: 400 });
  }

  const taskInstance = await prisma.taskInstance.findUnique({
    where: { id: taskInstanceId },
    include: {
      assignedStaff: true,
      execution: {
        include: {
          photos: true,
        },
      },
    },
  });

  if (!taskInstance) {
    return NextResponse.json({ error: 'Task instance not found' }, { status: 404 });
  }

  const hasEvidence = note.trim().length > 0 || (taskInstance.execution?.photos?.length ?? 0) > 0;

  if (grade <= 2 && !hasEvidence) {
    return NextResponse.json({ error: 'Grade 1-2 requires a photo or note before moving on' }, { status: 400 });
  }

  const now = new Date();
  const completionComment = buildComment({ grade, note });
  const completionStatus = grade >= 4 ? 'completed' : grade === 3 ? 'partial' : 'failed';
  const taskStatus = grade >= 4 ? 'completed' : 'in_progress';

  const startedAt = Date.now();

  try {
    await prisma.taskInstance.update({
      where: { id: taskInstanceId },
      data: {
        status: taskStatus,
      },
    });

    await prisma.taskExecution.upsert({
      where: { taskInstanceId },
      update: {
        startedAt: taskInstance.status === 'scheduled' || taskInstance.status === 'unscheduled' ? now : undefined,
        completedAt: now,
        completedByStaffId: taskInstance.assignedStaffId,
        completionStatus,
        completionComment,
        issueRaised: grade <= 2,
      },
      create: {
        taskInstanceId,
        startedAt: now,
        completedAt: now,
        completedByStaffId: taskInstance.assignedStaffId,
        completionStatus,
        completionComment,
        issueRaised: grade <= 2,
      },
    });

    if (grade <= 3) {
      await prisma.taskAudit.create({
        data: {
          taskInstanceId,
          auditedByStaffId: null,
          auditScore: grade,
          auditStatus: mapGradeToAuditStatus(grade),
          auditComment: note || 'Cleaner marked this task below pass threshold.',
          reworkRequired: grade <= 2,
          reworkReason: grade <= 2 ? 'Cleaner reported issue during completion.' : null,
          managerAction: mapGradeToManagerAction(grade),
          auditedAt: now,
        },
      });
    }
  } catch (error) {
    console.error('cleaner-task-save-failed', { taskInstanceId, grade, code: error?.code, message: error?.message });
    return NextResponse.json({ error: 'Unable to save cleaner task' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    message: grade >= 4 ? 'Task completed' : 'Task saved for follow-up',
  });
}
