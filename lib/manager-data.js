import { scheduleBuilder, supervisorCards } from '../data/demo-data';
import { getPrisma } from './prisma';
import { getCleanerAssignments } from './cleaner-data';
import { listNotifications, recordNotification } from './notification-center';
import { runRuntimeMaintenance } from './runtime-maintenance';

function shouldUsePrisma() {
  return process.env.ENABLE_PRISMA_DATA !== 'false';
}

function getDemoManagerData() {
  return {
    publishedDays: scheduleBuilder.generatedInstances.length,
    activeShifts: 0,
    totalTasks: 0,
    completedTasks: 0,
    completionRate: 0,
    lowScoreTasks: [],
    exceptionTasks: [],
    facilitySummary: [],
    cleanerTrendCards: [],
    reviewHistory: [],
    alertCards: [],
    liveNotifications: [],
    unreadNotifications: 0,
    reportingCards: [],
    supervisorSnapshot: supervisorCards,
    source: 'demo',
  };
}

function makeShiftMeta(taskInstance) {
  return {
    location: taskInstance.plannedFacility?.name ?? taskInstance.facility.name,
    zone: taskInstance.plannedZone?.name ?? taskInstance.zone.name,
    staff: taskInstance.assignedStaff?.fullName ?? 'Unassigned',
    day: taskInstance.shiftRun?.shiftLabel ?? 'Shift',
  };
}

function formatWhen(value) {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Brisbane',
  }).format(new Date(value));
}

function getAgeHours(dateLike) {
  const value = new Date(dateLike).getTime();
  return Math.max(0, Math.round((Date.now() - value) / (60 * 60 * 1000)));
}

