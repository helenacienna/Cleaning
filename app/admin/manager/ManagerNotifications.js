export default function ManagerNotifications({ notifications }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h3>Live notifications</h3>
          <p className="muted">Latest runtime alerts captured by issue, rework, and maintenance events.</p>
        </div>
        <span className="badge">{notifications.length}</span>
      </div>

      <div className="task-list">
        {notifications.map((notification) => (
          <div className="task-row" key={notification.id}>
            <div>
              <strong>{notification.title}</strong>
              <div className="muted">{notification.note}</div>
              <div className="muted">{notification.scope}</div>
              {notification.delivered && <div className="muted">Delivered to {notification.channel}</div>}
              {notification.lastError && <div className="muted">Delivery error: {notification.lastError}</div>}
            </div>
            <strong className={`tone-${notification.tone}`}>{notification.tone.toUpperCase()}</strong>
          </div>
        ))}
        {!notifications.length && <div className="muted">No notifications yet.</div>}
      </div>
    </section>
  );
}
