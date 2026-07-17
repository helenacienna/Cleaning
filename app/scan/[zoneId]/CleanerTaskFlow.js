'use client';

import { useEffect, useRef, useState } from 'react';

const REFRESH_DEBOUNCE_MS = 2000;
import CleanerPhotoLightbox from './CleanerPhotoLightbox';

function isTaskCompleted(task) {
  return Number(task?.score) >= 3 || task?.status === 'completed';
}

function isTaskGraded(task) {
  return Number(task?.score) >= 1;
}

function formatStatusLabel(task) {
  if (Number(task?.score) >= 3) {
    return `Completed · Grade ${task.score}/5`;
  }
  if (Number(task?.score) > 0) {
    return `Follow-up needed · Grade ${task.score}/5`;
  }
  if (task.status === 'completed') {
    return 'Completed already';
  }
  if (task.status === 'in_progress') {
    return 'Marked in progress';
  }
  return 'Ready to complete';
}

function createInitialTaskState(tasks) {
  return Object.fromEntries(tasks.map((task) => {
    const completed = isTaskCompleted(task);
    const hasGrade = Number(task?.score) > 0;
    return [task.id, {
      grade: task.score ?? null,
      note: task.note ?? '',
      saving: false,
      saved: completed,
      photoCount: task.photoCount ?? 0,
      photos: task.photos ?? [],
      resolutionNote: task.resolutionNote ?? '',
      issueGrade: task.initialGrade ?? null,
      issueStage: task.initialGrade && !task.resolvedIssue ? 'needs_correction' : null,
      finalGrade: task.resolvedIssue ? task.score ?? null : null,
      lastPhotoType: null,
      askAnotherPhoto: false,
      resolvedIssue: Boolean(task.resolvedIssue),
      statusMessage: hasGrade ? (completed ? 'Completed earlier' : 'Saved earlier for follow-up') : '',
      statusTone: completed ? 'tone-green' : hasGrade ? 'tone-amber' : 'muted',
    }];
  }));
}

