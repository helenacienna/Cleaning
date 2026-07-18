import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { buildComment } from '../../../lib/cleaner-data';
import { markTaskTemplateCompleted } from '../../../lib/task-scheduling';
import { getCleanerTaskEvidenceFailures, isValidSkipReason, normaliseSkipReason } from '../../../lib/cleaner-task-validation';

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
  const action = body?.action === 'skip' ? 'skip' : 'grade';
  const grade = Number(body?.grade);
  const note = typeof body?.note === 'string' ? body.note : '';
  const skipReason = normaliseSkipReason(body?.skipReason);

  if (!taskInstanceId) {
    return NextResponse.json({ error: 'Invalid cleaner task payload' }, { status: 400 });
  }

  if (action === 'grade' && (!Number.isInteger(grade) || grade < 1 || grade > 5)) {
    return NextResponse.json({ error: 'Invalid cleaner task payload' }, { status: 400 });
  }

  if (action === 'skip' && !isValidSkipReason(skipReason)) {
    return NextResponse.json({ error: 'A skip explanation is required for admin review' }, { status: 400 });
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

  const now = new Date();

  if (action === 'skip') {
    await prisma.$transaction(async (tx) => {
      await tx.taskInstance.update({
        where: { id: taskInstanceId },
        data: {
          status: 'skipped',
          exceptionReason: skipReason,
        },
      });

      await tx.taskExecution.upsert({
        where: { taskInstanceId },
        update: {
          startedAt: taskInstance.status === 'scheduled' || taskInstance.status === 'unscheduled' ? now : undefined,
          completedAt: now,
          completedByStaffId: taskInstance.assignedStaffId,
          completionStatus: 'skipped',
          completionComment: `[skip requested]\n${skipReason}`,
          exceptionReason: skipReason,
          issueRaised: true,
        },
        create: {
          taskInstanceId,
          startedAt: now,
          completedAt: now,
          completedByStaffId: taskInstance.assignedStaffId,
          completionStatus: 'skipped',
          completionComment: `[skip requested]\n${skipReason}`,
          exceptionReason: skipReason,
          issueRaised: true,
        },
      });

      await tx.taskAudit.create({
        data: {
          taskInstanceId,
          auditedByStaffId: null,
          auditScore: 0,
          auditStatus: 'pending',
          auditComment: `Cleaner requested skip: ${skipReason}`,
          reworkRequired: true,
          reworkReason: skipReason,
          managerAction: 'monitor',
          auditedAt: now,
        },
      });
    }, {
      timeout: 20000,
    });

    return NextResponse.json({
      ok: true,
      message: 'Skip sent to admin for review',
    });
  }

  const evidenceFailures = getCleanerTaskEvidenceFailures({ taskInstance, grade, note });
  if (evidenceFailures.length) {
    const missing = evidenceFailures.join(' and ');
    return NextResponse.json({
      error: `Required ${missing} must be added before moving on, or skip with an explanation for admin review.`,
      requirements: evidenceFailures,
    }, { status: 409 });
  }

  const completionComment = buildComment({ grade, note });
  const completionStatus = grade >= 4 ? 'completed' : grade === 3 ? 'partial' : 'failed';
  const taskStatus = grade >= 4 ? 'completed' : 'in_progress';

  await prisma.$transaction(async (tx) => {
    await tx.taskInstance.update({
      where: { id: taskInstanceId },
      data: {
        status: taskStatus,
      },
    });

    await tx.taskExecution.upsert({
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
      await tx.taskAudit.create({
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

    if (grade >= 4) {
      await markTaskTemplateCompleted(tx, taskInstanceId, now);
    }
  }, {
    timeout: 20000,
  });

  return NextResponse.json({
    ok: true,
    message: grade >= 4 ? 'Task completed' : 'Task saved for follow-up',
  });
}
