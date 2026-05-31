import Link from 'next/link';
import ExceptionWorkflow from './ExceptionWorkflow';
import { scheduleBuilder } from '../../../data/demo-data';

export const metadata = {
  title: 'Admin Calendar · Cienna Cleaning',
};

export default function AdminCalendarPage() {
  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Schedule calendar</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <span className="badge">Desktop planning view</span>
        </div>
      </div>

      <section className="card admin-calendar-shell">
        <div className="workflow-banner">
          <div>
            <span className="badge">Workflow</span>
            <strong>This weekly planner is now secondary — the daily hierarchy is the main organiser surface.</strong>
          </div>
          <div className="workflow-banner-actions">
            <Link className="button secondary" href="/admin/task-cards">Task card library</Link>
            <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
            <Link className="button secondary" href="/scan/shift-mon-1-mia-thompson-cienna-north-rooftop">Open cleaner example</Link>
          </div>
        </div>

        <div className="admin-calendar-header">
          <div>
            <h2>Secondary weekly planner</h2>
            <p className="muted">Use this as a supporting overview only — daily hierarchy is now the primary place to organise task cards.</p>
          </div>
        <div className="admin-calendar-controls">
          <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
          <Link className="button secondary" href="/admin/task-cards">Task card library</Link>
          <span className="button secondary">Previous week</span>
          <span className="badge">1–7 June 2026</span>
            <span className="button secondary">Next week</span>
            <span className="button primary">Publish schedule</span>
          </div>
        </div>

        <div className="admin-summary-row">
          <div className="builder-field strong-field">
            <span className="muted">Location</span>
            <strong>{scheduleBuilder.selectedLocation}</strong>
          </div>
          <div className="builder-field strong-field">
            <span className="muted">Active zone</span>
            <strong>{scheduleBuilder.selectedZone}</strong>
          </div>
          <div className="builder-field strong-field">
            <span className="muted">Cleaner</span>
            <strong>{scheduleBuilder.assignedCleaner}</strong>
          </div>
          <div className="builder-field strong-field">
            <span className="muted">Run style</span>
            <strong>{scheduleBuilder.shift}</strong>
          </div>
        </div>

        <div className="calendar-grid admin-week-grid">
          {scheduleBuilder.calendarDays.map((day) => (
            <div className={`calendar-day ${day.dayType === 'weekend' ? 'weekend-day' : ''}`} key={day.date}>
              <div className="calendar-date-row">
                <strong>{day.date}</strong>
                <span className="muted">{day.jobs.length ? `${day.jobs.length} job groups` : 'No runs'}</span>
              </div>
              <div className="calendar-jobs">
                {day.jobs.length ? day.jobs.map((job) => (
                  <div className={`admin-calendar-job ${job.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} key={`${day.date}-${job.jobOrderStart}-${job.zone}`}>
                    <div className="admin-job-time">Job order {job.jobOrderStart}</div>
                    <strong>{job.groupName}</strong>
                    <span>{job.facility}</span>
                    <span>{job.zone}</span>
                    <small>{job.count} tasks</small>
                  </div>
                )) : <span className="empty-day">Unscheduled</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ExceptionWorkflow workflow={scheduleBuilder.exceptionWorkflow} />
    </main>
  );
}
