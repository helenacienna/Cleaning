import Link from 'next/link';
import AllocationBoard from '../calendar/AllocationBoard';
import { getOrganiserBoardData } from '../../../lib/app-data';

export const metadata = {
  title: 'Organiser Board · Cienna Cleaning',
};

export default async function DailyHierarchyPage() {
  const { board } = await getOrganiserBoardData();

  return (
    <main className="page admin-calendar-page daily-hierarchy-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Daily organiser board</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/admin/calendar">Back to calendar</Link>
          <span className="badge">Full screen daily planner</span>
        </div>
      </div>

      <section className="workflow-banner no-top-gap">
        <div>
          <span className="badge">Workflow</span>
          <strong>This is now the main organiser board — shape the shift here, then open a zone’s cleaner checklist to run the work on shift.</strong>
        </div>
        <div className="workflow-banner-actions">
          <Link className="button secondary" href="/admin/task-cards">Task card library</Link>
          <Link className="button secondary" href="/admin/calendar">Open weekly overview</Link>
          <Link className="button secondary" href="/scan/shift-mon-1-mia-thompson-cienna-north-rooftop">Open cleaner example</Link>
        </div>
      </section>

      <AllocationBoard
        board={board}
        initialView="daily"
        lockView
        title="Daily organiser board"
        description="Organise the shift by time, facility, zone, and task group — then launch the cleaner checklist from the same structure."
      />
    </main>
  );
}
