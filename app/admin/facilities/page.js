import Link from 'next/link';
import FacilityManager from './FacilityManager';
import { getPrisma } from '../../../lib/prisma';
import { readStaffPresenceMap, summarizePresence, formatAgo } from '../../../lib/staff-presence';

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

        <FacilityManager initialFacilities={[]} initialStaffStatuses={[]} source="unavailable" />
      </main>
    );
  }

  const [facilities, staff, recentExecutions, presenceMap] = await Promise.all([
    prisma.facility.findMany({
      orderBy: { facilityCode: 'asc' },
      select: {
        id: true,
        facilityCode: true,
        name: true,
        active: true,
      },
    }),
    prisma.staff.findMany({
      where: { active: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      select: { id: true, staffCode: true, fullName: true, role: true },
    }),
    prisma.taskExecution.findMany({
      where: { completedByStaffId: { not: null }, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 80,
      include: {
        completedByStaff: true,
        taskInstance: {
          include: {
            plannedFacility: true,
            facility: true,
            plannedZone: true,
            zone: true,
          },
        },
      },
    }),
    readStaffPresenceMap(prisma),
  ]);

  const latestExecutionByStaff = new Map();
  recentExecutions.forEach((execution) => {
    if (!execution.completedByStaffId || latestExecutionByStaff.has(execution.completedByStaffId)) return;
    latestExecutionByStaff.set(execution.completedByStaffId, execution);
  });

  const staffStatuses = staff.map((member) => {
    const presence = summarizePresence(presenceMap[member.id]);
    const latest = latestExecutionByStaff.get(member.id);
    const completedAt = latest?.completedAt ?? null;
    return {
      id: member.id,
      staffCode: member.staffCode,
      fullName: member.fullName,
      role: member.role,
      online: presence.online,
      lastSeenAt: presence.lastSeenAt,
      lastSeenAgo: presence.lastSeenAt ? formatAgo(presence.lastSeenAt) : 'Never seen',
      deviceCount: presence.deviceCount,
      lastTaskTitle: latest?.taskInstance?.titleSnapshot ?? null,
      lastTaskFacility: latest?.taskInstance?.plannedFacility?.name ?? latest?.taskInstance?.facility?.name ?? null,
      lastTaskZone: latest?.taskInstance?.plannedZone?.name ?? latest?.taskInstance?.zone?.name ?? null,
      lastTaskCompletedAt: completedAt?.toISOString() ?? null,
      lastTaskAgo: completedAt ? formatAgo(completedAt) : 'No completed tasks yet',
    };
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

      <FacilityManager initialFacilities={facilities} initialStaffStatuses={staffStatuses} source="prisma" />
    </main>
  );
}
