import { getPrisma } from '../lib/prisma.js';
import { runRuntimeMaintenance } from '../lib/runtime-maintenance.js';

const prisma = await getPrisma();
if (!prisma) {
  console.error('Database unavailable');
  process.exit(1);
}

const result = await runRuntimeMaintenance(prisma, { force: true });
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect?.();
