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
  expandedZone: '',
  mode: 'cards',
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
  const taskCardsByZone = taskCardMatches.reduce((zones, card) => {
    const zoneName = card.zone || 'No zone';
    if (!zones.has(zoneName)) {
      zones.set(zoneName, []);
    }
    zones.get(zoneName).push(card);
    return zones;
  }, new Map());
  const zoneTaskGroups = [...taskCardsByZone.entries()].sort(([left], [right]) => left.localeCompare(right));
  const selectedZone = addTaskState.expandedZone && taskCardsByZone.has(addTaskState.expandedZone)
    ? addTaskState.expandedZone
    : zoneTaskGroups[0]?.[0] ?? '';
  const selectedZoneTasks = selectedZone ? taskCardsByZone.get(selectedZone) ?? [] : [];

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
                <section className="card" role="dialog" aria-modal="true" aria-label="Add task" style={addTaskCardStyle} onClick={(event) => event.stopPropagation()}>
                  <header style={addTaskHeaderStyle}>
                    <h3 style={{ margin: 0 }}>Add task</h3>
                    <div className="workflow-banner-actions">
                      <button
                        className={addTaskState.mode === 'custom' ? 'button secondary slim' : 'button primary slim'}
                        type="button"
                        onClick={() => setAddTaskState((current) => ({ ...current, mode: current.mode === 'custom' ? 'cards' : 'custom', error: '', success: '' }))}
                        disabled={addTaskState.saving}
                      >
                        {addTaskState.mode === 'custom' ? 'Task cards' : 'Add ad hoc'}
                      </button>
                      <button className="button secondary slim" type="button" onClick={closeAddTaskPopup} disabled={addTaskState.saving}>Close</button>
                    </div>
                  </header>

                  <section className="card" style={addTaskPanelStyle}>
                    {addTaskState.mode === 'custom' ? (
                      <div style={adHocDetailsStyle}>
                        <strong>Ad hoc details</strong>
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
                            rows={8}
                            disabled={addTaskState.saving}
                          />
                        </label>
                        <button className="button primary" type="button" onClick={addCustomTask} disabled={addTaskState.saving || !String(addTaskState.customTitle ?? '').trim()}>
                          {addTaskState.saving ? 'Adding…' : 'Add ad hoc task'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="field-label">
                          <span>Search task list</span>
                          <input
                            type="search"
                            value={addTaskState.search}
                            onChange={(event) => setAddTaskState((current) => ({ ...current, search: event.target.value, expandedZone: '' }))}
                            placeholder="Search task, zone, group or number…"
                            disabled={addTaskState.loading || addTaskState.saving}
                          />
                        </label>
                        <div style={zonePickerStackStyle}>
                          <div style={zoneListStyle} aria-label="Task zones">
                            {addTaskState.loading ? <div className="muted">Loading zones…</div> : null}
                            {!addTaskState.loading && zoneTaskGroups.length ? zoneTaskGroups.map(([zoneName, zoneCards]) => (
                              <button
                                key={zoneName}
                                type="button"
                                className={selectedZone === zoneName ? 'button primary' : 'button secondary'}
                                style={zoneChoiceStyle}
                                onClick={() => setAddTaskState((current) => ({ ...current, expandedZone: zoneName }))}
                                disabled={addTaskState.saving}
                                aria-expanded={selectedZone === zoneName}
                              >
                                <strong>{zoneName}</strong>
                                <span>{zoneCards.length} tasks</span>
                              </button>
                            )) : null}
                            {!addTaskState.loading && !zoneTaskGroups.length ? <div className="muted">No matching zones for this facility.</div> : null}
                          </div>
                          <div style={taskCardListStyle} aria-label={selectedZone ? `${selectedZone} tasks` : 'Zone tasks'}>
                            {selectedZone ? (
                              <div className="muted" style={{ marginBottom: 4 }}>
                                {selectedZone} · {selectedZoneTasks.length} matching tasks
                              </div>
                            ) : null}
                            {!addTaskState.loading && selectedZoneTasks.length ? selectedZoneTasks.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                className="button secondary"
                                style={taskCardChoiceStyle}
                                onClick={() => addTaskForToday({ templateId: card.templateId, title: card.title, zone: card.zone, taskGroup: card.taskGroup })}
                                disabled={addTaskState.saving}
                              >
                                <strong>{card.title}</strong>
                                <span>{card.taskGroup || 'No group'} · {card.frequency || 'manual'} · {card.templateId}</span>
                              </button>
                            )) : null}
                            {!addTaskState.loading && selectedZone && !selectedZoneTasks.length ? <div className="muted">No task cards in this zone.</div> : null}
                          </div>
                        </div>
                      </>
                    )}
                  </section>

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
  width: '100vw',
  height: '100vh',
  maxHeight: '100vh',
  overflow: 'hidden',
  borderRadius: 0,
  boxShadow: 'none',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: 12,
};

const addTaskHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(148,163,184,0.28)',
};

const addTaskPanelStyle = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minHeight: 0,
  overflow: 'hidden',
};

const zonePickerStackStyle = {
  display: 'grid',
  gap: 10,
  alignItems: 'start',
};

const zoneListStyle = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 8,
  WebkitOverflowScrolling: 'touch',
};

const zoneChoiceStyle = {
  display: 'grid',
  justifyItems: 'start',
  textAlign: 'left',
  gap: 2,
  whiteSpace: 'normal',
  minWidth: 150,
  maxWidth: 190,
  flex: '0 0 auto',
};

const taskCardListStyle = {
  display: 'grid',
  gap: 8,
  maxHeight: 'calc(100vh - 260px)',
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

const adHocDetailsStyle = {
  display: 'grid',
  gap: 10,
  alignContent: 'start',
  maxWidth: 720,
};
