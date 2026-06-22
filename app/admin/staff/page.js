import Link from 'next/link';
import StaffManager from './StaffManager';
import { getPrisma } from '../../../lib/prisma';
import { normalizeWeeklyRoster } from '../../../lib/staff-roster';

export const metadata = {
  title: 'Staff · Cienna Cleaning',
};

export const dynamic = 'force-dynamic';

function mapStaffRecord(member) {
  return {
    id: member.id,
    staffCode: member.staffCode,
    fullName: member.fullName,
    role: member.role,
    phone: member.phone ?? '',
    weeklyAvailability: normalizeWeeklyRoster(member.weeklyAvailability),
    active: member.active,
  };
}

export default async function StaffPage() {
  const prisma = await getPrisma();

  if (!prisma) {
    return (
      <main className="page admin-calendar-page">
        <div className="topbar">
          <div className="brand">
            <p>Cienna Cleaning Admin</p>
            <h1>Staff</h1>
          </div>
          <div className="badge-row">
            <Link className="button secondary" href="/">Back to dashboard</Link>
            <Link className="button secondary" href="/">Open dashboard</Link>
          </div>
        </div>

        <StaffManager initialStaff={[]} facilityOptions={[]} source="unavailable" />
      </main>
    );
  }

  const [staff, facilities] = await Promise.all([
    prisma.staff.findMany({
      orderBy: [{ fullName: 'asc' }],
      select: {
        id: true,
        staffCode: true,
        fullName: true,
        role: true,
        phone: true,
        weeklyAvailability: true,
        active: true,
      },
    }),
    prisma.facility.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        facilityCode: true,
      },
    }),
  ]);

  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Staff</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/">Open dashboard</Link>
          <span className="badge">Weekly roster</span>
        </div>
      </div>

      <StaffManager initialStaff={staff.map(mapStaffRecord)} facilityOptions={facilities} source="prisma" />
    </main>
  );
}
