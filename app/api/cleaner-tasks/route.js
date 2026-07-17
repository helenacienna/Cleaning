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
  const resolutionNote = typeof body?.resolutionNote === 'string' ? body.resolutionNote : '';
  const resolvedFromGrade = Number(body?.resolvedFromGrade);
  const isResolution = Number.isInteger(resolvedFromGrade) && resolvedFromGrade >= 1 && resolvedFromGrade <= 2 && grade >= 3;

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
  const completionComment = isResolution
    ? [
        buildComment({ grade, note }),
        `[initial-grade:${resolvedFromGrade}/5]`,
        '[issue-resolved:true]',
        resolutionNote.trim() ? `[resolution-note] ${resolutionNote.trim()}` : '[resolution-note] Corrected during checklist.',
      ].join('\n')
    : buildComment({ grade, note });
  const completionStatus = grade >= 3 ? 'completed' : 'failed';
  const taskStatus = grade >= 3 ? 'completed' : 'in_progress';

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
        issueRaised: isResolution ? true : grade <= 2,
      },
      create: {
        taskInstanceId,
        startedAt: now,
        completedAt: now,
        completedByStaffId: taskInstance.assignedStaffId,
        completionStatus,
        completionComment,
        issueRaised: isResolution ? true : grade <= 2,
      },
    });

    if (grade <= 3 || isResolution) {
      await prisma.taskAudit.create({
        data: {
          taskInstanceId,
          auditedByStaffId: null,
          auditScore: grade,
          auditStatus: isResolution ? 'passed' : mapGradeToAuditStatus(grade),
          auditComment: isResolution
            ? `Resolved issue: initial grade ${resolvedFromGrade}/5 corrected to ${grade}/5. ${resolutionNote || note || ''}`.trim()
            : note || 'Cleaner marked this task below pass threshold.',
          reworkRequired: isResolution ? false : grade <= 2,
          reworkReason: isResolution
            ? `Resolved grade ${resolvedFromGrade}/5 issue during checklist.`
            : grade <= 2 ? 'Cleaner reported issue during completion.' : null,
          managerAction: isResolution ? 'close' : mapGradeToManagerAction(grade),
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
    message: isResolution
      ? `Issue record saved: original score ${resolvedFromGrade}/5, corrected score ${grade}/5`
      : grade >= 3 ? 'Task completed' : 'Task saved for follow-up',
    issueRecord: isResolution
      ? {
          originalScore: resolvedFromGrade,
          correctedScore: grade,
          resolved: true,
        }
      : null,
  });
}
