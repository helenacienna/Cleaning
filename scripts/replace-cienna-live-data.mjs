import { randomUUID } from 'node:crypto';
import { getPrisma } from '../lib/prisma.js';

const prisma = await getPrisma();

if (!prisma) {
  throw new Error('Database unavailable');
}

const CIENNA_ZONES = [
  {
    zone: 'Visitor Carpark',
    tasks: [
      'Parcel locker cleaned',
      'Cobweb Inspection',
      'Rubbish Inspection',
      'Floor to be blown for dust',
      'Height bar cleaned',
      'Height bar inspected',
      'Exit signs cleaned',
      'Parking & fire signs clean and visible',
    ],
  },
  {
    zone: 'Driveway and loading bay',
    tasks: [
      'Clean signs - loading bay',
      'Inspect signs - loading bay',
      'Fire pump area for leaves and rubbish',
      'Inspect clearance bar',
      'Check for overgrown trees and scrubs',
    ],
  },
  {
    zone: 'B2 Carpark',
    tasks: [
      'General rubbish laying around',
      'Mailboxes T3 for cobwebs and rubbish',
      'Mailboxes T4 for cobwebs and rubbish',
      'Inspect fire hose reels',
      'Inspect fire extinguishers',
      'Inspect lights',
      'Inspect signage and mirrors',
      'Clean Signage and mirrors',
      'Check for cobwebs on cameras',
      'Check for cobwebs on lights',
      'Check for cobwebs sprinkler system',
      'Check for cobwebs on exit signs',
      'Check fire stairs for rubbish & leaves',
      'Check fire stairs drains and cobwebs',
      'Clean power points',
    ],
  },
  {
    zone: 'Stairs from visitor carpark to B1 near cafe lift',
    tasks: [
      'Check hand rails all the way up to ground floor',
      'Check for cobwebs',
      'Check for lower floor lift area just under cafe (Leaves etc)',
      'Check lights along stairwell and check black lights near lifts',
      'Check exit signs',
      'Dust air vent towards cafe',
      'Check white fence along cafe pathway',
      'Check stairs from cafe toilets to reception for weeds',
      'Check stairs from cafe toilets to reception leaves & rubbish',
      'Cafe toilets to reception check hand rails',
      'Check glass at top of stairs',
      'Check air vents near cafe toilets',
      'Check drain in front of cafe toilets',
    ],
  },
  {
    zone: 'Reception outdoor area',
    tasks: [
      'Check for rubbish',
      'Check mini lift',
      'Check for cobwebs',
      'Check for weeds',
      'Check seat and reception signs',
      'Check white rails',
      'Check cameras',
      'Check walls for dog urine',
    ],
  },
  {
    zone: 'Main Foyer Building 4',
    tasks: [
      'Inspect window sills of main door',
      'Inspect all corners of walls for cobwebs',
      'Inspect artificial plants for cobwebs and insects',
      'Check on-top of defibrillator for dust',
      'Check big mirror in lobby',
      'Check the standing lights',
      'Check for dust on-top of paintings',
      'Check sliding door sills',
      'Clean skirting boards',
      'Check and clean air vent near bin chute',
      'Check bin chute and bin chute floor',
      'Check fire stairs',
      'Check fire extinguisher',
      'Dust air vent near lift',
    ],
  },
  {
    zone: 'B1 Carpark',
    tasks: [
      'Check for general rubbish laying around',
      'Check fire extinguishers and reels',
      'Check signage and mirrors',
      'Check for cobwebs (On lights, signage, sprinkler system, cameras)',
      'Clean yellow safety poles (Near lifts, pipes and gym stairs)',
      'Clean power points (More so on top of them) (Do not use product)',
      'Check fire stairs for rubbish , leaves and cobwebs',
      'Check and clean service lift near the gym',
    ],
  },
  {
    zone: 'Rooftop',
    tasks: [
      'Inspect bin chute',
      'Inspect all furniture (Sun chairs and tables)',
      'Inspect gardens (Including the 3 big pot plants)',
      'Check for cobwebs (Including the black garden lights and cameras)',
      'Inspect fire blankets and fire extinguishers (Both ends)',
      'Inspect power points',
      'Inspect all signage for damage, cobwebs',
      'Inspect tiled floor',
      'Inspect bathroom is it clean',
      'Inspect bathroom for toilet paper',
      'Inspect fire doors (Both ends)',
      'Inspect glass is clean',
      "Inspect BBQ's are clean",
    ],
  },
];

