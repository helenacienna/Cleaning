import crypto from 'node:crypto';
import { cleanerAssignments, supervisorCards } from '../data/demo-data.js';
import { getPrisma } from './prisma.js';

const DEMO_PARTICIPANTS = [
  { key: 'staff:MGR001', name: 'Olivia Hart', role: 'manager', participantRole: 'owner' },
  { key: 'staff:SUP001', name: 'Daniel Price', role: 'supervisor', participantRole: 'member' },
  { key: 'system:ops', name: 'Operations system', role: 'system', participantRole: 'system' },
];

function shouldUsePrisma() {
  return process.env.ENABLE_PRISMA_DATA !== 'false';
}

function formatThreadTime(value) {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Brisbane',
  }).format(new Date(value));
}

function normaliseAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label.trim() : '',
      url: typeof item.url === 'string' ? item.url.trim() : '',
      type: typeof item.type === 'string' ? item.type.trim() : 'link',
      name: typeof item.name === 'string' ? item.name.trim() : '',
      mimeType: typeof item.mimeType === 'string' ? item.mimeType.trim() : '',
    }))
    .filter((item) => item.label && item.url);
}

function isAllowedThreadStatus(value) {
  return ['open', 'watch', 'resolved'].includes(value);
}

function getDemoMessages() {
  const now = Date.now();
  return [
    {
      id: 'demo-thread-ops',
      threadKey: 'manager:ops-watch',
      type: 'group',
      audience: 'manager',
      title: 'Operations watch',
      subtitle: 'Portfolio-wide exceptions and follow-up',
      scope: 'operations',
      status: 'open',
      participants: DEMO_PARTICIPANTS,
      unreadCount: 2,
      lastMessageAt: new Date(now - 1000 * 60 * 6).toISOString(),
      messages: [
        {
          id: 'demo-msg-ops-1',
          senderKey: 'system:ops',
          senderName: 'Operations system',
          senderRole: 'system',
          kind: 'alert',
          body: '2 open exceptions still need manager action across Cienna and Boheme.',
          createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
        },
        {
          id: 'demo-msg-ops-2',
          senderKey: 'staff:SUP001',
          senderName: 'Daniel Price',
          senderRole: 'supervisor',
          kind: 'status',
          body: 'North rooftop rework has been reassigned. Waiting on cleaner confirmation for the lift foyer item.',
          createdAt: new Date(now - 1000 * 60 * 18).toISOString(),
        },
        {
          id: 'demo-msg-ops-3',
          senderKey: 'system:ops',
          senderName: 'Operations system',
          senderRole: 'system',
          kind: 'alert',
          body: 'Late shift completion dipped below target at Boheme: 74% complete.',
          attachments: [
            { label: 'Open manager overview', url: '/admin/manager', type: 'internal' },
          ],
          createdAt: new Date(now - 1000 * 60 * 6).toISOString(),
        },
      ],
    },
    {
      id: 'demo-thread-entry-t4',
      threadKey: 'manager:issue:entry-t4',
      type: 'operational_alert',
      audience: 'manager',
      title: 'Entry t4 rework',
      subtitle: 'Cienna · Toilet block',
      scope: 'issue',
      status: 'open',
      participants: DEMO_PARTICIPANTS,
      unreadCount: 1,
      lastMessageAt: new Date(now - 1000 * 60 * 14).toISOString(),
      messages: [
        {
          id: 'demo-msg-entry-1',
          senderKey: 'system:ops',
          senderName: 'Operations system',
          senderRole: 'system',
          kind: 'alert',
          body: 'Cleaner raised issue: floor remained unsafe after initial pass. Photo evidence attached in task flow.',
          attachments: [
            { label: 'Open dashboard', url: '/', type: 'internal' },
            { label: 'Open staff landing', url: '/cleaner', type: 'internal' },
          ],
          createdAt: new Date(now - 1000 * 60 * 34).toISOString(),
        },
        {
          id: 'demo-msg-entry-2',
          senderKey: 'staff:MGR001',
          senderName: 'Olivia Hart',
          senderRole: 'manager',
          kind: 'note',
          body: 'Keep this in the rework queue until a supervisor signs off the second pass.',
          createdAt: new Date(now - 1000 * 60 * 14).toISOString(),
        },
      ],
    },
    {
      id: 'demo-thread-lifts',
      threadKey: 'manager:audit:lifts',
      type: 'group',
      audience: 'manager',
      title: 'Lift foyer audit follow-up',
      subtitle: 'Boheme · Audit score recovery',
      scope: 'audit',
      status: 'open',
      participants: DEMO_PARTICIPANTS,
      unreadCount: 0,
      lastMessageAt: new Date(now - 1000 * 60 * 70).toISOString(),
      messages: [
        {
          id: 'demo-msg-lifts-1',
          senderKey: 'staff:SUP001',
          senderName: 'Daniel Price',
          senderRole: 'supervisor',
          kind: 'status',
          body: 'Audit score improved to 4/5 after rails and mirrors were re-polished. Watch again tomorrow morning.',
          attachments: [
            { label: 'Open inbox', url: '/admin/inbox', type: 'internal' },
          ],
          createdAt: new Date(now - 1000 * 60 * 70).toISOString(),
        },
      ],
    },
  ];
}

