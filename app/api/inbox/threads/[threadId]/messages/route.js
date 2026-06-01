import { NextResponse } from 'next/server';
import { createInboxReply, getInboxWorkspaceData } from '../../../../../../lib/inbox-data';

export async function GET(_request, { params }) {
  const workspace = await getInboxWorkspaceData(params.threadId);
  if (!workspace.selectedThread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, thread: workspace.selectedThread });
}

export async function POST(request, { params }) {
  const body = await request.json().catch(() => null);
  const senderStaffCode = typeof body?.senderStaffCode === 'string' ? body.senderStaffCode : null;
  const messageBody = typeof body?.body === 'string' ? body.body : '';
  const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

  if (!messageBody.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
  }

  try {
    const result = await createInboxReply({
      threadId: params.threadId,
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
