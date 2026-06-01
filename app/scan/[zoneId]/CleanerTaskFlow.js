'use client';

import { useRef, useState } from 'react';

function formatStatusLabel(task) {
  if (task.score) {
    return `Grade ${task.score}/5 recorded`;
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
  return Object.fromEntries(tasks.map((task) => [task.id, {
    grade: task.score ?? null,
    note: task.note ?? '',
    saving: false,
    saved: Boolean(task.score),
    photoCount: task.photoCount ?? 0,
    photos: task.photos ?? [],
    statusMessage: task.score ? 'Saved earlier' : '',
    statusTone: task.score ? 'tone-green' : 'muted',
  }]));
}

export default function CleanerTaskFlow({ tasks }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskState, setTaskState] = useState(() => createInitialTaskState(tasks));
  const cardRefs = useRef([]);
  const listRef = useRef(null);

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
      const nextIndex = Math.min(index + 1, tasks.length - 1);
      window.setTimeout(() => {
        focusJob(nextIndex);
      }, 120);
    } catch {
      updateTask(taskId, {
        grade: current.grade ?? null,
        saving: false,
        saved: false,
        statusMessage: 'Save failed — tap a grade to retry',
        statusTone: 'tone-red',
      });
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
    } catch {
      updateTask(taskId, {
        saving: false,
        statusMessage: 'Photo upload failed — try again',
        statusTone: 'tone-red',
      });
    }
  }

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

  return (
    <div className="compact-flow">
      <div className="flow-position">
        <span className="badge">Current job {currentIndex + 1} of {tasks.length}</span>
        <span className="muted">Tap a grade to save this task and jump to the next one.</span>
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
              <span className={`completion-bubble ${selectedGrade ? 'completion-done' : 'completion-open'}`}>
                {selectedGrade ? 'Completed' : 'Open'}
              </span>

              <div className="compact-task-top">
                <div className="task-number">{index + 1}</div>
                <div>
                  <h3>{task.title}</h3>
                  <div className="muted">
                    {localState.saving
                      ? 'Saving…'
                      : localState.saved || task.score
                        ? formatStatusLabel({ ...task, score: selectedGrade || task.score })
                        : isCurrent
                          ? 'Current job'
                          : index < currentIndex
                            ? 'Previous job'
                            : 'Coming up next'}
                  </div>
                </div>
              </div>

              {(task.photoRequired || task.commentRequired || localState.photoCount > 0) && (
                <div className="compact-flags">
                  {task.photoRequired && <span className="flag required-flag">Forced photo</span>}
                  {task.commentRequired && <span className="flag">Comment required</span>}
                  <span className="flag">{localState.photoCount} photos</span>
                </div>
              )}

              {photos.length > 0 && (
                <div className="flag-row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                  {photos.slice(0, 3).map((photo) => (
                    <a key={photo.id} href={photo.photoUrl} target="_blank" rel="noreferrer">
                      <img
                        src={photo.photoUrl}
                        alt={`${task.title} evidence`}
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid #d8dee8' }}
                      />
                    </a>
                  ))}
                </div>
              )}

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
                      onClick={(event) => {
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
      </div>
    </div>
  );
}
