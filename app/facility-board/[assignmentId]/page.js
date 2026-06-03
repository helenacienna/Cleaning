import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cleanerAssignments } from '../../../data/demo-data';

function statusClass(status) {
  return `task-status status-${status}`;
}

function formatTaskLabel(status = '') {
  return status.replace('-', ' ');
}

function groupAssignmentTasks(tasks = []) {
  const groups = new Map();

  tasks.forEach((task, index) => {
    const key = `${task.zone}__${task.taskGroup}`;
    if (!groups.has(key)) {
      groups.set(key, {
        zone: task.zone,
        taskGroup: task.taskGroup,
        tasks: [],
      });
    }

    groups.get(key).tasks.push({ ...task, displayOrder: index + 1 });
  });

  return Array.from(groups.values()).map((group) => {
    const completed = group.tasks.filter((task) => task.status === 'completed').length;
    const total = group.tasks.length;
    return {
      ...group,
      completed,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });
}

export async function generateStaticParams() {
  return cleanerAssignments.map((assignment) => ({ assignmentId: assignment.id }));
}

export async function generateMetadata({ params }) {
  const { assignmentId } = await params;
  const assignment = cleanerAssignments.find((item) => item.id === assignmentId);

  return {
    title: assignment ? `${assignment.location} · Facility board` : 'Facility board',
  };
}

export default async function FacilityBoardPage({ params }) {
  const { assignmentId } = await params;
  const assignment = cleanerAssignments.find((item) => item.id === assignmentId);

  if (!assignment) {
    notFound();
  }

  const grouped = groupAssignmentTasks(assignment.tasks);
  const totalZones = new Set(grouped.map((group) => group.zone)).size;

  return (
    <main className="page facility-board-detail-shell">
      <section className="card facility-board-detail-hero">
        <div className="facility-board-detail-top">
          <div className="facility-board-detail-title-block">
            <span className="badge">Facility board</span>
            <h1>{assignment.location}</h1>
            <p className="muted">{(assignment.zones?.length ? assignment.zones : [assignment.zone]).join(' · ')}</p>
          </div>
          <div className="cta-row no-top-gap facility-board-detail-actions">
            <Link className="button secondary" href="/">Back to dashboard</Link>
            <Link className="button secondary" href={`/scan/${assignment.id}`}>Open cleaner checklist</Link>
          </div>
        </div>

        <div className="facility-board-detail-kpis">
          <div className="card">
            <span className="muted">Shift</span>
            <strong>{assignment.shift}</strong>
          </div>
          <div className="card">
            <span className="muted">Progress</span>
            <strong>{assignment.stats.completed}/{assignment.stats.total} done</strong>
          </div>
          <div className="card">
            <span className="muted">Photo checks</span>
            <strong>{assignment.stats.photoRequired}</strong>
          </div>
          <div className="card">
            <span className="muted">Zones</span>
            <strong>{totalZones}</strong>
          </div>
          <div className="card">
            <span className="muted">Task groups</span>
            <strong>{grouped.length}</strong>
          </div>
          <div className="card">
            <span className="muted">Assignment ID</span>
            <strong>{assignment.id}</strong>
          </div>
        </div>

        <div className="progress"><span style={{ width: `${assignment.progress}%` }} /></div>
      </section>

      <section className="facility-board-detail-zones">
        {grouped.map((group) => (
          <article className="card facility-board-zone-card" key={`${assignment.id}-${group.zone}-${group.taskGroup}`}>
            <div className="facility-board-zone-header">
              <div className="facility-board-zone-title">
                <h3>{group.taskGroup}</h3>
                <p className="muted">{group.zone}</p>
              </div>
              <div className="badge">{group.completed}/{group.total} complete</div>
            </div>

            <div className="progress"><span style={{ width: `${group.progress}%` }} /></div>

            <div className="facility-board-task-list">
              {group.tasks.map((task) => (
                <div className="task-row facility-board-task-row" key={task.id}>
                  <div>
                    <strong>#{String(task.displayOrder).padStart(3, '0')} · {task.title}</strong>
                  </div>
                  <span className={`${statusClass(task.status)}`}>{formatTaskLabel(task.status)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
