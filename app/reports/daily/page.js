import Link from 'next/link';
import { getPrisma } from '../../../lib/prisma';
import { formatBoardDayLabelForTimeZone, DEFAULT_APP_TIME_ZONE } from '../../../lib/app-timezone';
import ReportActions from './ReportActions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Daily Checklist Report · Cienna Cleaning',
};

function parseGrade(task) {
  const latestAudit = task.audits?.[0] ?? null;
  const gradeMatch = task.execution?.completionComment?.match(/grade\s*:?\s*(\d)\/5/i);
  return latestAudit?.auditScore ?? (gradeMatch ? Number(gradeMatch[1]) : null);
}

function hasNumericGrade(grade) {
  return Number.isFinite(Number(grade));
}

function scoreTone(grade, task) {
  if (Number(grade) >= 4 || task.status === 'completed') return 'green';
  if (Number(grade) === 3) return 'amber';
  if (Number(grade) <= 2) return 'red';
  return 'blue';
}

function scoreLabel(grade, task) {
  if (Number(grade) >= 1) return `${grade}/5`;
  if (task.status === 'completed') return 'Complete';
  return 'Not scored';
}

function dayDate(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return null;
  return new Date(`${day}T00:00:00.000Z`);
}

function dayRange(day) {
  const start = dayDate(day);
  if (!start) return null;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function formatDayLabel(day) {
  const date = dayDate(day);
  if (!date) return day || 'Selected day';
  return formatBoardDayLabelForTimeZone(date, DEFAULT_APP_TIME_ZONE);
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function buildEmailHref({ facility, staffName, day, totals, reportUrl }) {
  const subject = `${facility} daily checklist report - ${formatDayLabel(day)}`;
  const body = [
    `${facility} daily checklist report`,
    `Day: ${formatDayLabel(day)}`,
    `Cleaner: ${staffName}`,
    '',
    `Completed: ${totals.completed}/${totals.total}`,
    `Partial: ${totals.partial}`,
    `Follow-ups: ${totals.lowScores}`,
    `Photos: ${totals.photoCount}`,
    `Notes: ${totals.noteCount}`,
    '',
    `Open the visual report: ${reportUrl}`,
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function loadReport({ facility, staffName, day, ids }) {
  const prisma = await getPrisma();
  if (!prisma || (!ids.length && (!facility || !staffName || !day))) {
    return { source: prisma ? 'missing-input' : 'no-db', tasks: [] };
  }

  const range = dayRange(day);
  const tasks = await prisma.taskInstance.findMany({
    where: ids.length ? {
      id: { in: ids },
    } : {
      assignedStaff: { fullName: staffName },
      taskTemplate: { recurrenceType: 'daily' },
      ...(range ? {
        OR: [
          { plannedFacility: { name: facility }, plannedRunDate: range.start },
          { facility: { name: facility }, plannedRunDate: range.start },
          { plannedFacility: { name: facility }, dueAt: { gte: range.start, lt: range.end } },
          { facility: { name: facility }, dueAt: { gte: range.start, lt: range.end } },
        ],
      } : {
        OR: [
          { plannedFacility: { name: facility } },
          { facility: { name: facility } },
        ],
      }),
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
    orderBy: [
      { sequence: 'asc' },
      { titleSnapshot: 'asc' },
    ],
  });

  return { source: 'prisma', tasks };
}

export default async function DailyReportPage({ searchParams }) {
  const params = await searchParams;
  const ids = typeof params?.ids === 'string' ? params.ids.split(',').map((id) => id.trim()).filter(Boolean) : [];
  const facility = typeof params?.facility === 'string' ? params.facility : '';
  const staffName = typeof params?.staff === 'string' ? params.staff : '';
  const day = typeof params?.day === 'string' ? params.day : '';
  const { source, tasks } = await loadReport({ facility, staffName, day, ids });

  const scored = tasks.map((task) => ({ task, grade: parseGrade(task) }));
  const totals = {
    total: tasks.length,
    completed: scored.filter(({ grade, task }) => Number(grade) >= 4 || task.status === 'completed').length,
    partial: scored.filter(({ grade }) => hasNumericGrade(grade) && Number(grade) === 3).length,
    lowScores: scored.filter(({ grade }) => hasNumericGrade(grade) && Number(grade) <= 2).length,
    photoCount: tasks.reduce((sum, task) => sum + (task.execution?.photos?.length ?? 0), 0),
    noteCount: tasks.filter((task) => (task.execution?.completionComment ?? '').trim().length > 0).length,
  };
  const completionPercent = percent(totals.completed, totals.total);
  const reportPath = `/reports/daily?facility=${encodeURIComponent(facility)}&staff=${encodeURIComponent(staffName)}&day=${encodeURIComponent(day)}${ids.length ? `&ids=${encodeURIComponent(ids.join(','))}` : ''}`;
  const emailHref = buildEmailHref({ facility, staffName, day, totals, reportUrl: reportPath });
  const followUps = scored.filter(({ grade }) => hasNumericGrade(grade) && Number(grade) <= 3);

  return (
    <main className="page daily-report-page">
      <div className="daily-report-shell">
        <section className="daily-report-hero">
          <div>
            <span className="badge">Daily checklist report</span>
            <h1>{facility || 'Facility'} daily clean</h1>
            <p>{formatDayLabel(day)} · {staffName || 'Cleaner'}</p>
          </div>
          <div className="daily-report-score-card">
            <span>Completion</span>
            <strong>{completionPercent}%</strong>
            <div>{totals.completed}/{totals.total} complete</div>
          </div>
        </section>

        <ReportActions emailHref={emailHref} />

        {source !== 'prisma' || !tasks.length ? (
          <section className="card daily-report-card">
            <h2>Report not available yet</h2>
            <p className="muted">Complete the daily checklist first, then return to this report link.</p>
            <Link className="button secondary" href="/admin/manager">Back to manager overview</Link>
          </section>
        ) : (
          <>
            <section className="daily-report-metrics">
              <div className="daily-report-metric"><span>Total tasks</span><strong>{totals.total}</strong></div>
              <div className="daily-report-metric"><span>Completed</span><strong className="tone-green">{totals.completed}</strong></div>
              <div className="daily-report-metric"><span>Partial</span><strong className="tone-amber">{totals.partial}</strong></div>
              <div className="daily-report-metric"><span>Follow-ups</span><strong className={totals.lowScores ? 'tone-red' : 'tone-green'}>{totals.lowScores}</strong></div>
              <div className="daily-report-metric"><span>Photos</span><strong>{totals.photoCount}</strong></div>
              <div className="daily-report-metric"><span>Notes</span><strong>{totals.noteCount}</strong></div>
            </section>

            <section className="card daily-report-card">
              <div className="panel-title">
                <div>
                  <h2>Supervisor summary</h2>
                  <p className="muted">A concise handover view for the completed active checklist.</p>
                </div>
              </div>
              <div className="daily-report-summary-grid">
                <div><span className="muted">Facility</span><strong>{facility}</strong></div>
                <div><span className="muted">Cleaner</span><strong>{staffName}</strong></div>
                <div><span className="muted">Date</span><strong>{formatDayLabel(day)}</strong></div>
                <div><span className="muted">Result</span><strong>{totals.lowScores ? 'Supervisor review recommended' : 'No low-score follow-ups'}</strong></div>
              </div>
            </section>

            {followUps.length ? (
              <section className="card daily-report-card daily-report-followups">
                <div className="panel-title">
                  <div>
                    <h2>Items needing attention</h2>
                    <p className="muted">Grades 1–3, with notes/photos shown where available.</p>
                  </div>
                </div>
                <div className="daily-report-task-list">
                  {followUps.map(({ task, grade }) => (
                    <article className="daily-report-task-row report-attention" key={`followup-${task.id}`}>
                      <div>
                        <strong>{task.titleSnapshot}</strong>
                        <div className="muted">{task.plannedZone?.name ?? task.zone.name} · {task.plannedTaskGroup?.name ?? task.taskGroup.name}</div>
                        {task.execution?.completionComment ? <p>{task.execution.completionComment}</p> : null}
                      </div>
                      <div className="daily-report-task-meta">
                        <span className={`badge tone-${scoreTone(grade, task)}`}>{scoreLabel(grade, task)}</span>
                        <span className="flag">{task.execution?.photos?.length ?? 0} photos</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="card daily-report-card">
              <div className="panel-title">
                <div>
                  <h2>Full checklist</h2>
                  <p className="muted">All daily tasks from this active checklist.</p>
                </div>
              </div>
              <div className="daily-report-task-list">
                {scored.map(({ task, grade }, index) => (
                  <article className="daily-report-task-row" key={task.id}>
                    <div className="daily-report-task-main">
                      <span className="task-number">{index + 1}</span>
                      <div>
                        <strong>{task.titleSnapshot}</strong>
                        <div className="muted">{task.plannedZone?.name ?? task.zone.name} · {task.plannedTaskGroup?.name ?? task.taskGroup.name}</div>
                      </div>
                    </div>
                    <div className="daily-report-task-meta">
                      <span className={`badge tone-${scoreTone(grade, task)}`}>{scoreLabel(grade, task)}</span>
                      <span className="flag">{task.execution?.photos?.length ?? 0} photos</span>
                      {(task.execution?.completionComment ?? '').trim() ? <span className="flag">Note</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
