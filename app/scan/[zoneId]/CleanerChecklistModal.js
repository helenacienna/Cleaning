'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CleanerTaskFlow from './CleanerTaskFlow';

export default function CleanerChecklistModal({ tasks, label, staffName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dailyReportUrl, setDailyReportUrl] = useState('');
  const [dailyReportStatus, setDailyReportStatus] = useState('idle');
  const dailyReportRequestRef = useRef(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function refreshProgress() {
    startTransition(() => {
      router.refresh();
    });
  }

  function handleOpen() {
    refreshProgress();
    setDailyReportUrl('');
    setDailyReportStatus('idle');
    dailyReportRequestRef.current = null;
    setIsOpen(true);
  }

  async function createDailyReport() {
    if (!tasks.length) {
      return '';
    }

    if (dailyReportUrl) {
      return dailyReportUrl;
    }

    if (dailyReportRequestRef.current) {
      return dailyReportRequestRef.current;
    }

    setDailyReportStatus('creating');
    dailyReportRequestRef.current = fetch('/api/cleaner-daily-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskIds: tasks.map((task) => task.id),
        facility: label,
        staffName,
        day: tasks.find((task) => task.boardDayKey)?.boardDayKey ?? '',
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to create daily report');
        }
        const result = await response.json();
        const reportUrl = result?.reportUrl || '/admin/inbox';
        setDailyReportUrl(reportUrl);
        setDailyReportStatus('ready');
        return reportUrl;
      })
      .catch(() => {
        setDailyReportUrl('/admin/inbox');
        setDailyReportStatus('error');
        return '/admin/inbox';
      });

    return dailyReportRequestRef.current;
  }

  function handleComplete() {
    void createDailyReport();
    refreshProgress();
    setIsOpen(false);
  }

  useEffect(() => {
    document.body.classList.toggle('modal-open', isOpen);
    return () => document.body.classList.remove('modal-open');
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
            <header className="modal-header compact-modal-header active-list-header">
              <strong>{label} Active List</strong>
              <div className="workflow-banner-actions active-list-actions">
                <button className="button secondary" type="button" onClick={refreshProgress}>
                  Refresh
                </button>
                <button className="button secondary close-modal-button" type="button" onClick={() => setIsOpen(false)}>Close</button>
              </div>
            </header>

            <CleanerTaskFlow
              tasks={tasks}
              onTaskSaved={refreshProgress}
              onAllTasksCompleted={createDailyReport}
              reportUrl={dailyReportUrl}
              reportStatus={dailyReportStatus}
              onComplete={handleComplete}
            />
          </div>
        </div>
      )}
    </>
  );
}