export default function CleanerTaskFlow({ tasks, onTaskSaved, onComplete, onRefreshProgress, onClose, onAllTasksCompleted, reportUrl = '', reportStatus = 'idle', completionMode = 'completed', completeLabel = 'Submit and go back', completeTitle = 'All tasks submitted', completeDescription = 'Everything on this active list has been graded. Submit to go back.' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskState, setTaskState] = useState(() => createInitialTaskState(tasks));
  const cardRefs = useRef([]);
  const issuePanelRefs = useRef({});
  const afterCorrectionPhotoInputRefs = useRef({});
  const listRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const endCardRef = useRef(null);

  function queueRefresh() {
    if (!onTaskSaved) {
      return;
    }

    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      onTaskSaved();
    }, REFRESH_DEBOUNCE_MS);
  }

  function focusJob(index) {
    setCurrentIndex(index);
    cardRefs.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function scrollToIssuePanel(taskId, index, block = 'center') {
    setCurrentIndex(index);
    const issuePanel = issuePanelRefs.current[taskId];
    if (issuePanel) {
      issuePanel.scrollIntoView({
        behavior: 'smooth',
        block,
      });
      return;
    }
    focusJob(index);
  }

  function updateTask(taskId, updates) {
    setTaskState((existing) => ({
      ...existing,
      [taskId]: {
        ...existing[taskId],
        ...updates,
      },
    }));
  }

  async function gradeTask(taskId, grade, index) {
    const current = taskState[taskId] || {};
    const originalIssueLocked = (current.photos ?? []).some((photo) => photo.photoType === 'exception')
      && Number(current.issueGrade || current.grade) >= 1
      && Number(current.issueGrade || current.grade) <= 2
      && !current.resolvedIssue;

    if (originalIssueLocked) {
      updateTask(taskId, {
        statusMessage: `Original issue score ${Number(current.issueGrade || current.grade)}/5 is locked because a before photo has been added. Use the corrected score buttons below.`,
        statusTone: 'tone-amber',
      });
      window.setTimeout(() => {
        scrollToIssuePanel(taskId, index, 'start');
      }, 20);
      return;
    }

    if (grade <= 2) {
      updateTask(taskId, {
        grade,
        issueGrade: grade,
        issueStage: 'needs_issue_photo',
        finalGrade: null,
        resolvedIssue: false,
        saving: false,
        saved: false,
        statusMessage: 'Add before photo(s) of the issue before correction',
        statusTone: 'tone-amber',
      });
      window.setTimeout(() => {
        scrollToIssuePanel(taskId, index, 'center');
      }, 20);
      return;
    }

    updateTask(taskId, {
      grade,
      saving: true,
      saved: false,
      statusMessage: 'Saving task…',
      statusTone: 'tone-amber',
    });

    try {
      const response = await fetch('/api/cleaner-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskInstanceId: taskId,
          grade,
          note: current.note || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to save cleaner task');
      }

      const result = await response.json();
      updateTask(taskId, {
        grade,
        saving: false,
        saved: true,
        statusMessage: result.message || 'Task saved',
        statusTone: 'tone-green',
        issueGrade: current.issueGrade ?? null,
        issueStage: null,
        finalGrade: null,
        resolvedIssue: false,
      });
      if (index >= tasks.length - 1) {
        window.setTimeout(() => {
          endCardRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 20);
      } else {
        const nextIndex = Math.min(index + 1, tasks.length - 1);
        window.setTimeout(() => {
          focusJob(nextIndex);
        }, 20);
      }
      if (grade <= 3 || index >= tasks.length - 1) {
        queueRefresh();
      }
    } catch {
      updateTask(taskId, {
        grade: current.grade ?? null,
        saving: false,
        saved: false,
        statusMessage: 'Save failed — tap a grade to retry',
        statusTone: 'tone-red',
      });
      window.setTimeout(() => {
        focusJob(index);
      }, 20);
    }
  }

  async function saveInitialIssue(taskId, index) {
    const current = taskState[taskId] || {};
    const issueGrade = Number(current.issueGrade || current.grade);

    if (!Number.isInteger(issueGrade) || issueGrade < 1 || issueGrade > 2) {
      return;
    }

    updateTask(taskId, {
      saving: true,
      statusMessage: 'Recording issue…',
      statusTone: 'tone-amber',
    });

    try {
      const response = await fetch('/api/cleaner-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskInstanceId: taskId,
          grade: issueGrade,
          note: current.note || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to record issue');
      }

      updateTask(taskId, {
        grade: issueGrade,
        saving: false,
        saved: true,
        issueGrade,
        issueStage: 'needs_correction',
        resolvedIssue: false,
        statusMessage: 'Issue recorded — add correction note and corrected score',
        statusTone: 'tone-amber',
      });
      window.setTimeout(() => {
        scrollToIssuePanel(taskId, index, 'start');
      }, 20);
      queueRefresh();
    } catch {
      updateTask(taskId, {
        saving: false,
        saved: false,
        issueStage: 'needs_issue_photo',
        statusMessage: 'Issue save failed — add/check photo and try again',
        statusTone: 'tone-red',
      });
    }
  }

  function selectCorrectedGrade(taskId, finalGrade) {
    updateTask(taskId, {
      finalGrade,
      issueStage: 'needs_after_photo',
      statusMessage: 'Add after photo(s) showing the correction, then save',
      statusTone: 'tone-amber',
    });
  }

  function openAfterCorrectionPhotoPicker(taskId) {
    afterCorrectionPhotoInputRefs.current[taskId]?.click();
  }

  function deferIssueCorrection(taskId, index) {
    const current = taskState[taskId] || {};
    const issueGrade = Number(current.issueGrade || current.grade);

    updateTask(taskId, {
      grade: issueGrade,
      finalGrade: null,
      issueStage: 'deferred',
      resolvedIssue: false,
      saving: false,
      saved: true,
      statusMessage: 'Issue recorded for correction later',
      statusTone: 'tone-amber',
    });

    if (index >= tasks.length - 1) {
      window.setTimeout(() => {
        endCardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 20);
    } else {
      const nextIndex = Math.min(index + 1, tasks.length - 1);
      window.setTimeout(() => {
        focusJob(nextIndex);
      }, 20);
    }
    queueRefresh();
  }

  async function resolveIssue(taskId, index) {
    const current = taskState[taskId] || {};
    const issueGrade = Number(current.issueGrade || current.grade);
    const finalGrade = Number(current.finalGrade);

    if (!Number.isInteger(issueGrade) || issueGrade < 1 || issueGrade > 2) {
      updateTask(taskId, {
        statusMessage: 'Save the initial grade 1–2 issue first',
        statusTone: 'tone-red',
      });
      return;
    }

    if (!Number.isInteger(finalGrade) || finalGrade < 3 || finalGrade > 5) {
      updateTask(taskId, {
        statusMessage: 'Select the corrected score first',
        statusTone: 'tone-red',
      });
      return;
    }

    const hasAfterPhoto = (current.photos ?? []).some((photo) => photo.photoType === 'completion');
    if (!hasAfterPhoto) {
      updateTask(taskId, {
        issueStage: 'needs_after_photo',
        statusMessage: 'Add at least one after photo before saving the correction',
        statusTone: 'tone-red',
      });
      return;
    }

    updateTask(taskId, {
      saving: true,
      statusMessage: 'Saving resolved issue…',
      statusTone: 'tone-amber',
    });

    try {
      const response = await fetch('/api/cleaner-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskInstanceId: taskId,
          grade: finalGrade,
          note: current.note || '',
          resolvedFromGrade: issueGrade,
          resolutionNote: current.resolutionNote || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to save resolved issue');
      }

      const result = await response.json();
      updateTask(taskId, {
        grade: finalGrade,
        saving: false,
        saved: true,
        issueGrade,
        finalGrade,
        issueStage: 'resolved',
        resolvedIssue: true,
        statusMessage: result.issueRecord
          ? `Issue record saved — original ${result.issueRecord.originalScore}/5, corrected ${result.issueRecord.correctedScore}/5`
          : result.message || `Resolved from ${issueGrade}/5 to ${finalGrade}/5`,
        statusTone: 'tone-green',
      });

      if (index >= tasks.length - 1) {
        window.setTimeout(() => {
          endCardRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 20);
      } else {
        const nextIndex = Math.min(index + 1, tasks.length - 1);
        window.setTimeout(() => {
          focusJob(nextIndex);
        }, 20);
      }
      queueRefresh();
    } catch {
      updateTask(taskId, {
        saving: false,
        statusMessage: 'Resolved issue save failed — try again',
        statusTone: 'tone-red',
      });
      window.setTimeout(() => {
        focusJob(index);
      }, 20);
    }
  }

  async function uploadPhoto(taskId, file, photoType = 'completion', index = currentIndex) {
    if (!file) return;

    const current = taskState[taskId] || {};
    updateTask(taskId, {
      saving: true,
      statusMessage: 'Uploading photo…',
      statusTone: 'tone-amber',
    });

    try {
      const formData = new FormData();
      formData.append('taskInstanceId', taskId);
      formData.append('photoType', photoType);
      formData.append('file', file);

      const response = await fetch('/api/task-photos', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Unable to upload photo');
      }

      const result = await response.json();
      const nextPhoto = result?.photoId
        ? {
            id: result.photoId,
            photoType,
            photoUrl: `/api/task-photos/${result.photoId}`,
          }
        : null;
      const nextPhotos = nextPhoto ? [...(current.photos ?? []), nextPhoto] : (current.photos ?? []);

      updateTask(taskId, {
        photoCount: (current.photoCount ?? 0) + 1,
        photos: nextPhotos,
        saving: false,
        saved: true,
        lastPhotoType: photoType,
        askAnotherPhoto: true,
        statusMessage: photoType === 'exception' ? 'Before photo uploaded' : 'After photo uploaded',
        statusTone: 'tone-green',
      });
      queueRefresh();
    } catch {
      updateTask(taskId, {
        saving: false,
        statusMessage: 'Photo upload failed — try again',
        statusTone: 'tone-red',
      });
    }
  }

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
  }, []);

  function trackManualScroll() {
    const list = listRef.current;
    if (!list) return;

    const listCentre = list.getBoundingClientRect().top + list.clientHeight / 2;
    let closestIndex = currentIndex;
    let closestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const cardCentre = rect.top + rect.height / 2;
      const distance = Math.abs(cardCentre - listCentre);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== currentIndex) {
      setCurrentIndex(closestIndex);
    }
  }

  function findNextIncompleteIndex(startIndex = currentIndex) {
    if (!tasks.length) {
      return -1;
    }

    for (let offset = 1; offset <= tasks.length; offset += 1) {
      const index = (startIndex + offset) % tasks.length;
      const task = tasks[index];
      const localState = taskState[task.id] || {};
      if (!isTaskCompleted({ ...task, score: localState.grade ?? task.score })) {
        return index;
      }
    }

    return -1;
  }

  const completedCount = tasks.filter((task) => {
    const localState = taskState[task.id] || {};
    const mergedTask = { ...task, score: localState.grade ?? task.score };
    return completionMode === 'graded' ? isTaskGraded(mergedTask) : isTaskCompleted(mergedTask);
  }).length;
  const allTasksCompleted = tasks.length > 0 && completedCount === tasks.length;
  const nextIncompleteIndex = findNextIncompleteIndex();

  useEffect(() => {
    if (allTasksCompleted) {
      void onAllTasksCompleted?.();
    }
  }, [allTasksCompleted, onAllTasksCompleted]);

  return (
    <div className="compact-flow">
      <div className="flow-position" aria-label="Checklist controls">
        <span className="badge flow-current-job-chip">Current job {Math.min(currentIndex + 1, tasks.length)} of {tasks.length}</span>
        <button
          className="button secondary flow-nav-button"
          type="button"
          onClick={() => {
            if (nextIncompleteIndex >= 0) {
              focusJob(nextIncompleteIndex);
            }
          }}
          disabled={nextIncompleteIndex < 0}
        >
          {nextIncompleteIndex >= 0 ? 'Next open' : 'All done'}
        </button>
        <button className="button secondary flow-nav-button" type="button" onClick={onRefreshProgress}>
          Refresh
        </button>
        <button className="button secondary flow-nav-button close-modal-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="compact-task-list" ref={listRef} onScroll={trackManualScroll}>
        {tasks.map((task, index) => {
          const isCurrent = index === currentIndex;
          const localState = taskState[task.id] || { grade: null, note: '', saving: false, saved: false, photoCount: 0, photos: [], resolutionNote: '', issueGrade: null, issueStage: null, finalGrade: null, lastPhotoType: null, askAnotherPhoto: false, resolvedIssue: false, statusMessage: '', statusTone: 'muted' };
          const selectedGrade = localState.grade;
          const photos = localState.photos?.length ? localState.photos : (task.photos ?? []);
          const beforePhotos = photos.filter((photo) => photo.photoType === 'exception');
          const afterPhotos = photos.filter((photo) => photo.photoType === 'completion');
          const issueWorkflowPhotos = [...beforePhotos, ...afterPhotos];
          const unresolvedLowGrade = Number(selectedGrade) >= 1 && Number(selectedGrade) <= 2 && !localState.resolvedIssue;
          const originalIssueLocked = unresolvedLowGrade && beforePhotos.length > 0;
          const completionChipClass = isTaskCompleted({ ...task, score: selectedGrade ?? task.score }) ? 'completion-done' : selectedGrade ? 'completion-open' : 'completion-open';
          const completionChipLabel = isTaskCompleted({ ...task, score: selectedGrade ?? task.score }) ? 'Completed' : selectedGrade ? 'Follow-up' : 'Open';

          return (
            <article
              className={`compact-task-card ${isCurrent ? 'current-task-card' : ''} ${selectedGrade ? 'graded-task-card' : ''}`}
              key={task.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              onClick={() => focusJob(index)}
            >
              <div className="compact-task-top">
                <div className="task-number">{index + 1}</div>
                <div className="compact-task-copy">
                  {task.zone ? <div className="compact-task-zone">{task.zone}</div> : null}
                  <div className="compact-task-title">{task.title}</div>
                </div>
              </div>

              {(task.photoRequired || task.commentRequired || localState.photoCount > 0) && (
                <div className="compact-flags">
                  {task.photoRequired && <span className="flag required-flag">Forced photo</span>}
                  {task.commentRequired && <span className="flag">Comment required</span>}
                  <span className="flag">{localState.photoCount} photos</span>
                </div>
              )}

              {photos.length > 0 && !unresolvedLowGrade && <CleanerPhotoLightbox photos={photos} title={task.title} />}

              <div className="grade-panel compact-grade-panel">
                <div className="grade-panel-header-row">
                  <div>
                    <strong>Grade completion</strong>
                    <span className="muted">1-2 flags follow-up, 3 partial, 4-5 complete</span>
                  </div>
                  <span className={`completion-bubble grade-panel-completion-bubble ${completionChipClass}`}>
                    {completionChipLabel}
                  </span>
                </div>
                <div className="grade-buttons" aria-label={`Grade ${task.title}`}>
                  {[1, 2, 3, 4, 5].map((grade) => (
                    <button
                      className={`grade-button grade-${grade} ${selectedGrade === grade ? 'selected-grade' : ''}`}
                      type="button"
                      key={grade}
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void gradeTask(task.id, grade, index);
                      }}
                      disabled={localState.saving || originalIssueLocked}
                    >
                      <span>{grade}</span>
                    </button>
                  ))}
                </div>
                {originalIssueLocked ? (
                  <span className="muted">Original score locked after before photo. Record the corrected score in the issue section below.</span>
                ) : null}
              </div>

              {unresolvedLowGrade ? (
                <div
                  className="resolved-issue-panel"
                  ref={(node) => {
                    if (node) {
                      issuePanelRefs.current[task.id] = node;
                    } else {
                      delete issuePanelRefs.current[task.id];
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div>
                    <strong>{localState.issueStage === 'needs_issue_photo' ? 'Issue selected — add before photo(s)' : 'Issue recorded — add correction'}</strong>
                    <span className="muted">Keep the initial {selectedGrade}/5 issue on record, then capture the corrected result with after photo evidence.</span>
                  </div>
                  <div className="compact-flags">
                    <span className="flag">Before photos: {beforePhotos.length}</span>
                    <span className="flag">After photos: {afterPhotos.length}</span>
                  </div>
                  <input
                    ref={(node) => {
                      if (node) {
                        afterCorrectionPhotoInputRefs.current[task.id] = node;
                      } else {
                        delete afterCorrectionPhotoInputRefs.current[task.id];
                      }
                    }}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void uploadPhoto(task.id, file, 'completion', index);
                      event.target.value = '';
                    }}
                  />
                  {issueWorkflowPhotos.length > 0 ? (
                    <div className="issue-photo-split" aria-label={`${task.title} issue evidence`}>
                      <div className="issue-photo-column issue-photo-column-before">
                        <strong>Before</strong>
                        <span className="muted">Issue evidence</span>
                        {beforePhotos.length > 0 ? (
                          <CleanerPhotoLightbox photos={beforePhotos} title={`${task.title} before issue evidence`} />
                        ) : (
                          <span className="muted">No before photo yet</span>
                        )}
                      </div>
                      <div className="issue-photo-column issue-photo-column-after">
                        <strong>After</strong>
                        <span className="muted">Correction evidence</span>
                        {afterPhotos.length > 0 ? (
                          <CleanerPhotoLightbox photos={afterPhotos} title={`${task.title} after correction evidence`} />
                        ) : (
                          <span className="muted">No after photo yet</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {localState.askAnotherPhoto ? (
                    <div className="add-another-photo-panel">
                      <strong>Would you like to add another photo?</strong>
                      <div className="compact-actions">
                        <label className="button secondary">
                          Add another {localState.lastPhotoType === 'exception' ? 'before' : 'after'} photo
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              void uploadPhoto(task.id, file, localState.lastPhotoType || 'completion', index);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          className="button primary"
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            updateTask(task.id, { askAnotherPhoto: false });
                            if (localState.lastPhotoType === 'exception' && localState.issueStage === 'needs_issue_photo') {
                              void saveInitialIssue(task.id, index);
                            } else if (localState.lastPhotoType === 'completion' && localState.issueStage === 'needs_after_photo' && localState.finalGrade) {
                              void resolveIssue(task.id, index);
                            }
                          }}
                        >
                          No, continue
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {localState.issueStage === 'needs_issue_photo' && !localState.askAnotherPhoto ? (
                    <div className="task-actions compact-actions">
                      <label className="button photo-required-button">
                        Add before issue photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            void uploadPhoto(task.id, file, 'exception', index);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  ) : !localState.askAnotherPhoto ? (
                    <>
                      <label className="builder-field">
                        <span className="muted">Correction note</span>
                        <textarea
                          value={localState.resolutionNote || ''}
                          onChange={(event) => updateTask(task.id, { resolutionNote: event.target.value, statusMessage: '' })}
                          placeholder="What was corrected? Optional but useful for the supervisor report."
                          rows={2}
                        />
                      </label>
                      <div className="task-actions compact-actions">
                        <button
                          className="button secondary"
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            deferIssueCorrection(task.id, index);
                          }}
                          disabled={localState.saving}
                        >
                          Correct later
                        </button>
                      </div>
                      <div className="grade-buttons resolved-issue-buttons" aria-label={`Corrected score for ${task.title}`}>
                        {[3, 4, 5].map((finalGrade) => (
                          <button
                            className={`grade-button grade-${finalGrade} ${localState.finalGrade === finalGrade ? 'selected-grade' : ''}`}
                            type="button"
                            key={finalGrade}
                            onPointerDown={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            selectCorrectedGrade(task.id, finalGrade);
                            openAfterCorrectionPhotoPicker(task.id);
                          }}
                          disabled={localState.saving}
                        >
                            <span>Corrected to {finalGrade}</span>
                          </button>
                        ))}
                      </div>
                      {localState.finalGrade ? (
                        <div className="task-actions compact-actions">
                          <button
                            className="button photo-required-button"
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openAfterCorrectionPhotoPicker(task.id);
                            }}
                          >
                            Add after correction photo
                          </button>
                          <button
                            className="button primary"
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void resolveIssue(task.id, index);
                            }}
                            disabled={localState.saving || afterPhotos.length < 1}
                          >
                            Save corrected result
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : localState.resolvedIssue ? (
                <div className="resolved-issue-panel resolved-issue-panel-done">
                  <strong>Resolved issue recorded</strong>
                  <span className="muted">Original score {localState.issueGrade}/5 · Corrected score {selectedGrade}/5.</span>
                </div>
              ) : null}

              <label className="builder-field" onClick={(event) => event.stopPropagation()}>
                <span className="muted">Cleaner note</span>
                <textarea
                  value={localState.note}
                  onChange={(event) => updateTask(task.id, { note: event.target.value, saved: false, statusMessage: '' })}
                  placeholder={task.commentRequired ? 'Add the required note here' : 'Optional note'}
                  rows={3}
                />
              </label>

              <div className="task-actions compact-actions">
                <label className={task.photoRequired ? 'button photo-required-button' : 'button secondary'}>
                  {task.photoRequired ? 'Upload required photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void uploadPhoto(task.id, file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>

              {localState.statusMessage && (
                <div className={localState.statusTone} style={{ marginTop: 10, fontSize: 14 }}>
                  {localState.statusMessage}
                </div>
              )}
            </article>
          );
        })}

        {allTasksCompleted ? (
          <article className="compact-task-card current-task-card graded-task-card" ref={endCardRef}>
            <span className="completion-bubble completion-done">Finished</span>
            <div>
              <h3>{completeTitle}</h3>
              <div className="muted">{completeDescription}</div>
            </div>
            <div className="compact-actions">
              <button className="button primary" type="button" onClick={() => onComplete?.()}>
                {completeLabel}
              </button>
              {reportUrl ? (
                <a className="button secondary" href={reportUrl}>
                  View report
                </a>
              ) : reportStatus === 'creating' ? (
                <button className="button secondary" type="button" disabled>
                  Creating report…
                </button>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
