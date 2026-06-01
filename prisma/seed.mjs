import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const facilities = ['Cienna North', 'Cienna Central', 'Cienna South'];

const zoneBlueprints = [
  {
    code: 'Z01',
    zone: 'Rooftop',
    groups: [
      { code: 'G01', key: 'rooftop-presentation', name: 'Rooftop presentation', tasks: ['Clear tables', 'Wipe handrails'] },
      { code: 'G02', key: 'bbq-reset', name: 'BBQ area reset', tasks: ['Clean BBQ surrounds', 'Check outdoor bins'] },
      { code: 'G03', key: 'planter-perimeter', name: 'Planter perimeter', tasks: ['Sweep planter edges', 'Remove loose litter'] },
    ],
  },
  {
    code: 'Z02',
    zone: 'Lifts',
    groups: [
      { code: 'G01', key: 'lift-refresh', name: 'Lift refresh', tasks: ['Polish lift mirrors', 'Wipe buttons and rails'] },
      { code: 'G02', key: 'lift-foyer-detail', name: 'Lift foyer detail', tasks: ['Vacuum lift foyer mats', 'Spot clean foyer glass'] },
      { code: 'G03', key: 'button-sanitising', name: 'Button sanitising', tasks: ['Sanitise call buttons', 'Wipe door tracks'] },
    ],
  },
  {
    code: 'Z03',
    zone: 'Entry t4',
    groups: [
      { code: 'G01', key: 'toilet-block-t4', name: 'Toilet block', tasks: ['Clean toilets', 'Mop floor'] },
      { code: 'G02', key: 'entry-detail-t4', name: 'Entry detail', tasks: ['Vacuum mats', 'Wipe intercom panel'] },
      { code: 'G03', key: 'glass-presentation-t4', name: 'Glass presentation', tasks: ['Spot clean glass', 'Remove marks from doors'] },
    ],
  },
  {
    code: 'Z04',
    zone: 'Entry t3',
    groups: [
      { code: 'G01', key: 'toilet-block-t3', name: 'Toilet block', tasks: ['Check toilet paper', 'Wipe basins and mirrors'] },
      { code: 'G02', key: 'entry-detail-t3', name: 'Entry detail', tasks: ['Check entrance presentation', 'Clean skirting edges'] },
      { code: 'G03', key: 'mail-lobby-reset', name: 'Mail lobby reset', tasks: ['Tidy parcel shelves', 'Wipe lobby bench'] },
    ],
  },
  {
    code: 'Z05',
    zone: 'Residents lounge',
    groups: [
      { code: 'G01', key: 'lounge-touchup', name: 'Residents lounge touch-up', tasks: ['Wipe tables', 'Arrange cushions and chairs'] },
      { code: 'G02', key: 'kitchenette-reset', name: 'Kitchenette reset', tasks: ['Clean kitchenette bench', 'Restock paper towel'] },
      { code: 'G03', key: 'soft-furnishing-check', name: 'Soft furnishing check', tasks: ['Vacuum lounge floor', 'Spot clean upholstery'] },
    ],
  },
  {
    code: 'Z06',
    zone: 'Pool area',
    groups: [
      { code: 'G01', key: 'pool-deck-reset', name: 'Pool deck reset', tasks: ['Check pool furniture', 'Rinse high-traffic patches'] },
      { code: 'G02', key: 'amenities-wipe-down', name: 'Amenities wipe-down', tasks: ['Wipe gate handles', 'Clean shower touch points'] },
      { code: 'G03', key: 'safety-inspection', name: 'Safety inspection', tasks: ['Check safety signage', 'Remove leaf litter'] },
    ],
  },
  {
    code: 'Z07',
    zone: 'Carparks',
    groups: [
      { code: 'G01', key: 'carpark-round', name: 'Carpark round', tasks: ['Pick litter', 'Blow leaves from corners'] },
      { code: 'G02', key: 'bin-bay-detail', name: 'Bin bay detail', tasks: ['Check bin bays', 'Degrease bin bay handles'] },
      { code: 'G03', key: 'access-ramp-tidy', name: 'Access ramp tidy', tasks: ['Spot clean entry doors', 'Inspect trolley area'] },
    ],
  },
  {
    code: 'Z08',
    zone: 'Gym',
    groups: [
      { code: 'G01', key: 'gym-floor-care', name: 'Gym floor care', tasks: ['Vacuum gym floor', 'Mop rubber flooring'] },
      { code: 'G02', key: 'equipment-wipe-down', name: 'Equipment wipe-down', tasks: ['Sanitise cardio equipment', 'Wipe free weights'] },
      { code: 'G03', key: 'mirror-presentation', name: 'Mirror presentation', tasks: ['Polish wall mirrors', 'Check drink station'] },
    ],
  },
  {
    code: 'Z09',
    zone: 'Mail room',
    groups: [
      { code: 'G01', key: 'parcel-room-reset', name: 'Parcel room reset', tasks: ['Tidy parcel shelving', 'Sweep parcel room floor'] },
      { code: 'G02', key: 'locker-wipe-down', name: 'Locker wipe-down', tasks: ['Wipe locker doors', 'Check fingerprint marks'] },
      { code: 'G03', key: 'waste-detail', name: 'Waste detail', tasks: ['Empty bins', 'Replace liners'] },
    ],
  },
  {
    code: 'Z10',
    zone: 'Loading dock',
    groups: [
      { code: 'G01', key: 'dock-sweep', name: 'Dock sweep', tasks: ['Sweep loading dock', 'Remove cardboard scraps'] },
      { code: 'G02', key: 'roller-door-check', name: 'Roller door check', tasks: ['Wipe roller door handles', 'Check scuff marks near door'] },
      { code: 'G03', key: 'back-of-house-tidy', name: 'Back-of-house tidy', tasks: ['Tidy delivery corner', 'Check back-of-house bins'] },
    ],
  },
];

