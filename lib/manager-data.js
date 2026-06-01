import { scheduleBuilder, supervisorCards } from '../data/demo-data';
import { getPrisma } from './prisma';
import { getCleanerAssignments } from './cleaner-data';

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
    supervisorSnapshot: supervisorCards,
    source: 'demo',
  };
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
    const [assignmentsResult, taskAudits, taskExecutions, shiftRuns] = await Promise.all([
      getCleanerAssignments(),
      prisma.taskAudit.findMany({
        include: {
          taskInstance: {
            include: {
              assignedStaff: true,
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

    const lowScoreTasks = taskAudits
      .filter((audit) => audit.auditScore <= 2)
      .map((audit) => ({
        id: audit.id,
        title: audit.taskInstance.titleSnapshot,
        taskGroup: audit.taskInstance.plannedTaskGroup?.name ?? audit.taskInstance.taskGroup.name,
        score: audit.auditScore,
        note: audit.auditComment,
        shift: {
          location: audit.taskInstance.plannedFacility?.name ?? audit.taskInstance.facility.name,
          zone: audit.taskInstance.plannedZone?.name ?? audit.taskInstance.zone.name,
          staff: audit.taskInstance.assignedStaff?.fullName ?? 'Unassigned',
          day: audit.taskInstance.shiftRun?.shiftLabel ?? 'Shift',
        },
      }));

    const exceptionTasks = taskExecutions.map((execution) => ({
      id: execution.id,
      title: execution.taskInstance.titleSnapshot,
      status: execution.taskInstance.status,
      note: execution.completionComment,
      photoCount: execution.photos.length,
      photos: execution.photos.map((photo) => ({
        id: photo.id,
        photoType: photo.photoType,
        photoUrl: photo.photoUrl,
      })),
      shift: {
        location: execution.taskInstance.plannedFacility?.name ?? execution.taskInstance.facility.name,
        zone: execution.taskInstance.plannedZone?.name ?? execution.taskInstance.zone.name,
        staff: execution.taskInstance.assignedStaff?.fullName ?? 'Unassigned',
      },
    }));

    const facilitySummary = Array.from(
      assignments.reduce((map, shift) => {
        const existing = map.get(shift.location) || {
          location: shift.location,
          zones: new Set(),
          total: 0,
          completed: 0,
          lowScores: 0,
        };

        existing.zones.add(shift.zone);
        existing.total += shift.stats.total;
        existing.completed += shift.stats.completed;
        existing.lowScores += shift.tasks.filter((task) => (task.score ?? 0) <= 2 && task.score !== null).length;
        map.set(shift.location, existing);
        return map;
      }, new Map()).values(),
    ).map((facility) => ({
      ...facility,
      zoneCount: facility.zones.size,
      completion: facility.total ? Math.round((facility.completed / facility.total) * 100) : 0,
    }));

    const snapshot = [
      { title: 'Live completion', value: `${completedTasks} / ${totalTasks}`, note: 'Across active cleaner assignments', tone: 'green' },
      { title: 'Open issues', value: String(exceptionTasks.length), note: 'Cleaner-reported follow-ups', tone: exceptionTasks.length ? 'red' : 'green' },
      { title: 'Low score tasks', value: String(lowScoreTasks.length), note: 'Tasks scored 1-2/5 needing review', tone: lowScoreTasks.length ? 'amber' : 'green' },
      { title: 'Published shifts', value: String(publishedDays), note: 'Shift runs in the seeded runtime window', tone: 'blue' },
    ];

    return {
      publishedDays,
      activeShifts,
      totalTasks,
      completedTasks,
      completionRate,
      lowScoreTasks,
      exceptionTasks,
      facilitySummary,
      supervisorSnapshot: snapshot,
      source: assignmentsResult.source,
    };
  } catch {
    return getDemoManagerData();
  }
}
