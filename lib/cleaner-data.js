import { cleanerAssignments, cleanerProfile, cleanerShiftAssignments } from '../data/demo-data';
import { getPrisma } from './prisma';
import { runRuntimeMaintenance } from './runtime-maintenance';
import { getTaskInstanceBoardDate } from './task-scheduling';

const demoAssignments = [...cleanerAssignments, ...cleanerShiftAssignments];

const boardDayFormatter = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'Australia/Brisbane',
});

function shouldUsePrisma() {
  return process.env.ENABLE_PRISMA_DATA !== 'false';
}

function slugifyValue(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeCleanerShiftAssignmentId({ staff, day, facility, zone = 'facility' }) {
  return `shift-${slugifyValue(day)}-${slugifyValue(staff)}-${slugifyValue(facility)}-${slugifyValue(zone)}`;
}

function formatBoardDay(value) {
  return boardDayFormatter.format(new Date(value)).replace(',', '');
}

function parseExecutionGrade(comment = '') {
  const match = comment.match(/\[grade:(\d)\/5\]/i);
  return match ? Number(match[1]) : null;
}

function parseExecutionNote(comment = '') {
  return comment.replace(/\[grade:\d\/5\]\s*/i, '').trim();
}

function buildComment({ grade, note }) {
  const parts = [];
  if (Number.isInteger(grade)) {
    parts.push(`[grade:${grade}/5]`);
  }
  if (note?.trim()) {
    parts.push(note.trim());
  }
  return parts.join('\n');
}

function mapInstanceTask(instance) {
  const comment = instance.execution?.completionComment ?? '';
  const grade = parseExecutionGrade(comment);
  const note = parseExecutionNote(comment);

  return {
    id: instance.id,
    title: instance.titleSnapshot,
    status: instance.status === 'in_progress' ? 'in-progress' : instance.status,
    photoRequired: instance.evidenceRequirement === 'required_photo' || instance.evidenceRequirement === 'multi_photo',
    commentRequired: instance.commentRequirement === 'always' || instance.commentRequirement === 'on_exception',
    taskGroup: instance.plannedTaskGroup?.name ?? instance.taskGroup.name,
    score: grade,
    note,
    photoCount: instance.execution?.photos?.length ?? 0,
    photos: (instance.execution?.photos ?? []).map((photo) => ({
      id: photo.id,
      photoType: photo.photoType,
      photoUrl: `/api/task-photos/${photo.id}`,
    })),
  };
}

function buildPrismaAssignment(id, instances) {
  const first = instances[0];
  const orderedInstances = [...instances].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const total = orderedInstances.length;
  const completedTarget = Math.min(total, Math.round(total * 0.6));
  const inProgressIndex = completedTarget < total ? completedTarget : -1;
  const photoRequired = instances.filter((instance) => instance.evidenceRequirement === 'required_photo' || instance.evidenceRequirement === 'multi_photo').length;
  const zoneNames = [...new Set(instances.map((instance) => instance.plannedZone?.name ?? instance.zone.name).filter(Boolean))];

  const tasks = orderedInstances.map((instance, index) => {
    const mapped = mapInstanceTask(instance);
    if (index < completedTarget) {
      return { ...mapped, status: 'completed' };
    }
    if (index === inProgressIndex) {
      return { ...mapped, status: 'in-progress' };
    }
    return { ...mapped, status: mapped.photoRequired && index % 8 === 0 ? 'photo-required' : 'pending' };
  });

  return {
    id,
    location: first.plannedFacility?.name ?? first.facility.name,
    zone: zoneNames[0] ?? (first.plannedZone?.name ?? first.zone.name),
    zones: zoneNames,
    staff: first.assignedStaff?.fullName ?? cleanerProfile.name,
    day: formatBoardDay(getTaskInstanceBoardDate(first)),
    shift: first.shiftRun?.shiftLabel ?? cleanerProfile.nextShift,
    routeLabel: first.shiftRun?.routeLabel ?? '',
    progress: total ? Math.round((completedTarget / total) * 100) : 0,
    stats: {
      total,
      completed: completedTarget,
      photoRequired,
    },
    tasks,
  };
}

async function getPrismaAssignments() {
  const prisma = await getPrisma();
  if (!prisma) {
    return null;
  }

  const instances = await prisma.taskInstance.findMany({
    where: {
      assignedStaffId: { not: null },
      plannedFacilityId: { not: null },
      plannedZoneId: { not: null },
    },
    include: {
      assignedStaff: true,
      shiftRun: true,
      facility: true,
      zone: true,
      taskGroup: true,
      plannedFacility: true,
      plannedZone: true,
      plannedTaskGroup: true,
      execution: {
        include: {
          photos: true,
        },
      },
    },
    orderBy: [
      { dueAt: 'asc' },
      { sequence: 'asc' },
    ],
  });

  const grouped = new Map();

  for (const instance of instances) {
    const staff = instance.assignedStaff?.fullName;
    const facility = instance.plannedFacility?.name ?? instance.facility.name;
    const day = formatBoardDay(getTaskInstanceBoardDate(instance));

    if (!staff || !facility) {
      continue;
    }

    const id = makeCleanerShiftAssignmentId({ staff, day, facility, zone: 'facility' });
    if (!grouped.has(id)) {
      grouped.set(id, []);
    }
    grouped.get(id).push(instance);
  }

  return Array.from(grouped.entries()).map(([id, assignmentInstances]) => buildPrismaAssignment(id, assignmentInstances));
}

export async function getCleanerAssignments() {
  if (!shouldUsePrisma()) {
    return { assignments: demoAssignments, source: 'demo' };
  }

  try {
    const assignments = await getPrismaAssignments();
    if (!assignments?.length) {
      return { assignments: demoAssignments, source: 'demo-fallback' };
    }
    return { assignments, source: 'prisma' };
  } catch {
    return { assignments: demoAssignments, source: 'demo-fallback' };
  }
}

export async function getCleanerAssignment(zoneId) {
  const { assignments, source } = await getCleanerAssignments();
  return {
    assignment: assignments.find((item) => item.id === zoneId) ?? null,
    source,
  };
}

export { buildComment, parseExecutionGrade, parseExecutionNote };
