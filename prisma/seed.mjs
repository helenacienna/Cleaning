import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import crypto from 'node:crypto';

const facilities = ['Cienna North', 'Cienna Central', 'Cienna South'];

const staffBlueprints = [
  {
    staffCode: 'STF001',
    fullName: 'Mia Thompson',
    role: 'cleaner',
    shiftLabel: 'Morning flexible shift',
    routeLabel: 'Cienna North → Cienna Central → Cienna North',
    shiftStart: '06:00',
    shiftEnd: '14:00',
    routes: [
      { facility: 'Cienna North', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3'], laneIndexes: [0] },
      { facility: 'Cienna Central', zones: ['Residents lounge', 'Pool area', 'Carparks', 'Gym'], laneIndexes: [1, 2] },
      { facility: 'Cienna North', zones: ['Mail room', 'Loading dock'], laneIndexes: [3] },
    ],
  },
  {
    staffCode: 'STF002',
    fullName: 'Leo Nguyen',
    role: 'cleaner',
    shiftLabel: 'Day flexible shift',
    routeLabel: 'Cienna Central → Cienna South → Cienna North',
    shiftStart: '07:30',
    shiftEnd: '15:30',
    routes: [
      { facility: 'Cienna Central', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3', 'Residents lounge'], laneIndexes: [1, 2] },
      { facility: 'Cienna South', zones: ['Pool area', 'Carparks', 'Gym'], laneIndexes: [3] },
      { facility: 'Cienna North', zones: ['Mail room', 'Loading dock'], laneIndexes: [4] },
    ],
  },
  {
    staffCode: 'STF003',
    fullName: 'Ava Patel',
    role: 'cleaner',
    shiftLabel: 'Late flexible shift',
    routeLabel: 'Cienna South → Cienna North → Cienna Central',
    shiftStart: '09:00',
    shiftEnd: '17:00',
    routes: [
      { facility: 'Cienna South', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3'], laneIndexes: [3] },
      { facility: 'Cienna North', zones: ['Residents lounge', 'Pool area', 'Carparks', 'Gym'], laneIndexes: [4, 5] },
      { facility: 'Cienna Central', zones: ['Mail room', 'Loading dock'], laneIndexes: [6] },
    ],
  },
];

const boardDates = [
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
];

const zoneBlueprints = [
  { code: 'Z01', zone: 'Rooftop', groups: [
    { code: 'G01', name: 'Rooftop presentation', tasks: ['Clear tables', 'Wipe handrails'] },
    { code: 'G02', name: 'BBQ area reset', tasks: ['Clean BBQ surrounds', 'Check outdoor bins'] },
    { code: 'G03', name: 'Planter perimeter', tasks: ['Sweep planter edges', 'Remove loose litter'] },
  ]},
  { code: 'Z02', zone: 'Lifts', groups: [
    { code: 'G01', name: 'Lift refresh', tasks: ['Polish lift mirrors', 'Wipe buttons and rails'] },
    { code: 'G02', name: 'Lift foyer detail', tasks: ['Vacuum lift foyer mats', 'Spot clean foyer glass'] },
    { code: 'G03', name: 'Button sanitising', tasks: ['Sanitise call buttons', 'Wipe door tracks'] },
  ]},
  { code: 'Z03', zone: 'Entry t4', groups: [
    { code: 'G01', name: 'Toilet block', tasks: ['Clean toilets', 'Mop floor'] },
    { code: 'G02', name: 'Entry detail', tasks: ['Vacuum mats', 'Wipe intercom panel'] },
    { code: 'G03', name: 'Glass presentation', tasks: ['Spot clean glass', 'Remove marks from doors'] },
  ]},
  { code: 'Z04', zone: 'Entry t3', groups: [
    { code: 'G01', name: 'Toilet block', tasks: ['Check toilet paper', 'Wipe basins and mirrors'] },
    { code: 'G02', name: 'Entry detail', tasks: ['Check entrance presentation', 'Clean skirting edges'] },
    { code: 'G03', name: 'Mail lobby reset', tasks: ['Tidy parcel shelves', 'Wipe lobby bench'] },
  ]},
  { code: 'Z05', zone: 'Residents lounge', groups: [
    { code: 'G01', name: 'Residents lounge touch-up', tasks: ['Wipe tables', 'Arrange cushions and chairs'] },
    { code: 'G02', name: 'Kitchenette reset', tasks: ['Clean kitchenette bench', 'Restock paper towel'] },
    { code: 'G03', name: 'Soft furnishing check', tasks: ['Vacuum lounge floor', 'Spot clean upholstery'] },
  ]},
  { code: 'Z06', zone: 'Pool area', groups: [
    { code: 'G01', name: 'Pool deck reset', tasks: ['Check pool furniture', 'Rinse high-traffic patches'] },
    { code: 'G02', name: 'Amenities wipe-down', tasks: ['Wipe gate handles', 'Clean shower touch points'] },
    { code: 'G03', name: 'Safety inspection', tasks: ['Check safety signage', 'Remove leaf litter'] },
  ]},
  { code: 'Z07', zone: 'Carparks', groups: [
    { code: 'G01', name: 'Carpark round', tasks: ['Pick litter', 'Blow leaves from corners'] },
    { code: 'G02', name: 'Bin bay detail', tasks: ['Check bin bays', 'Degrease bin bay handles'] },
    { code: 'G03', name: 'Access ramp tidy', tasks: ['Spot clean entry doors', 'Inspect trolley area'] },
  ]},
  { code: 'Z08', zone: 'Gym', groups: [
    { code: 'G01', name: 'Gym floor care', tasks: ['Vacuum gym floor', 'Mop rubber flooring'] },
    { code: 'G02', name: 'Equipment wipe-down', tasks: ['Sanitise cardio equipment', 'Wipe free weights'] },
    { code: 'G03', name: 'Mirror presentation', tasks: ['Polish wall mirrors', 'Check drink station'] },
  ]},
  { code: 'Z09', zone: 'Mail room', groups: [
    { code: 'G01', name: 'Parcel room reset', tasks: ['Tidy parcel shelving', 'Sweep parcel room floor'] },
    { code: 'G02', name: 'Locker wipe-down', tasks: ['Wipe locker doors', 'Check fingerprint marks'] },
    { code: 'G03', name: 'Waste detail', tasks: ['Empty bins', 'Replace liners'] },
  ]},
  { code: 'Z10', zone: 'Loading dock', groups: [
    { code: 'G01', name: 'Dock sweep', tasks: ['Sweep loading dock', 'Remove cardboard scraps'] },
    { code: 'G02', name: 'Roller door check', tasks: ['Wipe roller door handles', 'Check scuff marks near door'] },
    { code: 'G03', name: 'Back-of-house tidy', tasks: ['Tidy delivery corner', 'Check back-of-house bins'] },
  ]},
];

function slugify(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function uuidFor(key) {
  return crypto.createHash('md5').update(key).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to run the seed.');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

function parseTimeOnDate(dateText, timeText) {
  const [hours, minutes] = timeText.split(':').map(Number);
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function findStaffRoute(facilityName, zoneName) {
  for (const staff of staffBlueprints) {
    for (const route of staff.routes) {
      if (route.facility === facilityName && route.zones.includes(zoneName)) {
        return { staff, route };
      }
    }
  }

  return { staff: staffBlueprints[0], route: staffBlueprints[0].routes[0] };
}

async function resetData(prisma) {
  await prisma.taskPhoto.deleteMany();
  await prisma.taskExecution.deleteMany();
  await prisma.taskAudit.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.taskTemplateStatus.deleteMany();
  await prisma.taskInstance.deleteMany();
  await prisma.taskTemplate.deleteMany();
  await prisma.shiftRun.deleteMany();
  await prisma.taskGroup.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.facility.deleteMany();
}

async function main() {
  const { prisma, pool } = createPrisma();

  try {
    await resetData(prisma);

    const facilityRows = facilities.map((name, index) => ({
      id: uuidFor(`facility:${index + 1}`),
      facilityCode: `FAC${String(index + 1).padStart(2, '0')}`,
      name,
      active: true,
    }));

    await prisma.facility.createMany({ data: facilityRows });

    const zoneRows = [];
    const groupRows = [];
    const templateRows = [];
    const statusRows = [];

    let templateCounter = 1;

    for (const facility of facilityRows) {
      for (const zoneBlueprint of zoneBlueprints) {
        const zoneId = uuidFor(`zone:${facility.facilityCode}:${zoneBlueprint.code}`);
        const fullZoneCode = `${facility.facilityCode}-${zoneBlueprint.code}`;

        zoneRows.push({
          id: zoneId,
          facilityId: facility.id,
          zoneCode: zoneBlueprint.code,
          fullZoneCode,
          name: zoneBlueprint.zone,
          qrSlug: `${facility.facilityCode.toLowerCase()}-${slugify(zoneBlueprint.zone)}`,
          active: true,
        });

        for (let groupIndex = 0; groupIndex < zoneBlueprint.groups.length; groupIndex += 1) {
          const groupBlueprint = zoneBlueprint.groups[groupIndex];
          const groupId = uuidFor(`group:${fullZoneCode}:${groupBlueprint.code}`);
          const fullGroupCode = `${fullZoneCode}-${groupBlueprint.code}`;

          groupRows.push({
            id: groupId,
            facilityId: facility.id,
            zoneId,
            groupCode: groupBlueprint.code,
            fullGroupCode,
            name: groupBlueprint.name,
            sequence: groupIndex + 1,
            active: true,
          });

          for (let taskIndex = 0; taskIndex < groupBlueprint.tasks.length; taskIndex += 1) {
            const title = groupBlueprint.tasks[taskIndex];
            const templateId = uuidFor(`template:${fullGroupCode}:${taskIndex + 1}`);
            const taskTemplateCode = `${fullGroupCode}-T${String(templateCounter).padStart(3, '0')}`;
            const recurrenceType = groupIndex === 0 ? 'daily' : groupIndex === 1 ? 'weekly' : 'monthly';
            const priority = groupIndex === 2 ? 'optional' : 'critical';
            const evidenceRequirement = taskIndex === 0 ? 'none' : zoneBlueprint.code === 'Z01' ? 'optional_photo' : 'required_photo';
            const commentRequirement = taskIndex === 0 ? 'none' : 'on_exception';
            const nextDueAt = groupIndex === 2 ? new Date('2026-06-05T09:00:00Z') : new Date('2026-06-01T09:00:00Z');
            const nextPlanningDueAt = groupIndex === 2 ? new Date('2026-06-03T09:00:00Z') : new Date('2026-05-31T09:00:00Z');
            const lastCompletedAt = taskIndex === 0 ? new Date('2026-05-30T08:00:00Z') : new Date('2026-05-29T08:00:00Z');

            templateRows.push({
              id: templateId,
              taskTemplateCode,
              facilityId: facility.id,
              zoneId,
              taskGroupId: groupId,
              title,
              description: `${groupBlueprint.name} · ${zoneBlueprint.zone} · ${facility.name}`,
              serviceType: 'routine',
              recurrenceType,
              targetDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
              preferredTimeWindow: 'flexible',
              defaultSequence: templateCounter,
              estimatedMinutes: taskIndex === 0 ? 8 : 15,
              priority,
              evidenceRequirement,
              commentRequirement,
              passCriteria: `Complete ${title.toLowerCase()} to site standard.`,
              autoGenerateInstances: true,
              requiresPlanning: true,
              canBeSplit: false,
              canBeMovedBetweenStaff: true,
              requiresManagerApprovalToSkip: false,
              missedTaskPolicy: priority === 'critical' ? 'carry_forward' : 'manager_review',
              rescheduleWindowDays: 2,
              active: true,
            });

            statusRows.push({
              taskTemplateId: templateId,
              lastCompletedAt,
              nextDueAt,
              nextPlanningDueAt,
              overdueSinceAt: null,
              openInstanceCount: 0,
              unscheduledInstanceCount: 0,
              statusBucket: 'upcoming',
            });

            templateCounter += 1;
          }
        }
      }
    }

    await prisma.zone.createMany({ data: zoneRows });
    await prisma.taskGroup.createMany({ data: groupRows });
    await prisma.taskTemplate.createMany({ data: templateRows });
    await prisma.taskTemplateStatus.createMany({ data: statusRows });

    const staffRows = staffBlueprints.map((staff) => ({
      id: uuidFor(`staff:${staff.staffCode}`),
      staffCode: staff.staffCode,
      fullName: staff.fullName,
      role: staff.role,
      active: true,
    }));

    await prisma.staff.createMany({ data: staffRows });

    const shiftRunRows = [];
    const shiftRunLookup = new Map();

    for (const dateText of boardDates) {
      for (const staff of staffBlueprints) {
        const row = {
          id: uuidFor(`shift:${dateText}:${staff.staffCode}`),
          shiftCode: `SHIFT-${dateText}-${staff.staffCode}`,
          runDate: new Date(`${dateText}T00:00:00.000Z`),
          assignedStaffId: uuidFor(`staff:${staff.staffCode}`),
          facilityScope: 'multi_facility',
          shiftLabel: staff.shiftLabel,
          routeLabel: staff.routeLabel,
          shiftStartAt: parseTimeOnDate(dateText, staff.shiftStart),
          shiftEndAt: parseTimeOnDate(dateText, staff.shiftEnd),
          organiserState: 'draft',
        };

        shiftRunRows.push(row);
        shiftRunLookup.set(`${staff.staffCode}:${dateText}`, row);
      }
    }

    await prisma.shiftRun.createMany({ data: shiftRunRows });

    const facilityById = new Map(facilityRows.map((facility) => [facility.id, facility]));
    const zoneById = new Map(zoneRows.map((zone) => [zone.id, zone]));
    const groupById = new Map(groupRows.map((group) => [group.id, group]));

    const taskInstanceRows = [];
    const taskExecutionRows = [];

    for (const template of templateRows) {
      const facility = facilityById.get(template.facilityId);
      const zone = zoneById.get(template.zoneId);
      const taskGroup = groupById.get(template.taskGroupId);
      const boardDate = boardDates[(template.defaultSequence - 1) % boardDates.length];
      const { staff, route } = findStaffRoute(facility.name, zone.name);
      const laneIndex = route.laneIndexes[(template.defaultSequence - 1) % route.laneIndexes.length] ?? 0;
      const shiftRun = shiftRunLookup.get(`${staff.staffCode}:${boardDate}`);
      const unallocated = template.defaultSequence % 17 === 0;
      const scheduledForAt = unallocated ? null : addMinutes(shiftRun.shiftStartAt, laneIndex * 60);
      const dueAtBase = scheduledForAt ?? addMinutes(parseTimeOnDate(boardDate, '09:00'), laneIndex * 15);
      const dueAt = template.defaultSequence % 19 === 0 ? addMinutes(dueAtBase, -24 * 60) : dueAtBase;
      const planningDueAt = addMinutes(dueAt, -24 * 60);
      const status = unallocated
        ? 'unscheduled'
        : template.defaultSequence % 19 === 0
          ? 'due'
          : template.defaultSequence % 13 === 0
            ? 'completed'
            : template.defaultSequence % 11 === 0
              ? 'in_progress'
              : 'scheduled';
      const instanceId = uuidFor(`instance:${template.taskTemplateCode}:${boardDate}`);

      taskInstanceRows.push({
        id: instanceId,
        instanceCode: `${template.taskTemplateCode}-${boardDate.replace(/-/g, '')}`,
        taskTemplateId: template.id,
        shiftRunId: unallocated ? null : shiftRun.id,
        facilityId: template.facilityId,
        zoneId: template.zoneId,
        taskGroupId: template.taskGroupId,
        plannedFacilityId: template.facilityId,
        plannedZoneId: template.zoneId,
        plannedTaskGroupId: template.taskGroupId,
        titleSnapshot: template.title,
        descriptionSnapshot: template.description,
        sourceType: 'auto_generated',
        dueAt,
        planningDueAt,
        scheduledForAt,
        assignedStaffId: unallocated ? null : uuidFor(`staff:${staff.staffCode}`),
        sequence: template.defaultSequence,
        status,
        priority: template.priority,
        evidenceRequirement: template.evidenceRequirement,
        commentRequirement: template.commentRequirement,
        estimatedMinutes: template.estimatedMinutes,
        isExceptionTask: false,
        manuallyCreated: false,
      });

      if (status === 'completed') {
        taskExecutionRows.push({
          id: uuidFor(`execution:${instanceId}`),
          taskInstanceId: instanceId,
          startedAt: addMinutes(dueAt, -15),
          completedAt: addMinutes(dueAt, 10),
          completedByStaffId: uuidFor(`staff:${staff.staffCode}`),
          completionStatus: 'completed',
          completionComment: 'Completed during seeded organiser run.',
          issueRaised: false,
        });
      }
    }

    await prisma.taskInstance.createMany({ data: taskInstanceRows });
    await prisma.taskExecution.createMany({ data: taskExecutionRows });

    console.log(`Seeded ${facilityRows.length} facilities, ${zoneRows.length} zones, ${groupRows.length} task groups, ${templateRows.length} task templates, ${staffRows.length} staff, ${shiftRunRows.length} shift runs, ${taskInstanceRows.length} task instances.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