function slugify(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function startOfDay(value) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildInstanceCode(templateCode, dueAt) {
  const stamp = dueAt.toISOString().slice(0, 10).replace(/-/g, '');
  const time = `${String(dueAt.getUTCHours()).padStart(2, '0')}${String(dueAt.getUTCMinutes()).padStart(2, '0')}`;
  return `${templateCode}-D${stamp}-T${time}`;
}

function getStatusBucket({ openInstanceCount, unscheduledInstanceCount, lastCompletedAt, nextDueAt }) {
  if (unscheduledInstanceCount > 0) return 'unscheduled';
  if (openInstanceCount > 0 && nextDueAt) return 'due';
  if (lastCompletedAt) return 'completed_recently';
  return 'upcoming';
}

async function main() {
  const facility = await prisma.facility.findFirst({ where: { name: 'Cienna' } });
  if (!facility) throw new Error('Cienna facility not found');

  const ciennaTemplates = await prisma.taskTemplate.findMany({
    where: { facilityId: facility.id },
    select: { id: true },
  });
  const templateIds = ciennaTemplates.map((row) => row.id);

  const ciennaInstances = await prisma.taskInstance.findMany({
    where: { facilityId: facility.id },
    select: { id: true },
  });
  const instanceIds = ciennaInstances.map((row) => row.id);

  const executionIds = instanceIds.length
    ? (await prisma.taskExecution.findMany({
        where: { taskInstanceId: { in: instanceIds } },
        select: { id: true },
      })).map((row) => row.id)
    : [];

  const shiftRuns = await prisma.shiftRun.findMany({
    where: {
      assignedStaff: { is: { role: 'cleaner', active: true } },
    },
    select: {
      id: true,
      runDate: true,
      shiftStartAt: true,
      assignedStaffId: true,
    },
    orderBy: [
      { runDate: 'asc' },
      { shiftStartAt: 'asc' },
    ],
  });

  const runsByDay = new Map();
  for (const run of shiftRuns) {
    const dayKey = run.runDate.toISOString().slice(0, 10);
    if (!runsByDay.has(dayKey)) runsByDay.set(dayKey, []);
    runsByDay.get(dayKey).push(run);
  }

  const zoneRows = [];
  const groupRows = [];
  const templateRows = [];
  let templateSequence = 1;

  for (let zoneIndex = 0; zoneIndex < CIENNA_ZONES.length; zoneIndex += 1) {
    const zoneBlueprint = CIENNA_ZONES[zoneIndex];
    const zoneId = randomUUID();
    const zoneCode = `Z${String(zoneIndex + 1).padStart(2, '0')}`;
    const fullZoneCode = `${facility.facilityCode}-${zoneCode}`;

    zoneRows.push({
      id: zoneId,
      facilityId: facility.id,
      zoneCode,
      fullZoneCode,
      name: zoneBlueprint.zone,
      qrSlug: `${facility.facilityCode.toLowerCase()}-${slugify(zoneBlueprint.zone)}`,
      active: true,
    });

    const groupId = randomUUID();
    const groupCode = 'G01';
    const fullGroupCode = `${fullZoneCode}-${groupCode}`;
    const groupName = `${zoneBlueprint.zone} walk-through`;

    groupRows.push({
      id: groupId,
      facilityId: facility.id,
      zoneId,
      groupCode,
      fullGroupCode,
      name: groupName,
      sequence: 1,
      active: true,
    });

    for (let taskIndex = 0; taskIndex < zoneBlueprint.tasks.length; taskIndex += 1) {
      const title = zoneBlueprint.tasks[taskIndex];
      const taskTemplateCode = `${fullGroupCode}-T${String(templateSequence).padStart(3, '0')}`;
      templateRows.push({
        id: randomUUID(),
        taskTemplateCode,
        facilityId: facility.id,
        zoneId,
        taskGroupId: groupId,
        title,
        description: `${groupName} · ${zoneBlueprint.zone} · ${facility.name}`,
        serviceType: 'routine',
        recurrenceType: 'daily',
        recurrenceRule: null,
        targetDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        preferredTimeWindow: 'flexible',
        defaultSequence: templateSequence,
        estimatedMinutes: 8,
        priority: 'critical',
        evidenceRequirement: 'none',
        commentRequirement: 'none',
        passCriteria: `Complete ${title.toLowerCase()} to site standard.`,
        autoGenerateInstances: true,
        requiresPlanning: true,
        canBeSplit: false,
        canBeMovedBetweenStaff: true,
        requiresManagerApprovalToSkip: false,
        missedTaskPolicy: 'carry_forward',
        rescheduleWindowDays: 2,
        active: true,
      });
      templateSequence += 1;
    }
  }

  const instanceRows = [];
  for (const [dayKey, dayRuns] of [...runsByDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const baseStart = dayRuns[0]?.shiftStartAt ?? new Date(`${dayKey}T06:00:00.000Z`);

    templateRows.forEach((template, index) => {
      const assignedRun = dayRuns[index % dayRuns.length] ?? null;
      const dueAt = addMinutes(baseStart, index * 8);
      instanceRows.push({
        id: randomUUID(),
        instanceCode: buildInstanceCode(template.taskTemplateCode, dueAt),
        taskTemplateId: template.id,
        shiftRunId: assignedRun?.id ?? null,
        facilityId: facility.id,
        zoneId: template.zoneId,
        taskGroupId: template.taskGroupId,
        plannedFacilityId: facility.id,
        plannedZoneId: template.zoneId,
        plannedTaskGroupId: template.taskGroupId,
        titleSnapshot: template.title,
        descriptionSnapshot: `${template.description} · Scheduled instance for ${dayKey}`,
        sourceType: 'auto_generated',
        dueAt,
        planningDueAt: addMinutes(dueAt, -24 * 60),
        scheduledForAt: dueAt,
        assignedStaffId: assignedRun?.assignedStaffId ?? null,
        plannedRunDate: startOfDay(`${dayKey}T00:00:00.000Z`),
        sequence: index + 1,
        status: assignedRun ? 'scheduled' : 'unscheduled',
        priority: template.priority,
        evidenceRequirement: template.evidenceRequirement,
        commentRequirement: template.commentRequirement,
        estimatedMinutes: template.estimatedMinutes,
        isExceptionTask: false,
        manuallyCreated: false,
      });
    });
  }

  const statusRows = templateRows.map((template) => {
    const templateInstances = instanceRows.filter((row) => row.taskTemplateId === template.id);
    const nextDueAt = templateInstances[0]?.dueAt ?? null;
    const unscheduledInstanceCount = templateInstances.filter((row) => row.status === 'unscheduled').length;
    return {
      taskTemplateId: template.id,
      lastCompletedAt: null,
      lastCompletedInstanceId: null,
      nextDueAt,
      nextPlanningDueAt: nextDueAt ? addMinutes(nextDueAt, -24 * 60) : null,
      overdueSinceAt: null,
      openInstanceCount: templateInstances.length,
      unscheduledInstanceCount,
      statusBucket: getStatusBucket({ openInstanceCount: templateInstances.length, unscheduledInstanceCount, lastCompletedAt: null, nextDueAt }),
    };
  });

  await prisma.$transaction(async (tx) => {
    if (instanceIds.length) {
      await tx.taskAudit.deleteMany({ where: { taskInstanceId: { in: instanceIds } } });
      if (executionIds.length) {
        await tx.taskPhoto.deleteMany({ where: { taskExecutionId: { in: executionIds } } });
      }
      await tx.taskExecution.deleteMany({ where: { taskInstanceId: { in: instanceIds } } });
      await tx.taskInstance.deleteMany({ where: { id: { in: instanceIds } } });
    }

    if (templateIds.length) {
      await tx.taskTemplateStatus.deleteMany({ where: { taskTemplateId: { in: templateIds } } });
      await tx.taskTemplate.deleteMany({ where: { id: { in: templateIds } } });
    }

    await tx.taskGroup.deleteMany({ where: { facilityId: facility.id } });
    await tx.zone.deleteMany({ where: { facilityId: facility.id } });

    await tx.zone.createMany({ data: zoneRows });
    await tx.taskGroup.createMany({ data: groupRows });
    await tx.taskTemplate.createMany({ data: templateRows });
    await tx.taskInstance.createMany({ data: instanceRows });
    await tx.taskTemplateStatus.createMany({ data: statusRows });
  }, {
    maxWait: 10_000,
    timeout: 120_000,
  });

  console.log(JSON.stringify({
    ok: true,
    facility: facility.name,
    zonesCreated: zoneRows.length,
    groupsCreated: groupRows.length,
    templatesCreated: templateRows.length,
    instancesCreated: instanceRows.length,
    daysCovered: runsByDay.size,
    assumption: 'All pasted tasks treated as daily undated live checklist items',
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
