import { getPrisma } from '../lib/prisma.js';
import { dispatchPendingNotifications } from '../lib/notification-dispatch.js';

const prisma = await getPrisma();
if (!prisma) {
  console.error('Database unavailable');
  process.exit(1);
}

const result = await dispatchPendingNotifications(async ({ channel, target, message }) => {
  console.log(JSON.stringify({ channel, target, message }, null, 2));
});
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect?.();
