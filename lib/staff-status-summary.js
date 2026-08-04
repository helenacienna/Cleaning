import { getPrisma } from './prisma.js';
import { readStaffPresenceMap, summarizePresence, formatAgo } from './staff-presence.js';
import { formatStaffRole } from './staff-role-label.js';

export async function getStaffStatusSummaries(prismaArg = null) {
  const prisma = prismaArg ?? await getPrisma();
  if (!prisma) return [];

  const [staff, recentExecutions, presenceMap] = await Promise.all([
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

  return staff.map((member) => {
    const presence = summarizePresence(presenceMap[member.id]);
    const latest = latestExecutionByStaff.get(member.id);
    const completedAt = latest?.completedAt ?? null;
    return {
      id: member.id,
      staffCode: member.staffCode,
      fullName: member.fullName,
      role: member.role,
      roleLabel: formatStaffRole(member.role),
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
}
