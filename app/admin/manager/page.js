import Link from 'next/link';
import { getManagerOverviewData } from '../../../lib/manager-data';

export const metadata = {
  title: 'Manager Overview · Cienna Cleaning',
};

function getStatusTone(value, warnAt = 1) {
  return value >= warnAt ? 'tone-red' : 'tone-green';
}

export default async function ManagerOverviewPage() {
  const {
    publishedDays,
    activeShifts,
    totalTasks,
    completedTasks,
    completionRate,
    lowScoreTasks,
    exceptionTasks,
    facilitySummary,
    supervisorSnapshot,
    source,
  } = await getManagerOverviewData();

  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Manager overview</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
          <span className="badge">Oversight view</span>
          <span className="badge">{source === 'prisma' ? 'Live runtime data' : 'Demo fallback'}</span>
        </div>
      </div>

      <section className="workflow-banner no-top-gap">
        <div>
          <span className="badge">Manager workflow</span>
          <strong>See published work, track live completion, and focus on the exceptions that need intervention.</strong>
        </div>
        <div className="workflow-banner-actions">
          <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
          <Link className="button secondary" href="/admin/calendar">Open weekly overview</Link>
        </div>
      </section>

      <section className="supervisor-grid manager-kpi-grid">
        <div className="card">
          <span className="muted">Published shifts</span>
          <strong className="metric">{publishedDays}</strong>
          <div className="muted">Generated daily shift packs ready to run</div>
        </div>
        <div className="card">
          <span className="muted">Active zone runs</span>
          <strong className="metric">{activeShifts}</strong>
          <div className="muted">Cleaner checklist instances across facilities</div>
        </div>
        <div className="card">
          <span className="muted">Live completion</span>
          <strong className="metric tone-green">{completionRate}%</strong>
          <div className="muted">{completedTasks} of {totalTasks} tasks completed</div>
        </div>
        <div className="card">
          <span className="muted">Low score alerts</span>
          <strong className={`metric ${getStatusTone(lowScoreTasks.length)}`}>{lowScoreTasks.length}</strong>
          <div className="muted">Tasks with a 1-2/5 score needing review</div>
        </div>
      </section>

      <section className="manager-layout">
        <div className="manager-main-column">
          <section className="card">
            <div className="panel-title">
              <div>
                <h3>Facility performance</h3>
                <p className="muted">Published work grouped by facility so managers can spot lagging sites quickly.</p>
              </div>
              <span className="badge">{facilitySummary.length} facilities</span>
            </div>

            <div className="manager-facility-grid">
              {facilitySummary.map((facility) => (
                <article className="task-row manager-facility-card" key={facility.location}>
                  <div className="manager-facility-copy">
                    <strong>{facility.location}</strong>
                    <div className="muted">{facility.zoneCount} zones · {facility.completed}/{facility.total} tasks complete</div>
                    <div className="progress"><span style={{ width: `${facility.completion}%` }} /></div>
                  </div>
                  <div className="manager-facility-meta">
                    <span className="flag">{facility.completion}% complete</span>
                    <span className={`flag ${facility.lowScores ? 'tone-red' : 'tone-green'}`}>{facility.lowScores} low scores</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="panel-title">
              <div>
                <h3>Low score interventions</h3>
                <p className="muted">The tasks most likely to need manager follow-up right now.</p>
              </div>
              <span className="badge">{lowScoreTasks.length} alerts</span>
            </div>

            <div className="task-list">
              {lowScoreTasks.slice(0, 8).map(({ id, title, taskGroup, shift, score, note }) => (
                <div className="task-row" key={id}>
                  <div>
                    <strong>{title}</strong>
                    <div className="muted">{shift.location} · {shift.zone} · {taskGroup}</div>
                    {note && <div className="muted">{note}</div>}
                  </div>
                  <div className="flag-row">
                    <span className="flag">{shift.staff}</span>
                    <span className="flag">{shift.day}</span>
                    <span className="task-status status-carried-forward">{score}/5 review</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="manager-side-column">
          <section className="card">
            <div className="panel-title">
              <div>
                <h3>Exceptions queue</h3>
                <p className="muted">Cleaner-reported issues and follow-up tasks likely to need reassignment.</p>
              </div>
              <span className="badge">{exceptionTasks.length} open</span>
            </div>

            <div className="task-list">
              {exceptionTasks.slice(0, 8).map(({ id, title, status, shift, note, photoCount, photos }) => (
                <div className="task-row" key={id}>
                  <div>
                    <strong>{title}</strong>
                    <div className="muted">{shift.location} · {shift.zone}</div>
                    {note && <div className="muted">{note}</div>}
                    {photos?.length > 0 && (
                      <div className="flag-row" style={{ marginTop: 8 }}>
                        {photos.slice(0, 2).map((photo) => (
                          <a key={photo.id} href={photo.photoUrl} target="_blank" rel="noreferrer" className="flag">
                            {photo.photoType} photo
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flag-row">
                    <span className="flag">{shift.staff}</span>
                    <span className={`task-status status-${status}`}>{status.replace('-', ' ')}</span>
                    <span className="flag">{photoCount} photos</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="panel-title">
              <div>
                <h3>Manager snapshot</h3>
                <p className="muted">Fast readout of the operating picture across the portfolio.</p>
              </div>
            </div>

            <div className="task-list">
              {supervisorSnapshot.map((card) => (
                <div className="task-row" key={card.title}>
                  <div>
                    <strong>{card.title}</strong>
                    <div className="muted">{card.note}</div>
                  </div>
                  <strong className={`tone-${card.tone}`}>{card.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
