import Link from 'next/link';

export default function ManagerNotifications({ notifications, unreadCount = 0 }) {
  return (
    <section className="card inbox-preview-card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h3>Operations inbox</h3>
          <p className="muted">Internal manager and supervisor threads for live exceptions, follow-up, and operational alerts.</p>
        </div>
        <div className="flag-row">
          <span className="badge">{notifications.length} threads</span>
          <span className={`badge ${unreadCount ? 'tone-red' : ''}`}>{unreadCount} unread</span>
          <Link className="button secondary" href="/admin/inbox">Open inbox</Link>
        </div>
      </div>

      <div className="task-list">
        {notifications.map((thread) => (
          <Link className="task-row inbox-preview-row" key={thread.id} href={`/admin/inbox?thread=${thread.id}`}>
            <div>
              <strong>{thread.title}</strong>
              {thread.subtitle && <div className="muted">{thread.subtitle}</div>}
              <div className="muted">{thread.lastMessagePreview}</div>
            </div>
            <div className="flag-row inbox-preview-meta">
              <span className="flag">{thread.type.replace('_', ' ')}</span>
              <span className="flag">{thread.participantCount} participants</span>
              {thread.unreadCount ? <span className="task-status status-carried-forward">{thread.unreadCount} unread</span> : <span className="flag">Read</span>}
              <span className="muted">{thread.formattedTime}</span>
            </div>
          </Link>
        ))}
        {!notifications.length && <div className="muted">Inbox is quiet right now.</div>}
      </div>
    </section>
  );
}
