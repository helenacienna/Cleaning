'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CleanerTaskFlow from './CleanerTaskFlow';

const CHECKLIST_REFRESH_MS = 2000;

export default function CleanerChecklistModal({ tasks, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function refreshProgress() {
    startTransition(() => {
      router.refresh();
    });
  }

  function handleOpen() {
    refreshProgress();
    setIsOpen(true);
  }

  function handleComplete() {
    refreshProgress();
    setIsOpen(false);
  }

  useEffect(() => {
    document.body.classList.toggle('modal-open', isOpen);
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshProgress();
      }
    }, CHECKLIST_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen]);

  return (
    <>
      <section className="card checklist-launch-card">
        <button className="button primary launch-checklist-button" type="button" onClick={handleOpen}>
          Open active checklist
        </button>
      </section>

      {isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${label} active checklist`}>
          <div className="fullscreen-checklist">
            <header className="modal-header compact-modal-header">
              <div>
                <strong>{label} Active List</strong>
              </div>
              <div className="workflow-banner-actions">
                <button className="button secondary" type="button" onClick={refreshProgress}>
                  Refresh progress
                </button>
                <button className="button secondary close-modal-button" type="button" onClick={() => setIsOpen(false)}>Close</button>
              </div>
            </header>

            <CleanerTaskFlow tasks={tasks} onTaskSaved={refreshProgress} onComplete={handleComplete} />
          </div>
        </div>
      )}
    </>
  );
}
