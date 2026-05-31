import Link from 'next/link';
import TaskCardManager from './TaskCardManager';
import { taskCardTemplates } from '../../../data/demo-data';

const zones = [...new Set(taskCardTemplates.map((card) => card.zone))].sort();

export const metadata = {
  title: 'Task Cards · Cienna Cleaning',
};

export default function TaskCardsPage() {
  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Task card library</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/admin/calendar">Open allocation board</Link>
          <span className="badge">Template management</span>
        </div>
      </div>

      <TaskCardManager cards={taskCardTemplates} zones={zones} />
    </main>
  );
}
