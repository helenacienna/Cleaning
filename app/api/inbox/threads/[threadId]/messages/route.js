import { NextResponse } from 'next/server';
import { createInboxReply, getInboxWorkspaceData } from '../../../../../../lib/inbox-data';
import { getCurrentStaffSession } from '../../../../../../lib/session-staff.js';
import { getPrisma } from '../../../../../../lib/prisma.js';

async function getAdminSenderStaffCode(session) {
  const prisma = await getPrisma();
  if (!prisma) return '';
  const username = String(session?.username || '').trim().toLowerCase();
  const name = String(session?.name || '').trim().toLowerCase();
  const staff = await prisma.staff.findMany({ where: { active: true }, orderBy: [{ role: 'asc' }, { fullName: 'asc' }] });
  const matched = staff.find((member) => member.fullName.toLowerCase() === username || member.fullName.toLowerCase() === name)
    || staff.find((member) => member.role === 'manager')
    || staff[0];
  return matched?.staffCode || '';
}

export async function GET(_request, { params }) {
  const { threadId } = await params;
  const { session, staff } = await getCurrentStaffSession();
  const workspace = await getInboxWorkspaceData(threadId, {
    audience: session?.role === 'staff' ? 'staff' : undefined,
    participantStaffCode: session?.role === 'staff' ? staff?.staffCode : '',
  });
  if (!workspace.selectedThread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, thread: workspace.selectedThread });
}

export async function POST(request, { params }) {
  const { threadId } = await params;
  const body = await request.json().catch(() => null);
  const { session, staff } = await getCurrentStaffSession();
  const senderStaffCode = session?.role === 'staff' ? staff?.staffCode : await getAdminSenderStaffCode(session);
  const messageBody = typeof body?.body === 'string' ? body.body : '';
  const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

  if (!messageBody.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
  }

  try {
    const result = await createInboxReply({
      threadId,
      senderStaffCode,
      body: messageBody,
      attachments,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send reply';
    return NextResponse.json({ error: message }, { status: message === 'Thread not found' ? 404 : 400 });
  }
}
