export default function ManagerNotifications({ notifications, unreadCount = 0 }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h3>Notification inbox</h3>
          <p className="muted">In-app manager notifications with severity, delivery state, and read tracking.</p>
        </div>
        <div className="flag-row">
          <span className="badge">{notifications.length} total</span>
          <span className={`badge ${unreadCount ? 'tone-red' : ''}`}>{unreadCount} unread</span>
        </div>
      </div>

      <div className="task-list">
        {notifications.map((notification) => (
          <div className="task-row" key={notification.id}>
            <div>
              <strong>{notification.title}</strong>
              <div className="muted">{notification.note}</div>
              <div className="muted">{notification.scope} · audience: {notification.audience}</div>
              <div className="muted">
                {notification.isRead ? 'Read' : 'Unread'}
                {notification.readAt ? ` · ${new Date(notification.readAt).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}` : ''}
              </div>
              {notification.delivered && <div className="muted">Delivered to {notification.channel}</div>}
              {notification.lastError && <div className="muted">Delivery error: {notification.lastError}</div>}
            </div>
            <div className="flag-row">
              <strong className={`tone-${notification.tone}`}>{notification.tone.toUpperCase()}</strong>
              <span className="flag">{notification.severity}</span>
            </div>
          </div>
        ))}
        {!notifications.length && <div className="muted">No notifications yet.</div>}
      </div>
    </section>
  );
}
