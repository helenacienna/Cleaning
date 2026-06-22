import Link from 'next/link';
import FacilityManager from './FacilityManager';
import { getPrisma } from '../../../lib/prisma';

export const metadata = {
  title: 'Facilities · Cienna Cleaning',
};

export const dynamic = 'force-dynamic';

export default async function FacilitiesPage() {
  const prisma = await getPrisma();

  if (!prisma) {
    return (
      <main className="page admin-calendar-page">
        <div className="topbar">
          <div className="brand">
            <p>Cienna Cleaning Admin</p>
            <h1>Facilities</h1>
          </div>
          <div className="badge-row">
            <Link className="button secondary" href="/">Back to dashboard</Link>
            <Link className="button secondary" href="/">Open dashboard</Link>
          </div>
        </div>

        <FacilityManager initialFacilities={[]} source="unavailable" />
      </main>
    );
  }

  const facilities = await prisma.facility.findMany({
    orderBy: { facilityCode: 'asc' },
    select: {
      id: true,
      facilityCode: true,
      name: true,
      active: true,
    },
  });

  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Facilities</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/">Open dashboard</Link>
          <span className="badge">Facility management</span>
        </div>
      </div>

      <FacilityManager initialFacilities={facilities} source="prisma" />
    </main>
  );
}
