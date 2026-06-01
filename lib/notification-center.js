import crypto from 'node:crypto';
import { getPrisma } from './prisma';

export async function recordNotification(scope, identifier, payload) {
  const prisma = await getPrisma();
  if (!prisma) {
    return false;
  }

  try {
    await prisma.notificationEvent.create({
      data: {
        id: crypto.randomUUID(),
        scope,
        identifier,
        title: payload.title,
        tone: payload.tone,
        note: payload.note ?? null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function listNotifications(limit = 20) {
  const prisma = await getPrisma();
  if (!prisma) {
    return [];
  }

  return prisma.notificationEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function clearNotifications() {
  const prisma = await getPrisma();
  if (!prisma) {
    return;
  }
  await prisma.notificationEvent.deleteMany();
}
