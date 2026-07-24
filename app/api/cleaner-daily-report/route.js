import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { recordNotification } from '../../../lib/notification-center';

function compactList(items, limit = 6) {
  if (!items.length) return 'None';
  const shown = items.slice(0, limit).join('; ');
  return items.length > limit ? `${shown}; +${items.length - limit} more` : shown;
}

function parseInitialGrade(comment = '') {
  const match = String(comment || '').match(/initial-grade\s*:?\s*(\d)\/5/i);
  return match ? Number(match[1]) : null;
}

function isResolvedIssue(comment = '') {
  return /\[issue-resolved:true\]/i.test(String(comment || ''));
}

function parseResolutionNote(comment = '') {
  const match = String(comment || '').match(/\[resolution-note\]\s*([^\n]+)/i);
  const note = match ? match[1].trim() : '';
  return /^Corrected during checklist\.?$/i.test(note) ? '' : note;
}

function parseIssueNote(comment = '') {
  return String(comment || '')
    .replace(/\[grade:\d\/5\]\s*/ig, '')
    .replace(/\[initial-grade:\d\/5\]\s*/ig, '')
    .replace(/\[issue-resolved:true\]\s*/ig, '')
    .replace(/\[resolution-note\]\s*[^\n]+\s*/ig, '')
    .trim();
}

function hasMeaningfulNote(comment = '') {
  return Boolean(parseIssueNote(comment) || parseResolutionNote(comment));
}

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const taskIds = Array.isArray(body?.taskIds)
    ? body.taskIds.filter((id) => typeof id === 'string')
    : [];
  const facility = typeof body?.facility === 'string' ? body.facility : 'Facility';
  const staffName = typeof body?.staffName === 'string' ? body.staffName : 'Cleaner';
  const day = typeof body?.day === 'string' ? body.day : '';

  if (!taskIds.length) {
    return NextResponse.json({ error: 'Daily task ids are required' }, { status: 400 });
  }

  const tasks = await prisma.taskInstance.findMany({
    where: {
      id: { in: taskIds },
    },
    include: {
      facility: true,
      plannedFacility: true,
      zone: true,
      plannedZone: true,
      taskGroup: true,
      plannedTaskGroup: true,
      assignedStaff: true,
      execution: {
        include: {
          photos: true,
        },
      },
      audits: {
        orderBy: { auditedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!tasks.length) {
    return NextResponse.json({ error: 'Daily tasks not found' }, { status: 404 });
  }

  const scoredTasks = tasks.map((task) => {
    const latestAudit = task.audits?.[0] ?? null;
    const gradeMatch = task.execution?.completionComment?.match(/grade\s*:?\s*(\d)\/5/i);
    const grade = latestAudit?.auditScore ?? (gradeMatch ? Number(gradeMatch[1]) : null);
    return {
      task,
      grade,
      initialGrade: parseInitialGrade(task.execution?.completionComment ?? ''),
      resolvedIssue: isResolvedIssue(task.execution?.completionComment ?? ''),
    };
  });

  const completed = scoredTasks.filter(({ grade, task }) => Number(grade) >= 3 || task.status === 'completed').length;
  const partial = scoredTasks.filter(({ grade }) => Number(grade) === 3).length;
  const lowScores = scoredTasks.filter(({ grade, resolvedIssue }) => !resolvedIssue && Number(grade) <= 2);
  const resolvedIssues = scoredTasks.filter(({ resolvedIssue }) => resolvedIssue);
  const photoCount = tasks.reduce((sum, task) => sum + (task.execution?.photos?.length ?? 0), 0);
  const noteCount = tasks.filter((task) => hasMeaningfulNote(task.execution?.completionComment ?? '')).length;
  const boardDay = day || tasks.find((task) => task.plannedRunDate || task.dueAt)?.plannedRunDate?.toISOString?.().slice(0, 10) || tasks[0]?.dueAt?.toISOString?.().slice(0, 10) || 'today';
  const resolvedFacility = tasks[0]?.plannedFacility?.name ?? tasks[0]?.facility?.name ?? facility;
  const resolvedStaff = tasks[0]?.assignedStaff?.fullName ?? staffName;

  const lowScoreSummary = lowScores.map(({ task, grade }) => {
    const zone = task.plannedZone?.name ?? task.zone?.name ?? 'Unknown zone';
    return `${zone}: ${task.titleSnapshot} (${grade}/5)`;
  });

  const identifier = `${resolvedFacility}:${resolvedStaff}:${boardDay}:daily-complete`;
  const note = [
    `${resolvedStaff} completed the ${resolvedFacility} daily checklist for ${boardDay}.`,
    `${completed}/${tasks.length} complete, ${partial} partial, ${resolvedIssues.length} resolved issue(s), ${lowScores.length} unresolved issue(s).`,
    `${photoCount} photo(s), ${noteCount} note(s).`,
    `Follow-ups: ${compactList(lowScoreSummary)}`,
  ].join('\n');

  await recordNotification('daily-report', identifier, {
    title: `${resolvedFacility} daily checklist report`,
    tone: lowScores.length ? 'red' : resolvedIssues.length ? 'amber' : 'green',
    severity: lowScores.length ? 'warning' : 'info',
    audience: 'manager',
    note,
  });

  const reportUrl = `/reports/daily?facility=${encodeURIComponent(resolvedFacility)}&staff=${encodeURIComponent(resolvedStaff)}&day=${encodeURIComponent(boardDay)}&ids=${encodeURIComponent(tasks.map((task) => task.id).join(','))}`;

  return NextResponse.json({
    ok: true,
    message: 'Daily report created',
    reportUrl,
    report: {
      facility: resolvedFacility,
      staffName: resolvedStaff,
      day: boardDay,
      total: tasks.length,
      completed,
      partial,
      lowScores: lowScores.length,
      resolvedIssues: resolvedIssues.length,
      photoCount,
      noteCount,
    },
  });
}
