import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import crypto from 'node:crypto';

const facilities = ['Cienna', 'Boheme', 'Holiday'];
const OPEN_INSTANCE_STATUSES = new Set(['upcoming', 'due', 'unscheduled', 'scheduled', 'in_progress', 'overdue', 'carried_forward']);
const UNSCHEDULED_INSTANCE_STATUSES = new Set(['unscheduled', 'overdue', 'carried_forward']);

const staffBlueprints = [
  {
    staffCode: 'MGR001',
    fullName: 'Olivia Hart',
    role: 'manager',
    shiftLabel: 'Operations manager',
    routeLabel: 'Portfolio oversight',
    shiftStart: '06:00',
    shiftEnd: '18:00',
    routes: [],
  },
  {
    staffCode: 'SUP001',
    fullName: 'Daniel Price',
    role: 'supervisor',
    shiftLabel: 'Field supervisor',
    routeLabel: 'Audit and support coverage',
    shiftStart: '06:00',
    shiftEnd: '16:00',
    routes: [],
  },
  {
    staffCode: 'STF001',
    fullName: 'Mia Thompson',
    role: 'cleaner',
    shiftLabel: 'Morning flexible shift',
    routeLabel: 'Cienna → Boheme → Cienna',
    shiftStart: '06:00',
    shiftEnd: '14:00',
    routes: [
      { facility: 'Cienna', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3'], laneIndexes: [0] },
      { facility: 'Boheme', zones: ['Residents lounge', 'Pool area', 'Carparks', 'Gym'], laneIndexes: [1, 2] },
      { facility: 'Cienna', zones: ['Mail room', 'Loading dock'], laneIndexes: [3] },
    ],
  },
  {
    staffCode: 'STF002',
    fullName: 'Leo Nguyen',
    role: 'cleaner',
    shiftLabel: 'Day flexible shift',
    routeLabel: 'Boheme → Holiday → Cienna',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    routes: [
      { facility: 'Boheme', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3', 'Residents lounge'], laneIndexes: [1, 2] },
      { facility: 'Holiday', zones: ['Pool area', 'Carparks', 'Gym'], laneIndexes: [3] },
      { facility: 'Cienna', zones: ['Mail room', 'Loading dock'], laneIndexes: [4] },
    ],
  },
  {
    staffCode: 'STF003',
    fullName: 'Ava Patel',
    role: 'cleaner',
    shiftLabel: 'Late flexible shift',
    routeLabel: 'Holiday → Cienna → Boheme',
    shiftStart: '10:00',
    shiftEnd: '18:00',
    routes: [
      { facility: 'Holiday', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3'], laneIndexes: [3] },
      { facility: 'Cienna', zones: ['Residents lounge', 'Pool area', 'Carparks', 'Gym'], laneIndexes: [4, 5] },
      { facility: 'Boheme', zones: ['Mail room', 'Loading dock'], laneIndexes: [6] },
    ],
  },
];

const TARGET_TASKS_PER_SHIFT = 100;
const COMPLETION_RATIO = 0.6;
const SEED_TODAY = new Date();

const cleanerBlueprints = staffBlueprints.filter((staff) => staff.role === 'cleaner');

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

function startOfUtcDay(date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function formatDateKey(date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function formatTimeKey(date) {
  return `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function buildBoardDates(anchorDate, pastDays = 4, futureDays = 5) {
  const today = startOfUtcDay(anchorDate);
  return Array.from({ length: pastDays + futureDays + 1 }, (_, index) => formatDateKey(addDays(today, index - pastDays)));
}

const boardDates = buildBoardDates(SEED_TODAY);

function uuidFor(key) {
  return crypto.createHash('md5').update(key).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

function getWeekdayCode(date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getUTCDay()];
}

function getTargetWeekday(template) {
  const designatedDay = String(template.recurrenceRule?.designatedDay ?? template.targetDays?.[0] ?? 'mon').toLowerCase();
  return designatedDay;
}

function getNextWeekdayOnOrAfter(referenceDate, weekdayCode) {
  let cursor = startOfUtcDay(referenceDate);
  while (getWeekdayCode(cursor) !== weekdayCode) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function getSeedDistributedMonthlyDueAt(referenceDate, slotIndex = 0) {
  const anchor = startOfUtcDay(referenceDate);
  const weekdayCode = ['mon', 'tue', 'wed', 'thu', 'fri'][slotIndex % 5];
  const weekOffset = Math.floor(slotIndex / 5) % 2;
  return getNextWeekdayOnOrAfter(addDays(anchor, weekOffset * 7), weekdayCode);
}

function getRecurrenceBasis(template) {
  const configured = String(template.recurrenceRule?.recurrenceBasis ?? template.recurrenceRule?.cadenceMode ?? 'anchored').toLowerCase();
  return configured === 'suggested' || configured === 'rolling' ? 'suggested' : 'anchored';
}

function isTemplateDueOnDate(template, date) {
  const boardDay = startOfUtcDay(date);
  const dueDay = startOfUtcDay(template.nextDueAt);

  if (template.recurrenceType === 'daily') {
    return boardDay.getTime() >= dueDay.getTime();
  }

  if (template.recurrenceType === 'weekly') {
    if (getRecurrenceBasis(template) === 'suggested') {
      const diffDays = Math.round((boardDay.getTime() - dueDay.getTime()) / (24 * 60 * 60 * 1000));
      return diffDays >= 0 && diffDays % 7 === 0;
    }

    return boardDay.getTime() >= dueDay.getTime() && getWeekdayCode(boardDay) === getTargetWeekday(template);
  }

  if (template.recurrenceType === 'monthly') {
    return boardDay.getTime() >= dueDay.getTime() && boardDay.getUTCDate() === dueDay.getUTCDate();
  }

  return boardDay.getTime() === dueDay.getTime();
}

function getNextDueAtAfter(template, referenceAt) {
  const base = startOfUtcDay(referenceAt);

  if (template.recurrenceType === 'daily') {
    return addDays(base, 1);
  }

  if (template.recurrenceType === 'weekly') {
    if (getRecurrenceBasis(template) === 'suggested') {
      return addDays(base, 7);
    }

    let cursor = addDays(base, 1);
    while (getWeekdayCode(cursor) !== getTargetWeekday(template)) {
      cursor = addDays(cursor, 1);
    }
    return cursor;
  }

  if (template.recurrenceType === 'monthly') {
    return addMonths(base, 1);
  }

  return null;
}

function getTemplateStatusBucket({ nextDueAt, overdueSinceAt, unscheduledInstanceCount, lastCompletedAt }, now = new Date()) {
  if (overdueSinceAt) return 'overdue';
  if (unscheduledInstanceCount > 0) return 'unscheduled';
  if (nextDueAt && new Date(nextDueAt).getTime() <= now.getTime()) return 'due';
  if (lastCompletedAt && now.getTime() - new Date(lastCompletedAt).getTime() < 2 * 24 * 60 * 60 * 1000) return 'completed_recently';
  return 'upcoming';
}

function pickAssignedStaff(template, cleanerBlueprintsForRoute, boardDateText, assignmentCounts) {
  const eligible = cleanerBlueprintsForRoute.filter((staff) => staff.routes.some((route) => route.facility === template.facilityName && route.zones.includes(template.zoneName)));
  if (!eligible.length) {
    return null;
  }

  const dateHash = Number(boardDateText.replace(/-/g, ''));
  const preferredIndex = (template.defaultSequence + dateHash) % eligible.length;
  const ranked = eligible
    .map((staff, index) => ({
      staff,
      offset: (index - preferredIndex + eligible.length) % eligible.length,
      count: assignmentCounts.get(staff.staffCode) ?? 0,
    }))
    .sort((left, right) => left.count - right.count || left.offset - right.offset || left.staff.staffCode.localeCompare(right.staff.staffCode));

  const chosen = ranked[0]?.staff ?? null;
  if (chosen) {
    assignmentCounts.set(chosen.staffCode, (assignmentCounts.get(chosen.staffCode) ?? 0) + 1);
  }
  return chosen;
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to run the seed.');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

function getSeedTaskStatus(boardDate, index, completedTarget) {
  const day = new Date(`${boardDate}T00:00:00Z`);
  const today = startOfUtcDay(SEED_TODAY);

  if (day.getTime() > today.getTime()) {
    return 'scheduled';
  }

  if (day.getTime() < today.getTime()) {
    return 'completed';
  }

  if (index < completedTarget) {
    return 'completed';
  }

  if (day.getTime() === today.getTime() && index === completedTarget) {
    return 'in_progress';
  }

  return 'scheduled';
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

function buildInstanceCode(templateCode, dueAt) {
  const date = new Date(dueAt);
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const time = `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return `${templateCode}-D${stamp}-T${time}`;
}

async function resetData(prisma) {
  await prisma.inboxParticipant.deleteMany();
  await prisma.inboxMessage.deleteMany();
  await prisma.inboxThread.deleteMany();
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
            const facilityIndex = facilityRows.findIndex((row) => row.id === facility.id);
            const recurrenceBasis = recurrenceType === 'weekly' ? (taskIndex % 2 === 0 ? 'anchored' : 'suggested') : 'suggested';
            const designatedDay = ['mon', 'tue', 'wed', 'thu', 'fri'][(facilityIndex + zoneBlueprints.findIndex((zone) => zone.code === zoneBlueprint.code) + taskIndex) % 5];
            const dailyLastCompletedAt = addDays(startOfUtcDay(SEED_TODAY), -1);
            const weeklyNextDueAt = getNextWeekdayOnOrAfter(startOfUtcDay(SEED_TODAY), designatedDay);
            const weeklyLastCompletedAt = addDays(weeklyNextDueAt, -7);
            const monthlySlotIndex = (facilityIndex * zoneBlueprints.length + zoneBlueprints.findIndex((zone) => zone.code === zoneBlueprint.code) + taskIndex) % 10;
            const monthlyNextDueAt = getSeedDistributedMonthlyDueAt(SEED_TODAY, monthlySlotIndex);
            const monthlyLastCompletedAt = addMonths(monthlyNextDueAt, -1);
            const lastCompletedAt = recurrenceType === 'daily'
              ? dailyLastCompletedAt
              : recurrenceType === 'weekly'
                ? weeklyLastCompletedAt
                : monthlyLastCompletedAt;
            const nextDueAt = recurrenceType === 'weekly' && recurrenceBasis === 'anchored'
              ? weeklyNextDueAt
              : recurrenceType === 'monthly'
                ? monthlyNextDueAt
              : getNextDueAtAfter({ recurrenceType, recurrenceRule: recurrenceType === 'weekly' ? { recurrenceBasis, cadenceMode: recurrenceBasis === 'suggested' ? 'rolling' : 'anchored', designatedDay } : null }, lastCompletedAt);

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
              recurrenceRule: recurrenceType === 'weekly' ? { recurrenceBasis, cadenceMode: recurrenceBasis === 'suggested' ? 'rolling' : 'anchored', designatedDay } : null,
              targetDays: recurrenceType === 'weekly' ? [designatedDay] : ['mon', 'tue', 'wed', 'thu', 'fri'],
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
              facilityName: facility.name,
              zoneName: zoneBlueprint.zone,
              nextDueAt,
              lastCompletedAt,
            });

            templateCounter += 1;
          }
        }
      }
    }

    await prisma.zone.createMany({ data: zoneRows });
    await prisma.taskGroup.createMany({ data: groupRows });
    await prisma.taskTemplate.createMany({
      data: templateRows.map(({ facilityName, zoneName, nextDueAt, lastCompletedAt, ...row }) => row),
    });

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
      for (const staff of cleanerBlueprints) {
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

    const taskInstanceRows = [];
    const taskExecutionRows = [];
    const statusRows = [];
    const instancesByTemplateId = new Map();

    for (const boardDate of boardDates) {
      const boardDateValue = new Date(`${boardDate}T00:00:00Z`);
      const assignmentCounts = new Map();
      const assignmentsByStaffCode = new Map(cleanerBlueprints.map((staff) => [staff.staffCode, []]));

      const dueTemplates = templateRows
        .filter((template) => isTemplateDueOnDate(template, boardDateValue))
        .sort((left, right) => left.defaultSequence - right.defaultSequence);

      for (const template of dueTemplates) {
        const assignedStaff = pickAssignedStaff(template, cleanerBlueprints, boardDate, assignmentCounts);
        if (!assignedStaff) {
          continue;
        }
        assignmentsByStaffCode.get(assignedStaff.staffCode)?.push(template);
      }

      for (const staff of cleanerBlueprints) {
        const shiftRun = shiftRunLookup.get(`${staff.staffCode}:${boardDate}`);
        const assignedTemplates = assignmentsByStaffCode.get(staff.staffCode) ?? [];
        const completedTarget = Math.round(assignedTemplates.length * COMPLETION_RATIO);

        assignedTemplates.forEach((template, index) => {
          const scheduledForAt = addMinutes(shiftRun.shiftStartAt, Math.floor(index * 12));
          const dueAt = scheduledForAt;
          const planningDueAt = addMinutes(dueAt, -24 * 60);
          const status = getSeedTaskStatus(boardDate, index, completedTarget);
          const instanceCode = buildInstanceCode(template.taskTemplateCode, dueAt);
          const instanceId = uuidFor(`instance:${instanceCode}`);

          const instance = {
            id: instanceId,
            instanceCode,
            taskTemplateId: template.id,
            shiftRunId: shiftRun.id,
            facilityId: template.facilityId,
            zoneId: template.zoneId,
            taskGroupId: template.taskGroupId,
            plannedFacilityId: template.facilityId,
            plannedZoneId: template.zoneId,
            plannedTaskGroupId: template.taskGroupId,
            titleSnapshot: template.title,
            descriptionSnapshot: `${template.description} · Scheduled instance for ${boardDate}`,
            sourceType: 'auto_generated',
            dueAt,
            planningDueAt,
            scheduledForAt,
            assignedStaffId: uuidFor(`staff:${staff.staffCode}`),
            sequence: index + 1,
            status,
            priority: template.priority,
            evidenceRequirement: template.evidenceRequirement,
            commentRequirement: template.commentRequirement,
            estimatedMinutes: template.estimatedMinutes,
            isExceptionTask: false,
            manuallyCreated: false,
          };

          taskInstanceRows.push(instance);

          if (!instancesByTemplateId.has(template.id)) {
            instancesByTemplateId.set(template.id, []);
          }
          instancesByTemplateId.get(template.id).push(instance);

          if (status === 'completed') {
            taskExecutionRows.push({
              id: uuidFor(`execution:${instanceId}`),
              taskInstanceId: instanceId,
              startedAt: addMinutes(dueAt, -Math.max(2, Math.round((template.estimatedMinutes ?? 10) * 0.6))),
              completedAt: addMinutes(dueAt, Math.max(1, Math.round((template.estimatedMinutes ?? 10) * 0.2))),
              completedByStaffId: uuidFor(`staff:${staff.staffCode}`),
              completionStatus: 'completed',
              completionComment: `Completed during seeded organiser run at ${template.facilityName} · ${template.zoneName}.`,
              issueRaised: false,
            });
          }
        });
      }
    }

    for (const template of templateRows) {
      const templateInstances = (instancesByTemplateId.get(template.id) ?? []).sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt));
      const completedInstances = templateInstances.filter((instance) => instance.status === 'completed');
      const latestCompletedInstance = completedInstances[completedInstances.length - 1] ?? null;
      const openInstances = templateInstances.filter((instance) => OPEN_INSTANCE_STATUSES.has(instance.status));
      const nextDueAt = openInstances[0]?.dueAt ?? getNextDueAtAfter(template, latestCompletedInstance?.dueAt ?? template.lastCompletedAt ?? SEED_TODAY);
      const unscheduledInstanceCount = openInstances.filter((instance) => UNSCHEDULED_INSTANCE_STATUSES.has(instance.status)).length;

      statusRows.push({
        taskTemplateId: template.id,
        lastCompletedAt: latestCompletedInstance?.dueAt ?? template.lastCompletedAt,
        lastCompletedInstanceId: latestCompletedInstance?.id ?? null,
        nextDueAt,
        nextPlanningDueAt: nextDueAt ? addMinutes(nextDueAt, -24 * 60) : null,
        overdueSinceAt: null,
        openInstanceCount: openInstances.length,
        unscheduledInstanceCount,
        statusBucket: getTemplateStatusBucket({
          nextDueAt,
          overdueSinceAt: null,
          unscheduledInstanceCount,
          lastCompletedAt: latestCompletedInstance?.dueAt ?? template.lastCompletedAt,
        }, SEED_TODAY),
      });
    }

    await prisma.taskInstance.createMany({ data: taskInstanceRows });
    await prisma.taskExecution.createMany({ data: taskExecutionRows });
    await prisma.taskTemplateStatus.createMany({ data: statusRows });

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
