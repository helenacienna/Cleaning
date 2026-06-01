import { getPrisma } from './prisma';

function isDispatchEnabled() {
  return process.env.NOTIFICATION_DISPATCH_ENABLED === 'true';
}

function getDispatchTarget() {
  return {
    channel: process.env.NOTIFICATION_CHANNEL || 'telegram',
    target: process.env.NOTIFICATION_TARGET || process.env.TELEGRAM_CHAT_ID || null,
  };
}

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

function formatNotificationMessage(event) {
  const icon = event.tone === 'red' ? '🚨' : event.tone === 'amber' ? '⚠️' : event.tone === 'green' ? '✅' : 'ℹ️';
  return [
    `${icon} ${event.title}`,
    event.note || null,
    `scope: ${event.scope}`,
    `time: ${new Date(event.createdAt).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`,
  ].filter(Boolean).join('\n');
}

async function sendTelegramMessage({ target, message }) {
  const token = getTelegramBotToken();
  if (!token) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: target,
      text: message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram send failed (${response.status})`);
  }

  return response.json();
}

export async function sendNotification({ channel, target, message }) {
  if (channel === 'telegram') {
    return sendTelegramMessage({ target, message });
  }

  throw new Error(`Unsupported notification channel: ${channel}`);
}

export async function getPendingNotifications(limit = 10) {
  const prisma = await getPrisma();
  if (!prisma) return [];

  return prisma.notificationEvent.findMany({
    where: { delivered: false },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export async function dispatchPendingNotifications(sender = sendNotification) {
  const prisma = await getPrisma();
  if (!prisma || !isDispatchEnabled()) {
    return { scanned: 0, delivered: 0, failed: 0, skipped: true };
  }

  const { channel, target } = getDispatchTarget();
  if (!target) {
    return { scanned: 0, delivered: 0, failed: 0, skipped: true, reason: 'missing_target' };
  }

  const events = await getPendingNotifications(20);
  let delivered = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await sender({ channel, target, message: formatNotificationMessage(event) });
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          delivered: true,
          channel,
          target,
          deliveredAt: new Date(),
          lastError: null,
        },
      });
      delivered += 1;
    } catch (error) {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      failed += 1;
    }
  }

  return { scanned: events.length, delivered, failed, skipped: false };
}
