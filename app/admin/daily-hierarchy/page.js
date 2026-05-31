import Link from 'next/link';
import AllocationBoard from '../calendar/AllocationBoard';
import { scheduleBuilder } from '../../../data/demo-data';

export const metadata = {
  title: 'Daily Hierarchy · Cienna Cleaning',
};

export default function DailyHierarchyPage() {
  return (
    <main className="page admin-calendar-page daily-hierarchy-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Daily hierarchy board</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/admin/calendar">Back to calendar</Link>
          <span className="badge">Full screen daily planner</span>
        </div>
      </div>

      <AllocationBoard
        board={scheduleBuilder.allocationBoard}
        initialView="daily"
        lockView
        title="Daily hierarchy view"
        description="See the whole day by shift time, then drill into facilities, zones, and task groups only when needed."
      />
    </main>
  );
}
