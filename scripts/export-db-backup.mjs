#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getPrisma } from '../lib/prisma.js';

function parseArgs(argv) {
  const args = { out: null };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if ((value === '--out' || value === '-o') && argv[index + 1]) {
      args.out = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

const { out } = parseArgs(process.argv);

if (!out) {
  console.error('Usage: node scripts/export-db-backup.mjs --out <file>');
  process.exit(1);
}

const prisma = await getPrisma();

if (!prisma) {
  console.error('No Prisma connection available. Provide DATABASE_URL or run via Railway environment.');
  process.exit(1);
}

const payload = {
  schema: 'cienna-cleaning.db-backup.v1',
  exportedAt: new Date().toISOString(),
  tables: {},
};

try {
  const [facilities, zones, taskGroups, staff, shiftRuns, taskInstances, taskExecutions, taskAudits] = await Promise.all([
    prisma.facility.findMany({ orderBy: { name: 'asc' } }),
    prisma.zone.findMany({ orderBy: [{ facilityId: 'asc' }, { name: 'asc' }] }),
    prisma.taskGroup.findMany({ orderBy: [{ zoneId: 'asc' }, { sequence: 'asc' }] }),
    prisma.staff.findMany({ orderBy: { fullName: 'asc' } }),
    prisma.shiftRun.findMany({ orderBy: [{ runDate: 'asc' }, { shiftLabel: 'asc' }] }),
    prisma.taskInstance.findMany({
      include: {
        assignedStaff: true,
        facility: true,
        zone: true,
        taskGroup: true,
        plannedFacility: true,
        plannedZone: true,
        plannedTaskGroup: true,
        shiftRun: true,
      },
      orderBy: [{ dueAt: 'asc' }, { sequence: 'asc' }],
    }),
    prisma.taskExecution.findMany({
      include: { photos: true },
      orderBy: { completedAt: 'asc' },
    }),
    prisma.taskAudit.findMany({ orderBy: { auditedAt: 'asc' } }),
  ]);

  payload.tables = {
    facilities,
    zones,
    taskGroups,
    staff,
    shiftRuns,
    taskInstances,
    taskExecutions,
    taskAudits,
  };
  payload.counts = Object.fromEntries(
    Object.entries(payload.tables).map(([key, value]) => [key, Array.isArray(value) ? value.length : null]),
  );

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, out, counts: payload.counts }));
} finally {
  await prisma.$disconnect();
}
