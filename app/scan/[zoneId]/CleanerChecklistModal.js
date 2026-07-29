'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CleanerTaskFlow from './CleanerTaskFlow';
import RemainingWorkPanel from './RemainingWorkPanel';

const RESUME_REFRESH_COOLDOWN_MS = 5000;

const ADD_TASK_EMPTY_STATE = {
  open: false,
  loading: false,
  saving: false,
  error: '',
  success: '',
  search: '',
  cards: [],
  customTitle: '',
  customNotes: '',
};

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

export default function CleanerChecklistModal({ tasks, label, staffName, reportHref = '' }) {
  const storedChecklistState = readStoredChecklistState(label);
  const [isOpen, setIsOpen] = useState(storedChecklistState.isOpen);
  const [stage, setStage] = useState(storedChecklistState.stage);
  const [assignedRemainingTasks, setAssignedRemainingTasks] = useState([]);
  const [dailyReportUrl, setDailyReportUrl] = useState('');
  const [dailyReportStatus, setDailyReportStatus] = useState('idle');
  const [addTaskState, setAddTaskState] = useState(ADD_TASK_EMPTY_STATE);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const lastResumeRefreshRef = useRef(0);
  const dailyReportRequestRef = useRef(null);

  function refreshProgress() {
    startTransition(() => {
      router.refresh();
    });
  }

  const dailyTasks = tasks.filter((task) => !task.addedToday && (!task.frequency || task.frequency === 'daily'));
  const assignedTasks = tasks.filter((task) => task.addedToday || (task.frequency && task.frequency !== 'daily'));
  const effectiveStage = stage === 'daily' && !dailyTasks.length ? 'assigned' : stage;
  const activeTasks = effectiveStage === 'assigned' && assignedRemainingTasks.length ? assignedRemainingTasks : assignedTasks;
  const boardDay = tasks.find((task) => task.boardDayKey)?.boardDayKey ?? '';

  function closeChecklist() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`cleanerChecklist:${label}`);
    }
    setIsOpen(false);
  }

  function handleOpen() {
    refreshProgress();
    setStage(dailyTasks.length ? 'daily' : 'assigned');
    setAssignedRemainingTasks([]);
    setDailyReportUrl('');
    setDailyReportStatus('idle');
    dailyReportRequestRef.current = null;
    setIsOpen(true);
  }

  async function openAddTaskPopup() {
    setAddTaskState((current) => ({ ...ADD_TASK_EMPTY_STATE, open: true, loading: true, cards: current.cards ?? [] }));
    try {
      const response = await fetch('/api/task-library', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.cards)) {
        throw new Error(payload?.error || 'Unable to load task cards');
      }
      setAddTaskState((current) => ({
        ...current,
        loading: false,
        cards: payload.cards.filter((card) => card.active !== false && (!card.facility || card.facility === label)),
      }));
    } catch (error) {
      setAddTaskState((current) => ({ ...current, loading: false, error: error.message || 'Could not load task cards.' }));
    }
  }

  function closeAddTaskPopup() {
    if (addTaskState.saving) return;
    setAddTaskState(ADD_TASK_EMPTY_STATE);
  }

  async function addTaskForToday(payload) {
    if (!boardDay || addTaskState.saving) return;
    setAddTaskState((current) => ({ ...current, saving: true, error: '', success: '' }));
    try {
      const response = await fetch('/api/facility-extra-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility: label,
          day: boardDay,
          staffName,
          ...payload,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Unable to add task');
      }
      setAddTaskState((current) => ({
        ...current,
        saving: false,
        success: result.alreadyScheduled ? 'That task is already on today’s list.' : 'Added to today’s active list.',
      }));
      setAssignedRemainingTasks([]);
      refreshProgress();
      setStage('assigned');
      window.setTimeout(() => {
        closeAddTaskPopup();
      }, 900);
    } catch (error) {
      setAddTaskState((current) => ({ ...current, saving: false, error: error.message || 'Could not add task.' }));
    }
  }

  async function addCustomTask() {
    const title = String(addTaskState.customTitle ?? '').trim();
    if (!title) {
      setAddTaskState((current) => ({ ...current, error: 'Add a task name first.' }));
      return;
    }
    await addTaskForToday({
      customTask: true,
      title,
      notes: String(addTaskState.customNotes ?? '').trim(),
    });
  }

  const taskCardMatches = addTaskState.cards.filter((card) => {
    const query = addTaskState.search.trim().toLowerCase();
    if (!query) return true;
    return [card.title, card.zone, card.taskGroup, card.templateId, card.frequency]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  async function createDailyReport() {
    if (!dailyTasks.length) {
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
        taskIds: dailyTasks.map((task) => task.id),
        facility: label,
        staffName,
        day: boardDay,
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

  async function openDailyReport() {
    const reportUrl = await createDailyReport();
    if (reportUrl && typeof window !== 'undefined') {
      window.location.href = reportUrl;
    }
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

    window.sessionStorage.setItem(`cleanerChecklist:${label}`, JSON.stringify({ isOpen: true, stage: effectiveStage }));
  }, [isOpen, label, stage, effectiveStage]);

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
        {reportHref ? (
          <a className="button secondary launch-checklist-button" href={reportHref}>
            Open report
          </a>
        ) : null}
      </section>

      {isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${label} active checklist`}>
          <div className="fullscreen-checklist">
            <header className="modal-header compact-modal-header">
              <div className="workflow-banner-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="button secondary slim" type="button" onClick={openAddTaskPopup} disabled={!boardDay}>
                  Add task
                </button>
                <strong>{label} {effectiveStage === 'daily' ? 'Daily List' : effectiveStage === 'remaining' ? 'Remaining Work' : 'Assigned Active List'}</strong>
              </div>
              {effectiveStage === 'remaining' ? (
                <div className="workflow-banner-actions">
                  <button className="button secondary" type="button" onClick={refreshProgress}>
                    Refresh progress
                  </button>
                  <button className="button secondary close-modal-button" type="button" onClick={closeChecklist}>Close</button>
                </div>
              ) : null}
            </header>

            {addTaskState.open ? (
              <div className="modal-backdrop" role="presentation" style={addTaskBackdropStyle} onClick={closeAddTaskPopup}>
                <section className="card" role="dialog" aria-modal="true" aria-label="Add task for today" style={addTaskCardStyle} onClick={(event) => event.stopPropagation()}>
                  <div className="panel-title" style={{ marginBottom: 12 }}>
                    <div>
                      <h3>Add task for today</h3>
                      <p className="muted">Choose an existing task card or add a one-off ad hoc task. It will be added to today’s active assigned list only.</p>
                    </div>
                    <button className="button secondary slim" type="button" onClick={closeAddTaskPopup} disabled={addTaskState.saving}>Close</button>
                  </div>

                  <div style={addTaskGridStyle}>
                    <section className="card" style={addTaskPanelStyle}>
                      <strong>Choose task card</strong>
                      <label className="field-label" style={{ marginTop: 10 }}>
                        <span>Search task list</span>
                        <input
                          type="search"
                          value={addTaskState.search}
                          onChange={(event) => setAddTaskState((current) => ({ ...current, search: event.target.value }))}
                          placeholder="Search by task, zone, group or number…"
                          disabled={addTaskState.loading || addTaskState.saving}
                        />
                      </label>
                      <div style={taskCardListStyle}>
                        {addTaskState.loading ? <div className="muted">Loading task cards…</div> : null}
                        {!addTaskState.loading && taskCardMatches.length ? taskCardMatches.slice(0, 80).map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            className="button secondary"
                            style={taskCardChoiceStyle}
                            onClick={() => addTaskForToday({ templateId: card.templateId, title: card.title, zone: card.zone, taskGroup: card.taskGroup })}
                            disabled={addTaskState.saving}
                          >
                            <strong>{card.title}</strong>
                            <span>{card.zone || 'No zone'} · {card.taskGroup || 'No group'} · {card.frequency || 'manual'}</span>
                          </button>
                        )) : null}
                        {!addTaskState.loading && !taskCardMatches.length ? <div className="muted">No matching task cards for this facility.</div> : null}
                      </div>
                    </section>

                    <section className="card" style={addTaskPanelStyle}>
                      <strong>Custom ad hoc task</strong>
                      <label className="field-label" style={{ marginTop: 10 }}>
                        <span>Task name</span>
                        <input
                          value={addTaskState.customTitle}
                          onChange={(event) => setAddTaskState((current) => ({ ...current, customTitle: event.target.value }))}
                          placeholder="e.g. Clean spill near lift"
                          disabled={addTaskState.saving}
                        />
                      </label>
                      <label className="field-label">
                        <span>Notes</span>
                        <textarea
                          value={addTaskState.customNotes}
                          onChange={(event) => setAddTaskState((current) => ({ ...current, customNotes: event.target.value }))}
                          placeholder="Optional details"
                          rows={5}
                          disabled={addTaskState.saving}
                        />
                      </label>
                      <button className="button primary" type="button" onClick={addCustomTask} disabled={addTaskState.saving || !String(addTaskState.customTitle ?? '').trim()}>
                        {addTaskState.saving ? 'Adding…' : 'Add ad hoc task'}
                      </button>
                    </section>
                  </div>

                  {addTaskState.error ? <div className="tone-red" style={{ marginTop: 10 }}>{addTaskState.error}</div> : null}
                  {addTaskState.success ? <div className="tone-green" style={{ marginTop: 10 }}>{addTaskState.success}</div> : null}
                </section>
              </div>
            ) : null}

            {effectiveStage === 'daily' ? (
              <CleanerTaskFlow
                tasks={dailyTasks}
                onTaskSaved={refreshProgress}
                onRefreshProgress={refreshProgress}
                onClose={closeChecklist}
                onAllTasksCompleted={createDailyReport}
                onOpenReport={openDailyReport}
                reportUrl={dailyReportUrl}
                reportStatus={dailyReportStatus}
                onComplete={() => {
                  void createDailyReport();
                  refreshProgress();
                  setStage('remaining');
                }}
                completionMode="graded"
                completeLabel="Daily complete — review remaining work"
                completeTitle="Daily tasks complete"
                completeDescription="All daily tasks have been graded. Anything scored 1–3 will be added to the revisit list."
              />
            ) : effectiveStage === 'remaining' ? (
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

const addTaskBackdropStyle = {
  zIndex: 1200,
  background: 'rgba(2,6,23,0.72)',
};

const addTaskCardStyle = {
  width: 'min(920px, calc(100vw - 24px))',
  maxHeight: '88vh',
  overflow: 'auto',
  boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
};

const addTaskGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 12,
};

const addTaskPanelStyle = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
};

const taskCardListStyle = {
  display: 'grid',
  gap: 8,
  maxHeight: 420,
  overflow: 'auto',
  paddingRight: 4,
};

const taskCardChoiceStyle = {
  display: 'grid',
  justifyItems: 'start',
  textAlign: 'left',
  gap: 3,
  whiteSpace: 'normal',
};
