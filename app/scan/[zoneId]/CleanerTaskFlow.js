'use client';

import { useEffect, useRef, useState } from 'react';

const REFRESH_DEBOUNCE_MS = 450;
import CleanerPhotoLightbox from './CleanerPhotoLightbox';

function isTaskCompleted(task) {
  return Number(task?.score) >= 3 || task?.status === 'completed' || task?.status === 'skipped';
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
  if (task.status === 'skipped') {
    return 'Skipped for admin review';
  }
  if (task.status === 'in_progress') {
    return 'Marked in progress';
  }
  return 'Ready to complete';
}

function isCommentRequiredForGrade(task, grade) {
  if (task?.commentRequirement === 'always') {
    return true;
  }

  if (task?.commentRequirement === 'on_exception') {
    return Number(grade) <= 2;
  }

  return task?.commentRequired && !task?.commentRequirement;
}

function getRequirementState({ task, localState }) {
  const selectedGrade = localState.grade;
  const photoIsRequired = Boolean(selectedGrade && task?.photoRequired);
  const commentIsRequired = Boolean(selectedGrade && isCommentRequiredForGrade(task, selectedGrade));
  const photoMet = !photoIsRequired || (localState.photoCount ?? task.photoCount ?? 0) > 0;
  const commentMet = !commentIsRequired || Boolean(String(localState.note || '').trim());

  return {
    photoIsRequired,
    commentIsRequired,
    photoMet,
    commentMet,
    missing: [
      photoIsRequired && !photoMet ? 'photo' : null,
      commentIsRequired && !commentMet ? 'comment' : null,
    ].filter(Boolean),
  };
}

function createInitialTaskState(tasks) {
  return Object.fromEntries(tasks.map((task) => {
    const completed = isTaskCompleted(task);
    const hasGrade = Number(task?.score) > 0;
    return [task.id, {
      grade: task.score ?? null,
      correctedGrade: null,
      note: task.note ?? '',
      status: task.status,
      skipReason: '',
      showSkip: false,
      saving: false,
      saved: completed,
      photoCount: task.photoCount ?? 0,
      photos: task.photos ?? [],
      statusMessage: hasGrade ? (completed ? 'Completed earlier' : 'Saved earlier for follow-up') : '',
      statusTone: completed ? 'tone-green' : hasGrade ? 'tone-amber' : 'muted',
    }];
  }));
}

