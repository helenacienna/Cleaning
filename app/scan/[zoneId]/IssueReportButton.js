'use client';

import { useState } from 'react';

export default function IssueReportButton({ taskId }) {
  const [note, setNote] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  async function submitIssue() {
    if (!note.trim()) {
      setStatus('Add an issue note first');
      return;
    }

    setSaving(true);
    setStatus('Saving issue…');

    try {
      const response = await fetch('/api/cleaner-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskInstanceId: taskId,
          note,
          photoNote,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to save issue');
      }

      setStatus('Issue reported');
      setOpen(false);
      setNote('');
      setPhotoNote('');
    } catch {
      setStatus('Issue save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="issue-report-widget">
      <button className="button secondary" type="button" onClick={() => setOpen((value) => !value)}>
        Report issue
      </button>
      {status && <span className="muted">{status}</span>}
      {open && (
        <div className="card">
          <label className="builder-field">
            <span className="muted">Issue note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Describe the site issue" />
          </label>
          <label className="builder-field">
            <span className="muted">Photo note</span>
            <input value={photoNote} onChange={(event) => setPhotoNote(event.target.value)} placeholder="Photo placeholder note" />
          </label>
          <button className="button primary" type="button" onClick={submitIssue} disabled={saving}>
            {saving ? 'Saving…' : 'Save issue'}
          </button>
        </div>
      )}
    </div>
  );
}
