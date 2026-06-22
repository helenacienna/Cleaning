import Link from 'next/link';

export const metadata = {
  title: 'QR workflow parked · Cienna Cleaning',
};

export default function QrZonesPage() {
  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>QR workflow parked</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <span className="badge">Future feature</span>
        </div>
      </div>

      <section className="card">
        <div className="panel-title">
          <div>
            <h3>Cleaner access is simplified for now</h3>
            <p className="muted">The QR-based entry flow has been removed from active use during testing. Cleaners should open their daily work from the staff landing page instead.</p>
          </div>
        </div>

        <div className="workflow-banner-actions" style={{ marginTop: 16 }}>
          <Link className="button primary" href="/cleaner">Open staff landing</Link>
          <Link className="button secondary" href="/admin/staff">Open staff admin</Link>
        </div>
      </section>
    </main>
  );
}
