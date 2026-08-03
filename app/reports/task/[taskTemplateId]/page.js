import Link from 'next/link';
import PhotoPreloader from '../../../PhotoPreloader';
import {
  DEFAULT_APP_TIME_ZONE,
  formatBoardDayLabelForTimeZone,
} from '../../../../lib/app-timezone';
import {
  buildMonthlyPeriod,
  buildWeeklyPeriod,
  nextPeriodHref,
  parseIssueNote,
  parseResolutionNote,
  periodParamForHref,
  previousPeriodHref,
  scoreLabel,
  serviceLevelLabel,
  loadTaskPeriodReport,
} from '../../../../lib/report-summary';
import { taskPhotoUrl } from '../../../../lib/task-photo-urls';
import { photoPreloadLimit, photoThumbnailWidth } from '../../../../lib/cost-control.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Task Report · Cienna Cleaning',
};

function formatDayLabel(day) {
  if (!day) return 'Unknown day';
  return formatBoardDayLabelForTimeZone(new Date(`${day}T00:00:00.000Z`), DEFAULT_APP_TIME_ZONE);
}

function buildTaskReportPeriod(params) {
  const periodType = params?.period === 'monthly' ? 'monthly' : 'weekly';
  return periodType === 'monthly'
    ? buildMonthlyPeriod(typeof params?.month === 'string' ? params.month : '')
    : buildWeeklyPeriod(typeof params?.week === 'string' ? params.week : '');
}

function withPeriod(route, period) {
  return `${route}?period=${period.type}&${periodParamForHref(period)}`;
}

function previousTaskPeriodHref(period, route) {
  const href = previousPeriodHref(period, route);
  return `${href}&period=${period.type}`;
}

function nextTaskPeriodHref(period, route) {
  const href = nextPeriodHref(period, route);
  return `${href}&period=${period.type}`;
}

function gradeRows(totals) {
  return [5, 4, 3, 2, 1].map((grade) => ({ label: `Grade ${grade}`, count: totals.grades[grade] ?? 0 }));
}

function SummaryMetrics({ totals }) {
  return (
    <section className="daily-report-metrics">
      <div className="daily-report-metric"><span>Runs</span><strong>{totals.total}</strong></div>
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

function TaskRunList({ scored, title = 'Task history', description = 'Every run of this task in the selected period.' }) {
  if (!scored.length) return null;
  return (
    <section className="card daily-report-card">
      <div className="panel-title">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="daily-report-task-list">
        {scored.map(({ task, grade, resolvedIssue, day, staff, serviceLevel }) => {
          const photos = task.execution?.photos ?? [];
          return (
            <article className={`daily-report-task-row ${!resolvedIssue && Number(grade) <= 2 ? 'report-attention' : ''}`} key={task.id}>
              <div>
                <strong>{formatDayLabel(day)}</strong>
                <div className="muted">{task.plannedFacility?.name ?? task.facility?.name ?? 'Unknown facility'} · {task.plannedZone?.name ?? task.zone?.name ?? 'Unknown zone'} · {staff} · {serviceLevelLabel(serviceLevel)}</div>
                {parseIssueNote(task) ? <p>{parseIssueNote(task)}</p> : null}
                {parseResolutionNote(task) ? <p><strong>Correction:</strong> {parseResolutionNote(task)}</p> : null}
                {photos.length ? (
                  <div className="daily-report-photo-grid">
                    {photos.slice(0, 6).map((photo, index) => (
                      <a className="daily-report-photo-card photo-loading-card" href={taskPhotoUrl(photo)} target="_blank" rel="noreferrer" key={photo.id}>
                        <img src={taskPhotoUrl(photo, { thumbnail: true, width: photoThumbnailWidth(360) })} alt={`${task.titleSnapshot} evidence photo ${index + 1}`} loading="lazy" decoding="async" fetchPriority="low" width="240" height="180" />
                      </a>
                    ))}
                    {photos.length > 6 ? <span className="flag">+{photos.length - 6} more</span> : null}
                  </div>
                ) : null}
              </div>
              <div className="daily-report-task-meta">
                <span className={`badge ${resolvedIssue ? 'tone-green' : Number(grade) <= 2 ? 'tone-red' : 'tone-green'}`}>{scoreLabel(grade, task)}</span>
                <span className="flag">{task.status}</span>
                {photos.length ? <span className="flag">{photos.length} photos</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default async function TaskReportPage({ params, searchParams }) {
  const routeParams = await params;
  const query = await searchParams;
  const taskTemplateId = routeParams?.taskTemplateId ?? '';
  const period = buildTaskReportPeriod(query ?? {});
  const route = `/reports/task/${taskTemplateId}`;
  const { source, template, totals, dayGroups, staffGroups, issueEntries, scored } = await loadTaskPeriodReport({ templateId: taskTemplateId, period });
  const reportReady = source === 'prisma' && Boolean(template);
  const oppositePeriod = period.type === 'weekly' ? buildMonthlyPeriod('') : buildWeeklyPeriod('');
  const backgroundPhotoUrls = scored
    .flatMap((entry) => (entry.task.execution?.photos ?? []).map((photo) => taskPhotoUrl(photo, { thumbnail: true, width: photoThumbnailWidth(360) })))
    .filter(Boolean);

  return (
    <main className="page daily-report-page">
      <PhotoPreloader urls={backgroundPhotoUrls} limit={photoPreloadLimit(36)} delayMs={2400} />
      <div className="daily-report-shell">
        <section className="daily-report-hero">
          <div>
            <span className="badge">Task {period.type} report</span>
            <h1>{template?.title ?? 'Task report'}</h1>
            <p>{period.label}</p>
            {template ? (
              <p className="muted">{template.facility?.name ?? 'Unknown facility'} · {template.zone?.name ?? 'Unknown zone'} · {template.taskGroup?.name ?? 'Unknown group'} · {serviceLevelLabel(template.serviceLevel)} · {template.taskTemplateCode}</p>
            ) : null}
            <div className="workflow-banner-actions" style={{ marginTop: 14 }}>
              <Link className="button secondary" href={previousTaskPeriodHref(period, route)}>Previous</Link>
              <Link className="button secondary" href={nextTaskPeriodHref(period, route)}>Next</Link>
              <Link className="button secondary" href={withPeriod(route, oppositePeriod)}>{period.type === 'weekly' ? 'Monthly view' : 'Weekly view'}</Link>
              <Link className="button secondary" href="/facility-board/cienna?view=order">Task Card Organiser</Link>
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
            <h2>Task not found</h2>
            <p className="muted">This task card could not be found, or the database is unavailable.</p>
            <Link className="button secondary" href="/facility-board/cienna?view=order">Back to Task Card Organiser</Link>
          </section>
        ) : totals.total === 0 ? (
          <section className="card daily-report-card">
            <h2>No activity for this period</h2>
            <p className="muted">This task card has no scheduled or completed runs in the selected period.</p>
            <Link className="button secondary" href="/facility-board/cienna?view=order">Back to Task Card Organiser</Link>
          </section>
        ) : (
          <>
            <SummaryMetrics totals={totals} />
            <GroupTable title="Day-by-day summary" description="How this task performed across the selected period." groups={dayGroups} dayLabels />
            <GroupTable title="Staff summary" description="Who this task was assigned to or completed by." groups={staffGroups} />
            <TaskRunList scored={scored} />
            {issueEntries.length ? <TaskRunList scored={issueEntries} title="Issues and corrections" description="Low scores and corrected issues for this task card." /> : null}
          </>
        )}
      </div>
    </main>
  );
}
