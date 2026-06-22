export default function ManagerAlerts({ alertCards }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h3>Alert centre</h3>
          <p className="muted">Immediate issues that need manager attention.</p>
        </div>
        <span className="badge">{alertCards.length} alerts</span>
      </div>

      <div className="task-list">
        {alertCards.map((alert) => (
          <div className="task-row" key={alert.title}>
            <div>
              <strong>{alert.title}</strong>
              <div className="muted">{alert.note}</div>
            </div>
            <strong className={`tone-${alert.tone}`}>{alert.tone.toUpperCase()}</strong>
          </div>
        ))}
        {!alertCards.length && <div className="muted">No urgent alerts right now.</div>}
      </div>
    </section>
  );
}
