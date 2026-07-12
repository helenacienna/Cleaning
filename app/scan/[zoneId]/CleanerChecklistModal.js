'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CleanerTaskFlow from './CleanerTaskFlow';
import RemainingWorkPanel from './RemainingWorkPanel';

const CHECKLIST_REFRESH_MS = 2000;

export default function CleanerChecklistModal({ tasks, label, staffName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState('daily');
  const [assignedRemainingTasks, setAssignedRemainingTasks] = useState([]);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function refreshProgress() {
    startTransition(() => {
      router.refresh();
    });
  }

  const dailyTasks = tasks.filter((task) => !task.frequency || task.frequency === 'daily');
  const activeTasks = stage === 'assigned' && assignedRemainingTasks.length ? assignedRemainingTasks : tasks.filter((task) => task.frequency && task.frequency !== 'daily');
  const boardDay = tasks.find((task) => task.boardDayKey)?.boardDayKey ?? '';

  function handleOpen() {
    refreshProgress();
    setStage('daily');
    setAssignedRemainingTasks([]);
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
                <strong>{label} {stage === 'daily' ? 'Daily List' : stage === 'remaining' ? 'Remaining Work' : 'Assigned Active List'}</strong>
              </div>
              <div className="workflow-banner-actions">
                <button className="button secondary" type="button" onClick={refreshProgress}>
                  Refresh progress
                </button>
                <button className="button secondary close-modal-button" type="button" onClick={() => setIsOpen(false)}>Close</button>
              </div>
            </header>

            {stage === 'daily' ? (
              <CleanerTaskFlow
                tasks={dailyTasks}
                onTaskSaved={refreshProgress}
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
