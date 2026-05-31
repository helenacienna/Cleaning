import Link from 'next/link';
import CleanerChecklistModal from './CleanerChecklistModal';
import { cleanerAssignments, cleanerProfile } from '../../../data/demo-data';

export function generateStaticParams() {
  return cleanerAssignments.map((assignment) => ({ zoneId: assignment.id }));
}

export async function generateMetadata({ params }) {
  const { zoneId } = await params;
  const assignment = cleanerAssignments.find((item) => item.id === zoneId);
  return {
    title: assignment ? `${assignment.zone} · Cleaner Tasks` : 'Cleaner Tasks',
  };
}

export default async function CleanerZonePage({ params }) {
  const { zoneId } = await params;
  const assignment = cleanerAssignments.find((item) => item.id === zoneId);

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

  const remaining = assignment.tasks.filter((task) => task.status !== 'completed').length;

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
            <Link className="button secondary" href="/">Admin view</Link>
          </div>

          <div className="cleaner-strip">
            <div>
              <span className="muted">Cleaner</span>
              <strong>{cleanerProfile.name}</strong>
            </div>
            <div>
              <span className="muted">Shift</span>
              <strong>{assignment.shift}</strong>
            </div>
          </div>

          <div className="progress"><span style={{ width: `${assignment.progress}%` }} /></div>
          <div className="stat-row">
            <span className="flag">{assignment.stats.completed}/{assignment.stats.total} tasks completed</span>
            <span className="flag">{remaining} remaining</span>
            <span className="flag">{assignment.stats.photoRequired} forced photo checks</span>
            <span className="flag">Optional photos always available</span>
          </div>
        </section>

        <CleanerChecklistModal tasks={assignment.tasks} zoneName={assignment.zone} />

        <section className="card issue-card">
          <div>
            <h2>Something wrong?</h2>
            <p className="muted">Raise a site issue with photo proof so supervisors can review it.</p>
          </div>
          <button className="button secondary" type="button">Report issue</button>
        </section>
      </div>
    </main>
  );
}
