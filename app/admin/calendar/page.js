import Link from 'next/link';
import AllocationBoard from './AllocationBoard';
import ExceptionWorkflow from './ExceptionWorkflow';
import { scheduleBuilder } from '../../../data/demo-data';
import { getOrganiserBoardData } from '../../../lib/app-data';

export const metadata = {
  title: 'Admin Calendar · Cienna Cleaning',
};

export default async function AdminCalendarPage() {
  const { board } = await getOrganiserBoardData();

  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Schedule calendar</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
          <span className="badge">Shared planning window</span>
        </div>
      </div>

      <section className="workflow-banner no-top-gap">
        <div>
          <span className="badge">Workflow</span>
          <strong>This weekly overview now rides on the same live organiser board data and planning window controls as the daily planner.</strong>
        </div>
        <div className="workflow-banner-actions">
          <Link className="button secondary" href="/admin/task-cards">Task card library</Link>
          <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
          <Link className="button secondary" href="/scan/shift-mon-1-mia-thompson-cienna-north-rooftop">Open cleaner example</Link>
        </div>
      </section>

      <AllocationBoard
        board={board}
        initialView="weekly"
        lockView
        title="Weekly organiser overview"
        description="Review the same live planning window used by the daily organiser board, then switch to the daily view route without losing the active scheduling horizon."
      />

      <ExceptionWorkflow workflow={scheduleBuilder.exceptionWorkflow} />
    </main>
  );
}
