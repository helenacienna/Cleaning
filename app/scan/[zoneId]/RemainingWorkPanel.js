'use client';

import { useEffect, useMemo, useState } from 'react';

function taskBucketLabel(task) {
  if (task.frequency === 'daily') return `Daily revisit · Grade ${task.score ?? '—'}/5`;
  return `${String(task.frequency || 'periodic').toUpperCase()} scheduled`;
}

export default function RemainingWorkPanel({ facility, day, currentStaff, onSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [revisitTasks, setRevisitTasks] = useState([]);
  const [periodicTasks, setPeriodicTasks] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [message, setMessage] = useState('');

  async function loadRemaining() {
    if (!facility || !day) return;
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ facility, day });
      const response = await fetch(`/api/cleaner-remaining?${params.toString()}`);
      if (!response.ok) throw new Error('Unable to load remaining work');
      const data = await response.json();
      const tasks = [...(data.revisitTasks ?? []), ...(data.periodicTasks ?? [])];
      setStaff(data.staff ?? []);
      setRevisitTasks(data.revisitTasks ?? []);
      setPeriodicTasks(data.periodicTasks ?? []);
      setAssignments(Object.fromEntries(tasks.map((task) => [task.id, task.assignedStaff || currentStaff || 'Unallocated'])));
    } catch {
      setMessage('Could not load remaining work. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRemaining();
  }, [facility, day]);

  const allTasks = useMemo(() => [...revisitTasks, ...periodicTasks], [revisitTasks, periodicTasks]);
  const assignedToCurrentStaff = allTasks.filter((task) => (assignments[task.id] || task.assignedStaff) === currentStaff);

  async function submitAssignments() {
    setSaving(true);
    setMessage('Saving assignments…');
    try {
      const payload = {
        assignments: allTasks.map((task) => ({
          taskInstanceId: task.id,
          staffName: assignments[task.id] || task.assignedStaff || 'Unallocated',
        })),
      };
      const response = await fetch('/api/cleaner-remaining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Unable to save assignments');
      const data = await response.json();
      setMessage(`Assignments saved (${data.updated ?? 0} tasks).`);
      onSubmitted?.(assignedToCurrentStaff);
    } catch {
      setMessage('Could not save assignments. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="task-row"><strong>Loading remaining work…</strong></div>;
  }

  return (
    <div className="compact-flow remaining-work-panel">
      <div className="workflow-banner">
        <div>
          <strong>Daily tasks complete</strong>
          <div className="muted">Review remaining work for {facility}: daily correction items plus scheduled periodic tasks.</div>
        </div>
        <span className="badge">{revisitTasks.length} revisits · {periodicTasks.length} periodic</span>
      </div>

      {message ? <div className="tone-amber" style={{ fontSize: 14 }}>{message}</div> : null}

      <div className="compact-task-list">
        {allTasks.length ? allTasks.map((task) => (
          <article className="compact-task-card" key={task.id}>
            <span className={`completion-bubble ${task.frequency === 'daily' ? 'completion-open' : 'completion-done'}`}>{taskBucketLabel(task)}</span>
            <div className="compact-task-top">
              <div className="task-number">{task.frequency === 'daily' ? 'R' : 'P'}</div>
              <div className="compact-task-copy">
                <div className="compact-task-zone">{task.zone}</div>
                <div className="compact-task-title">{task.title}</div>
                <div className="muted">{task.taskGroup}</div>
              </div>
            </div>
            <label className="builder-field">
              <span className="muted">Allocated to</span>
              <select value={assignments[task.id] || task.assignedStaff || 'Unallocated'} onChange={(event) => setAssignments((existing) => ({ ...existing, [task.id]: event.target.value }))}>
                <option value="Unallocated">Unallocated</option>
                {staff.map((staffMember) => <option key={staffMember.id} value={staffMember.fullName}>{staffMember.fullName}</option>)}
              </select>
            </label>
          </article>
        )) : (
          <article className="compact-task-card current-task-card graded-task-card">
            <span className="completion-bubble completion-done">Clear</span>
            <h3>No remaining work</h3>
            <div className="muted">There are no periodic tasks or daily correction items for this facility today.</div>
          </article>
        )}
      </div>

      <div className="compact-actions">
        <button className="button secondary" type="button" onClick={loadRemaining} disabled={saving}>Refresh</button>
        <button className="button primary" type="button" onClick={submitAssignments} disabled={saving}>{saving ? 'Saving…' : 'Submit assignments and continue'}</button>
      </div>
    </div>
  );
}
