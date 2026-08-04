import Link from 'next/link';
import InboxWorkspace from '../../admin/inbox/InboxWorkspace';
import { getInboxWorkspaceData } from '../../../lib/inbox-data';
import { getCurrentStaffSession } from '../../../lib/session-staff';
import { formatStaffRole } from '../../../lib/staff-role-label';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Staff Messages · Cienna Cleaning',
};

export default async function StaffMessagesPage({ searchParams }) {
  const params = await searchParams;
  const selectedThreadId = typeof params?.thread === 'string' ? params.thread : null;
  const { session, staff } = await getCurrentStaffSession();

  if (!session || !staff) {
    return (
      <main className="page admin-calendar-page">
        <div className="topbar">
          <div className="brand">
            <p>Cienna Cleaning</p>
            <h1>Staff messages</h1>
          </div>
          <div className="badge-row">
            <Link className="button secondary" href="/cleaner">Staff landing</Link>
          </div>
        </div>
        <section className="card">
          <strong>Staff login required</strong>
          <div className="muted">Sign in with an individual staff login to use staff messages.</div>
        </section>
      </main>
    );
  }

  const workspace = await getInboxWorkspaceData(selectedThreadId, {
    audience: 'staff',
    participantStaffCode: staff.staffCode,
    limit: 30,
  });

  const senderOptions = [{ value: staff.staffCode, label: `${staff.fullName} · ${formatStaffRole(staff.role)}` }];

  return (
    <main className="page admin-calendar-page staff-messenger-page maintenance-chat-page">
      <div className="maintenance-page-top">
        <div className="maintenance-page-brand">
          <div className="maintenance-page-logo">CC</div>
          <div>
            <p>Cienna Cleaning</p>
            <h1>Messages</h1>
            <span>Signed in as {staff.fullName}</span>
          </div>
        </div>
        <div className="maintenance-page-actions">
          <Link className="top-action" href={session?.staffSlug ? `/cleaner/${session.staffSlug}` : '/cleaner'}>← Back</Link>
          <Link className="top-action" href="/cleaner/messages">Refresh</Link>
        </div>
      </div>

      <InboxWorkspace
        initialThreads={workspace.threads}
        initialThread={workspace.selectedThread}
        source={workspace.source}
        senderOptions={senderOptions}
        participantOptions={workspace.composerDefaults.participantOptions}
        audienceLabel="Staff"
      />
    </main>
  );
}
