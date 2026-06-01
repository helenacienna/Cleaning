import Link from 'next/link';
import InboxWorkspace from './InboxWorkspace';
import { getInboxWorkspaceData } from '../../../lib/inbox-data';

export const metadata = {
  title: 'Operations Inbox · Cienna Cleaning',
};

export const dynamic = 'force-dynamic';

export default async function InboxPage({ searchParams }) {
  const selectedThreadId = searchParams?.thread ?? null;
  const audience = typeof searchParams?.audience === 'string' ? searchParams.audience : 'manager';
  const audienceLabel = audience === 'supervisor' ? 'Supervisor' : audience === 'cleaner' ? 'Cleaner' : 'Manager';
  const workspace = await getInboxWorkspaceData(selectedThreadId, { audience, limit: 14 });

  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Operations inbox</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/admin/manager">Manager overview</Link>
          <Link className="button secondary" href="/admin/daily-hierarchy">Organiser board</Link>
          <Link className="button secondary" href="/scan/assignment-1?tab=inbox">Cleaner mobile view</Link>
          <span className="badge">{workspace.source === 'prisma' ? 'Live inbox' : 'Demo fallback'}</span>
        </div>
      </div>

      <section className="workflow-banner no-top-gap">
        <div>
          <span className="badge">Internal messaging</span>
          <strong>Replace Telegram with a clean in-app inbox for operational threads, {audienceLabel.toLowerCase()} replies, and system alerts.</strong>
        </div>
        <div className="workflow-banner-actions">
          <Link className="button secondary" href="/admin/inbox?audience=manager">Manager</Link>
          <Link className="button secondary" href="/admin/inbox?audience=supervisor">Supervisor</Link>
          <Link className="button secondary" href="/admin/inbox?audience=cleaner">Cleaner</Link>
          <span className="badge">{workspace.threads.length} threads</span>
          <span className={`badge ${workspace.unreadCount ? 'tone-red' : ''}`}>{workspace.unreadCount} unread</span>
        </div>
      </section>

      <InboxWorkspace
        initialThreads={workspace.threads}
        initialThread={workspace.selectedThread}
        source={workspace.source}
        senderOptions={workspace.composerDefaults.senderOptions}
        participantOptions={workspace.composerDefaults.participantOptions}
        audienceLabel={audienceLabel}
      />
    </main>
  );
}
