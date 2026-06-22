import Link from 'next/link';
import TaskCardManager from './TaskCardManager';
import { getTaskCardLibraryData } from '../../../lib/app-data';

export const metadata = {
  title: 'Task Cards · Cienna Cleaning',
};

export default async function TaskCardsPage({ searchParams }) {
  const { cards, zones } = await getTaskCardLibraryData();
  const resolvedSearchParams = await searchParams;
  const initialTemplateId = typeof resolvedSearchParams?.templateId === 'string' ? resolvedSearchParams.templateId : null;

  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Task card library</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/">Open dashboard</Link>
          <span className="badge">Template management</span>
        </div>
      </div>

      <TaskCardManager cards={cards} zones={zones} initialTemplateId={initialTemplateId} />
    </main>
  );
}
