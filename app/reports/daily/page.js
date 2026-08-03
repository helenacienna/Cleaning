import Link from 'next/link';
import PhotoPreloader from '../../PhotoPreloader';
import { getPrisma } from '../../../lib/prisma';
import { formatBoardDayLabelForTimeZone, DEFAULT_APP_TIME_ZONE } from '../../../lib/app-timezone';
import { taskPhotoUrl as buildTaskPhotoUrl } from '../../../lib/task-photo-urls.js';
import { photoPreloadLimit, photoThumbnailWidth } from '../../../lib/cost-control.js';
import ReportActions from './ReportActions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Daily Checklist Report · Cienna Cleaning',
};

function parseCompletionGrade(task) {
  const gradeMatch = task.execution?.completionComment?.match(/grade\s*:?\s*(\d)\/5/i);
  return gradeMatch ? Number(gradeMatch[1]) : null;
}

function parseGrade(task) {
  const latestAudit = task.audits?.[0] ?? null;
  const completionGrade = parseCompletionGrade(task);
  if (parseResolvedIssue(task) && completionGrade !== null) {
    return completionGrade;
  }
  return latestAudit?.auditScore ?? completionGrade;
}

function parseInitialGrade(task) {
  const match = task.execution?.completionComment?.match(/initial-grade\s*:?\s*(\d)\/5/i);
  return match ? Number(match[1]) : null;
}

function parseResolvedIssue(task) {
  return /\[issue-resolved:true\]/i.test(task.execution?.completionComment ?? '');
}

function parseResolutionNote(task) {
  const match = task.execution?.completionComment?.match(/\[resolution-note\]\s*([^\n]+)/i);
  const note = match ? match[1].trim() : '';
  return /^Corrected during checklist\.?$/i.test(note) ? '' : note;
}

function parseIssueNote(task) {
  return String(task.execution?.completionComment ?? '')
    .replace(/\[grade:\d\/5\]\s*/ig, '')
    .replace(/\[initial-grade:\d\/5\]\s*/ig, '')
    .replace(/\[issue-resolved:true\]\s*/ig, '')
    .replace(/\[resolution-note\]\s*[^\n]+\s*/ig, '')
    .trim();
}

function hasMeaningfulNote(task) {
  return Boolean(parseIssueNote(task) || parseResolutionNote(task));
}

function serviceLevelLabel(serviceLevel = 'clean') {
  if (serviceLevel === 'check') return 'Check';
  if (serviceLevel === 'detailed_clean') return 'Detailed clean';
  return 'Clean';
}

function taskServiceLevel(task) {
  return task?.serviceLevel ?? task?.taskTemplate?.serviceLevel ?? 'clean';
}

function hasNumericGrade(grade) {
  return grade !== null && grade !== undefined && grade !== '' && Number.isFinite(Number(grade));
}

function isAddedReportTask(task) {
  return task?.sourceType === 'ad_hoc' || Boolean(task?.manuallyCreated);
}

function reportSortGrade(entry) {
  if (!hasNumericGrade(entry.grade)) return 99;
  return Number(entry.grade);
}

function taskPhotoCount(task) {
  return task.execution?.photos?.length ?? 0;
}

function sortReportEntries(entries) {
  return [...entries].sort((a, b) => {
    const gradeDifference = reportSortGrade(a) - reportSortGrade(b);
    if (gradeDifference !== 0) return gradeDifference;

    const photoDifference = taskPhotoCount(b.task) - taskPhotoCount(a.task);
    if (photoDifference !== 0) return photoDifference;

    return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
  });
}

function taskPhotos(task) {
  return task.execution?.photos ?? [];
}

function taskPhotoUrl(photo, options = {}) {
  return buildTaskPhotoUrl(photo, options);
}

function photoCountLabel(count) {
  return `${count} photo${count === 1 ? '' : 's'}`;
}

