'use client';

import { useEffect, useState } from 'react';
import CleanerTaskFlow from './CleanerTaskFlow';

export default function CleanerChecklistModal({ tasks, zoneName }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('modal-open', isOpen);
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  return (
    <>
      <section className="card checklist-launch-card">
        <div>
          <span className="badge">Active run sheet</span>
          <h2>Today&apos;s checklist</h2>
          <p className="muted">Open the full-screen cleaner workflow when you&apos;re ready to move through the jobs.</p>
        </div>
        <button className="button primary launch-checklist-button" type="button" onClick={() => setIsOpen(true)}>
          Open active checklist
        </button>
      </section>

      {isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${zoneName} active checklist`}>
          <div className="fullscreen-checklist">
            <header className="modal-header compact-modal-header">
              <div>
                <span className="badge">Active checklist</span>
                <strong>{zoneName}</strong>
              </div>
              <div className="workflow-banner-actions">
                <button className="button secondary" type="button" onClick={() => window.location.reload()}>
                  Refresh progress
                </button>
                <button className="button secondary close-modal-button" type="button" onClick={() => setIsOpen(false)}>Close</button>
              </div>
            </header>

            <CleanerTaskFlow tasks={tasks} />
          </div>
        </div>
      )}
    </>
  );
}