function mapDemoThread(thread) {
  const orderedMessages = [...thread.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const lastMessage = orderedMessages[orderedMessages.length - 1] ?? null;
  return {
    id: thread.id,
    threadKey: thread.threadKey,
    type: thread.type,
    audience: thread.audience,
    title: thread.title,
    subtitle: thread.subtitle,
    scope: thread.scope,
    status: thread.status,
    unreadCount: thread.unreadCount,
    participantCount: thread.participants.length,
    participants: thread.participants,
    lastMessageAt: thread.lastMessageAt,
    lastMessagePreview: lastMessage?.body ?? '',
    messageCount: orderedMessages.length,
    messages: orderedMessages.map((message) => ({
      ...message,
      attachments: normaliseAttachments(message.attachments ?? message.metadata?.attachments),
      formattedTime: formatThreadTime(message.createdAt),
    })),
    formattedTime: formatThreadTime(thread.lastMessageAt),
  };
}

function getDemoThreads() {
  return getDemoMessages()
    .map(mapDemoThread)
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

function getFallbackInboxWorkspace(selectedThreadId) {
  const staffOptions = DEMO_PARTICIPANTS.filter((participant) => participant.role !== 'system').map((participant) => ({
    value: participant.key.replace('staff:', ''),
    label: participant.name,
  }));

  return {
    threads: [],
    selectedThread: null,
    unreadCount: 0,
    source: 'unavailable',
    composerDefaults: {
      senderOptions: staffOptions,
      participantOptions: staffOptions,
    },
  };
}

function mapParticipantRecord(participant) {
  const staffRole = participant.staff?.role ?? null;
  return {
    id: participant.id,
    key: participant.participantKey,
    name: participant.displayName,
    role: staffRole ?? participant.role.toLowerCase(),
    participantRole: participant.role.toLowerCase(),
    unreadCount: participant.unreadCount,
    notificationLevel: participant.notificationLevel,
    archivedAt: participant.archivedAt?.toISOString() ?? null,
    staffCode: participant.staff?.staffCode ?? null,
  };
}

function mapThreadRecord(thread) {
  const orderedMessages = [...(thread.messages ?? [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const lastMessage = thread.latestMessage ?? orderedMessages[orderedMessages.length - 1] ?? null;

  return {
    id: thread.id,
    threadKey: thread.threadKey,
    type: thread.type,
    audience: thread.audience,
    title: thread.title,
    subtitle: thread.subtitle,
    scope: thread.scope,
    status: thread.status,
    unreadCount: thread.participants.reduce((sum, participant) => sum + participant.unreadCount, 0),
    participantCount: thread.participants.length,
    participants: thread.participants.map(mapParticipantRecord),
    messageCount: thread._count?.messages ?? orderedMessages.length,
    lastMessageAt: (thread.lastMessageAt ?? lastMessage?.createdAt ?? thread.createdAt).toISOString(),
    lastMessagePreview: lastMessage?.body ?? 'No messages yet.',
    formattedTime: formatThreadTime(thread.lastMessageAt ?? lastMessage?.createdAt ?? thread.createdAt),
    messages: orderedMessages.map((message) => ({
      id: message.id,
      senderKey: message.senderKey,
      senderName: message.senderName,
      senderRole: message.senderStaff?.role ?? (message.kind === 'alert' || message.kind === 'system' ? 'system' : 'manager'),
      kind: message.kind,
      body: message.body,
      metadata: message.metadata,
      attachments: normaliseAttachments(message.metadata?.attachments),
      createdAt: message.createdAt.toISOString(),
      formattedTime: formatThreadTime(message.createdAt),
    })),
  };
}

async function listPrismaThreads(prisma, { audience = 'manager', limit = 12 } = {}) {
  const threads = await prisma.inboxThread.findMany({
    where: audience ? { audience } : undefined,
    include: {
      participants: {
        where: { archivedAt: null },
        include: { staff: true },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
      latestMessage: {
        include: { senderStaff: true },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });

  return threads.map((thread) => mapThreadRecord({ ...thread, messages: [] }));
}

async function listInboxStaffOptions(prisma, audience = 'manager') {
  const roles = audience === 'supervisor'
    ? ['supervisor']
    : audience === 'cleaner'
      ? ['cleaner', 'supervisor']
      : ['manager', 'supervisor'];
  const staff = await prisma.staff.findMany({
    where: {
      active: true,
      role: { in: roles },
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });

  return staff.map((member) => ({
    value: member.staffCode,
    label: `${member.fullName} · ${member.role}`,
  }));
}

async function getPrismaThreadDetail(prisma, threadId) {
  const thread = await prisma.inboxThread.findUnique({
    where: { id: threadId },
    include: {
      participants: {
        where: { archivedAt: null },
        include: { staff: true },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
      latestMessage: {
        include: { senderStaff: true },
      },
      messages: {
        include: { senderStaff: true },
        orderBy: { createdAt: 'asc' },
        take: 80,
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  return thread ? mapThreadRecord(thread) : null;
}

export async function getInboxWorkspaceData(selectedThreadId, options = {}) {
  if (!shouldUsePrisma()) {
    return getFallbackInboxWorkspace(selectedThreadId);
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return getFallbackInboxWorkspace(selectedThreadId);
  }

  try {
    const threads = await listPrismaThreads(prisma, options);
    if (!threads.length) {
      return getFallbackInboxWorkspace(selectedThreadId);
    }

    const selectedId = selectedThreadId ?? threads[0].id;
    const selectedThread = await getPrismaThreadDetail(prisma, selectedId);
    const participantOptions = await listInboxStaffOptions(prisma, options.audience ?? 'manager');

    return {
      threads,
      selectedThread: selectedThread ?? (await getPrismaThreadDetail(prisma, threads[0].id)),
      unreadCount: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
      source: 'prisma',
      composerDefaults: {
        senderOptions: (selectedThread?.participants ?? threads[0]?.participants ?? [])
          .filter((participant) => participant.role !== 'system')
          .map((participant) => ({
            value: participant.staffCode ?? participant.key,
            label: participant.name,
          })),
        participantOptions,
      },
    };
  } catch {
    return getFallbackInboxWorkspace(selectedThreadId);
  }
}

export async function listInboxThreads(options = {}) {
  const workspace = await getInboxWorkspaceData(null, options);
  return workspace.threads;
}

function normaliseSenderKey(value) {
  if (!value) return null;
  if (value.startsWith('staff:') || value.startsWith('system:')) return value;
  return value;
}

function buildParticipantKeyFromStaff(staff) {
  return `staff:${staff.staffCode}`;
}

async function ensureThreadParticipants(tx, threadId, participants) {
  for (const participant of participants) {
    const participantKey = participant.participantKey ?? (participant.staff ? buildParticipantKeyFromStaff(participant.staff) : participant.key);
    await tx.inboxParticipant.upsert({
      where: {
        threadId_participantKey: {
          threadId,
          participantKey,
        },
      },
      update: {
        displayName: participant.displayName ?? participant.staff?.fullName ?? participant.name,
        role: participant.role,
        notificationLevel: participant.notificationLevel ?? 'all',
        archivedAt: null,
      },
      create: {
        id: crypto.randomUUID(),
        threadId,
        staffId: participant.staff?.id ?? participant.staffId ?? null,
        participantKey,
        displayName: participant.displayName ?? participant.staff?.fullName ?? participant.name,
        role: participant.role,
        notificationLevel: participant.notificationLevel ?? 'all',
      },
    });
  }
}

async function buildDefaultOperationalParticipants(prisma, audience = 'manager') {
  const staff = await prisma.staff.findMany({
    where: {
      active: true,
      role: {
        in: audience === 'supervisor'
          ? ['supervisor']
          : audience === 'cleaner'
            ? ['cleaner', 'supervisor']
            : ['manager', 'supervisor'],
      },
    },
    orderBy: [{ role: 'asc' }, { staffCode: 'asc' }],
  });

  const participants = staff.map((member, index) => ({
    staff: member,
    role: index === 0 ? 'owner' : 'member',
  }));

  participants.push({
    key: 'system:ops',
    name: 'Operations system',
    role: 'system',
  });

  return participants;
}

async function findThreadContext(prisma, payload = {}) {
  if (!payload.facilityId && !payload.zoneId && !payload.taskInstanceId) {
    return {};
  }

  return {
    facilityId: payload.facilityId ?? null,
    zoneId: payload.zoneId ?? null,
    taskInstanceId: payload.taskInstanceId ?? null,
  };
}

export async function syncNotificationEventToInbox(prisma, event, payload = {}) {
  if (!prisma) return null;

  const threadKey = `${event.audience}:${event.scope}:${event.identifier}`;
  const participants = await buildDefaultOperationalParticipants(prisma, event.audience);
  const context = await findThreadContext(prisma, payload);

  const thread = await prisma.inboxThread.upsert({
    where: { threadKey },
    update: {
      type: 'operational_alert',
      audience: event.audience,
      title: event.title,
      subtitle: payload.subtitle ?? event.note ?? null,
      scope: event.scope,
      sourceIdentifier: event.identifier,
      status: 'open',
      ...context,
    },
    create: {
      id: crypto.randomUUID(),
      threadKey,
      type: 'operational_alert',
      audience: event.audience,
      title: event.title,
      subtitle: payload.subtitle ?? event.note ?? null,
      scope: event.scope,
      sourceIdentifier: event.identifier,
      status: 'open',
      ...context,
    },
  });

  await ensureThreadParticipants(prisma, thread.id, participants);

  let messageId = event.inboxMessageId;

  if (messageId) {
    await prisma.inboxMessage.update({
      where: { id: messageId },
      data: {
        senderKey: 'system:ops',
        senderName: 'Operations system',
        kind: 'alert',
        body: event.note ? `${event.title}\n${event.note}` : event.title,
        metadata: {
          severity: event.severity,
          tone: event.tone,
          scope: event.scope,
          audience: event.audience,
        },
      },
    });
  } else {
    const message = await prisma.inboxMessage.create({
      data: {
        id: crypto.randomUUID(),
        threadId: thread.id,
        senderKey: 'system:ops',
        senderName: 'Operations system',
        kind: 'alert',
        body: event.note ? `${event.title}\n${event.note}` : event.title,
        metadata: {
          severity: event.severity,
          tone: event.tone,
          scope: event.scope,
          audience: event.audience,
        },
      },
    });
    messageId = message.id;

    await prisma.inboxParticipant.updateMany({
      where: { threadId: thread.id, role: { not: 'system' } },
      data: { unreadCount: { increment: 1 } },
    });
  }

  await prisma.inboxThread.update({
    where: { id: thread.id },
    data: {
      latestMessageId: messageId,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.notificationEvent.update({
    where: { id: event.id },
    data: {
      inboxThreadId: thread.id,
      inboxMessageId: messageId,
    },
  });

  return { threadId: thread.id, messageId };
}

export async function createInboxReply({ threadId, senderStaffCode, body, attachments = [] }) {
  if (!body?.trim()) {
    throw new Error('Message body is required');
  }

  const normalisedAttachments = normaliseAttachments(attachments);

  if (!shouldUsePrisma()) {
    throw new Error('Live inbox data is unavailable');
  }

  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error('Live inbox data is unavailable');
  }

  try {
    const sender = senderStaffCode
      ? await prisma.staff.findUnique({ where: { staffCode: senderStaffCode } })
      : null;

    const thread = await prisma.inboxThread.findUnique({
      where: { id: threadId },
      include: { participants: true },
    });

    if (!thread) {
      throw new Error('Thread not found');
    }

    const senderKey = sender ? buildParticipantKeyFromStaff(sender) : normaliseSenderKey(senderStaffCode) ?? 'system:ops';
    const senderName = sender?.fullName ?? 'Operations system';
    const senderRole = sender?.role ?? 'system';

    const message = await prisma.inboxMessage.create({
      data: {
        id: crypto.randomUUID(),
        threadId,
        senderStaffId: sender?.id ?? null,
        senderKey,
        senderName,
        kind: 'note',
        body: body.trim(),
        metadata: {
          senderRole: sender ? sender.role : 'system',
          attachments: normalisedAttachments,
        },
      },
    });

    await prisma.inboxThread.update({
      where: { id: threadId },
      data: {
        latestMessageId: message.id,
        lastMessageAt: message.createdAt,
      },
    });

    await prisma.inboxParticipant.updateMany({
      where: {
        threadId,
        participantKey: { not: senderKey },
        role: { not: 'system' },
        archivedAt: null,
      },
      data: {
        unreadCount: { increment: 1 },
      },
    });

    return {
      ok: true,
      source: 'prisma',
      threadId,
      message: {
        id: message.id,
        senderKey,
        senderName,
        senderRole,
        kind: message.kind,
        body: message.body,
        attachments: normalisedAttachments,
        createdAt: message.createdAt.toISOString(),
        formattedTime: formatThreadTime(message.createdAt),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Thread not found') {
      throw error;
    }

    throw new Error('Live inbox data is unavailable');
  }
}

export async function markInboxThreadRead({ threadId, participantStaffCode }) {
  if (!shouldUsePrisma()) {
    return { ok: true, source: 'unavailable', skipped: true };
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return { ok: true, source: 'unavailable', skipped: true };
  }

  try {
    const thread = await prisma.inboxThread.findUnique({
      where: { id: threadId },
      include: {
        latestMessage: true,
        participants: {
          include: { staff: true },
        },
      },
    });

    if (!thread) {
      throw new Error('Thread not found');
    }

    const participant = participantStaffCode
      ? thread.participants.find((item) => item.staff?.staffCode === participantStaffCode)
      : thread.participants.find((item) => item.role !== 'system');

    if (!participant) {
      return { ok: true, source: 'prisma', skipped: true };
    }

    await prisma.inboxParticipant.update({
      where: { id: participant.id },
      data: {
        unreadCount: 0,
        lastReadAt: new Date(),
        lastReadMessageId: thread.latestMessageId,
      },
    });

    return { ok: true, source: 'prisma' };
  } catch (error) {
    if (error instanceof Error && error.message === 'Thread not found') {
      throw error;
    }
    return { ok: true, source: 'unavailable', skipped: true };
  }
}

export async function createInboxThread({ title, subtitle, audience = 'manager', participantStaffCodes = [], senderStaffCode }) {
  if (!title?.trim()) {
    throw new Error('Title is required');
  }

  if (!shouldUsePrisma()) {
    throw new Error('Live inbox data is unavailable');
  }

  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error('Live inbox data is unavailable');
  }

  try {
    const staffMembers = participantStaffCodes.length
      ? await prisma.staff.findMany({ where: { staffCode: { in: participantStaffCodes } } })
      : [];
    const sender = senderStaffCode
      ? await prisma.staff.findUnique({ where: { staffCode: senderStaffCode } })
      : null;

    const thread = await prisma.inboxThread.create({
      data: {
        id: crypto.randomUUID(),
        type: 'group',
        audience,
        title: title.trim(),
        subtitle: subtitle?.trim() || null,
        scope: 'manual',
        status: 'open',
      },
    });

    const participants = [
      ...staffMembers.map((staff, index) => ({ staff, role: index === 0 ? 'owner' : 'member' })),
      sender ? { staff: sender, role: 'owner' } : null,
      { key: 'system:ops', name: 'Operations system', role: 'system' },
    ].filter(Boolean);

    await ensureThreadParticipants(prisma, thread.id, participants);

    if (subtitle?.trim()) {
      await createInboxReply({ threadId: thread.id, senderStaffCode: senderStaffCode ?? sender?.staffCode ?? null, body: subtitle.trim() });
    }

    return {
      ok: true,
      source: 'prisma',
      thread: await getPrismaThreadDetail(prisma, thread.id),
    };
  } catch {
    throw new Error('Live inbox data is unavailable');
  }
}

export async function setInboxThreadStatus({ threadId, status }) {
  if (!isAllowedThreadStatus(status)) {
    throw new Error('Invalid thread status');
  }

  if (!shouldUsePrisma()) {
    throw new Error('Live inbox data is unavailable');
  }

  const prisma = await getPrisma();
  if (!prisma) {
    throw new Error('Live inbox data is unavailable');
  }

  const thread = await prisma.inboxThread.update({
    where: { id: threadId },
    data: {
      status,
      updatedAt: new Date(),
    },
    include: {
      participants: {
        where: { archivedAt: null },
        include: { staff: true },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
      latestMessage: {
        include: { senderStaff: true },
      },
      messages: {
        include: { senderStaff: true },
        orderBy: { createdAt: 'asc' },
        take: 80,
      },
      _count: {
        select: { messages: true },
      },
    },
  }).catch((error) => {
    if (error instanceof Error) {
      throw new Error('Thread not found');
    }
    throw error;
  });

  return {
    ok: true,
    source: 'prisma',
    thread: mapThreadRecord(thread),
  };
}

export function getInboxDemoSnapshot() {
  const threads = getDemoThreads();
  return {
    threads,
    unreadCount: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    supervisorThreads: threads.filter((thread) => thread.participants.some((participant) => participant.role === 'supervisor')).slice(0, 8),
    cleanerThreads: threads.filter((thread) => thread.title.toLowerCase().includes('rework') || thread.type === 'operational_alert').slice(0, 8),
    completionSummary: cleanerAssignments.map((assignment) => ({
      location: assignment.location,
      progress: assignment.progress,
    })),
    supervisorSnapshot: supervisorCards,
  };
}
