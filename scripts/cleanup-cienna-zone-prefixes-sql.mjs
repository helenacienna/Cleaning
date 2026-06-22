import { getPrisma } from '../lib/prisma.js';

const prisma = await getPrisma();

if (!prisma) {
  throw new Error('Database unavailable');
}

async function main() {
  const facility = await prisma.facility.findFirst({ where: { name: 'Cienna' }, select: { id: true, name: true } });
  if (!facility) throw new Error('Cienna facility not found');

  const facilityId = facility.id;

  const zonesUpdated = await prisma.$executeRawUnsafe(`
    UPDATE zones
    SET name = regexp_replace(name, '^Zone\\s+[0-9]+\\s*-\\s*', '', 'i')
    WHERE facility_id = $1
      AND name ~* '^Zone\\s+[0-9]+\\s*-\\s*'
  `, facilityId);

  const groupsUpdated = await prisma.$executeRawUnsafe(`
    UPDATE task_groups tg
    SET name = z.name || ' walk-through'
    FROM zones z
    WHERE tg.zone_id = z.id
      AND tg.facility_id = $1
      AND z.facility_id = $1
      AND tg.name IS DISTINCT FROM z.name || ' walk-through'
  `, facilityId);

  const templatesUpdated = await prisma.$executeRawUnsafe(`
    UPDATE task_templates tt
    SET description = tg.name || ' · ' || z.name || ' · ' || $2
    FROM task_groups tg
    JOIN zones z ON z.id = tg.zone_id
    WHERE tt.task_group_id = tg.id
      AND tt.zone_id = z.id
      AND tt.facility_id = $1
      AND tg.facility_id = $1
      AND z.facility_id = $1
      AND tt.description IS DISTINCT FROM tg.name || ' · ' || z.name || ' · ' || $2
  `, facilityId, facility.name);

  const instancesUpdated = await prisma.$executeRawUnsafe(`
    UPDATE task_instances ti
    SET description_snapshot = tg.name || ' · ' || z.name || ' · ' || $2 || ' · Scheduled instance for ' || to_char((ti.due_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
    FROM task_groups tg
    JOIN zones z ON z.id = tg.zone_id
    WHERE ti.task_group_id = tg.id
      AND ti.zone_id = z.id
      AND ti.facility_id = $1
      AND tg.facility_id = $1
      AND z.facility_id = $1
      AND ti.description_snapshot IS DISTINCT FROM tg.name || ' · ' || z.name || ' · ' || $2 || ' · Scheduled instance for ' || to_char((ti.due_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
  `, facilityId, facility.name);

  const zoneNames = await prisma.zone.findMany({
    where: { facilityId },
    select: { name: true },
    orderBy: { zoneCode: 'asc' },
  });

  console.log(JSON.stringify({
    ok: true,
    facility: facility.name,
    zonesUpdated,
    groupsUpdated,
    templatesUpdated,
    instancesUpdated,
    zoneNames: zoneNames.map((row) => row.name),
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
