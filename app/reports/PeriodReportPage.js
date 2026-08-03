import Link from 'next/link';
import {
  formatBoardDayLabelForTimeZone,
  DEFAULT_APP_TIME_ZONE,
} from '../../lib/app-timezone';
import {
  loadPeriodReport,
  nextPeriodHref,
  previousPeriodHref,
  periodParamForHref,
  scoreLabel,
  parseIssueNote,
  parseResolutionNote,
  serviceLevelLabel,
} from '../../lib/report-summary';

function formatDayLabel(day) {
  if (!day) return 'Unknown day';
  return formatBoardDayLabelForTimeZone(new Date(`${day}T00:00:00.000Z`), DEFAULT_APP_TIME_ZONE);
}

function gradeRows(totals) {
  return [5, 4, 3, 2, 1].map((grade) => ({
    key: `score-${grade}`,
    label: `Grade ${grade}`,
    count: totals.grades[grade] ?? 0,
    className: `score-${grade}`,
  }));
}

function ScoreBreakdown({ totals }) {
  const rows = [
    ...gradeRows(totals),
    {
      key: 'not-scored',
      label: 'Not graded',
      count: totals.grades.notScored ?? 0,
      className: 'score-not-scored',
    },
  ];

  return (
    <div className="daily-report-score-breakdown" aria-label="Grade distribution breakdown">
      {rows.map((row) => (
        <div className="daily-report-score-breakdown-row" key={row.key}>
          <span className={`score-dot ${row.className}`} aria-hidden="true" />
          <strong>{row.label}</strong>
          <span>{row.count}</span>
          <span>{totals.total ? Math.round((row.count / totals.total) * 100) : 0}%</span>
        </div>
      ))}
    </div>
  );
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
      <div className="daily-report-metric"><span>Check</span><strong>{totals.serviceLevels?.check ?? 0}</strong></div>
      <div className="daily-report-metric"><span>Clean</span><strong>{totals.serviceLevels?.clean ?? 0}</strong></div>
      <div className="daily-report-metric"><span>Detailed clean</span><strong>{totals.serviceLevels?.detailed_clean ?? 0}</strong></div>
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
        {groups.map((group) => <GroupSummaryRow group={group} dayLabels={dayLabels} key={group.key} />)}
      </div>
    </section>
  );
}

function GroupSummaryRow({ group, dayLabels = false }) {
  return (
    <article className="daily-report-task-row daily-report-task-row-compact">
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
  );
}

function weekLabel(group) {
  const start = formatDayLabel(group.startKey);
  const end = formatDayLabel(group.endKey);
  return start === end ? start : `${start} – ${end}`;
}

function buildWeekGroups(dayGroups) {
  const weeks = new Map();
  dayGroups.forEach((dayGroup) => {
    const parsed = new Date(`${dayGroup.key}T00:00:00.000Z`);
    const day = parsed.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(parsed);
    weekStart.setUTCDate(parsed.getUTCDate() + offset);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const key = weekStart.toISOString().slice(0, 10);
    if (!weeks.has(key)) {
      weeks.set(key, {
        key,
        startKey: key,
        endKey: weekEnd.toISOString().slice(0, 10),
        total: 0,
        completed: 0,
        partial: 0,
        unresolvedIssues: 0,
        resolvedIssues: 0,
        photos: 0,
        notes: 0,
        days: [],
      });
    }
    const week = weeks.get(key);
    week.total += dayGroup.total;
    week.completed += dayGroup.completed;
    week.partial += dayGroup.partial ?? 0;
    week.unresolvedIssues += dayGroup.unresolvedIssues;
    week.resolvedIssues += dayGroup.resolvedIssues;
    week.photos += dayGroup.photos;
    week.notes += dayGroup.notes;
    week.days.push(dayGroup);
  });

  return [...weeks.values()]
    .map((week) => ({ ...week, completionPercent: week.total ? Math.round((week.completed / week.total) * 100) : 0 }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function WeekGroupTable({ groups }) {
  if (!groups.length) return null;
  return (
    <section className="card daily-report-card">
      <div className="panel-title">
        <div>
          <h2>Week-by-week summary</h2>
          <p className="muted">Monthly operational trend by week. Expand a week to see the daily summaries.</p>
        </div>
      </div>
      <div className="daily-report-compact-task-grid period-report-group-grid">
        {groups.map((group) => (
          <details className="period-report-week-group" key={group.key}>
            <summary>
              <GroupSummaryRow group={{ ...group, key: weekLabel(group) }} />
            </summary>
            <div className="period-report-week-days">
              {group.days.map((dayGroup) => <GroupSummaryRow group={dayGroup} dayLabels key={dayGroup.key} />)}
            </div>
          </details>
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
        {entries.map(({ task, grade, resolvedIssue, day, facility, staff, serviceLevel }) => (
          <article className={`daily-report-task-row ${resolvedIssue ? 'report-resolved' : 'report-attention'}`} key={task.id}>
            <div>
              <strong>{task.titleSnapshot}</strong>
              <div className="muted">{formatDayLabel(day)} · {facility} · {task.plannedZone?.name ?? task.zone?.name ?? 'Unknown zone'} · {staff} · {serviceLevelLabel(serviceLevel)}</div>
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

export default async function PeriodReportPage({ period, routePath, compareHref, title, reportHeading, includeFacilityStaff = false, managerReport = false }) {
  const { source, totals, dayGroups, facilityGroups, staffGroups, issueEntries } = await loadPeriodReport({ period });
  const reportReady = source === 'prisma' && totals.total > 0;
  const weekGroups = period.type === 'monthly' ? buildWeekGroups(dayGroups) : [];
  const managerHref = `/reports/building-manager?${periodParamForHref(period)}&type=${period.type}`;

  return (
    <main className="page daily-report-page">
      <div className="daily-report-shell">
        <section className="daily-report-hero">
          <div>
            <span className="badge">{title}</span>
            <h1>{reportHeading ?? `Cienna Cleaning ${period.type} report`}</h1>
            <p>{period.label}</p>
            <div className="workflow-banner-actions" style={{ marginTop: 14 }}>
              <Link className="button secondary" href={previousPeriodHref(period, routePath)}>Previous</Link>
              <Link className="button secondary" href={nextPeriodHref(period, routePath)}>Next</Link>
              <Link className="button secondary" href={compareHref}>{period.type === 'weekly' ? (managerReport ? 'Monthly manager report' : 'Monthly report') : (managerReport ? 'Weekly manager report' : 'Weekly report')}</Link>
              {!managerReport ? <Link className="button secondary" href={managerHref}>Building manager report</Link> : null}
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
              <ScoreBreakdown totals={totals} />
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
            {period.type === 'monthly'
              ? <WeekGroupTable groups={weekGroups} />
              : <GroupTable title="Day-by-day summary" description="Daily operational trend across the selected period." groups={dayGroups} dayLabels />}
            {includeFacilityStaff ? <GroupTable title="Facility summary" description="Completion, issue, photo, and note counts by facility." groups={facilityGroups} /> : null}
            {includeFacilityStaff ? <GroupTable title="Staff summary" description="Work completed or assigned by staff member." groups={staffGroups} /> : null}
            <IssueList entries={issueEntries} />
          </>
        )}
      </div>
    </main>
  );
}
