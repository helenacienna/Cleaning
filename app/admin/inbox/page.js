import Link from 'next/link';
import InboxWorkspace from './InboxWorkspace';
import { getInboxWorkspaceData } from '../../../lib/inbox-data';

export const metadata = {
  title: 'Operations Inbox · Cienna Cleaning',
};

export const dynamic = 'force-dynamic';

export default async function InboxPage({ searchParams }) {
  const selectedThreadId = searchParams?.thread ?? null;
  const workspace = await getInboxWorkspaceData(selectedThreadId, { audience: 'manager', limit: 14 });

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
          <span className="badge">{workspace.source === 'prisma' ? 'Live inbox' : 'Demo fallback'}</span>
        </div>
      </div>

      <section className="workflow-banner no-top-gap">
        <div>
          <span className="badge">Internal messaging</span>
          <strong>Replace Telegram with a clean in-app inbox for operational threads, manager replies, and system alerts.</strong>
        </div>
        <div className="workflow-banner-actions">
          <span className="badge">{workspace.threads.length} threads</span>
          <span className={`badge ${workspace.unreadCount ? 'tone-red' : ''}`}>{workspace.unreadCount} unread</span>
        </div>
      </section>

      <InboxWorkspace
        initialThreads={workspace.threads}
        initialThread={workspace.selectedThread}
        source={workspace.source}
        senderOptions={workspace.composerDefaults.senderOptions}
      />
    </main>
  );
}