export default function CleanerTaskFlow({ tasks, onTaskSaved, onComplete }) {
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

  function focusRequirement(taskId, requirementType) {
    const target = document.querySelector(`[data-requirement-target="${taskId}-${requirementType}"]`);
    target?.scrollIntoView({
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

  async function gradeTask(taskId, grade, index, options = {}) {
    const task = tasks[index];
    const current = taskState[taskId] || {};
    const requirementState = getRequirementState({
      task,
      localState: {
        ...current,
        grade,
      },
    });
    const missing = requirementState.missing;

    if (missing.length) {
      updateTask(taskId, {
        grade,
        saved: false,
        showSkip: true,
        statusMessage: `Required ${missing.join(' and ')} must be added before moving on. Use skip only with an admin explanation.`,
        statusTone: 'tone-red',
      });
      window.setTimeout(() => {
        focusRequirement(taskId, missing[0]);
      }, 40);
      return;
    }

    const shouldStayForCorrection = task?.photoRequired && grade <= 2 && !options.corrected;

    if (!shouldStayForCorrection) {
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
          note: options.corrected
            ? `[initial-grade:${current.grade || task.score || 'unknown'}/5]\n[issue-resolved:true]\n[corrected-score:${grade}/5]\n${current.note || ''}`.trim()
            : current.note || '',
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Unable to save cleaner task');
      }

      const result = await response.json();
      updateTask(taskId, {
        grade,
        correctedGrade: options.corrected ? grade : current.correctedGrade,
        status: grade >= 4 ? 'completed' : 'in_progress',
        saving: false,
        saved: true,
        statusMessage: shouldStayForCorrection ? 'Incident recorded — add after photo and corrected score when fixed.' : result.message || 'Task saved',
        statusTone: shouldStayForCorrection ? 'tone-amber' : 'tone-green',
      });
      queueRefresh();
      if (shouldStayForCorrection) {
        window.setTimeout(() => {
          focusRequirement(taskId, 'correction');
        }, 80);
      }
    } catch (error) {
      updateTask(taskId, {
        grade: current.grade ?? null,
        saving: false,
        saved: false,
        showSkip: true,
        statusMessage: error?.message || 'Save failed — tap a grade to retry',
        statusTone: 'tone-red',
      });
      window.setTimeout(() => {
        focusJob(index);
      }, 20);
    }
  }

  async function uploadPhoto(taskId, file, photoType = null) {
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
      formData.append('photoType', photoType || (Number(current.grade) <= 2 ? 'exception' : 'completion'));
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
            photoType: photoType || (Number(current.grade) <= 2 ? 'exception' : 'completion'),
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


  async function skipTask(taskId, index) {
    const current = taskState[taskId] || {};
    const skipReason = String(current.skipReason || '').trim();

    if (skipReason.length < 5) {
      updateTask(taskId, {
        showSkip: true,
        statusMessage: 'Add a short explanation before skipping so admin can assess it.',
        statusTone: 'tone-red',
      });
      return;
    }

    updateTask(taskId, {
      saving: true,
      statusMessage: 'Sending skip to admin…',
      statusTone: 'tone-amber',
    });

    try {
      const response = await fetch('/api/cleaner-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'skip',
          taskInstanceId: taskId,
          skipReason,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Unable to skip task');
      }

      const result = await response.json();
      updateTask(taskId, {
        status: 'skipped',
        saving: false,
        saved: true,
        showSkip: false,
        statusMessage: result.message || 'Skip sent to admin for review',
        statusTone: 'tone-amber',
      });
      queueRefresh();

      const nextIndex = findNextIncompleteIndex(index);
      if (nextIndex >= 0 && nextIndex !== index) {
        window.setTimeout(() => {
          focusJob(nextIndex);
        }, 20);
      } else {
        window.setTimeout(() => {
          endCardRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 20);
      }
    } catch (error) {
      updateTask(taskId, {
        saving: false,
        showSkip: true,
        statusMessage: error?.message || 'Skip failed — try again',
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
      if (!isTaskCompleted({ ...task, status: localState.status ?? task.status, score: localState.grade ?? task.score })) {
        return index;
      }
    }

    return -1;
  }

  const completedCount = tasks.filter((task) => {
    const localState = taskState[task.id] || {};
    return isTaskCompleted({ ...task, status: localState.status ?? task.status, score: localState.grade ?? task.score });
  }).length;
  const allTasksCompleted = tasks.length > 0 && completedCount === tasks.length;
  const nextIncompleteIndex = findNextIncompleteIndex();

  return (
    <div className="compact-flow">
      <div className="flow-position">
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            if (nextIncompleteIndex >= 0) {
              focusJob(nextIncompleteIndex);
            }
          }}
          disabled={nextIncompleteIndex < 0}
        >
          {nextIncompleteIndex >= 0 ? 'Jump to next open task' : 'All tasks completed'}
        </button>
        <span className="badge">Current job {Math.min(currentIndex + 1, tasks.length)} of {tasks.length}</span>
      </div>

      <div className="compact-task-list" ref={listRef} onScroll={trackManualScroll}>
        {tasks.map((task, index) => {
          const isCurrent = index === currentIndex;
          const localState = taskState[task.id] || { grade: null, note: '', status: task.status, skipReason: '', showSkip: false, saving: false, saved: false, photoCount: 0, photos: [], statusMessage: '', statusTone: 'muted' };
          const selectedGrade = localState.grade;
          const photos = localState.photos?.length ? localState.photos : (task.photos ?? []);
          const beforePhotos = photos.filter((photo) => photo.photoType === 'exception');
          const afterPhotos = photos.filter((photo) => photo.photoType === 'completion');
          const flowStatus = localState.status ?? task.status;
          const hasIncidentGrade = Number(selectedGrade ?? task.score) > 0 && Number(selectedGrade ?? task.score) <= 2;
          const showCorrectionPanel = task.photoRequired && hasIncidentGrade && flowStatus !== 'skipped';
          const requirementState = getRequirementState({ task, localState });
          const photoRequirementClass = requirementState.photoIsRequired
            ? requirementState.photoMet
              ? 'requirement-met'
              : 'requirement-missing'
            : '';
          const commentRequirementClass = requirementState.commentIsRequired
            ? requirementState.commentMet
              ? 'requirement-met'
              : 'requirement-missing'
            : '';

          return (
            <article
              className={`compact-task-card ${isCurrent ? 'current-task-card' : ''} ${selectedGrade ? 'graded-task-card' : ''}`}
              key={task.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              onClick={() => focusJob(index)}
            >
              <span className={`completion-bubble ${isTaskCompleted({ ...task, status: flowStatus, score: selectedGrade ?? task.score }) ? 'completion-done' : selectedGrade ? 'completion-open' : 'completion-open'}`}>
                {flowStatus === 'skipped' ? 'Skipped' : isTaskCompleted({ ...task, status: flowStatus, score: selectedGrade ?? task.score }) ? 'Completed' : selectedGrade ? 'Follow-up' : 'Open'}
              </span>

              <div className="compact-task-top">
                <div className="task-number">{index + 1}</div>
                <div className="compact-task-copy">
                  {task.zone ? <div className="compact-task-zone">{task.zone}</div> : null}
                  <div className="compact-task-title">{task.title}</div>
                </div>
              </div>

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

              {(task.photoRequired || task.commentRequired || localState.photoCount > 0) && (
                <div className="compact-flags">
                  {task.photoRequired && <span className="flag required-flag">Forced photo</span>}
                  {task.commentRequired && <span className="flag">Comment required</span>}
                  <span className="flag">{localState.photoCount} photos</span>
                </div>
              )}

              {photos.length > 0 && !showCorrectionPanel && (
                <CleanerPhotoLightbox
                  photos={photos}
                  title={task.title}
                  required={task.photoRequired}
                  incident={hasIncidentGrade}
                />
              )}

              {showCorrectionPanel && (
                <section className="issue-correction-panel compulsory-correction-panel" data-requirement-target={`${task.id}-correction`}>
                  <div>
                    <strong>Compulsory incident correction</strong>
                    <span className="muted">Before evidence is accepted. Add after evidence, then choose corrected score.</span>
                  </div>
                  <div className="before-after-grid">
                    <div className="before-after-column before-evidence-column">
                      <div className="cleaner-photo-evidence-title">Before / incident evidence</div>
                      {beforePhotos.length ? (
                        <CleanerPhotoLightbox photos={beforePhotos} title={task.title} required incident />
                      ) : (
                        <div className="muted">No before photo recorded yet.</div>
                      )}
                    </div>
                    <div className="before-after-column after-evidence-column">
                      <div className="cleaner-photo-evidence-title">After correction evidence</div>
                      {afterPhotos.length ? (
                        <CleanerPhotoLightbox photos={afterPhotos} title={task.title} required />
                      ) : (
                        <div className="muted">Add an after photo once corrected.</div>
                      )}
                      <label className="button secondary cleaner-requirement-box requirement-missing">
                        Add after correction photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            void uploadPhoto(task.id, file, 'completion');
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="resolved-issue-buttons">
                    {[3, 4, 5].map((grade) => (
                      <button
                        key={grade}
                        className={`button ${localState.correctedGrade === grade ? 'primary' : 'secondary'}`}
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void gradeTask(task.id, grade, index, { corrected: true });
                        }}
                        disabled={localState.saving || afterPhotos.length < 1}
                      >
                        Corrected to {grade}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <label
                className={`builder-field cleaner-requirement-box ${commentRequirementClass}`}
                data-requirement-target={`${task.id}-comment`}
                onClick={(event) => event.stopPropagation()}
              >
                <span className="muted">Cleaner note</span>
                <textarea
                  value={localState.note}
                  onChange={(event) => updateTask(task.id, { note: event.target.value, saved: false, statusMessage: '' })}
                  placeholder={task.commentRequired ? 'Add the required note here' : 'Optional note'}
                  rows={3}
                />
              </label>

              <div className="task-actions compact-actions">
                <label
                  className={`${task.photoRequired ? 'button photo-required-button' : 'button secondary'} cleaner-requirement-box ${photoRequirementClass}`}
                  data-requirement-target={`${task.id}-photo`}
                >
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
                {(task.photoRequired || task.commentRequired || localState.showSkip) && flowStatus !== 'skipped' && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateTask(task.id, { showSkip: !localState.showSkip, statusMessage: '' });
                    }}
                    disabled={localState.saving}
                  >
                    Skip with explanation
                  </button>
                )}
              </div>

              {localState.showSkip && flowStatus !== 'skipped' && (
                <div className="builder-field" onClick={(event) => event.stopPropagation()}>
                  <span className="muted">Skip explanation for admin review</span>
                  <textarea
                    value={localState.skipReason || ''}
                    onChange={(event) => updateTask(task.id, { skipReason: event.target.value, statusMessage: '' })}
                    placeholder="Why can this task not be completed now?"
                    rows={3}
                  />
                  <button
                    className="button secondary"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void skipTask(task.id, index);
                    }}
                    disabled={localState.saving}
                  >
                    Send skip to admin
                  </button>
                </div>
              )}

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
              <h3>All tasks submitted</h3>
              <div className="muted">Everything on this active list has been graded. Submit to go back.</div>
            </div>
            <div className="compact-actions">
              <button className="button primary" type="button" onClick={() => onComplete?.()}>
                Submit and go back
              </button>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
