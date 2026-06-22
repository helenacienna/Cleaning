import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard-first workflow · Cienna Cleaning',
};

export default async function DailyHierarchyPage() {
  return (
    <main className="page admin-calendar-page daily-hierarchy-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Dashboard-first workflow</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <span className="badge">Legacy board retired</span>
        </div>
      </div>

      <section className="workflow-banner no-top-gap">
        <div>
          <span className="badge">Workflow</span>
          <strong>The main dashboard is now the single planning surface. The standalone legacy board has been retired from the workflow.</strong>
        </div>
        <div className="workflow-banner-actions">
          <Link className="button secondary" href="/admin/inbox">Operations inbox</Link>
          <Link className="button secondary" href="/admin/task-cards">Task card library</Link>
          <Link className="button secondary" href="/">Open main dashboard</Link>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <strong>Legacy board removed from active use</strong>
        <div className="muted">Daily planning and staff organisation now happen from the main dashboard so there is only one authoritative planning surface.</div>
      </section>
    </main>
  );
}
