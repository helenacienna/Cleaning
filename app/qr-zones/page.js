import Link from 'next/link';
import { qrZones } from '../../data/demo-data';

export const metadata = {
  title: 'QR Zone Codes · Cienna Cleaning',
};

export default function QrZonesPage() {
  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>QR zone codes</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <span className="badge">Prototype links active</span>
        </div>
      </div>

      <section className="card">
        <div className="panel-title">
          <div>
            <h3>Zone QR library</h3>
            <p className="muted">Print one code per physical cleaning zone. Scanning opens the cleaner task list for that location.</p>
          </div>
          <span className="badge">{qrZones.length} zones</span>
        </div>
        <div className="qr-grid">
          {qrZones.map((zone) => (
            <Link className="qr-card" href={zone.qrUrl} key={zone.id}>
              <div className="fake-qr" aria-hidden="true">
                <span /><span /><span /><span /><span /><span /><span /><span /><span />
              </div>
              <div>
                <strong>{zone.label}</strong>
                <p className="muted">{zone.location}</p>
                <span className="flag">{zone.code}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
