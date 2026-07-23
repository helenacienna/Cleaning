'use client';

import { useEffect, useRef, useState } from 'react';

const REFRESH_DEBOUNCE_MS = 450;
const OFFLINE_SYNC_INTERVAL_MS = 15000;
import { splitCleanerEvidencePhotos, shouldRenderSeparatedBeforeAfterEvidence } from '../../../lib/cleaner-photo-sections';
import { isCleanerTaskResolvedForProgress } from '../../../lib/cleaner-task-progress';
import CleanerPhotoLightbox from './CleanerPhotoLightbox';
import { addOfflineAction, getOfflineQueueSummary, onQueueChange, syncOfflineActions } from './offlineQueue';

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

function isOfflineLikeError(error) {
  return error?.queueable === true || (typeof navigator !== 'undefined' && navigator.onLine === false) || error instanceof TypeError;
}

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  error.queueable = status >= 500 || status === 408 || status === 429;
  return error;
}

function getOnlineLabel(isOnline) {
  return isOnline ? 'Online' : 'Offline';
}

function buildCorrectionLaterNote({ initialGrade, note }) {
  return `[initial-grade:${initialGrade || 'unknown'}/5]\n[correction-later:true]\n${note || ''}`.trim();
}

function createInitialTaskState(tasks) {
  return Object.fromEntries(tasks.map((task) => {
    const completed = isTaskCompleted(task);
    const hasGrade = Number(task?.score) > 0;
    return [task.id, {
      grade: task.score ?? null,
      correctedGrade: task.correctedGrade ?? null,
      correctionLater: task.correctionLater ?? false,
      incidentGrade: task.initialGrade ?? (Number(task?.score) > 0 && Number(task?.score) <= 2 ? task.score : null),
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

export default function CleanerTaskFlow({ tasks, onTaskSaved, onComplete, onAllTasksCompleted, reportUrl = '', reportStatus = 'idle' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskState, setTaskState] = useState(() => createInitialTaskState(tasks));
  const [noteTaskId, setNoteTaskId] = useState(null);
  const [skipTaskId, setSkipTaskId] = useState(null);
  const [queueSummary, setQueueSummary] = useState({ count: 0, actions: [], lastError: null });
  const [syncMessage, setSyncMessage] = useState('');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const cardRefs = useRef([]);
  const listRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const endCardRef = useRef(null);
  const reportRequestedRef = useRef(false);

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

  function blockLeavingCurrentTask() {
    const currentTask = tasks[currentIndex];
    if (!currentTask) return false;

    const currentState = taskState[currentTask.id] || {};
    const resolved = isCleanerTaskResolvedForProgress({
      ...currentTask,
      ...currentState,
      score: currentState.saved ? (currentState.grade ?? currentTask.score) : currentTask.score,
      status: currentState.status ?? currentTask.status,
    });

    if (resolved) return false;

    updateTask(currentTask.id, {
      showSkip: true,
      statusMessage: 'Grade this task or skip with an explanation before moving to the next task.',
      statusTone: 'tone-red',
    });
    window.setTimeout(() => {
      cardRefs.current[currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 20);
    return true;
  }

  function focusJob(index, options = {}) {
    if (!options.force && index !== currentIndex && blockLeavingCurrentTask()) {
      return false;
    }

    setCurrentIndex(index);
    cardRefs.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    return true;
  }

  function focusRequirement(taskId, requirementType, block = 'center') {
    const target = document.querySelector(`[data-requirement-target="${taskId}-${requirementType}"]`);
    target?.scrollIntoView({
      behavior: 'smooth',
      block,
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

  async function refreshQueueSummary() {
    const summary = await getOfflineQueueSummary().catch(() => ({ count: 0, actions: [], lastError: null }));
    setQueueSummary(summary);
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    return summary;
  }

  async function runPendingSync() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSyncMessage('Offline — work will sync when signal returns');
      await refreshQueueSummary();
      return;
    }

    const before = await refreshQueueSummary();
    if (!before.count) {
      setSyncMessage('');
      return;
    }

    setSyncMessage(`Syncing ${before.count} pending item${before.count === 1 ? '' : 's'}…`);
    const result = await syncOfflineActions();
    await refreshQueueSummary();

    if (result.synced > 0) {
      setSyncMessage(`Synced ${result.synced} pending item${result.synced === 1 ? '' : 's'}`);
      queueRefresh();
    } else if (result.failed > 0) {
      setSyncMessage('Sync failed — will retry automatically');
    } else if (result.remaining > 0) {
      setSyncMessage('Pending sync — waiting for connection');
    } else {
      setSyncMessage('');
    }
  }

  async function queueOfflineAction(action) {
    const queued = await addOfflineAction(action);
    await refreshQueueSummary();
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      window.setTimeout(() => {
        void runPendingSync();
      }, 500);
    }
    return queued;
  }

  function moveToNextTask(index) {
    if (index >= tasks.length - 1) {
      window.setTimeout(() => {
        endCardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 20);
      return;
    }

    const nextIndex = Math.min(index + 1, tasks.length - 1);
    window.setTimeout(() => {
      focusJob(nextIndex, { force: true });
    }, 20);
  }

  async function correctLater(taskId, index) {
    const task = tasks[index];
    const current = taskState[taskId] || {};
    const initialGrade = current.incidentGrade ?? current.grade ?? task.initialGrade ?? task.score;
    const note = buildCorrectionLaterNote({ initialGrade, note: current.note || '' });

    updateTask(taskId, {
      correctionLater: true,
      correctedGrade: null,
      saving: true,
      saved: false,
      statusMessage: 'Saving follow-up for later…',
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
          grade: Number(initialGrade) > 0 ? Number(initialGrade) : 1,
          note,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw createHttpError(result?.error || 'Unable to save follow-up for later', response.status);
      }

      updateTask(taskId, {
        grade: Number(initialGrade) > 0 ? Number(initialGrade) : current.grade,
        correctionLater: true,
        correctedGrade: null,
        status: 'in_progress',
        saving: false,
        saved: true,
        statusMessage: 'Correction marked for later follow-up.',
        statusTone: 'tone-amber',
      });
      queueRefresh();
      moveToNextTask(index);
    } catch (error) {
      if (isOfflineLikeError(error)) {
        await queueOfflineAction({
          type: 'grade',
          taskInstanceId: taskId,
          grade: Number(initialGrade) > 0 ? Number(initialGrade) : 1,
          note,
        });
        updateTask(taskId, {
          grade: Number(initialGrade) > 0 ? Number(initialGrade) : current.grade,
          correctionLater: true,
          correctedGrade: null,
          status: 'in_progress',
          saving: false,
          saved: false,
          statusMessage: 'Correction later pending sync — saved on this device',
          statusTone: 'tone-amber',
        });
        moveToNextTask(index);
        return;
      }

      updateTask(taskId, {
        correctionLater: false,
        saving: false,
        saved: false,
        statusMessage: error?.message || 'Save failed — try Correct later again',
        statusTone: 'tone-red',
      });
      window.setTimeout(() => {
        focusRequirement(taskId, 'correction', 'start');
      }, 40);
    }
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

    const shouldStayForCorrection = grade <= 2 && !options.corrected;

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
        throw createHttpError(result?.error || 'Unable to save cleaner task', response.status);
      }

      const result = await response.json();
      updateTask(taskId, {
        grade,
        correctedGrade: options.corrected ? grade : current.correctedGrade,
        incidentGrade: grade <= 2 ? grade : current.incidentGrade,
        status: grade >= 4 ? 'completed' : 'in_progress',
        saving: false,
        saved: true,
        statusMessage: shouldStayForCorrection ? 'Incident recorded — add after photo and corrected score when fixed.' : result.message || 'Task saved',
        statusTone: shouldStayForCorrection ? 'tone-amber' : 'tone-green',
      });
      queueRefresh();
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
            focusJob(nextIndex, { force: true });
          }, 20);
        }
      }
      if (shouldStayForCorrection) {
        window.setTimeout(() => {
          focusRequirement(taskId, 'correction', 'start');
        }, 80);
      }
    } catch (error) {
      if (isOfflineLikeError(error)) {
        await queueOfflineAction({
          type: 'grade',
          taskInstanceId: taskId,
          grade,
          note: options.corrected
            ? `[initial-grade:${current.grade || task.score || 'unknown'}/5]\n[issue-resolved:true]\n[corrected-score:${grade}/5]\n${current.note || ''}`.trim()
            : current.note || '',
        });
        updateTask(taskId, {
          grade,
          correctedGrade: options.corrected ? grade : current.correctedGrade,
          incidentGrade: grade <= 2 ? grade : current.incidentGrade,
          status: grade >= 4 ? 'completed' : 'in_progress',
          saving: false,
          saved: false,
          statusMessage: shouldStayForCorrection
            ? 'Incident saved on this device — add after photo and corrected score when fixed.'
            : 'Pending sync — saved on this device and will upload when connection returns',
          statusTone: 'tone-amber',
        });
        if (!shouldStayForCorrection) {
          const nextIndex = index >= tasks.length - 1 ? -1 : Math.min(index + 1, tasks.length - 1);
          window.setTimeout(() => {
            if (nextIndex >= 0) {
              focusJob(nextIndex, { force: true });
            } else {
              endCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 20);
        } else {
          window.setTimeout(() => {
            focusRequirement(taskId, 'correction', 'start');
          }, 80);
        }
        return;
      }

      updateTask(taskId, {
        grade: current.grade ?? null,
        saving: false,
        saved: false,
        showSkip: true,
        statusMessage: error?.message || 'Save failed — tap a grade to retry',
        statusTone: 'tone-red',
      });
      window.setTimeout(() => {
          focusJob(index, { force: true });
      }, 20);
    }
  }

  async function uploadPhoto(taskId, file, photoType = null, index = null) {
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
        throw createHttpError('Unable to upload photo', response.status);
      }

      const result = await response.json();
      const nextPhoto = result?.photoId
        ? {
            id: result.photoId,
            photoType: photoType || (Number(current.grade) <= 2 ? 'exception' : 'completion'),
            photoUrl: `/api/task-photos/${result.photoId}`,
          }
        : null;

      const nextPhotos = nextPhoto ? [...(current.photos ?? []), nextPhoto] : (current.photos ?? []);
      const nextPhotoCount = (current.photoCount ?? 0) + 1;
      const afterPhotoMissingRequirements = photoType === 'completion' && current.correctedGrade && Number.isInteger(index)
        ? getRequirementState({
            task: tasks[index],
            localState: {
              ...current,
              grade: current.correctedGrade,
              photoCount: nextPhotoCount,
              photos: nextPhotos,
            },
          }).missing
        : [];

      updateTask(taskId, {
        photoCount: nextPhotoCount,
        photos: nextPhotos,
        saving: false,
        saved: false,
        showSkip: afterPhotoMissingRequirements.length ? true : current.showSkip,
        statusMessage: afterPhotoMissingRequirements.length
          ? `Required ${afterPhotoMissingRequirements.join(' and ')} must be added before moving on. Use skip only with an admin explanation.`
          : result.message || 'Photo uploaded',
        statusTone: afterPhotoMissingRequirements.length ? 'tone-red' : 'tone-green',
      });
      queueRefresh();

      if (photoType === 'completion' && current.correctedGrade && Number.isInteger(index)) {
        if (afterPhotoMissingRequirements.includes('comment')) {
          window.setTimeout(() => {
            focusRequirement(taskId, 'comment', 'center');
          }, 80);
          return;
        }

        window.setTimeout(() => {
          void gradeTask(taskId, current.correctedGrade, index, { corrected: true });
        }, 80);
      }
    } catch (error) {
      if (isOfflineLikeError(error)) {
        const resolvedPhotoType = photoType || (Number(current.grade) <= 2 ? 'exception' : 'completion');
        const localPhoto = {
          id: `pending-${Date.now()}`,
          photoType: resolvedPhotoType,
          photoUrl: URL.createObjectURL(file),
        };
        await queueOfflineAction({
          type: 'photo',
          taskInstanceId: taskId,
          photoType: resolvedPhotoType,
          file,
          fileName: file.name || 'cleaning-photo.jpg',
        });

        const nextPhotos = [...(current.photos ?? []), localPhoto];
        const nextPhotoCount = (current.photoCount ?? 0) + 1;
        const afterPhotoMissingRequirements = photoType === 'completion' && current.correctedGrade && Number.isInteger(index)
          ? getRequirementState({
              task: tasks[index],
              localState: {
                ...current,
                grade: current.correctedGrade,
                photoCount: nextPhotoCount,
                photos: nextPhotos,
              },
            }).missing
          : [];

        updateTask(taskId, {
          photoCount: nextPhotoCount,
          photos: nextPhotos,
          saving: false,
          saved: false,
          showSkip: afterPhotoMissingRequirements.length ? true : current.showSkip,
          statusMessage: afterPhotoMissingRequirements.length
            ? `Required ${afterPhotoMissingRequirements.join(' and ')} must be added before moving on. Use skip only with an admin explanation.`
            : 'Photo pending sync — saved on this device',
          statusTone: afterPhotoMissingRequirements.length ? 'tone-red' : 'tone-amber',
        });

        if (photoType === 'completion' && current.correctedGrade && Number.isInteger(index)) {
          if (afterPhotoMissingRequirements.includes('comment')) {
            window.setTimeout(() => {
              focusRequirement(taskId, 'comment', 'center');
            }, 80);
            return;
          }

          window.setTimeout(() => {
            void gradeTask(taskId, current.correctedGrade, index, { corrected: true });
          }, 80);
        }
        return;
      }

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
        throw createHttpError(result?.error || 'Unable to skip task', response.status);
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
          focusJob(nextIndex, { force: true });
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
      if (isOfflineLikeError(error)) {
        await queueOfflineAction({
          type: 'skip',
          taskInstanceId: taskId,
          skipReason,
        });
        updateTask(taskId, {
          status: 'skipped',
          saving: false,
          saved: false,
          showSkip: false,
          statusMessage: 'Skip pending sync — saved on this device',
          statusTone: 'tone-amber',
        });
        return;
      }

      updateTask(taskId, {
        saving: false,
        showSkip: true,
        statusMessage: error?.message || 'Skip failed — try again',
        statusTone: 'tone-red',
      });
    }
  }

  useEffect(() => {
    void refreshQueueSummary();

    const removeListeners = onQueueChange(() => {
      void refreshQueueSummary();
    });

    const handleOnline = () => {
      void refreshQueueSummary();
      void runPendingSync();
    };
    const handleOffline = () => {
      setSyncMessage('Offline — work will sync when signal returns');
      void refreshQueueSummary();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const intervalId = window.setInterval(() => {
      void runPendingSync();
    }, OFFLINE_SYNC_INTERVAL_MS);

    void runPendingSync();

    return () => {
      removeListeners();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  function findNextIncompleteIndex(startIndex = currentIndex) {
    if (!tasks.length) {
      return -1;
    }

    for (let offset = 1; offset <= tasks.length; offset += 1) {
      const index = (startIndex + offset) % tasks.length;
      const task = tasks[index];
      const localState = taskState[task.id] || {};
      if (!isCleanerTaskResolvedForProgress({ ...task, ...localState, status: localState.status ?? task.status, score: localState.saved ? (localState.grade ?? task.score) : task.score })) {
        return index;
      }
    }

    return -1;
  }

  const completedCount = tasks.filter((task) => {
    const localState = taskState[task.id] || {};
    return isCleanerTaskResolvedForProgress({ ...task, ...localState, status: localState.status ?? task.status, score: localState.saved ? (localState.grade ?? task.score) : task.score });
  }).length;
  const allTasksCompleted = tasks.length > 0 && completedCount === tasks.length;
  const nextIncompleteIndex = findNextIncompleteIndex();

  useEffect(() => {
    if (!allTasksCompleted || reportRequestedRef.current) {
      return;
    }

    reportRequestedRef.current = true;
    void onAllTasksCompleted?.();
  }, [allTasksCompleted, onAllTasksCompleted]);

  return (
    <div className="compact-flow">
      <div className={`offline-sync-banner ${queueSummary.count ? 'offline-sync-banner-pending' : ''}`}>
        <span className="badge">{getOnlineLabel(isOnline)}</span>
        {queueSummary.count ? (
          <span>{queueSummary.count} item{queueSummary.count === 1 ? '' : 's'} pending sync</span>
        ) : (
          <span>All work synced</span>
        )}
        {syncMessage ? <span className="muted">{syncMessage}</span> : null}
        {queueSummary.lastError ? <span className="tone-red">Last sync error: {queueSummary.lastError}</span> : null}
        {queueSummary.count ? (
          <button className="button secondary slim" type="button" onClick={() => void runPendingSync()}>
            Retry sync
          </button>
        ) : null}
      </div>

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
          {nextIncompleteIndex >= 0 ? `Current job ${Math.min(currentIndex + 1, tasks.length)} of ${tasks.length}` : 'All done'}
        </button>
        <span className="badge">{nextIncompleteIndex >= 0 ? 'Open' : 'Finished'}</span>
      </div>

      <div className="compact-task-list" ref={listRef}>
        {tasks.map((task, index) => {
          const isCurrent = index === currentIndex;
          const localState = taskState[task.id] || { grade: null, correctedGrade: task.correctedGrade ?? null, correctionLater: task.correctionLater ?? false, incidentGrade: task.initialGrade ?? null, note: '', status: task.status, skipReason: '', showSkip: false, saving: false, saved: false, photoCount: 0, photos: [], statusMessage: '', statusTone: 'muted' };
          const selectedGrade = localState.grade;
          const resolvedCorrectedGrade = localState.correctedGrade ?? task.correctedGrade ?? null;
          const correctionLaterSelected = Boolean(localState.correctionLater ?? task.correctionLater);
          const photos = localState.photos?.length ? localState.photos : (task.photos ?? []);
          const { beforePhotos, afterPhotos } = splitCleanerEvidencePhotos(photos);
          const flowStatus = localState.status ?? task.status;
          const gradeForIncidentCheck = Number(localState.incidentGrade ?? task.initialGrade ?? selectedGrade ?? task.score);
          const hasIncidentGrade = gradeForIncidentCheck > 0 && gradeForIncidentCheck <= 2;
          const shouldSeparateEvidence = shouldRenderSeparatedBeforeAfterEvidence({
            photos,
            initialGrade: task.initialGrade,
            incidentGrade: localState.incidentGrade,
            correctedGrade: resolvedCorrectedGrade,
            selectedGrade,
            score: task.score,
          });
          const showCorrectionPanel = shouldSeparateEvidence && flowStatus !== 'skipped';
          const canShowStackPhotoUpload = photos.length === 0 && !showCorrectionPanel;
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
                >
                  <label className="button secondary">
                    Add another photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        void uploadPhoto(task.id, file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </CleanerPhotoLightbox>
              )}

              {showCorrectionPanel && (
                <section className={`issue-correction-panel compulsory-correction-panel ${resolvedCorrectedGrade ? 'correction-score-entered' : correctionLaterSelected ? 'correction-later-entered' : ''}`} data-requirement-target={`${task.id}-correction`}>
                  <div>
                    <strong>{task.photoRequired ? 'Compulsory incident correction' : 'Incident correction'}</strong>
                    <span className="muted">Before evidence is recorded separately. Choose corrected score and add after evidence, or mark it to correct later.</span>
                  </div>
                  <div className="before-after-column before-evidence-column">
                    <div className="cleaner-photo-evidence-title">Before / incident evidence</div>
                    {beforePhotos.length ? (
                      <CleanerPhotoLightbox photos={beforePhotos} title={task.title} required={task.photoRequired} incident>
                        <label className="button secondary">
                          Add before incident photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              void uploadPhoto(task.id, file, 'exception');
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </CleanerPhotoLightbox>
                    ) : (
                      <label className="button secondary cleaner-requirement-box requirement-missing">
                        Add before incident photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: 'none' }}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            void uploadPhoto(task.id, file, 'exception');
                            event.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {beforePhotos.length > 0 ? (
                    <div className="resolved-issue-buttons">
                      {[3, 4, 5].map((grade) => (
                        <button
                          key={grade}
                          className={`button ${resolvedCorrectedGrade === grade ? 'primary' : 'secondary'}`}
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            updateTask(task.id, {
                              correctedGrade: grade,
                              correctionLater: false,
                              statusMessage: `Corrected score ${grade}/5 selected — add after photo to complete.`,
                              statusTone: 'tone-green',
                            });
                            window.setTimeout(() => focusRequirement(task.id, 'correction'), 40);
                          }}
                          disabled={localState.saving}
                        >
                          Corrected to {grade}
                        </button>
                      ))}
                      <button
                        className={`button ${correctionLaterSelected ? 'primary' : 'secondary'}`}
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void correctLater(task.id, index);
                        }}
                        disabled={localState.saving}
                      >
                        Correct later
                      </button>
                    </div>
                  ) : (
                    <div className="muted">Add before photo to unlock corrected score options.</div>
                  )}

                  <div className="before-after-column after-evidence-column">
                    <div className="cleaner-photo-evidence-title">After correction evidence</div>
                    {afterPhotos.length ? (
                      <CleanerPhotoLightbox photos={afterPhotos} title={task.title} required={task.photoRequired}>
                        <label className="button secondary">
                          Add another after photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              void uploadPhoto(task.id, file, 'completion', index);
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </CleanerPhotoLightbox>
                    ) : (
                      <div className="muted">{correctionLaterSelected ? 'Marked to correct later — no after photo needed now.' : resolvedCorrectedGrade ? 'Add an after photo to complete the correction.' : 'Choose corrected score first, then add after photo.'}</div>
                    )}
                    {afterPhotos.length < 1 && resolvedCorrectedGrade && !correctionLaterSelected && <label className="button secondary cleaner-requirement-box requirement-missing">
                      Add after correction photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          void uploadPhoto(task.id, file, 'completion', index);
                          event.target.value = '';
                        }}
                      />
                    </label>}
                  </div>
                </section>
              )}

              <button
                className={`button secondary cleaner-note-button cleaner-requirement-box ${commentRequirementClass}`}
                type="button"
                data-requirement-target={`${task.id}-comment`}
                onClick={(event) => {
                  event.stopPropagation();
                  setNoteTaskId(task.id);
                }}
              >
                {localState.note?.trim() ? 'Edit cleaner note' : task.commentRequired ? 'Add required cleaner note' : 'Cleaner note'}
              </button>

              <div className="task-actions compact-actions">
                {canShowStackPhotoUpload && (
                  <label
                    className={`${task.photoRequired ? 'button photo-required-button' : 'button secondary'} cleaner-requirement-box ${photoRequirementClass}`}
                    data-requirement-target={`${task.id}-photo`}
                  >
                    {task.photoRequired ? 'Upload required photo' : 'Upload photo'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        void uploadPhoto(task.id, file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                )}
                {flowStatus !== 'skipped' && (
                  <button
                    className={`button secondary skip-explanation-button cleaner-requirement-box ${commentRequirementClass}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateTask(task.id, { showSkip: true, statusMessage: '' });
                      setSkipTaskId(task.id);
                    }}
                    disabled={localState.saving}
                  >
                    Skip with explanation
                  </button>
                )}
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
              <h3>All tasks submitted</h3>
              <div className="muted">Everything on this active list has been graded. Submit to go back.</div>
            </div>
            <div className="compact-actions">
              <button className="button primary" type="button" onClick={() => onComplete?.()}>
                Submit and go back
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

      {noteTaskId && (() => {
        const noteTask = tasks.find((task) => task.id === noteTaskId);
        const noteState = taskState[noteTaskId] || {};
        if (!noteTask) return null;
        return (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Cleaner note">
            <div className={`note-modal-card ${noteTask.commentRequired ? (noteState.note?.trim() ? 'note-requirement-met' : 'note-requirement-missing') : ''}`}>
              <div>
                <span className="badge">Cleaner note</span>
                <h3>{noteTask.title}</h3>
              </div>
              <textarea
                value={noteState.note || ''}
                onChange={(event) => updateTask(noteTaskId, { note: event.target.value, saved: false, statusMessage: '' })}
                placeholder={noteTask.commentRequired ? 'Add the required note here' : 'Optional note'}
                rows={noteTask.commentRequired ? 12 : 6}
                autoFocus
              />
              <div className="workflow-banner-actions">
                <button className="button secondary" type="button" onClick={() => setNoteTaskId(null)}>Close</button>
                <button className="button primary" type="button" onClick={() => setNoteTaskId(null)}>Save note</button>
              </div>
            </div>
          </div>
        );
      })()}

      {skipTaskId && (() => {
        const skipTaskItem = tasks.find((task) => task.id === skipTaskId);
        const skipState = taskState[skipTaskId] || {};
        if (!skipTaskItem) return null;
        return (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Skip explanation">
            <div className="note-modal-card skip-modal-card">
              <div>
                <span className="badge">Skip explanation</span>
                <h3>{skipTaskItem.title}</h3>
              </div>
              <textarea
                value={skipState.skipReason || ''}
                onChange={(event) => updateTask(skipTaskId, { skipReason: event.target.value, statusMessage: '' })}
                placeholder="Why can this task not be completed now?"
                rows={6}
                autoFocus
              />
              <div className="workflow-banner-actions">
                <button className="button secondary" type="button" onClick={() => setSkipTaskId(null)}>Close</button>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => {
                    const reason = String((taskState[skipTaskId] || {}).skipReason || '').trim();
                    if (reason.length < 5) {
                      updateTask(skipTaskId, {
                        showSkip: true,
                        statusMessage: 'Add a short explanation before skipping so admin can assess it.',
                        statusTone: 'tone-red',
                      });
                      return;
                    }
                    const skipIndex = tasks.findIndex((task) => task.id === skipTaskId);
                    void skipTask(skipTaskId, skipIndex >= 0 ? skipIndex : 0);
                    setSkipTaskId(null);
                  }}
                >
                  Send skip to admin
                </button>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
}
