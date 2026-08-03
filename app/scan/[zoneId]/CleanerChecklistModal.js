'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CleanerTaskFlow from './CleanerTaskFlow';
import RemainingWorkPanel from './RemainingWorkPanel';

const RESUME_REFRESH_COOLDOWN_MS = 5000;

function serviceLevelLabel(value) {
  if (value === 'check') return 'Check';
  if (value === 'detailed_clean') return 'Detailed clean';
  return 'Clean';
}

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
  staff: [],
  pendingTask: null,
  customTitle: '',
  customNotes: '',
  cleanerNote: '',
  selectedServiceLevel: 'clean',
  selectedStaff: null,
};

const SERVICE_LEVEL_OPTIONS = [
  { value: 'check', label: 'Check' },
  { value: 'clean', label: 'Clean' },
  { value: 'detailed_clean', label: 'Detailed clean' },
];

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
  const addedTasks = tasks.filter((task) => task.addedToday);
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
    setAddTaskState((current) => ({ ...ADD_TASK_EMPTY_STATE, open: true, loading: true, cards: current.cards ?? [], staff: current.staff ?? [] }));
    try {
      const [taskResponse, staffResponse] = await Promise.all([
        fetch(`/api/task-library?facility=${encodeURIComponent(label)}&day=${encodeURIComponent(boardDay)}`, { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
      ]);
      const taskPayload = await taskResponse.json().catch(() => null);
      const staffPayload = await staffResponse.json().catch(() => null);
      if (!taskResponse.ok || !Array.isArray(taskPayload?.cards)) {
        throw new Error(taskPayload?.error || 'Unable to load task cards');
      }
      if (!staffResponse.ok || !Array.isArray(staffPayload?.staff)) {
        throw new Error(staffPayload?.error || 'Unable to load staff');
      }
      setAddTaskState((current) => ({
        ...current,
        loading: false,
        cards: taskPayload.cards.filter((card) => card.active !== false && (!card.facility || card.facility === label)),
        staff: staffPayload.staff.filter((member) => member.active !== false && member.role === 'cleaner'),
      }));
    } catch (error) {
      setAddTaskState((current) => ({ ...current, loading: false, error: error.message || 'Could not load task cards and staff.' }));
    }
  }

  function closeAddTaskPopup() {
    if (addTaskState.saving) return;
    setAddTaskState(ADD_TASK_EMPTY_STATE);
  }

  function selectTaskForAllocation(taskPayload) {
    setAddTaskState((current) => ({
      ...current,
      mode: 'allocate',
      pendingTask: taskPayload,
      selectedStaff: null,
      selectedServiceLevel: taskPayload?.serviceLevel ?? 'clean',
      cleanerNote: taskPayload?.notes ?? '',
      error: '',
      success: '',
    }));
  }

  async function addTaskForToday(payload, staffMember = null) {
    if (!boardDay || addTaskState.saving) return;
    setAddTaskState((current) => ({ ...current, saving: true, error: '', success: '' }));
    try {
      const response = await fetch('/api/facility-extra-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility: label,
          day: boardDay,
          staffName: staffMember?.fullName ?? staffName,
          staffId: staffMember?.id ?? undefined,
          ...payload,
          serviceLevel: addTaskState.selectedServiceLevel,
          notes: String(addTaskState.cleanerNote ?? '').trim() || String(payload?.notes ?? '').trim(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Unable to add task');
      }
      setAddTaskState((current) => ({
        ...current,
        saving: false,
        success: result.alreadyScheduled ? 'That task is already on today’s list.' : `Added to ${(staffMember?.fullName ?? staffName) || 'today’s active list'}.`,
      }));
      setAssignedRemainingTasks([]);
      refreshProgress();
      window.setTimeout(() => {
        closeAddTaskPopup();
      }, 900);
    } catch (error) {
      setAddTaskState((current) => ({ ...current, saving: false, error: error.message || 'Could not add task.' }));
    }
  }

  function prepareCustomTaskAllocation() {
    const title = String(addTaskState.customTitle ?? '').trim();
    if (!title) {
      setAddTaskState((current) => ({ ...current, error: 'Add a task name first.' }));
      return;
    }
    selectTaskForAllocation({
      customTask: true,
      title,
      notes: String(addTaskState.customNotes ?? '').trim(),
      serviceLevel: addTaskState.selectedServiceLevel,
      label: title,
      meta: 'Ad hoc task',
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
        taskIds: [...dailyTasks, ...addedTasks].map((task) => task.id),
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
        <div className="checklist-launch-primary-actions">
          <button className="button primary launch-checklist-button" type="button" onClick={handleOpen}>
            Open active checklist
          </button>
          <button className="button secondary launch-checklist-button" type="button" onClick={openAddTaskPopup} disabled={!boardDay}>
            Add task
          </button>
        </div>
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
              <div className="workflow-banner-actions checklist-header-primary-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="button secondary slim" type="button" onClick={openAddTaskPopup} disabled={!boardDay}>
                  Add task
                </button>
              </div>
              <strong>{label} {effectiveStage === 'daily' ? 'Daily List' : effectiveStage === 'remaining' ? 'Remaining Work' : 'Assigned Active List'}</strong>
              <div className="workflow-banner-actions checklist-header-secondary-actions">
                {effectiveStage === 'remaining' ? (
                  <button className="button secondary" type="button" onClick={refreshProgress}>
                    Refresh progress
                  </button>
                ) : null}
                <button className="button secondary close-modal-button" type="button" onClick={closeChecklist}>Close</button>
              </div>
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
                        onClick={() => setAddTaskState((current) => ({ ...current, mode: current.mode === 'custom' ? 'cards' : 'custom', pendingTask: null, selectedStaff: null, selectedServiceLevel: 'clean', cleanerNote: '', error: '', success: '' }))}
                        disabled={addTaskState.saving}
                      >
                        {addTaskState.mode === 'custom' ? 'Task cards' : 'Add Task'}
                      </button>
                      <button className="button secondary slim" type="button" onClick={closeAddTaskPopup} disabled={addTaskState.saving}>Close</button>
                    </div>
                  </header>

                  <section className="card" style={addTaskPanelStyle}>
                    {addTaskState.mode === 'allocate' ? (
                      <div style={allocationPanelStyle}>
                        <button
                          className="button secondary slim"
                          type="button"
                          onClick={() => setAddTaskState((current) => ({ ...current, mode: current.pendingTask?.customTask ? 'custom' : 'cards', pendingTask: null, selectedStaff: null, selectedServiceLevel: 'clean', cleanerNote: '', error: '', success: '' }))}
                          disabled={addTaskState.saving}
                          style={{ justifySelf: 'start' }}
                        >
                          Back
                        </button>
                        <div className="card" style={selectedTaskSummaryStyle}>
                          <span className="muted">Selected task</span>
                          <strong>{addTaskState.pendingTask?.label ?? addTaskState.pendingTask?.title ?? 'Task'}</strong>
                          {addTaskState.pendingTask?.meta ? <span>{addTaskState.pendingTask.meta}</span> : null}
                        </div>
                        <label className="field-label">
                          <span>Cleaning level</span>
                          <select
                            value={addTaskState.selectedServiceLevel}
                            onChange={(event) => setAddTaskState((current) => ({ ...current, selectedServiceLevel: event.target.value }))}
                            disabled={addTaskState.saving}
                          >
                            {SERVICE_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <strong>Allocate to staff</strong>
                        <div style={staffListStyle} aria-label="Allocate task to staff">
                          {addTaskState.loading ? <div className="muted">Loading staff…</div> : null}
                          {!addTaskState.loading && addTaskState.staff.length ? addTaskState.staff.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              className={addTaskState.selectedStaff?.id === member.id ? 'button primary' : 'button secondary'}
                              style={staffChoiceStyle}
                              onClick={() => setAddTaskState((current) => ({ ...current, selectedStaff: member }))}
                              disabled={addTaskState.saving || !addTaskState.pendingTask}
                            >
                              <strong>{member.fullName}</strong>
                              <span>{member.preferredShiftLabel || member.preferredTimeWindow || member.staffCode}</span>
                            </button>
                          )) : null}
                          {!addTaskState.loading && !addTaskState.staff.length ? <div className="muted">No active cleaner staff found.</div> : null}
                        </div>
                        <label className="field-label" style={{ marginTop: 10 }}>
                          <span>Cleaner note for this job</span>
                          <textarea
                            value={addTaskState.cleanerNote}
                            onChange={(event) => setAddTaskState((current) => ({ ...current, cleanerNote: event.target.value }))}
                            placeholder="Optional: key instructions, equipment, or access notes"
                            rows={3}
                            disabled={addTaskState.saving}
                          />
                        </label>
                        <button
                          className="button primary"
                          type="button"
                          onClick={() => addTaskForToday(addTaskState.pendingTask, addTaskState.selectedStaff)}
                          disabled={addTaskState.saving || !addTaskState.pendingTask || !addTaskState.selectedStaff}
                        >
                          {addTaskState.selectedStaff ? `Add to ${addTaskState.selectedStaff.fullName}` : 'Choose staff first'}
                        </button>
                      </div>
                    ) : addTaskState.mode === 'custom' ? (
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
                        <button className="button primary" type="button" onClick={prepareCustomTaskAllocation} disabled={addTaskState.saving || !String(addTaskState.customTitle ?? '').trim()}>
                          Choose staff
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="field-label">
                          <input
                            type="search"
                            value={addTaskState.search}
                            onChange={(event) => setAddTaskState((current) => ({ ...current, search: event.target.value, expandedZone: '' }))}
                            placeholder="Search task…"
                            aria-label="Search task list"
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
                                onClick={() => selectTaskForAllocation({
                                  templateId: card.templateId,
                                  title: card.title,
                                  zone: card.zone,
                                  taskGroup: card.taskGroup,
                                  serviceLevel: card.serviceLevel ?? 'clean',
                                  label: card.title,
                                  meta: [card.frequency, serviceLevelLabel(card.serviceLevel)].filter(Boolean).join(' · '),
                                })}
                                disabled={addTaskState.saving}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                                  <strong>{card.title}</strong>
                                  {card.scheduledToday ? <span className="badge">Scheduled</span> : null}
                                </span>
                                <span className="muted">{serviceLevelLabel(card.serviceLevel)}</span>
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
  height: '100dvh',
  maxHeight: '100dvh',
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
  gridTemplateRows: 'auto minmax(0, 1fr)',
  alignContent: 'stretch',
  gap: 10,
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
};

const zonePickerStackStyle = {
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 10,
  alignItems: 'stretch',
  minHeight: 0,
  height: '100%',
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
  minHeight: 0,
  overflow: 'auto',
  paddingRight: 4,
  paddingBottom: 'calc(10mm + env(safe-area-inset-bottom, 0px))',
  scrollPaddingBottom: 'calc(10mm + env(safe-area-inset-bottom, 0px))',
};

const taskCardChoiceStyle = {
  display: 'grid',
  alignItems: 'center',
  justifyItems: 'stretch',
  textAlign: 'left',
  gap: 3,
  minHeight: 52,
  whiteSpace: 'normal',
};

const allocationPanelStyle = {
  display: 'grid',
  gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
  gap: 10,
  minHeight: 0,
  height: '100%',
};

const selectedTaskSummaryStyle = {
  display: 'grid',
  gap: 4,
};

const staffListStyle = {
  display: 'grid',
  gap: 8,
  minHeight: 0,
  overflow: 'auto',
  paddingRight: 4,
  paddingBottom: 'calc(10mm + env(safe-area-inset-bottom, 0px))',
  scrollPaddingBottom: 'calc(10mm + env(safe-area-inset-bottom, 0px))',
};

const staffChoiceStyle = {
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
