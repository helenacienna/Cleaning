import { getPrisma } from '../lib/prisma.js';

const prisma = await getPrisma();

if (!prisma) {
  throw new Error('Database unavailable');
}

function stripZonePrefix(value = '') {
  return String(value).replace(/^Zone\s+\d+\s*-\s*/i, '').trim();
}

async function main() {
  const facility = await prisma.facility.findFirst({ where: { name: 'Cienna' }, select: { id: true, name: true } });
  if (!facility) throw new Error('Cienna facility not found');

  const zones = await prisma.zone.findMany({
    where: { facilityId: facility.id },
    select: { id: true, name: true },
  });

  const zoneNameMap = new Map();
  for (const zone of zones) {
    zoneNameMap.set(zone.id, {
      oldName: zone.name,
      newName: stripZonePrefix(zone.name),
    });
  }

  const groups = await prisma.taskGroup.findMany({
    where: { facilityId: facility.id },
    select: { id: true, zoneId: true, name: true },
  });

  const templates = await prisma.taskTemplate.findMany({
    where: { facilityId: facility.id },
    select: { id: true, zoneId: true, title: true },
  });

  const instances = await prisma.taskInstance.findMany({
    where: { facilityId: facility.id },
    select: { id: true, zoneId: true, titleSnapshot: true, dueAt: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const zone of zones) {
      const next = zoneNameMap.get(zone.id);
      if (next && next.oldName !== next.newName) {
        await tx.zone.update({ where: { id: zone.id }, data: { name: next.newName } });
      }
    }

    for (const group of groups) {
      const zoneNames = zoneNameMap.get(group.zoneId);
      const nextName = `${zoneNames?.newName ?? group.name.replace(/\s+walk-through$/i, '')} walk-through`;
      if (group.name !== nextName) {
        await tx.taskGroup.update({ where: { id: group.id }, data: { name: nextName } });
      }
    }

    for (const template of templates) {
      const zoneNames = zoneNameMap.get(template.zoneId);
      const zoneName = zoneNames?.newName ?? '';
      const groupName = `${zoneName} walk-through`;
      const nextDescription = `${groupName} · ${zoneName} · ${facility.name}`;
      await tx.taskTemplate.update({ where: { id: template.id }, data: { description: nextDescription } });
    }

    for (const instance of instances) {
      const zoneNames = zoneNameMap.get(instance.zoneId);
      const zoneName = zoneNames?.newName ?? '';
      const groupName = `${zoneName} walk-through`;
      const dayKey = instance.dueAt.toISOString().slice(0, 10);
      const nextDescription = `${groupName} · ${zoneName} · ${facility.name} · Scheduled instance for ${dayKey}`;
      await tx.taskInstance.update({ where: { id: instance.id }, data: { descriptionSnapshot: nextDescription } });
    }
  }, {
    maxWait: 10000,
    timeout: 120000,
  });

  console.log(JSON.stringify({
    ok: true,
    facility: facility.name,
    zonesUpdated: zones.length,
    groupsUpdated: groups.length,
    templatesUpdated: templates.length,
    instancesUpdated: instances.length,
    zoneNames: Array.from(zoneNameMap.values()),
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