export async function getManagerOverviewData() {
  if (!shouldUsePrisma()) {
    return getDemoManagerData();
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return getDemoManagerData();
  }

  try {
    const maintenance = await runRuntimeMaintenance(prisma);

    const [assignmentsResult, taskAudits, taskExecutions, shiftRuns] = await Promise.all([
      getCleanerAssignments(),
      prisma.taskAudit.findMany({
        include: {
          taskInstance: {
            include: {
              assignedStaff: true,
              shiftRun: true,
              plannedFacility: true,
              plannedZone: true,
              plannedTaskGroup: true,
              facility: true,
              zone: true,
              taskGroup: true,
            },
          },
        },
        orderBy: { auditedAt: 'desc' },
      }),
      prisma.taskExecution.findMany({
        where: {
          issueRaised: true,
        },
        include: {
          photos: true,
          taskInstance: {
            include: {
              assignedStaff: true,
              shiftRun: true,
              plannedFacility: true,
              plannedZone: true,
              plannedTaskGroup: true,
              facility: true,
              zone: true,
              taskGroup: true,
              audits: {
                orderBy: { auditedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.shiftRun.findMany(),
    ]);

    const assignments = assignmentsResult.assignments;
    const publishedDays = shiftRuns.length;
    const activeShifts = assignments.length;
    const totalTasks = assignments.reduce((sum, shift) => sum + shift.stats.total, 0);
    const completedTasks = assignments.reduce((sum, shift) => sum + shift.stats.completed, 0);
    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const latestAuditMap = new Map();
    for (const audit of taskAudits) {
      if (!latestAuditMap.has(audit.taskInstanceId)) {
        latestAuditMap.set(audit.taskInstanceId, audit);
      }
    }

    const lowScoreTasks = Array.from(latestAuditMap.values())
      .filter((audit) => audit.auditScore <= 2)
      .map((audit) => ({
        id: audit.id,
        title: audit.taskInstance.titleSnapshot,
        taskGroup: audit.taskInstance.plannedTaskGroup?.name ?? audit.taskInstance.taskGroup.name,
        score: audit.auditScore,
        note: audit.auditComment,
        managerAction: audit.managerAction,
        shift: makeShiftMeta(audit.taskInstance),
      }));

    const exceptionTasks = await Promise.all(taskExecutions.map(async (execution) => {
      const latestAudit = execution.taskInstance.audits?.[0] ?? null;
      const ageHours = getAgeHours(execution.updatedAt);
      const latestManagerAction = latestAudit?.managerAction ?? 'none';
      await recordNotification('exception', execution.id, {
        title: execution.taskInstance.titleSnapshot,
        tone: latestManagerAction === 'reassign' ? 'amber' : 'red',
        note: `${execution.taskInstance.plannedFacility?.name ?? execution.taskInstance.facility.name} · ${execution.taskInstance.plannedZone?.name ?? execution.taskInstance.zone.name}`,
      });
      return {
        id: execution.id,
        title: execution.taskInstance.titleSnapshot,
        status: execution.taskInstance.status,
        note: execution.completionComment,
        photoCount: execution.photos.length,
        ageHours,
        latestManagerAction,
        photos: execution.photos.map((photo) => ({
          id: photo.id,
          photoType: photo.photoType,
          photoUrl: `/api/task-photos/${photo.id}`,
        })),
        shift: {
          location: execution.taskInstance.plannedFacility?.name ?? execution.taskInstance.facility.name,
          zone: execution.taskInstance.plannedZone?.name ?? execution.taskInstance.zone.name,
          staff: execution.taskInstance.assignedStaff?.fullName ?? 'Unassigned',
        },
      };
    }));

    const reviewHistory = taskAudits.slice(0, 12).map((audit) => ({
      id: audit.id,
      title: audit.taskInstance.titleSnapshot,
      location: audit.taskInstance.plannedFacility?.name ?? audit.taskInstance.facility.name,
      zone: audit.taskInstance.plannedZone?.name ?? audit.taskInstance.zone.name,
      note: audit.auditComment,
      managerAction: audit.managerAction,
      auditStatus: audit.auditStatus,
      when: formatWhen(audit.auditedAt),
    }));

    const facilitySummary = Array.from(
      assignments.reduce((map, shift) => {
        const existing = map.get(shift.location) || {
          location: shift.location,
          zones: new Set(),
          total: 0,
          completed: 0,
          lowScores: 0,
          openIssues: 0,
        };

        existing.zones.add(shift.zone);
        existing.total += shift.stats.total;
        existing.completed += shift.stats.completed;
        existing.lowScores += shift.tasks.filter((task) => (task.score ?? 0) <= 2 && task.score !== null).length;
        existing.openIssues += shift.tasks.filter((task) => task.status !== 'completed' && ((task.score ?? 0) <= 2 && task.score !== null)).length;
        map.set(shift.location, existing);
        return map;
      }, new Map()).values(),
    ).map((facility) => ({
      ...facility,
      zoneCount: facility.zones.size,
      completion: facility.total ? Math.round((facility.completed / facility.total) * 100) : 0,
      riskLevel: facility.lowScores >= 3 || facility.openIssues >= 4 ? 'High' : facility.lowScores >= 1 ? 'Watch' : 'Stable',
    }));

    const cleanerTrendCards = assignments
      .map((assignment) => ({
        staff: assignment.staff,
        completed: assignment.stats.completed,
        total: assignment.stats.total,
        completion: assignment.stats.total ? Math.round((assignment.stats.completed / assignment.stats.total) * 100) : 0,
        issueCount: assignment.tasks.filter((task) => (task.score ?? 0) <= 2 && task.score !== null).length,
      }))
      .sort((a, b) => b.issueCount - a.issueCount || a.completion - b.completion)
      .slice(0, 6);

    const alertCards = [
      exceptionTasks.length ? { tone: 'red', title: 'Open exceptions', note: `${exceptionTasks.length} issue items still need review or closure.` } : null,
      exceptionTasks.filter((task) => task.latestManagerAction === 'reassign' || task.status === 'carried_forward').length
        ? { tone: 'amber', title: 'Rework queue active', note: `${exceptionTasks.filter((task) => task.latestManagerAction === 'reassign' || task.status === 'carried_forward').length} tasks are back with the organiser.` }
        : null,
      maintenance.changed
        ? { tone: 'blue', title: 'Automation ran', note: `${maintenance.changed} overdue tasks were updated in the latest maintenance pass.` }
        : null,
    ].filter(Boolean);

    const reportingCards = [
      {
        title: 'Oldest open issue',
        value: exceptionTasks.length ? `${Math.max(...exceptionTasks.map((task) => task.ageHours))}h` : '0h',
        note: 'Age of the oldest exception still open',
        tone: exceptionTasks.some((task) => task.ageHours >= 24) ? 'red' : 'amber',
      },
      {
        title: 'Carry-forward queue',
        value: String(exceptionTasks.filter((task) => task.latestManagerAction === 'reassign' || task.status === 'carried_forward').length),
        note: 'Tasks waiting for organiser rescheduling',
        tone: exceptionTasks.some((task) => task.latestManagerAction === 'reassign' || task.status === 'carried_forward') ? 'amber' : 'green',
      },
      {
        title: 'Facilities at risk',
        value: String(facilitySummary.filter((facility) => facility.riskLevel !== 'Stable').length),
        note: 'Facilities with low-score or exception pressure',
        tone: facilitySummary.some((facility) => facility.riskLevel === 'High') ? 'red' : 'blue',
      },
    ];

    const snapshot = [
      { title: 'Live completion', value: `${completedTasks} / ${totalTasks}`, note: 'Across active cleaner assignments', tone: 'green' },
      { title: 'Open issues', value: String(exceptionTasks.length), note: 'Cleaner-reported follow-ups', tone: exceptionTasks.length ? 'red' : 'green' },
      { title: 'Low score tasks', value: String(lowScoreTasks.length), note: 'Tasks scored 1-2/5 needing review', tone: lowScoreTasks.length ? 'amber' : 'green' },
      { title: 'Published shifts', value: String(publishedDays), note: 'Shift runs in the seeded runtime window', tone: 'blue' },
    ];

    const liveNotifications = await listNotifications();
    const unreadNotifications = liveNotifications.filter((item) => !item.isRead).length;

    return {
      publishedDays,
      activeShifts,
      totalTasks,
      completedTasks,
      completionRate,
      lowScoreTasks,
      exceptionTasks,
      facilitySummary,
      cleanerTrendCards,
      reviewHistory,
      alertCards,
      liveNotifications,
      unreadNotifications,
      reportingCards,
      supervisorSnapshot: snapshot,
      source: assignmentsResult.source,
    };
  } catch {
    return getDemoManagerData();
  }
}
