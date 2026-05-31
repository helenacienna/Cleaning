import {
  appSummary,
  cleanerAssignments,
  supervisorCards,
  taskLibrary,
  reports,
  qrZones,
  scheduleBuilder,
} from '../data/demo-data';
import Link from 'next/link';

function statusClass(status) {
  return `task-status status-${status}`;
}

export default function HomePage() {
  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <p>{appSummary.suiteLabel}</p>
          <h1>{appSummary.appName}</h1>
        </div>
        <div className="badge-row">
          <span className="badge">Mobile-first cleaner workflow</span>
          <span className="badge">Railway-ready</span>
          <span className="badge">Audit-grade history</span>
        </div>
      </div>

      <section className="hero">
        <div className="card hero-copy">
          <div className="tab-row">
            <span className="tab active">Cleaner app</span>
            <span className="tab">Supervisor dashboard</span>
            <span className="tab">Admin controls</span>
          </div>
          <h2>Reusable task cards, QR zones, and proof-driven cleaning operations.</h2>
          <p>
            This first build pass is designed as a Cienna-suite style operations app: task-card based,
            schedule-aware, historically auditable, and simple enough for cleaners to move through fast.
          </p>
          <div className="kpi-grid">
            <div className="card kpi">
              <span className="muted">Completion rate</span>
              <strong>{appSummary.completionRate}%</strong>
            </div>
            <div className="card kpi">
              <span className="muted">Completed today</span>
              <strong>{appSummary.completedTasks}</strong>
            </div>
            <div className="card kpi">
              <span className="muted">Pending</span>
              <strong>{appSummary.pendingTasks}</strong>
            </div>
            <div className="card kpi">
              <span className="muted">Photo checks</span>
              <strong>{appSummary.photoVerifications}</strong>
            </div>
          </div>
          <div className="cta-row">
            <a className="button primary" href="#schedule-builder">Start scheduling workflow</a>
            <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
            <Link className="button secondary" href="/scan/assignment-1">Open cleaner QR flow</Link>
            <Link className="button secondary" href="/admin/task-cards">Task cards</Link>
          </div>
        </div>

        <div className="card">
          <div className="panel-title">
            <div>
              <h3>Today</h3>
              <p className="muted">{appSummary.today}</p>
            </div>
            <span className="badge">Random photo verification enabled</span>
          </div>
          <div className="task-list">
            <div className="task-row">
              <div>
                <strong>Overdue tasks</strong>
                <div className="muted">Require carry-forward review</div>
              </div>
              <strong className="tone-red">{appSummary.overdueTasks}</strong>
            </div>
            <div className="task-row">
              <div>
                <strong>Audit evidence</strong>
                <div className="muted">Photos and comments attached to completions</div>
              </div>
              <strong className="tone-blue">Live</strong>
            </div>
            <div className="task-row">
              <div>
                <strong>QR zone access</strong>
                <div className="muted">Cleaner opens task list by scanning zone code</div>
              </div>
              <strong className="tone-green">Ready</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="workflow-strip">
        <div className="workflow-card">
          <span className="badge">Step 1</span>
          <strong>Build the run</strong>
          <p className="muted">Set task order, cleaner, and repeat pattern in the schedule builder.</p>
          <a className="button secondary" href="#schedule-builder">Open schedule builder</a>
        </div>
        <div className="workflow-card">
          <span className="badge">Step 2</span>
          <strong>Organise the shift</strong>
          <p className="muted">Use the organiser board as the main planning surface to drag, reorder, and shape the day.</p>
          <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
        </div>
        <div className="workflow-card">
          <span className="badge">Step 3</span>
          <strong>Review exceptions</strong>
          <p className="muted">Check low scores, problem zones, and task-level exceptions before the shift runs.</p>
          <Link className="button secondary" href="/admin/daily-hierarchy">Review hierarchy alerts</Link>
        </div>
        <div className="workflow-card">
          <span className="badge">Step 4</span>
          <strong>Run the cleaner flow</strong>
          <p className="muted">Open the same checklist view the cleaner uses during the shift.</p>
          <Link className="button secondary" href="/scan/assignment-1">Open cleaner checklist</Link>
        </div>
      </section>

      <section className="supervisor-grid">
        {supervisorCards.map((card) => (
          <div className="card" key={card.title}>
            <span className="muted">{card.title}</span>
            <strong className={`metric tone-${card.tone}`}>{card.value}</strong>
            <div className="muted">{card.note}</div>
          </div>
        ))}
      </section>

      <section className="assignment-grid">
        {cleanerAssignments.map((assignment) => (
          <div className="card" key={assignment.id}>
            <div className="panel-title">
              <div>
                <h3>{assignment.zone}</h3>
                <p className="muted">{assignment.location}</p>
              </div>
              <span className="badge">{assignment.shift}</span>
            </div>
            <div className="stat-row">
              <span className="flag">{assignment.stats.completed}/{assignment.stats.total} done</span>
              <span className="flag">{assignment.stats.photoRequired} photo checks</span>
            </div>
            <div className="progress"><span style={{ width: `${assignment.progress}%` }} /></div>
            <div className="qr-link-row">
              <Link className="button secondary" href={`/scan/${assignment.id}`}>Simulate QR scan</Link>
              <span className="muted">/{assignment.id}</span>
            </div>
            <div className="task-list">
              {assignment.tasks.map((task) => (
                <div className="task-row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <div className="flag-row">
                      {task.photoRequired && <span className="flag">Photo required</span>}
                      {task.commentRequired && <span className="flag">Comment required</span>}
                    </div>
                  </div>
                  <span className={statusClass(task.status)}>{task.status.replace('-', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="panel-title">
          <div>
            <h3>QR zone codes</h3>
            <p className="muted">Print one code per physical cleaning zone. Scanning opens the cleaner&apos;s task list for that location.</p>
          </div>
          <span className="badge">Prototype links active</span>
        </div>
        <div className="qr-grid">
          {qrZones.map((zone) => (
            <Link className="qr-card" href={zone.qrUrl} key={zone.id}>
              <div className="fake-qr" aria-hidden="true">
                <span /><span /><span /><span /><span /><span /><span /><span /><span />
              </div>
              <div>
                <strong>{zone.label}</strong>
                <p className="muted">{zone.location}</p>
                <span className="flag">{zone.code}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card schedule-builder" id="schedule-builder">
        <div className="panel-title">
          <div>
            <h3>Schedule builder prototype</h3>
            <p className="muted">Build a repeating run sheet from reusable task templates, then generate dated task instances for history/reporting.</p>
          </div>
          <span className="badge">Draft mode</span>
        </div>

        <div className="schedule-grid">
          <div className="schedule-sidebar">
            <div className="builder-field">
              <span className="muted">Location</span>
              <strong>{scheduleBuilder.selectedLocation}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Zone / QR code</span>
              <strong>{scheduleBuilder.selectedZone}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Frequency</span>
              <strong>{scheduleBuilder.frequency}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Run style</span>
              <strong>{scheduleBuilder.shift}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Assigned cleaner</span>
              <strong>{scheduleBuilder.assignedCleaner}</strong>
            </div>
            <div className="cta-row">
              <span className="button primary">Save schedule draft</span>
              <span className="button secondary">Preview cleaner run sheet</span>
              <Link className="button secondary" href="/admin/task-cards">Edit task cards</Link>
            </div>
          </div>

          <div className="schedule-main">
            <div className="schedule-toolbar">
              <div>
                <h4>Run sheet task order</h4>
                <p className="muted">Job order numbers set the default sequence, but staff can still reorder or split tasks when the day changes.</p>
              </div>
              <span className="badge">{scheduleBuilder.draftTasks.length} task cards</span>
            </div>
            <div className="schedule-task-list">
              {scheduleBuilder.draftTasks.map((task) => (
                <div className="schedule-task" key={task.templateId}>
                  <div className="schedule-task-main">
                    <div className="task-number">{task.order}</div>
                    <div>
                      <strong>{task.title}</strong>
                      <div className="muted">Job #{task.jobOrderNumber} · {task.templateId}</div>
                    </div>
                  </div>
                  <div className="frequency-panel">
                    <span className={`frequency-type ${task.frequencyType === 'Critical' ? 'frequency-critical' : 'frequency-suggestive'}`}>
                      {task.frequencyType}
                    </span>
                    <div>
                      <span className="muted">Task group</span>
                      <strong>{task.taskGroup}</strong>
                    </div>
                    <div>
                      <span className="muted">Zone</span>
                      <strong>{task.zone}</strong>
                    </div>
                    <div>
                      <span className="muted">Facility</span>
                      <strong>{task.facility}</strong>
                    </div>
                  </div>
                  <div className="frequency-panel">
                    <div>
                      <span className="muted">Frequency</span>
                      <strong>{task.frequency}</strong>
                    </div>
                    <div>
                      <span className="muted">Last completed</span>
                      <strong>{task.lastCompleted}</strong>
                    </div>
                    <div>
                      <span className="muted">Suggested due</span>
                      <strong>{task.suggestedDue}</strong>
                    </div>
                  </div>
                  <span className="flag">{task.required}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="generated-panel">
          <div>
            <h4>Generated history keys</h4>
            <p className="muted">The schedule creates unique daily task instances while preserving the reusable task template IDs.</p>
          </div>
          <div className="generated-grid">
            <div className="builder-field strong-field">
              <span className="muted">Repeat rule</span>
              <strong>{scheduleBuilder.repeatRule}</strong>
            </div>
            <div className="builder-field strong-field">
              <span className="muted">Random photo rule</span>
              <strong>{scheduleBuilder.randomPhotoRate}</strong>
            </div>
          </div>
          <div className="instance-list">
            {scheduleBuilder.generatedInstances.map(([date, count, key]) => (
              <div className="instance-row" key={key}>
                <strong>{date}</strong>
                <span className="muted">{count}</span>
                <code>{key}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-panel">
          <div className="schedule-toolbar">
            <div>
              <h4>Calendar planning view</h4>
              <p className="muted">See critical and suggestive work across the week by job order, facility, and zone before publishing schedules.</p>
            </div>
            <div className="calendar-legend">
              <span><i className="legend-dot critical-dot" /> Critical</span>
              <span><i className="legend-dot suggestive-dot" /> Suggestive</span>
            </div>
          </div>

          <div className="calendar-grid">
            {scheduleBuilder.calendarDays.map((day) => (
              <div className={`calendar-day ${day.dayType === 'weekend' ? 'weekend-day' : ''}`} key={day.date}>
                <div className="calendar-date-row">
                  <strong>{day.date}</strong>
                  <span className="muted">{day.jobs.length ? `${day.jobs.length} job groups` : 'No runs'}</span>
                </div>
                <div className="calendar-jobs">
                  {day.jobs.length ? day.jobs.map((job) => (
                    <div className={`calendar-job ${job.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} key={`${day.date}-${job.jobOrderStart}-${job.zone}`}>
                      <strong>Job order {job.jobOrderStart}</strong>
                      <span>{job.groupName}</span>
                      <small>{job.facility} · {job.zone}</small>
                    </div>
                  )) : <span className="empty-day">Unscheduled</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bottom-grid">
        <div className="card">
          <div className="panel-title">
            <div>
              <h3>Task library</h3>
              <p className="muted">Reusable cards that can appear in multiple schedules</p>
            </div>
            <span className="badge">Admin managed</span>
          </div>
          <div className="library-grid">
            {taskLibrary.map((task) => (
              <div className="card" key={task.title}>
                <span className="muted">{task.category}</span>
                <h4>{task.title}</h4>
                <p className="muted">Estimated duration: {task.duration}</p>
                <div className="flag-row">
                  {task.flags.map((flag) => (
                    <span className="flag" key={flag}>{flag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="panel-title">
            <div>
              <h3>Reporting snapshot</h3>
              <p className="muted">Filterable by location, zone, task, cleaner, and date range</p>
            </div>
          </div>
          <div className="report-table">
            {reports.map(([label, value]) => (
              <div className="report-row" key={label}>
                <span className="muted">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="cta-row">
            <span className="button secondary">Supervisor audits</span>
            <span className="button secondary">Issue reports</span>
          </div>
        </div>
      </section>
    </main>
  );
}
