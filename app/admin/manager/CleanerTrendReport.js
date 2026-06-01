export default function CleanerTrendReport({ cleanerTrendCards }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h3>Cleaner trend view</h3>
          <p className="muted">Quick comparison of completion and exception pressure by cleaner.</p>
        </div>
      </div>

      <div className="task-list">
        {cleanerTrendCards.map((cleaner) => (
          <div className="task-row" key={cleaner.staff}>
            <div>
              <strong>{cleaner.staff}</strong>
              <div className="muted">{cleaner.completed}/{cleaner.total} tasks complete</div>
            </div>
            <div className="flag-row">
              <span className="flag">{cleaner.completion}% complete</span>
              <span className={`flag ${cleaner.issueCount ? 'tone-red' : 'tone-green'}`}>{cleaner.issueCount} issues</span>
            </div>
          </div>
        ))}
        {!cleanerTrendCards.length && <div className="muted">No cleaner trends available yet.</div>}
      </div>
    </section>
  );
}