function slugify(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the seed.');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrisma();

  try {
    let templateCounter = 1;

    for (let facilityIndex = 0; facilityIndex < facilities.length; facilityIndex += 1) {
      const facilityName = facilities[facilityIndex];
      const facilityCode = `FAC${String(facilityIndex + 1).padStart(2, '0')}`;

      const facility = await prisma.facility.upsert({
        where: { facilityCode },
        update: { name: facilityName, active: true },
        create: { facilityCode, name: facilityName, active: true },
      });

      for (const zoneBlueprint of zoneBlueprints) {
        const fullZoneCode = `${facilityCode}-${zoneBlueprint.code}`;

        const zone = await prisma.zone.upsert({
          where: { fullZoneCode },
          update: {
            facilityId: facility.id,
            zoneCode: zoneBlueprint.code,
            name: zoneBlueprint.zone,
            qrSlug: `${facilityCode.toLowerCase()}-${slugify(zoneBlueprint.zone)}`,
            active: true,
          },
          create: {
            facilityId: facility.id,
            zoneCode: zoneBlueprint.code,
            fullZoneCode,
            name: zoneBlueprint.zone,
            qrSlug: `${facilityCode.toLowerCase()}-${slugify(zoneBlueprint.zone)}`,
            active: true,
          },
        });

        for (let groupIndex = 0; groupIndex < zoneBlueprint.groups.length; groupIndex += 1) {
          const groupBlueprint = zoneBlueprint.groups[groupIndex];
          const fullGroupCode = `${fullZoneCode}-${groupBlueprint.code}`;

          const taskGroup = await prisma.taskGroup.upsert({
            where: { fullGroupCode },
            update: {
              facilityId: facility.id,
              zoneId: zone.id,
              groupCode: groupBlueprint.code,
              name: groupBlueprint.name,
              sequence: groupIndex + 1,
              active: true,
            },
            create: {
              facilityId: facility.id,
              zoneId: zone.id,
              groupCode: groupBlueprint.code,
              fullGroupCode,
              name: groupBlueprint.name,
              sequence: groupIndex + 1,
              active: true,
            },
          });

          for (let taskIndex = 0; taskIndex < groupBlueprint.tasks.length; taskIndex += 1) {
            const title = groupBlueprint.tasks[taskIndex];
            const templateCode = `${fullGroupCode}-T${String(templateCounter).padStart(3, '0')}`;
            const recurrenceType = groupIndex === 0 ? 'daily' : groupIndex === 1 ? 'weekly' : 'monthly';
            const priority = groupIndex === 2 ? 'optional' : 'critical';
            const evidenceRequirement = taskIndex === 0 ? 'none' : zoneBlueprint.code === 'Z01' ? 'optional_photo' : 'required_photo';
            const commentRequirement = taskIndex === 0 ? 'none' : 'on_exception';
            const nextDueAt = groupIndex === 2 ? new Date('2026-06-05T09:00:00Z') : new Date('2026-06-01T09:00:00Z');
            const planningDueAt = groupIndex === 2 ? new Date('2026-06-03T09:00:00Z') : new Date('2026-05-31T09:00:00Z');
            const lastCompletedAt = taskIndex === 0 ? new Date('2026-05-30T08:00:00Z') : new Date('2026-05-29T08:00:00Z');

            const template = await prisma.taskTemplate.upsert({
              where: { taskTemplateCode: templateCode },
              update: {
                facilityId: facility.id,
                zoneId: zone.id,
                taskGroupId: taskGroup.id,
                title,
                description: `${groupBlueprint.name} · ${zoneBlueprint.zone} · ${facilityName}`,
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
                safetyNotes: null,
                autoGenerateInstances: true,
                requiresPlanning: true,
                canBeSplit: false,
                canBeMovedBetweenStaff: true,
                requiresManagerApprovalToSkip: false,
                missedTaskPolicy: priority === 'critical' ? 'carry_forward' : 'manager_review',
                rescheduleWindowDays: 2,
                active: true,
              },
              create: {
                taskTemplateCode: templateCode,
                facilityId: facility.id,
                zoneId: zone.id,
                taskGroupId: taskGroup.id,
                title,
                description: `${groupBlueprint.name} · ${zoneBlueprint.zone} · ${facilityName}`,
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
              },
            });

            await prisma.taskTemplateStatus.upsert({
              where: { taskTemplateId: template.id },
              update: {
                lastCompletedAt,
                nextDueAt,
                nextPlanningDueAt: planningDueAt,
                overdueSinceAt: null,
                openInstanceCount: 0,
                unscheduledInstanceCount: 0,
                statusBucket: 'upcoming',
              },
              create: {
                taskTemplateId: template.id,
                lastCompletedAt,
                nextDueAt,
                nextPlanningDueAt: planningDueAt,
                overdueSinceAt: null,
                openInstanceCount: 0,
                unscheduledInstanceCount: 0,
                statusBucket: 'upcoming',
              },
            });

            templateCounter += 1;
          }
        }
      }
    }

    console.log('Seeded facilities, zones, task groups, task templates, and template status.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
