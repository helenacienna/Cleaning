'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function ExtraTaskScheduleCard({ task, facility, day }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const score = Math.max(0, Math.min(100, task?.standbySuitability?.score ?? 0));
  const ringClass = score >= 90 ? 'score-ring-green' : 'score-ring-amber';
  const style = useMemo(() => ({ '--score': `${score}%` }), [score]);

  async function addToDay() {
    setMessage('Adding to today…');

    try {
      const response = await fetch('/api/facility-extra-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: task.templateId,
          title: task.title,
          zone: task.zone,
          taskGroup: task.taskGroup,
          facility,
          day,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not add task');
      }

      setMessage(payload.alreadyScheduled ? 'Already scheduled for this day.' : 'Added to scheduled tasks.');
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error?.message || 'Could not add task');
    }
  }

  return (
    <div className="task-row facility-board-task-row facility-board-extra-task-row" data-expanded={expanded ? 'true' : 'false'}>
      <button className="facility-board-extra-main" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <div className="facility-board-extra-score-wrap">
          <div className={`facility-board-extra-score-ring ${ringClass}`} style={style}>
            <span>{score}%</span>
          </div>
        </div>
        <div className="facility-board-extra-copy">
          <div className="facility-board-extra-zone">{task.zone}</div>
          <strong className="facility-board-extra-title">{task.title}</strong>
          <div className="facility-board-extra-task-meta">
            <span>◷ Last done: {task.lastCompletedLabel}</span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="facility-board-extra-action-panel">
          <div>
            <strong>Add this to {day}?</strong>
            <p className="muted">It will become a scheduled task for this facility day and appear with the rest of the task list.</p>
            {message ? <p className="facility-board-extra-action-message">{message}</p> : null}
          </div>
          <div className="facility-board-extra-action-buttons">
            <button className="button primary slim" type="button" onClick={addToDay} disabled={isPending || message === 'Adding to today…'}>
              {isPending || message === 'Adding to today…' ? 'Adding…' : 'Add to today'}
            </button>
            <button className="button secondary slim" type="button" onClick={() => { setExpanded(false); setMessage(''); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
