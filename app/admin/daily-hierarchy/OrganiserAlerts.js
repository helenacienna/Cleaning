export default function OrganiserAlerts({ board }) {
  const reworkCards = board.cards.filter((card) => card.reworkRequired || card.managerAction === 'reassign' || card.status === 'carried-forward');
  const overdueCards = board.cards.filter((card) => card.managerAction === 'monitor' || card.hasOpenIssue);
  const inboxSummary = board.inboxSummary ?? { unread: 0, supervisorUnread: 0, cleanerUnread: 0 };
  const validationSummary = board.validationSummary ?? { issues: [], templatesAffected: 0, instancesAffected: 0 };

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="panel-title">
        <div>
          <h3>Board alerts</h3>
          <p className="muted">Tasks that need reshuffling, reassignment, or attention before the shift slips.</p>
        </div>
        <span className="badge">{reworkCards.length + overdueCards.length} alerts</span>
      </div>

      <div className="task-list">
        <div className="task-row">
          <div>
            <strong>Rework queue</strong>
            <div className="muted">Tasks returned by managers and waiting on the main board.</div>
          </div>
          <strong className={reworkCards.length ? 'tone-amber' : 'tone-green'}>{reworkCards.length}</strong>
        </div>
        <div className="task-row">
          <div>
            <strong>Issue / overdue pressure</strong>
            <div className="muted">Tasks with open issue flags or watch-state follow-up.</div>
          </div>
          <strong className={overdueCards.length ? 'tone-red' : 'tone-green'}>{overdueCards.length}</strong>
        </div>
        <div className="task-row">
          <div>
            <strong>Inbox activity</strong>
            <div className="muted">Unread manager, supervisor, and cleaner operational replies.</div>
          </div>
          <div className="flag-row">
            <span className={`flag ${inboxSummary.unread ? 'tone-red' : 'tone-green'}`}>Manager {inboxSummary.unread}</span>
            <span className={`flag ${inboxSummary.supervisorUnread ? 'tone-amber' : 'tone-green'}`}>Supervisor {inboxSummary.supervisorUnread}</span>
            <span className={`flag ${inboxSummary.cleanerUnread ? 'tone-blue' : 'tone-green'}`}>Cleaner {inboxSummary.cleanerUnread}</span>
          </div>
        </div>
        <div className="task-row">
          <div>
            <strong>Task rule mismatches</strong>
            <div className="muted">Instances that do not align with their template cadence or anchored weekday rules.</div>
          </div>
          <div className="flag-row">
            <span className={`flag ${validationSummary.issues.length ? 'tone-red' : 'tone-green'}`}>{validationSummary.issues.length} issues</span>
            <span className="flag">{validationSummary.templatesAffected} templates</span>
            <span className="flag">{validationSummary.instancesAffected} instances</span>
          </div>
        </div>
      </div>
    </section>
  );
}
