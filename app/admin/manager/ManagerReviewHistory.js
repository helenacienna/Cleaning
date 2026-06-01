export default function ManagerReviewHistory({ reviewHistory }) {
  return (
    <section className="card">
      <div className="panel-title">
        <div>
          <h3>Recent review history</h3>
          <p className="muted">Latest manager and system review decisions across the portfolio.</p>
        </div>
        <span className="badge">{reviewHistory.length} events</span>
      </div>

      <div className="task-list">
        {reviewHistory.map((item) => (
          <div className="task-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <div className="muted">{item.location} · {item.zone}</div>
              {item.note && <div className="muted">{item.note}</div>}
            </div>
            <div className="flag-row">
              <span className="flag">{item.managerAction}</span>
              <span className={`task-status status-${item.auditStatus}`}>{item.auditStatus.replace('_', ' ')}</span>
              <span className="flag">{item.when}</span>
            </div>
          </div>
        ))}
        {!reviewHistory.length && <div className="muted">No review history yet.</div>}
      </div>
    </section>
  );
}