function photoLabel(photo, index) {
  if (photo.photoType === 'exception') return 'Before issue photo';
  if (photo.photoType === 'completion') return 'After correction photo';
  return `Photo ${index + 1}`;
}

function PhotoEvidence({ task, photos: providedPhotos = null, className = '' }) {
  const photos = providedPhotos ?? taskPhotos(task);
  if (!photos.length) return null;

  const typeCounts = photos.reduce((counts, photo) => {
    const key = photo.photoType || 'general';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className={`daily-report-photo-grid ${className}`.trim()}>
      {photos.map((photo, index) => (
        <figure className="daily-report-photo-card photo-loading-card" key={photo.id}>
          <a href={taskPhotoUrl(photo)} target="_blank" rel="noreferrer">
            <img src={taskPhotoUrl(photo, { thumbnail: true, width: photoThumbnailWidth(520) })} alt={`${task.titleSnapshot} evidence photo ${index + 1}`} loading="lazy" decoding="async" fetchPriority="low" width="320" height="240" />
          </a>
          <figcaption>
            <span>{photoLabel(photo, index)}</span>
            <span className="flag daily-report-photo-count-chip">{photoCountLabel(typeCounts[photo.photoType || 'general'] ?? photos.length)}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function ResolvedIssueEvidence({ task, grade, initialGrade }) {
  const photos = taskPhotos(task);
  const beforePhotos = photos.filter((photo) => photo.photoType === 'exception');
  const afterPhotos = photos.filter((photo) => photo.photoType === 'completion');
  const otherPhotos = photos.filter((photo) => photo.photoType !== 'exception' && photo.photoType !== 'completion');
  const balancedSinglePair = beforePhotos.length === 1 && afterPhotos.length === 1;

  if (!photos.length) {
    return (
      <div className="daily-report-resolved-score-row">
        <span className={`badge tone-${initialGrade === 1 ? 'red' : 'amber'}`}>Initial Score {initialGrade}</span>
        <span className="badge tone-green">Corrected Score {grade}</span>
      </div>
    );
  }

  return (
    <div className={`daily-report-resolved-evidence ${balancedSinglePair ? 'daily-report-resolved-evidence-balanced' : ''}`}>
      <div className="daily-report-resolved-evidence-column">
        <span className={`badge tone-${initialGrade === 1 ? 'red' : 'amber'}`}>Initial Score {initialGrade}</span>
        <PhotoEvidence task={task} photos={beforePhotos} className="daily-report-photo-grid-resolved" />
      </div>
      <div className="daily-report-resolved-evidence-column">
        <span className="badge tone-green">Corrected Score {grade}</span>
        <PhotoEvidence task={task} photos={afterPhotos} className="daily-report-photo-grid-resolved" />
      </div>
      {otherPhotos.length ? <PhotoEvidence task={task} photos={otherPhotos} /> : null}
    </div>
  );
}

function scoreTone(grade, task) {
  const initialGrade = parseInitialGrade(task);
  if (parseResolvedIssue(task) && initialGrade === 1) return 'red';
  if (parseResolvedIssue(task) && initialGrade === 2) return 'amber';
  if (Number(grade) >= 4 || task.status === 'completed') return 'green';
  if (Number(grade) === 3) return 'amber';
  if (Number(grade) <= 2) return 'red';
  return 'blue';
}

function scoreLabel(grade, task) {
  const initialGrade = parseInitialGrade(task);
  if (parseResolvedIssue(task) && initialGrade) return `Resolved ${initialGrade}→${grade}`;
  if (Number(grade) >= 1) return `${grade}/5`;
  if (task.status === 'completed') return 'Complete';
  return 'Not Graded';
}

function reportScoreKey(grade) {
  return hasNumericGrade(grade) && Number(grade) >= 1 && Number(grade) <= 5 ? String(Number(grade)) : 'notScored';
}

function buildReportScoreSections(scored) {
  const sectionConfig = [
    { key: '1', title: 'Grade 1', description: 'Needs correction urgently.' },
    { key: '2', title: 'Grade 2', description: 'Needs correction today.' },
    { key: '3', title: 'Grade 3', description: 'Partial or cleaner to improve.' },
    { key: '4', title: 'Grade 4', description: 'Acceptable / completed.' },
    { key: '5', title: 'Grade 5', description: 'Perfect / completed to standard.' },
    { key: 'notScored', title: 'Not graded', description: 'Tasks without a saved score.' },
  ];

  return sectionConfig.map((section) => {
    const entries = scored.filter(({ grade }) => reportScoreKey(grade) === section.key);
    const withPhotos = sortReportEntries(entries.filter(({ task }) => taskPhotoCount(task) > 0));
    const withoutPhotos = sortReportEntries(entries.filter(({ task }) => taskPhotoCount(task) === 0));
    return { ...section, entries, withPhotos, withoutPhotos };
  }).filter((section) => section.entries.length > 0);
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

function toDayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function addDays(day, count) {
  const date = dayDate(day) ?? new Date();
  date.setUTCDate(date.getUTCDate() + count);
  return toDayKey(date);
}

function dailyReportHref({ facility, staffName, day }) {
  const params = new URLSearchParams();
  if (facility) params.set('facility', facility);
  if (staffName) params.set('staff', staffName);
  if (day) params.set('day', day);
  const query = params.toString();
  return `/reports/daily${query ? `?${query}` : ''}`;
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

const SCORE_DISTRIBUTION = [
  { key: '5', label: 'Grade 5', shortLabel: '5', className: 'score-5', color: '#63e6a5' },
  { key: '4', label: 'Grade 4', shortLabel: '4', className: 'score-4', color: '#59c3ff' },
  { key: '3', label: 'Grade 3', shortLabel: '3', className: 'score-3', color: '#ffca6a' },
  { key: '2', label: 'Grade 2', shortLabel: '2', className: 'score-2', color: '#ffa06e' },
  { key: '1', label: 'Grade 1', shortLabel: '1', className: 'score-1', color: '#ff7b91' },
  { key: 'notScored', label: 'Not Graded', shortLabel: 'NG', className: 'score-not-scored', color: '#cbd5e1' },
];

function buildScoreDistribution(scored) {
  const counts = SCORE_DISTRIBUTION.reduce((acc, item) => ({ ...acc, [item.key]: 0 }), {});

  scored.forEach(({ grade }) => {
    if (hasNumericGrade(grade) && Number(grade) >= 1 && Number(grade) <= 5) {
      counts[String(Number(grade))] += 1;
      return;
    }
    counts.notScored += 1;
  });

  return SCORE_DISTRIBUTION.map((item) => ({
    ...item,
    count: counts[item.key] ?? 0,
    fraction: `${counts[item.key] ?? 0}/${scored.length}`,
    percent: percent(counts[item.key] ?? 0, scored.length),
  }));
}

function buildPieGradient(distribution) {
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  if (!total) return 'conic-gradient(#e2e8f0 0deg 360deg)';

  let cursor = 0;
  const segments = distribution
    .filter((item) => item.count > 0)
    .map((item) => {
      const start = cursor;
      const end = cursor + (item.count / total) * 360;
      cursor = end;
      return `${item.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });

  return `conic-gradient(${segments.join(', ')})`;
}

function buildCleanerHref(staffName) {
  const firstName = String(staffName || '').trim().split(/\s+/)[0];
  return firstName ? `/cleaner/${encodeURIComponent(firstName.toLowerCase())}` : '/cleaner';
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
    `Resolved issues: ${totals.resolvedIssues}`,
    `Unresolved issues: ${totals.unresolvedIssues}`,
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

  const scored = tasks.map((task, originalIndex) => ({
    task,
    grade: parseGrade(task),
    initialGrade: parseInitialGrade(task),
    resolvedIssue: parseResolvedIssue(task),
    originalIndex,
  }));
  const sortedScored = sortReportEntries(scored);
  const scoreDistribution = buildScoreDistribution(scored);
  const scorePieStyle = { '--score-pie': buildPieGradient(scoreDistribution) };
  const totals = {
    total: tasks.length,
    completed: scored.filter(({ grade, task }) => Number(grade) >= 3 || task.status === 'completed').length,
    partial: scored.filter(({ grade }) => hasNumericGrade(grade) && Number(grade) === 3).length,
    lowScores: scored.filter(({ grade, resolvedIssue }) => !resolvedIssue && hasNumericGrade(grade) && Number(grade) <= 2).length,
    resolvedIssues: scored.filter(({ resolvedIssue }) => resolvedIssue).length,
    unresolvedIssues: scored.filter(({ grade, resolvedIssue }) => !resolvedIssue && hasNumericGrade(grade) && Number(grade) <= 2).length,
    photoCount: tasks.reduce((sum, task) => sum + (task.execution?.photos?.length ?? 0), 0),
    noteCount: tasks.filter(hasMeaningfulNote).length,
    serviceLevels: {
      check: tasks.filter((task) => taskServiceLevel(task) === 'check').length,
      clean: tasks.filter((task) => taskServiceLevel(task) !== 'check' && taskServiceLevel(task) !== 'detailed_clean').length,
      detailed_clean: tasks.filter((task) => taskServiceLevel(task) === 'detailed_clean').length,
    },
  };
  const completionPercent = percent(totals.completed, totals.total);
  const reportPath = `/reports/daily?facility=${encodeURIComponent(facility)}&staff=${encodeURIComponent(staffName)}&day=${encodeURIComponent(day)}${ids.length ? `&ids=${encodeURIComponent(ids.join(','))}` : ''}`;
  const previousDayHref = dailyReportHref({ facility, staffName, day: addDays(day, -1) });
  const nextDayHref = dailyReportHref({ facility, staffName, day: addDays(day, 1) });
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://web-production-3a1422.up.railway.app';
  const emailHref = buildEmailHref({ facility, staffName, day, totals, reportUrl: `${publicBaseUrl}${reportPath}` });
  const cleanerHref = buildCleanerHref(staffName);
  const reportPayload = {
    facility,
    staffName,
    day,
    dayLabel: formatDayLabel(day),
    totals,
    reportUrl: `${publicBaseUrl}${reportPath}`,
    tasks: sortedScored.map(({ task, grade, initialGrade, resolvedIssue }) => ({
      title: task.titleSnapshot,
      zone: task.plannedZone?.name ?? task.zone?.name,
      group: task.plannedTaskGroup?.name ?? task.taskGroup?.name,
      grade: scoreLabel(grade, task),
      serviceLevel: serviceLevelLabel(taskServiceLevel(task)),
      initialGrade,
      resolvedIssue,
      issueNote: parseIssueNote(task),
      resolutionNote: parseResolutionNote(task),
      photoCount: taskPhotoCount(task),
      addedToday: isAddedReportTask(task),
    })),
  };
  const resolvedIssues = sortReportEntries(scored.filter(({ resolvedIssue }) => resolvedIssue));
  const followUps = sortReportEntries(scored.filter(({ grade, resolvedIssue }) => !resolvedIssue && hasNumericGrade(grade) && Number(grade) <= 2));
  const addedTaskEntries = sortReportEntries(scored.filter(({ task }) => isAddedReportTask(task)));
  const scoreSections = buildReportScoreSections(scored);
  const backgroundPhotoUrls = tasks.flatMap((task) => taskPhotos(task).map((photo) => taskPhotoUrl(photo, { thumbnail: true, width: photoThumbnailWidth(520) }))).filter(Boolean);

  return (
    <main className="page daily-report-page">
      <PhotoPreloader urls={backgroundPhotoUrls} limit={photoPreloadLimit(48)} />
      <div className="daily-report-shell">
        <section className="daily-report-hero">
          <div>
            <span className="badge">Daily checklist report</span>
            <h1>{facility || 'Facility'} daily clean</h1>
            <p>{formatDayLabel(day)} · {staffName || 'Cleaner'}</p>
            <div className="workflow-banner-actions" style={{ marginTop: 14 }}>
              <Link className="button secondary" href={previousDayHref}>Previous day</Link>
              <Link className="button secondary" href={nextDayHref}>Next day</Link>
              <Link className="button secondary" href="/reports/weekly">Weekly report</Link>
              <Link className="button secondary" href="/reports/monthly">Monthly report</Link>
            </div>
          </div>
          <div className="daily-report-hero-stats">
            <div className="daily-report-score-card daily-report-score-card-with-pie">
              <div>
                <span>Completion</span>
                <strong>{completionPercent}%</strong>
                <div>{totals.completed}/{totals.total} complete</div>
              </div>
              <div className="daily-report-score-pie" style={scorePieStyle} aria-label="Grade distribution pie chart">
                <span>{totals.total}</span>
              </div>
            </div>
            <div className="daily-report-score-distribution-card">
              <div className="daily-report-score-breakdown" aria-label="Grade distribution breakdown">
                {scoreDistribution.map((item) => (
                  <div className="daily-report-score-breakdown-row" key={item.key}>
                    <span className={`score-dot ${item.className}`} aria-hidden="true" />
                    <strong>{item.label}</strong>
                    <span>{item.fraction}</span>
                    <span>{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <ReportActions emailHref={emailHref} backHref={cleanerHref} reportPayload={reportPayload} />

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
              <div className="daily-report-metric"><span>Resolved issues</span><strong className={totals.resolvedIssues ? 'tone-amber' : 'tone-green'}>{totals.resolvedIssues}</strong></div>
              <div className="daily-report-metric"><span>Unresolved</span><strong className={totals.unresolvedIssues ? 'tone-red' : 'tone-green'}>{totals.unresolvedIssues}</strong></div>
              <div className="daily-report-metric"><span>Photos</span><strong>{totals.photoCount}</strong></div>
              <div className="daily-report-metric"><span>Notes</span><strong>{totals.noteCount}</strong></div>
              <div className="daily-report-metric"><span>Check</span><strong>{totals.serviceLevels.check}</strong></div>
              <div className="daily-report-metric"><span>Clean</span><strong>{totals.serviceLevels.clean}</strong></div>
              <div className="daily-report-metric"><span>Detailed clean</span><strong>{totals.serviceLevels.detailed_clean}</strong></div>
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
                <div><span className="muted">Result</span><strong>{totals.unresolvedIssues ? 'Supervisor review required' : totals.resolvedIssues ? 'Issues found and resolved' : 'No low-score issues'}</strong></div>
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
                        <div className="muted">{task.plannedZone?.name ?? task.zone.name} · {task.plannedTaskGroup?.name ?? task.taskGroup.name} · {serviceLevelLabel(taskServiceLevel(task))}</div>
                        {parseIssueNote(task) ? <p>{parseIssueNote(task)}</p> : null}
                        <PhotoEvidence task={task} />
                      </div>
                      <div className="daily-report-task-meta">
                        <span className={`badge tone-${scoreTone(grade, task)}`}>{scoreLabel(grade, task)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {addedTaskEntries.length ? (
              <section className="card daily-report-card daily-report-added-tasks">
                <div className="panel-title">
                  <div>
                    <h2>Added tasks</h2>
                    <p className="muted">Extra work manually added to this facility day.</p>
                  </div>
                </div>
                <div className="daily-report-task-list">
                  {addedTaskEntries.map(({ task, grade }) => (
                    <article className="daily-report-task-row report-added" key={`added-${task.id}`}>
                      <div>
                        <strong>{task.titleSnapshot}</strong>
                        <div className="muted">{task.plannedZone?.name ?? task.zone.name} · {task.plannedTaskGroup?.name ?? task.taskGroup.name} · {serviceLevelLabel(taskServiceLevel(task))}</div>
                        {parseIssueNote(task) ? <p>{parseIssueNote(task)}</p> : null}
                        <PhotoEvidence task={task} />
                      </div>
                      <div className="daily-report-task-meta">
                        <span className={`badge tone-${scoreTone(grade, task)}`}>{scoreLabel(grade, task)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {resolvedIssues.length ? (
              <section className="card daily-report-card daily-report-followups">
                <div className="panel-title">
                  <div>
                    <h2>Resolved issues</h2>
                    <p className="muted">Problems found during the walkthrough and corrected before completion.</p>
                  </div>
                </div>
                <div className="daily-report-task-list">
                  {resolvedIssues.map(({ task, grade, initialGrade }) => (
                    <article className="daily-report-task-row report-resolved" key={`resolved-${task.id}`}>
                      <div>
                        <strong>{task.titleSnapshot}</strong>
                        <div className="muted">{task.plannedZone?.name ?? task.zone.name} · {task.plannedTaskGroup?.name ?? task.taskGroup.name} · {serviceLevelLabel(taskServiceLevel(task))}</div>
                        {parseIssueNote(task) ? <p><strong>Initial issue:</strong> {parseIssueNote(task)}</p> : null}
                        {parseResolutionNote(task) ? <p><strong>Correction:</strong> {parseResolutionNote(task)}</p> : null}
                        <ResolvedIssueEvidence task={task} grade={grade} initialGrade={initialGrade} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="card daily-report-card">
              <div className="panel-title">
                <div>
                  <h2>Checklist by score</h2>
                  <p className="muted">Tasks are grouped by score. Items with photos are shown first and stay full-width.</p>
                </div>
              </div>
              <div className="daily-report-score-sections">
                {scoreSections.map((section) => (
                  <section className="daily-report-score-section" key={section.key}>
                    <div className="daily-report-score-section-heading">
                      <div>
                        <h3>{section.title}</h3>
                        <p className="muted">{section.description}</p>
                      </div>
                      <span className="badge">{section.entries.length} task{section.entries.length === 1 ? '' : 's'}</span>
                    </div>
                    {section.withPhotos.length ? (
                      <div className="daily-report-task-list daily-report-photo-task-list">
                        {section.withPhotos.map(({ task, grade }) => (
                          <article className="daily-report-task-row daily-report-task-row-photo" key={task.id}>
                            <div className="daily-report-task-main">
                              <div>
                                <strong>{task.titleSnapshot}</strong>
                                <div className="muted">{task.plannedZone?.name ?? task.zone.name} · {task.plannedTaskGroup?.name ?? task.taskGroup.name} · {serviceLevelLabel(taskServiceLevel(task))}</div>
                              </div>
                            </div>
                            <div className="daily-report-task-meta">
                              <span className={`badge tone-${scoreTone(grade, task)}`}>{scoreLabel(grade, task)}</span>
                              {hasMeaningfulNote(task) ? <span className="flag">Note</span> : null}
                              <span className="flag">{photoCountLabel(taskPhotoCount(task))}</span>
                            </div>
                            <PhotoEvidence task={task} />
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {section.withoutPhotos.length ? (
                      <div className="daily-report-compact-task-grid">
                        {section.withoutPhotos.map(({ task, grade }) => (
                          <article className="daily-report-task-row daily-report-task-row-compact" key={task.id}>
                            <div className="daily-report-task-main">
                              <strong>{task.titleSnapshot}</strong>
                              <div className="muted">{task.plannedZone?.name ?? task.zone.name} · {task.plannedTaskGroup?.name ?? task.taskGroup.name} · {serviceLevelLabel(taskServiceLevel(task))}</div>
                            </div>
                            <div className="daily-report-task-meta">
                              <span className={`badge tone-${scoreTone(grade, task)}`}>{scoreLabel(grade, task)}</span>
                              {hasMeaningfulNote(task) ? <span className="flag">Note</span> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
