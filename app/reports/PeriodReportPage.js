import Link from 'next/link';
import {
  formatBoardDayLabelForTimeZone,
  DEFAULT_APP_TIME_ZONE,
} from '../../lib/app-timezone';
import {
  loadPeriodReport,
  nextPeriodHref,
  previousPeriodHref,
  scoreLabel,
  parseIssueNote,
  parseResolutionNote,
} from '../../lib/report-summary';

function formatDayLabel(day) {
  if (!day) return 'Unknown day';
  return formatBoardDayLabelForTimeZone(new Date(`${day}T00:00:00.000Z`), DEFAULT_APP_TIME_ZONE);
}

function gradeRows(totals) {
  return [5, 4, 3, 2, 1].map((grade) => ({ label: `Grade ${grade}`, count: totals.grades[grade] ?? 0 }));
}

function SummaryMetrics({ totals }) {
  return (
    <section className="daily-report-metrics">
      <div className="daily-report-metric"><span>Total tasks</span><strong>{totals.total}</strong></div>
      <div className="daily-report-metric"><span>Completed</span><strong className="tone-green">{totals.completed}</strong></div>
      <div className="daily-report-metric"><span>Completion</span><strong>{totals.completionPercent}%</strong></div>
      <div className="daily-report-metric"><span>Partial</span><strong className="tone-amber">{totals.partial}</strong></div>
      <div className="daily-report-metric"><span>Resolved</span><strong className={totals.resolvedIssues ? 'tone-amber' : 'tone-green'}>{totals.resolvedIssues}</strong></div>
      <div className="daily-report-metric"><span>Unresolved</span><strong className={totals.unresolvedIssues ? 'tone-red' : 'tone-green'}>{totals.unresolvedIssues}</strong></div>
      <div className="daily-report-metric"><span>Photos</span><strong>{totals.photoCount}</strong></div>
      <div className="daily-report-metric"><span>Notes</span><strong>{totals.noteCount}</strong></div>
    </section>
  );
}

function GroupTable({ title, description, groups, dayLabels = false }) {
  if (!groups.length) return null;
  return (
    <section className="card daily-report-card">
      <div className="panel-title">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="daily-report-compact-task-grid period-report-group-grid">
        {groups.map((group) => (
          <article className="daily-report-task-row daily-report-task-row-compact" key={group.key}>
            <div className="daily-report-task-main">
              <strong>{dayLabels ? formatDayLabel(group.key) : group.key}</strong>
              <div className="muted">{group.completed}/{group.total} complete · {group.completionPercent}%</div>
            </div>
            <div className="daily-report-task-meta">
              {group.unresolvedIssues ? <span className="badge tone-red">{group.unresolvedIssues} unresolved</span> : null}
              {group.resolvedIssues ? <span className="badge tone-amber">{group.resolvedIssues} resolved</span> : null}
              {group.photos ? <span className="flag">{group.photos} photos</span> : null}
              {group.notes ? <span className="flag">{group.notes} notes</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function IssueList({ entries }) {
  if (!entries.length) return null;
  return (
    <section className="card daily-report-card daily-report-followups">
      <div className="panel-title">
        <div>
          <h2>Issues and corrections</h2>
          <p className="muted">Unresolved low scores plus issues corrected during the report period.</p>
        </div>
      </div>
      <div className="daily-report-task-list">
        {entries.map(({ task, grade, resolvedIssue, day, facility, staff }) => (
          <article className={`daily-report-task-row ${resolvedIssue ? 'report-resolved' : 'report-attention'}`} key={task.id}>
            <div>
              <strong>{task.titleSnapshot}</strong>
              <div className="muted">{formatDayLabel(day)} · {facility} · {task.plannedZone?.name ?? task.zone?.name ?? 'Unknown zone'} · {staff}</div>
              {parseIssueNote(task) ? <p>{parseIssueNote(task)}</p> : null}
              {parseResolutionNote(task) ? <p><strong>Correction:</strong> {parseResolutionNote(task)}</p> : null}
            </div>
            <div className="daily-report-task-meta">
              <span className={`badge ${resolvedIssue ? 'tone-green' : 'tone-red'}`}>{scoreLabel(grade, task)}</span>
              {task.execution?.photos?.length ? <span className="flag">{task.execution.photos.length} photos</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function PeriodReportPage({ period, routePath, compareHref, title }) {
  const { source, totals, dayGroups, facilityGroups, staffGroups, issueEntries } = await loadPeriodReport({ period });
  const reportReady = source === 'prisma' && totals.total > 0;

  return (
    <main className="page daily-report-page">
      <div className="daily-report-shell">
        <section className="daily-report-hero">
          <div>
            <span className="badge">{title}</span>
            <h1>Cienna Cleaning {period.type} report</h1>
            <p>{period.label}</p>
            <div className="workflow-banner-actions" style={{ marginTop: 14 }}>
              <Link className="button secondary" href={previousPeriodHref(period, routePath)}>Previous</Link>
              <Link className="button secondary" href={nextPeriodHref(period, routePath)}>Next</Link>
              <Link className="button secondary" href={compareHref}>{period.type === 'weekly' ? 'Monthly report' : 'Weekly report'}</Link>
              <Link className="button secondary" href="/reports/daily">Daily reports</Link>
            </div>
          </div>
          <div className="daily-report-hero-stats">
            <div className="daily-report-score-card">
              <span>Completion</span>
              <strong>{totals.completionPercent}%</strong>
              <div>{totals.completed}/{totals.total} complete</div>
            </div>
            <div className="daily-report-score-distribution-card">
              <div className="daily-report-score-breakdown" aria-label="Grade distribution breakdown">
                {gradeRows(totals).map((row) => (
                  <div className="daily-report-score-breakdown-row" key={row.label}>
                    <strong>{row.label}</strong>
                    <span>{row.count}</span>
                    <span>{totals.total ? Math.round((row.count / totals.total) * 100) : 0}%</span>
                  </div>
                ))}
                <div className="daily-report-score-breakdown-row">
                  <strong>Not graded</strong>
                  <span>{totals.grades.notScored}</span>
                  <span>{totals.total ? Math.round((totals.grades.notScored / totals.total) * 100) : 0}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!reportReady ? (
          <section className="card daily-report-card">
            <h2>Report not available yet</h2>
            <p className="muted">No task activity was found for this period, or the database is unavailable.</p>
            <Link className="button secondary" href="/">Back to dashboard</Link>
          </section>
        ) : (
          <>
            <SummaryMetrics totals={totals} />
            <GroupTable title="Day-by-day summary" description="Daily operational trend across the selected period." groups={dayGroups} dayLabels />
            <GroupTable title="Facility summary" description="Completion, issue, photo, and note counts by facility." groups={facilityGroups} />
            <GroupTable title="Staff summary" description="Work completed or assigned by staff member." groups={staffGroups} />
            <IssueList entries={issueEntries} />
          </>
        )}
      </div>
    </main>
  );
}
