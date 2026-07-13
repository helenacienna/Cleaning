'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CleanerTaskFlow from './CleanerTaskFlow';
import RemainingWorkPanel from './RemainingWorkPanel';

const RESUME_REFRESH_COOLDOWN_MS = 5000;

function readStoredChecklistState(label) {
  if (typeof window === 'undefined') {
    return { isOpen: false, stage: 'daily' };
  }

  try {
    const stored = window.sessionStorage.getItem(`cleanerChecklist:${label}`);
    if (!stored) {
      return { isOpen: false, stage: 'daily' };
    }

    const parsed = JSON.parse(stored);
    return {
      isOpen: Boolean(parsed?.isOpen),
      stage: ['daily', 'remaining', 'assigned'].includes(parsed?.stage) ? parsed.stage : 'daily',
    };
  } catch {
    return { isOpen: false, stage: 'daily' };
  }
}

export default function CleanerChecklistModal({ tasks, label, staffName }) {
  const storedChecklistState = readStoredChecklistState(label);
  const [isOpen, setIsOpen] = useState(storedChecklistState.isOpen);
  const [stage, setStage] = useState(storedChecklistState.stage);
  const [assignedRemainingTasks, setAssignedRemainingTasks] = useState([]);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const lastResumeRefreshRef = useRef(0);

  function refreshProgress() {
    startTransition(() => {
      router.refresh();
    });
  }

  const dailyTasks = tasks.filter((task) => !task.frequency || task.frequency === 'daily');
  const activeTasks = stage === 'assigned' && assignedRemainingTasks.length ? assignedRemainingTasks : tasks.filter((task) => task.frequency && task.frequency !== 'daily');
  const boardDay = tasks.find((task) => task.boardDayKey)?.boardDayKey ?? '';

  function closeChecklist() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`cleanerChecklist:${label}`);
    }
    setIsOpen(false);
  }

  function handleOpen() {
    refreshProgress();
    setStage('daily');
    setAssignedRemainingTasks([]);
    setIsOpen(true);
  }

  function handleComplete() {
    refreshProgress();
    closeChecklist();
  }

  useEffect(() => {
    document.body.classList.toggle('modal-open', isOpen);
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isOpen) {
      window.sessionStorage.removeItem(`cleanerChecklist:${label}`);
      return;
    }

    window.sessionStorage.setItem(`cleanerChecklist:${label}`, JSON.stringify({ isOpen: true, stage }));
  }, [isOpen, label, stage]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function refreshAfterResume() {
      if (document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();
      if (now - lastResumeRefreshRef.current < RESUME_REFRESH_COOLDOWN_MS) {
        return;
      }

      lastResumeRefreshRef.current = now;
      refreshProgress();
    }

    document.addEventListener('visibilitychange', refreshAfterResume);
    window.addEventListener('pageshow', refreshAfterResume);
    window.addEventListener('focus', refreshAfterResume);

    return () => {
      document.removeEventListener('visibilitychange', refreshAfterResume);
      window.removeEventListener('pageshow', refreshAfterResume);
      window.removeEventListener('focus', refreshAfterResume);
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
                <strong>{label} {stage === 'daily' ? 'Daily List' : stage === 'remaining' ? 'Remaining Work' : 'Assigned Active List'}</strong>
              </div>
              {stage === 'remaining' ? (
                <div className="workflow-banner-actions">
                  <button className="button secondary" type="button" onClick={refreshProgress}>
                    Refresh progress
                  </button>
                  <button className="button secondary close-modal-button" type="button" onClick={closeChecklist}>Close</button>
                </div>
              ) : null}
            </header>

            {stage === 'daily' ? (
              <CleanerTaskFlow
                tasks={dailyTasks}
                onTaskSaved={refreshProgress}
                onRefreshProgress={refreshProgress}
                onClose={closeChecklist}
                onComplete={() => {
                  refreshProgress();
                  setStage('remaining');
                }}
                completionMode="graded"
                completeLabel="Daily complete — review remaining work"
                completeTitle="Daily tasks complete"
                completeDescription="All daily tasks have been graded. Anything scored 1–3 will be added to the revisit list."
              />
            ) : stage === 'remaining' ? (
              <RemainingWorkPanel
                facility={label}
                day={boardDay}
                currentStaff={staffName}
                onSubmitted={(nextTasks) => {
                  setAssignedRemainingTasks(nextTasks ?? []);
                  refreshProgress();
                  setStage('assigned');
                }}
              />
            ) : (
              <CleanerTaskFlow
                tasks={activeTasks}
                onTaskSaved={refreshProgress}
                onRefreshProgress={refreshProgress}
                onClose={closeChecklist}
                onComplete={handleComplete}
                completeLabel="Submit and close active list"
                completeTitle="Remaining assigned tasks complete"
                completeDescription="Everything currently assigned to you has been graded."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
