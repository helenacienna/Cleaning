import { getPrisma } from './prisma.js';

const PRESENCE_SETTING_KEY = 'staff_presence_v1';
const ONLINE_MS = 90 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function normalizePresenceMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function readStaffPresenceMap(prismaArg = null) {
  const prisma = prismaArg ?? await getPrisma();
  if (!prisma) return {};
  const record = await prisma.appSetting.findUnique({ where: { key: PRESENCE_SETTING_KEY } }).catch(() => null);
  return normalizePresenceMap(record?.value);
}

export async function writeStaffPresence({ staff, deviceId = '', page = '' }) {
  if (!staff?.id) return { ok: false, skipped: true };
  const prisma = await getPrisma();
  if (!prisma) return { ok: false, skipped: true };

  const existing = await readStaffPresenceMap(prisma);
  const key = staff.id;
  const previous = normalizePresenceMap(existing[key]);
  const devices = normalizePresenceMap(previous.devices);
  const safeDeviceId = String(deviceId || 'browser').slice(0, 80);

  devices[safeDeviceId] = {
    deviceId: safeDeviceId,
    page: String(page || '').slice(0, 180),
    lastSeenAt: nowIso(),
  };

  const next = {
    ...existing,
    [key]: {
      staffId: staff.id,
      staffCode: staff.staffCode,
      staffName: staff.fullName,
      role: staff.role,
      lastSeenAt: nowIso(),
      devices,
    },
  };

  await prisma.appSetting.upsert({
    where: { key: PRESENCE_SETTING_KEY },
    update: { value: next },
    create: { key: PRESENCE_SETTING_KEY, value: next },
  });

  return { ok: true, presence: next[key] };
}

export function summarizePresence(entry, now = new Date()) {
  const lastSeenAt = entry?.lastSeenAt ? new Date(entry.lastSeenAt) : null;
  const lastSeenMs = lastSeenAt && !Number.isNaN(lastSeenAt.getTime()) ? now.getTime() - lastSeenAt.getTime() : null;
  return {
    online: lastSeenMs !== null && lastSeenMs <= ONLINE_MS,
    lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
    lastSeenSecondsAgo: lastSeenMs === null ? null : Math.max(0, Math.round(lastSeenMs / 1000)),
    deviceCount: entry?.devices ? Object.keys(entry.devices).length : 0,
  };
}

export function formatAgo(value) {
  if (!value) return 'Never seen';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never seen';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
