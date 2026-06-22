import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'QR workflow parked · Cienna Cleaning',
};

export default async function CleanerZonePage() {
  return (
    <main className="page compact-page">
      <section className="card">
        <span className="badge">Future feature</span>
        <h1>QR entry is parked for now</h1>
        <p className="muted">To keep testing simple, cleaners should open their daily work from the staff landing page instead of scanning QR codes.</p>
        <div className="workflow-banner-actions" style={{ marginTop: 16 }}>
          <Link className="button primary" href="/cleaner">Open staff landing</Link>
          <Link className="button secondary" href="/">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
