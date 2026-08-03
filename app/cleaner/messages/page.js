import Link from 'next/link';
import InboxWorkspace from '../../admin/inbox/InboxWorkspace';
import { getInboxWorkspaceData } from '../../../lib/inbox-data';
import { getCurrentStaffSession } from '../../../lib/session-staff';

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

  const senderOptions = [{ value: staff.staffCode, label: `${staff.fullName} · ${staff.role}` }];

  return (
    <main className="page admin-calendar-page staff-messenger-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning</p>
          <h1>Staff messages</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href={session?.staffSlug ? `/cleaner/${session.staffSlug}` : '/cleaner'}>My work</Link>
          <Link className="button secondary" href="/cleaner">Staff landing</Link>
          <span className="badge">Signed in as {staff.fullName}</span>
        </div>
      </div>

      <section className="card inbox-hero-card messenger-reference-card">
        <span className="badge">Staff messenger</span>
        <strong>Message other staff from inside the cleaning system.</strong>
        <div className="muted">Threads are limited to their participants. Keep task instructions and follow-up questions in one place.</div>
      </section>

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
