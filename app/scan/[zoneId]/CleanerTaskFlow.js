'use client';

import { useEffect, useRef, useState } from 'react';

const REFRESH_DEBOUNCE_MS = 2000;
import CleanerPhotoLightbox from './CleanerPhotoLightbox';

function isTaskCompleted(task) {
  return Number(task?.score) >= 4 || task?.status === 'completed';
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
      statusMessage: hasGrade ? (completed ? 'Completed earlier' : 'Saved earlier for follow-up') : '',
      statusTone: completed ? 'tone-green' : hasGrade ? 'tone-amber' : 'muted',
    }];
  }));
}

export default function CleanerTaskFlow({ tasks, onTaskSaved, onComplete, onRefreshProgress, onClose, completionMode = 'completed', completeLabel = 'Submit and go back', completeTitle = 'All tasks submitted', completeDescription = 'Everything on this active list has been graded. Submit to go back.' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskState, setTaskState] = useState(() => createInitialTaskState(tasks));
  const cardRefs = useRef([]);
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
      });
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

  async function uploadPhoto(taskId, file) {
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
      formData.append('photoType', 'completion');
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
            photoType: 'completion',
            photoUrl: `/api/task-photos/${result.photoId}`,
          }
        : null;

      updateTask(taskId, {
        photoCount: (current.photoCount ?? 0) + 1,
        photos: nextPhoto ? [...(current.photos ?? []), nextPhoto] : (current.photos ?? []),
        saving: false,
        saved: true,
        statusMessage: result.message || 'Photo uploaded',
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
          {nextIncompleteIndex >= 0 ? 'Next open task' : 'All tasks completed'}
        </button>
        <button className="button secondary flow-nav-button" type="button" onClick={onRefreshProgress}>
          Refresh progress
        </button>
        <button className="button secondary flow-nav-button close-modal-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="compact-task-list" ref={listRef} onScroll={trackManualScroll}>
        {tasks.map((task, index) => {
          const isCurrent = index === currentIndex;
          const localState = taskState[task.id] || { grade: null, note: '', saving: false, saved: false, photoCount: 0, photos: [], statusMessage: '', statusTone: 'muted' };
          const selectedGrade = localState.grade;
          const photos = localState.photos?.length ? localState.photos : (task.photos ?? []);

          return (
            <article
              className={`compact-task-card ${isCurrent ? 'current-task-card' : ''} ${selectedGrade ? 'graded-task-card' : ''}`}
              key={task.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              onClick={() => focusJob(index)}
            >
              <span className={`completion-bubble ${isTaskCompleted({ ...task, score: selectedGrade ?? task.score }) ? 'completion-done' : selectedGrade ? 'completion-open' : 'completion-open'}`}>
                {isTaskCompleted({ ...task, score: selectedGrade ?? task.score }) ? 'Completed' : selectedGrade ? 'Follow-up' : 'Open'}
              </span>

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

              {photos.length > 0 && <CleanerPhotoLightbox photos={photos} title={task.title} />}

              <div className="grade-panel compact-grade-panel">
                <div>
                  <strong>Grade completion</strong>
                  <span className="muted">1-2 flags follow-up, 3 partial, 4-5 complete</span>
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
                      disabled={localState.saving}
                    >
                      <span>{grade}</span>
                    </button>
                  ))}
                </div>
              </div>

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
                <button className="button secondary" type="button" onClick={(event) => event.stopPropagation()}>
                  {task.commentRequired ? 'Required note' : 'Optional note'}
                </button>
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
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
