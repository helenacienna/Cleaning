export default function ManagerReporting({ reportingCards, facilitySummary }) {
  return (
    <section className="card">
      <div className="panel-title">
        <div>
          <h3>Reporting snapshot</h3>
          <p className="muted">Quick reporting layer for aging issues and facility risk.</p>
        </div>
      </div>

      <div className="supervisor-grid" style={{ marginBottom: 16 }}>
        {reportingCards.map((card) => (
          <div className="card" key={card.title}>
            <span className="muted">{card.title}</span>
            <strong className={`metric tone-${card.tone}`}>{card.value}</strong>
            <div className="muted">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="task-list">
        {facilitySummary.slice(0, 6).map((facility) => (
          <div className="task-row" key={`${facility.location}-risk`}>
            <div>
              <strong>{facility.location}</strong>
              <div className="muted">{facility.zoneCount} zones · {facility.lowScores} low scores · {facility.openIssues} open issues</div>
            </div>
            <div className="flag-row">
              <span className={`flag ${facility.riskLevel === 'High' ? 'tone-red' : facility.riskLevel === 'Watch' ? 'tone-amber' : 'tone-green'}`}>{facility.riskLevel}</span>
              <span className="flag">{facility.completion}% complete</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
