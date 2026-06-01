import Link from 'next/link';
import CleanerChecklistModal from './CleanerChecklistModal';
import IssueReportButton from './IssueReportButton';
import { cleanerProfile } from '../../../data/demo-data';
import { getCleanerAssignment, getCleanerAssignments } from '../../../lib/cleaner-data';

export async function generateStaticParams() {
  const { assignments } = await getCleanerAssignments();
  return assignments.map((assignment) => ({ zoneId: assignment.id }));
}

export async function generateMetadata({ params }) {
  const { zoneId } = await params;
  const { assignment } = await getCleanerAssignment(zoneId);
  return {
    title: assignment ? `${assignment.zone} · Cleaner Tasks` : 'Cleaner Tasks',
  };
}

export default async function CleanerZonePage({ params }) {
  const { zoneId } = await params;
  const { assignment, source } = await getCleanerAssignment(zoneId);

  if (!assignment) {
    return (
      <main className="page compact-page">
        <section className="card">
          <span className="badge">QR code not recognised</span>
          <h1>Unknown cleaning zone</h1>
          <p className="muted">This QR code does not match an active Cienna cleaning zone.</p>
          <Link className="button primary" href="/">Back to dashboard</Link>
        </section>
      </main>
    );
  }

  const remaining = assignment.tasks.filter((task) => task.status !== 'completed' && !task.score).length;
  const firstOpenTask = assignment.tasks.find((task) => task.status !== 'completed') ?? assignment.tasks[0];

  return (
    <main className="page compact-page">
      <div className="mobile-shell">
        <section className="card scan-hero">
          <div className="scan-header">
            <div>
              <span className="badge">QR scan confirmed</span>
              <h1>{assignment.zone}</h1>
              <p className="muted">{assignment.location}</p>
            </div>
            <div className="workflow-banner-actions">
              <Link className="button secondary" href="/admin/daily-hierarchy">Organiser board</Link>
              <Link className="button secondary" href="/admin/calendar">Weekly planner</Link>
            </div>
          </div>

          <div className="cleaner-strip">
            <div>
              <span className="muted">Cleaner</span>
              <strong>{assignment.staff ?? cleanerProfile.name}</strong>
            </div>
            <div>
              <span className="muted">Shift</span>
              <strong>{assignment.shift}</strong>
            </div>
          </div>

          {(assignment.day || assignment.routeLabel) && (
            <div className="stat-row">
              {assignment.day && <span className="flag">{assignment.day}</span>}
              {assignment.routeLabel && <span className="flag">{assignment.routeLabel}</span>}
              <span className="flag">{source === 'prisma' ? 'Live runtime data' : 'Demo fallback'}</span>
            </div>
          )}

          <div className="progress"><span style={{ width: `${assignment.progress}%` }} /></div>
          <div className="stat-row">
            <span className="flag">{assignment.stats.completed}/{assignment.stats.total} tasks completed</span>
            <span className="flag">{remaining} remaining</span>
            <span className="flag">{assignment.stats.photoRequired} forced photo checks</span>
            <span className="flag">Optional photos always available</span>
          </div>
        </section>

        <CleanerChecklistModal tasks={assignment.tasks} zoneName={assignment.zone} />

        <section className="workflow-banner">
          <div>
            <span className="badge">Workflow</span>
            <strong>Cleaner completes tasks here, while supervisors monitor progress from the organiser board and weekly overview.</strong>
          </div>
          <div className="workflow-banner-actions">
            <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
            <Link className="button secondary" href="/">Back to dashboard</Link>
          </div>
        </section>

        <section className="card issue-card">
          <div>
            <h2>Something wrong?</h2>
            <p className="muted">Raise a site issue with photo proof so supervisors can review it.</p>
          </div>
          <IssueReportButton taskId={firstOpenTask?.id} />
        </section>
      </div>
    </main>
  );
}
