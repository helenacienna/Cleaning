'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ManagerReviewActions({ taskExecutionId }) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState('');
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState('muted');
  const [savingAction, setSavingAction] = useState('');

  async function submitAction(managerAction) {
    setSavingAction(managerAction);
    setStatus('Saving manager action…');
    setStatusTone('tone-amber');

    try {
      const response = await fetch('/api/manager-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskExecutionId,
          managerAction,
          reviewNote,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to save manager action');
      }

      const result = await response.json();
      setStatus(result.message || 'Manager action saved');
      setStatusTone('tone-green');
      setReviewNote('');
      router.refresh();
    } catch {
      setStatus('Manager action failed');
      setStatusTone('tone-red');
    } finally {
      setSavingAction('');
    }
  }

  return (
    <div className="builder-field" style={{ marginTop: 12, minWidth: 240 }}>
      <span className="muted">Manager review note</span>
      <textarea
        value={reviewNote}
        onChange={(event) => setReviewNote(event.target.value)}
        rows={3}
        placeholder="Add a manager follow-up note"
      />
      <div className="flag-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className="button secondary" type="button" onClick={() => submitAction('monitor')} disabled={Boolean(savingAction)}>
          {savingAction === 'monitor' ? 'Saving…' : 'Mark reviewed'}
        </button>
        <button className="button secondary" type="button" onClick={() => submitAction('reassign')} disabled={Boolean(savingAction)}>
          {savingAction === 'reassign' ? 'Saving…' : 'Require rework'}
        </button>
        <button className="button primary" type="button" onClick={() => submitAction('close')} disabled={Boolean(savingAction)}>
          {savingAction === 'close' ? 'Saving…' : 'Close issue'}
        </button>
      </div>
      {status && <span className={statusTone}>{status}</span>}
    </div>
  );
}
