import crypto from 'node:crypto';
import { getPrisma } from './prisma.js';
import { syncNotificationEventToInbox } from './inbox-data.js';

function normaliseSeverity(payload = {}) {
  if (payload.severity) return payload.severity;
  if (payload.tone === 'red') return 'critical';
  if (payload.tone === 'amber') return 'warning';
  return 'info';
}

export async function recordNotification(scope, identifier, payload) {
  const prisma = await getPrisma();
  if (!prisma) {
    return false;
  }

  const event = await prisma.notificationEvent.upsert({
    where: {
      scope_identifier: {
        scope,
        identifier,
      },
    },
    update: {
      title: payload.title,
      tone: payload.tone,
      severity: normaliseSeverity(payload),
      audience: payload.audience ?? 'manager',
      note: payload.note ?? null,
      isRead: false,
      readAt: null,
      delivered: false,
      deliveredAt: null,
      lastError: null,
    },
    create: {
      id: crypto.randomUUID(),
      scope,
      identifier,
      title: payload.title,
      tone: payload.tone,
      severity: normaliseSeverity(payload),
      audience: payload.audience ?? 'manager',
      note: payload.note ?? null,
    },
  });

  try {
    await syncNotificationEventToInbox(prisma, event, payload);
  } catch {
    // Keep notification capture resilient even if inbox sync is unavailable.
  }

  return true;
}

export async function listNotifications(limit = 20, audience = 'manager') {
  const prisma = await getPrisma();
  if (!prisma) {
    return [];
  }

  return prisma.notificationEvent.findMany({
    where: audience ? { audience } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function markNotificationRead(id) {
  const prisma = await getPrisma();
  if (!prisma) {
    return null;
  }

  return prisma.notificationEvent.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function clearNotifications() {
  const prisma = await getPrisma();
  if (!prisma) {
    return;
  }
  await prisma.notificationEvent.deleteMany();
}
