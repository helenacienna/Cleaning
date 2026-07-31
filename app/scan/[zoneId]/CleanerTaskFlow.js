'use client';

import { useEffect, useRef, useState } from 'react';
import { clearBlockedOfflineRequests, createOfflinePhotoPreview, enqueueJsonRequest, enqueuePhotoUpload, flushOfflineQueue, getPendingOfflineCount, getPendingOfflineSummary, subscribeOfflineQueue } from './offlineQueue';

const REFRESH_DEBOUNCE_MS = 2000;
const MOBILE_TASK_ALIGNMENT_QUERY = '(max-width: 768px)';
const MOBILE_TASK_VISIBLE_PADDING = 12;
const MOBILE_ACTION_VISIBLE_PADDING = 170;
const PROGRAMMATIC_SCROLL_GRACE_MS = 1200;
const GRADE_REFERENCE = [
  ['Grade 1', 'Needs Correction Urgently', 'grade-reference-1'],
  ['Grade 2', 'Needs Correction Today', 'grade-reference-2'],
  ['Grade 3', 'Cleaner to Improve ASAP', 'grade-reference-3'],
  ['Grade 4', 'Acceptable', 'grade-reference-4'],
  ['Grade 5', 'Perfect', 'grade-reference-5'],
];
import CleanerPhotoLightbox from './CleanerPhotoLightbox';

function checklistStateCacheKey(tasks = []) {
  return `cleanerChecklistTaskState:${tasks.map((task) => task.id).join('|')}`;
}

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
  let cachedState = {};
  if (typeof window !== 'undefined') {
    try {
      cachedState = JSON.parse(window.localStorage.getItem(checklistStateCacheKey(tasks)) || '{}') || {};
    } catch {
      cachedState = {};
    }
  }

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
      syncVersion: task.syncVersion ?? null,
      statusMessage: hasGrade ? (completed ? 'Completed earlier' : 'Saved earlier for follow-up') : '',
      statusTone: completed ? 'tone-green' : hasGrade ? 'tone-amber' : 'muted',
      ...(cachedState[task.id] ?? {}),
    }];
  }));
}

async function buildCleanerSaveError(response, fallbackMessage) {
  const payload = await response.json().catch(() => null);
  const error = new Error(payload?.error || fallbackMessage);
  error.queueOffline = false;
  error.conflict = Boolean(payload?.conflict || response.status === 409);
  error.currentTaskUpdatedAt = payload?.currentTaskUpdatedAt ?? null;
  return error;
}

export default function CleanerTaskFlow({ tasks, onTaskSaved, onComplete, onRefreshProgress, onClose, onAllTasksCompleted, onOpenReport, reportUrl = '', reportStatus = 'idle', completionMode = 'completed', completeLabel = 'Submit and go back', completeTitle = 'All tasks submitted', completeDescription = 'Everything on this active list has been graded. Submit to go back.' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskState, setTaskState] = useState(() => createInitialTaskState(tasks));
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');
  const [pendingOfflineSummary, setPendingOfflineSummary] = useState([]);
  const [hasBlockedSync, setHasBlockedSync] = useState(false);
  const [gradeReferenceHiddenByScroll, setGradeReferenceHiddenByScroll] = useState(false);
  const [dismissedAllocatedNoticeKey, setDismissedAllocatedNoticeKey] = useState('');
  const cardRefs = useRef([]);
  const gradePanelRefs = useRef([]);
  const issuePanelRefs = useRef({});
  const afterCorrectionPhotoInputRefs = useRef({});
  const afterCorrectionAlbumInputRefs = useRef({});
  const listRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const endCardRef = useRef(null);
  const programmaticScrollUntilRef = useRef(0);

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

  function shouldBottomAlignActiveTask() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.(MOBILE_TASK_ALIGNMENT_QUERY)?.matches ?? false;
  }

  function scrollElementIntoTaskPosition(element, preferredBlock = 'center') {
    if (!element) return;

    if (!shouldBottomAlignActiveTask()) {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      if (rect.top < 0 || rect.bottom <= viewportHeight) {
        return;
      }
      programmaticScrollUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_GRACE_MS;
      element.scrollIntoView({
        behavior: 'smooth',
        block: preferredBlock,
      });
      return;
    }

    const list = listRef.current;
    if (!list) {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      if (rect.top < 0 || rect.bottom <= viewportHeight) {
        return;
      }
      programmaticScrollUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_GRACE_MS;
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    window.requestAnimationFrame(() => {
      const listRect = list.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const relativeTop = elementRect.top - listRect.top + list.scrollTop;
      const relativeBottom = relativeTop + elementRect.height;
      const targetScrollTop = Math.max(0, relativeBottom - list.clientHeight + MOBILE_ACTION_VISIBLE_PADDING);
      const currentScrollTop = list.scrollTop;

      if (targetScrollTop <= currentScrollTop + 1) {
        return;
      }

      programmaticScrollUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_GRACE_MS;
      list.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    });
  }

  function focusJob(index) {
    setGradeReferenceHiddenByScroll(false);
    setCurrentIndex(index);
    scrollElementIntoTaskPosition(cardRefs.current[index], 'center');
  }

  function focusTaskActions(index, delayMs = 80) {
    window.setTimeout(() => {
      scrollElementIntoTaskPosition(gradePanelRefs.current[index] || cardRefs.current[index], 'end');
    }, delayMs);
  }

  function focusTaskActionsAfterLayout(index) {
    setGradeReferenceHiddenByScroll(false);
    focusTaskActions(index, 40);
    focusTaskActions(index, 180);
    focusTaskActions(index, 420);
  }

  function scrollToIssuePanel(taskId, index, block = 'center') {
    setCurrentIndex(index);
    const issuePanel = issuePanelRefs.current[taskId];
    if (issuePanel) {
      scrollElementIntoTaskPosition(issuePanel, block);
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

  async function refreshPendingOfflineCount() {
    const [count, summary] = await Promise.all([
      getPendingOfflineCount().catch(() => 0),
      getPendingOfflineSummary().catch(() => []),
    ]);
    setPendingOfflineCount(count);
    setPendingOfflineSummary(summary);
    setHasBlockedSync(summary.some((entry) => entry.blocked || entry.conflict));
    return count;
  }

  async function refreshPendingOfflineState() {
    const [count, summary] = await Promise.all([
      getPendingOfflineCount().catch(() => 0),
      getPendingOfflineSummary().catch(() => []),
    ]);
    setPendingOfflineCount(count);
    setPendingOfflineSummary(summary);
    setHasBlockedSync(summary.some((entry) => entry.blocked || entry.conflict));
    return { count, summary };
  }

  async function clearBlockedSyncItems() {
    const result = await clearBlockedOfflineRequests().catch((error) => ({ error: error?.message || 'Unable to clear stuck sync item' }));
    const remaining = await refreshPendingOfflineCount();
    if (result.error) {
      setSyncStatusMessage(result.error);
      return;
    }
    setSyncStatusMessage(result.cleared
      ? `${result.cleared} stuck sync item${result.cleared === 1 ? '' : 's'} cleared. Refreshing checklist…`
      : 'No stuck sync items found.');
    if (remaining === 0) {
      queueRefresh();
    }
  }

  async function tryFlushOfflineQueue(reason = 'manual') {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSyncStatusMessage('Offline — changes will sync when connection returns.');
      return;
    }

    const beforeCount = await refreshPendingOfflineCount();
    if (!beforeCount) {
      if (reason === 'manual') {
        setSyncStatusMessage('Everything is synced.');
      }
      return;
    }

    setSyncStatusMessage('Syncing saved offline changes…');
    const result = await flushOfflineQueue().catch((error) => ({ ok: false, error: error?.message || 'Sync failed' }));
    const { count: afterCount, summary: afterSummary } = await refreshPendingOfflineState();
    if (result.conflict) {
      setSyncStatusMessage('One saved offline change is blocked because the task changed on the server. Check the details below, then clear the stuck item if the checklist already looks saved.');
      return;
    }
    if (result.ok && afterCount === 0) {
      setSyncStatusMessage('Offline changes synced.');
      queueRefresh();
      return;
    }
    const blocked = afterSummary.some((entry) => entry.blocked || entry.conflict) || Boolean(result.conflict);
    setSyncStatusMessage(afterCount
      ? blocked
        ? `${afterCount} change${afterCount === 1 ? '' : 's'} still pending sync. One appears stuck and needs attention.`
        : `${afterCount} change${afterCount === 1 ? '' : 's'} still pending sync.`
      : 'Sync finished.');
  }

  async function queueJsonSave(taskId, payload, successUpdates) {
    await enqueueJsonRequest({ url: '/api/cleaner-tasks', body: payload, label: 'Checklist save' });
    await refreshPendingOfflineCount();
    updateTask(taskId, {
      ...successUpdates,
      saving: false,
      saved: true,
      syncVersion: successUpdates.syncVersion ?? payload.expectedTaskUpdatedAt ?? null,
      offlinePending: true,
      statusMessage: 'Saved offline — pending sync',
      statusTone: 'tone-amber',
    });
    setSyncStatusMessage('Offline save queued. Keep this app open when back online to sync.');
  }

  function handleSaveConflict(taskId, error) {
    updateTask(taskId, {
      saving: false,
      saved: false,
      conflict: true,
      syncVersion: error?.currentTaskUpdatedAt ?? null,
      statusMessage: error?.message || 'Task changed on another device. Refresh before saving this item.',
      statusTone: 'tone-red',
    });
    setSyncStatusMessage('Conflict detected — refresh the checklist before continuing on that task.');
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
      focusTaskActions(index);
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
      focusTaskActions(index);
      return;
    }

    updateTask(taskId, {
      grade,
      saving: true,
      saved: false,
      statusMessage: 'Saving task…',
      statusTone: 'tone-amber',
    });

    const payload = {
      taskInstanceId: taskId,
      grade,
      note: current.note || '',
      expectedTaskUpdatedAt: current.syncVersion ?? tasks[index]?.syncVersion ?? null,
    };

    try {
      const response = await fetch('/api/cleaner-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await buildCleanerSaveError(response, 'Unable to save cleaner task');
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
        syncVersion: result.taskVersion ?? current.syncVersion ?? null,
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
    } catch (error) {
      if (error?.queueOffline === false) {
        if (error.conflict) {
          handleSaveConflict(taskId, error);
          return;
        }
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
        return;
      }
      await queueJsonSave(taskId, payload, {
        grade,
        issueGrade: current.issueGrade ?? null,
        issueStage: null,
        finalGrade: null,
        resolvedIssue: false,
        syncVersion: current.syncVersion ?? tasks[index]?.syncVersion ?? null,
      });
      window.setTimeout(() => {
        if (index >= tasks.length - 1) {
          endCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          focusJob(Math.min(index + 1, tasks.length - 1));
        }
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

    const payload = {
      taskInstanceId: taskId,
      grade: issueGrade,
      note: current.note || '',
      expectedTaskUpdatedAt: current.syncVersion ?? tasks[index]?.syncVersion ?? null,
    };

    try {
      const response = await fetch('/api/cleaner-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await buildCleanerSaveError(response, 'Unable to record issue');
      }

      const result = await response.json();

      updateTask(taskId, {
        grade: issueGrade,
        saving: false,
        saved: true,
        issueGrade,
        issueStage: 'needs_correction',
        resolvedIssue: false,
        syncVersion: result.taskVersion ?? current.syncVersion ?? null,
        statusMessage: 'Issue recorded — add correction note and corrected score',
        statusTone: 'tone-amber',
      });
      focusTaskActions(index);
      queueRefresh();
    } catch (error) {
      if (error?.queueOffline === false) {
        if (error.conflict) {
          handleSaveConflict(taskId, error);
          return;
        }
        updateTask(taskId, {
          saving: false,
          saved: false,
          issueStage: 'needs_issue_photo',
          statusMessage: 'Issue save failed — add/check photo and try again',
          statusTone: 'tone-red',
        });
        return;
      }
      await queueJsonSave(taskId, payload, {
        grade: issueGrade,
        saved: true,
        issueGrade,
        resolvedIssue: false,
        issueStage: 'needs_correction',
        syncVersion: current.syncVersion ?? tasks[index]?.syncVersion ?? null,
      });
    }
  }

  function selectCorrectedGrade(taskId, finalGrade, index = currentIndex) {
    updateTask(taskId, {
      finalGrade,
      issueStage: 'needs_after_photo',
      statusMessage: 'Add after photo(s) showing the correction, then save',
      statusTone: 'tone-amber',
    });
    focusTaskActions(index);
  }

  function openAfterCorrectionPhotoPicker(taskId) {
    afterCorrectionPhotoInputRefs.current[taskId]?.click();
  }

  function openAfterCorrectionAlbumPicker(taskId) {
    afterCorrectionAlbumInputRefs.current[taskId]?.click();
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
      setCurrentIndex(nextIndex);
      focusTaskActionsAfterLayout(nextIndex);
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

    const payload = {
      taskInstanceId: taskId,
      grade: finalGrade,
      note: current.note || '',
      resolvedFromGrade: issueGrade,
      resolutionNote: current.note || '',
      expectedTaskUpdatedAt: current.syncVersion ?? tasks[index]?.syncVersion ?? null,
    };

    try {
      const response = await fetch('/api/cleaner-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await buildCleanerSaveError(response, 'Unable to save resolved issue');
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
        syncVersion: result.taskVersion ?? current.syncVersion ?? null,
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
    } catch (error) {
      if (error?.queueOffline === false) {
        if (error.conflict) {
          handleSaveConflict(taskId, error);
          return;
        }
        updateTask(taskId, {
          saving: false,
          statusMessage: 'Resolved issue save failed — try again',
          statusTone: 'tone-red',
        });
        window.setTimeout(() => {
          focusJob(index);
        }, 20);
        return;
      }
      await queueJsonSave(taskId, payload, {
        grade: finalGrade,
        issueGrade,
        finalGrade,
        issueStage: 'resolved',
        resolvedIssue: true,
        syncVersion: current.syncVersion ?? tasks[index]?.syncVersion ?? null,
      });
      window.setTimeout(() => {
        if (index >= tasks.length - 1) {
          endCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          focusJob(Math.min(index + 1, tasks.length - 1));
        }
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
        throw Object.assign(new Error('Unable to upload photo'), { queueOffline: false });
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
      focusTaskActions(index, 120);
      queueRefresh();
    } catch (error) {
      if (error?.queueOffline === false) {
        updateTask(taskId, {
          saving: false,
          statusMessage: 'Photo upload failed — try again',
          statusTone: 'tone-red',
        });
        return;
      }
      const offlinePhoto = createOfflinePhotoPreview(file, photoType);
      await enqueuePhotoUpload({ taskInstanceId: taskId, photoType, file, label: photoType === 'exception' ? 'Before photo upload' : 'After photo upload' });
      const nextPhotos = [...(current.photos ?? []), offlinePhoto];
      await refreshPendingOfflineCount();
      updateTask(taskId, {
        photoCount: (current.photoCount ?? 0) + 1,
        photos: nextPhotos,
        saving: false,
        saved: true,
        lastPhotoType: photoType,
        askAnotherPhoto: true,
        offlinePending: true,
        statusMessage: photoType === 'exception' ? 'Before photo saved offline — pending sync' : 'After photo saved offline — pending sync',
        statusTone: 'tone-amber',
      });
      setSyncStatusMessage('Photo saved offline. Keep this app open when back online to sync.');
      focusTaskActions(index, 120);
    }
  }

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    try {
      window.localStorage.setItem(checklistStateCacheKey(tasks), JSON.stringify(taskState));
    } catch {
      // Local checklist cache is best-effort. IndexedDB remains the source for pending sync work.
    }

    return undefined;
  }, [tasks, taskState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let cancelled = false;
    const refresh = () => {
      void refreshPendingOfflineCount();
    };
    const unsubscribe = subscribeOfflineQueue(refresh);

    function updateOnlineState() {
      const online = navigator.onLine !== false;
      setIsOnline(online);
      if (online) {
        void tryFlushOfflineQueue('online');
      } else {
        setSyncStatusMessage('Offline — changes will sync when connection returns.');
      }
    }

    function warnIfPending(event) {
      if (pendingOfflineCount <= 0) return;
      event.preventDefault();
      event.returnValue = 'There are checklist changes still waiting to sync.';
      return event.returnValue;
    }

    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    window.addEventListener('beforeunload', warnIfPending);

    void refreshPendingOfflineCount().then((count) => {
      if (!cancelled && count > 0 && navigator.onLine !== false) {
        void tryFlushOfflineQueue('open');
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
      window.removeEventListener('beforeunload', warnIfPending);
    };
  }, [pendingOfflineCount]);

  function trackManualScroll() {
    const list = listRef.current;
    if (!list) return;

    if (Date.now() > programmaticScrollUntilRef.current) {
      setGradeReferenceHiddenByScroll(true);
    }

    const listRect = list.getBoundingClientRect();
    const focusLine = shouldBottomAlignActiveTask()
      ? listRect.bottom
      : listRect.top + list.clientHeight / 2;
    let closestIndex = currentIndex;
    let closestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const cardFocusPoint = shouldBottomAlignActiveTask()
        ? rect.bottom
        : rect.top + rect.height / 2;
      const distance = Math.abs(cardFocusPoint - focusLine);

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
  const currentTask = tasks[currentIndex] ?? null;
  const currentLocalState = currentTask ? (taskState[currentTask.id] || {}) : {};
  const currentIssueStage = currentLocalState.issueStage ?? '';
  const currentPhotoCount = currentLocalState.photoCount ?? 0;
  const currentPhotoLength = currentLocalState.photos?.length ?? 0;
  const currentSelectedGrade = currentTask ? (currentLocalState.grade ?? currentTask.score) : null;
  const allocatedNoticeTasks = tasks.filter((task) => task.addedToday || task.allocationNote);
  const allocatedNoticeKey = allocatedNoticeTasks.map((task) => task.id).join('|');
  const showAllocatedTaskNotice = Boolean(allocatedNoticeKey && dismissedAllocatedNoticeKey !== allocatedNoticeKey);
  const showGradeReference = Boolean(
    currentTask
      && !gradeReferenceHiddenByScroll
      && !(Number(currentSelectedGrade) >= 1 && Number(currentSelectedGrade) <= 5)
  );
  const shouldKeepActionsVisible = Boolean(
    currentTask
      && shouldBottomAlignActiveTask()
      && (
        currentLocalState.askAnotherPhoto
        || ['needs_issue_photo', 'needs_correction', 'needs_after_photo'].includes(currentIssueStage)
        || (Number(currentLocalState.grade) >= 1 && Number(currentLocalState.grade) <= 2 && !currentLocalState.resolvedIssue)
      ),
  );

  useEffect(() => {
    if (allTasksCompleted) {
      void onAllTasksCompleted?.();
    }
  }, [allTasksCompleted, onAllTasksCompleted]);

  useEffect(() => {
    if (!shouldKeepActionsVisible) return;
    focusTaskActions(currentIndex, 80);
    focusTaskActions(currentIndex, 350);
    focusTaskActions(currentIndex, 800);
  }, [currentIndex, currentIssueStage, currentLocalState.askAnotherPhoto, currentLocalState.finalGrade, currentPhotoCount, currentPhotoLength, shouldKeepActionsVisible]);

  useEffect(() => {
    if (!shouldKeepActionsVisible || typeof ResizeObserver === 'undefined') return undefined;
    const card = cardRefs.current[currentIndex];
    if (!card) return undefined;

    let resizeTimer = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        scrollElementIntoTaskPosition(card, 'end');
      }, 80);
    });

    observer.observe(card);

    return () => {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      observer.disconnect();
    };
  }, [currentIndex, shouldKeepActionsVisible]);

  return (
    <div className="compact-flow">
      {showAllocatedTaskNotice ? (
        <div className="modal-backdrop" role="presentation" style={{ zIndex: 45 }}>
          <section className="card" role="dialog" aria-modal="true" aria-label="Allocated task notice" style={{ width: 'min(92vw, 480px)', margin: '12vh auto', display: 'grid', gap: 12 }}>
            <div>
              <span className="badge">Allocated task notice</span>
              <h3 style={{ margin: '6px 0 0' }}>You have specific allocated task{allocatedNoticeTasks.length === 1 ? '' : 's'} today</h3>
              <p className="muted" style={{ margin: '6px 0 0' }}>Please check these first — they may need special equipment or instructions.</p>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {allocatedNoticeTasks.map((task) => (
                <div className="card" key={task.id} style={{ padding: 10 }}>
                  <strong>{task.title}</strong>
                  {task.instructionNote ? <p style={{ margin: '6px 0 0' }}>{task.instructionNote}</p> : null}
                </div>
              ))}
            </div>
            <button className="button primary" type="button" onClick={() => setDismissedAllocatedNoticeKey(allocatedNoticeKey)}>Open my list</button>
          </section>
        </div>
      ) : null}
      <div className="flow-position" aria-label="Checklist controls">
        <span className="badge flow-current-job-chip">Current job {Math.min(currentIndex + 1, tasks.length)} of {tasks.length}</span>
        <span className={`badge ${isOnline ? 'tone-green' : 'tone-amber'}`}>{isOnline ? 'Online' : 'Offline'}</span>
        {pendingOfflineCount > 0 ? <span className="badge tone-amber">{pendingOfflineCount} pending sync</span> : null}
        {pendingOfflineCount > 0 && isOnline ? (
          <button className="button secondary flow-nav-button" type="button" onClick={() => { void tryFlushOfflineQueue('manual'); }}>
            Sync now
          </button>
        ) : null}
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
        {onOpenReport ? (
          <button
            className="button secondary flow-nav-button"
            type="button"
            onClick={() => {
              void onOpenReport();
            }}
            disabled={reportStatus === 'creating'}
          >
            {reportStatus === 'creating' ? 'Creating…' : 'Report'}
          </button>
        ) : (
          <button className="button secondary flow-nav-button" type="button" onClick={onRefreshProgress}>
            Refresh
          </button>
        )}
        <button className="button secondary flow-nav-button close-modal-button" type="button" onClick={onClose}>
          Close
        </button>
        {showGradeReference ? (
          <div className="floating-grade-reference" aria-label="Grade score reference">
            {GRADE_REFERENCE.map(([grade, description, toneClass]) => (
              <span className={`floating-grade-reference-item ${toneClass}`} key={grade}>
                <strong>{grade}</strong>
                <span>{description}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {(syncStatusMessage || pendingOfflineCount > 0 || !isOnline) ? (
        <div className={`offline-checklist-sync-panel ${pendingOfflineCount > 0 || !isOnline ? 'offline-checklist-sync-panel-pending' : ''}`} role="status">
          <strong>{pendingOfflineCount > 0 ? `${pendingOfflineCount} change${pendingOfflineCount === 1 ? '' : 's'} waiting to sync` : isOnline ? 'Checklist online' : 'Checklist offline'}</strong>
          <span>{syncStatusMessage || (isOnline ? 'Saved changes will sync to the server.' : 'You can keep grading. Saves and photos will queue on this device.')}</span>
          {pendingOfflineSummary.length > 0 ? (
            <details className="offline-checklist-sync-details">
              <summary>Sync details</summary>
              <ul>
                {pendingOfflineSummary.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.label}</strong>
                    {entry.type === 'photo' ? ` · ${entry.photoType || 'photo'}` : null}
                    {entry.attempts ? ` · tried ${entry.attempts} time${entry.attempts === 1 ? '' : 's'}` : ''}
                    {entry.lastError ? ` · ${entry.lastError}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {hasBlockedSync ? (
            <button className="button secondary flow-nav-button" type="button" onClick={() => { void clearBlockedSyncItems(); }}>
              Clear stuck sync item
            </button>
          ) : null}
          {pendingOfflineCount > 0 ? <span>Do not clear browser data before this reaches 0.</span> : null}
        </div>
      ) : null}

      <div className="compact-task-list" ref={listRef} onScroll={trackManualScroll}>
        <section className="active-checklist-instructions" aria-label="Active checklist instructions">
          <div className="instruction-copy">
            <span className="badge">How to use this list</span>
            <strong>Work through each job, grade it, then move to the next open task.</strong>
            <ul>
              <li>Tap a task to focus it. Use <strong>Next open</strong> to jump to the next unfinished job.</li>
              <li>Grade each job from <strong>1 to 5</strong>: 1-2 needs correction, 3 is partly done, 4-5 is complete.</li>
              <li>If you choose 1 or 2, add a <strong>before photo</strong>, fix the issue, then choose the corrected score and add an <strong>after photo</strong>.</li>
              <li>Add any required photo or note before saving. Use <strong>Report</strong> to open the daily report when needed.</li>
            </ul>
          </div>
        </section>
        {tasks.map((task, index) => {
          const isCurrent = index === currentIndex;
          const localState = taskState[task.id] || { grade: null, note: '', saving: false, saved: false, photoCount: 0, photos: [], resolutionNote: '', issueGrade: null, issueStage: null, finalGrade: null, lastPhotoType: null, askAnotherPhoto: false, resolvedIssue: false, statusMessage: '', statusTone: 'muted' };
          const selectedGrade = localState.grade;
          const photos = localState.photos?.length ? localState.photos : (task.photos ?? []);
          const beforePhotos = photos.filter((photo) => photo.photoType === 'exception');
          const afterPhotos = photos.filter((photo) => photo.photoType === 'completion');
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
                <div className="compact-task-copy">
                  {task.zone ? <div className="compact-task-zone">{task.zone}</div> : null}
                  <div className="compact-task-title">{task.title}</div>
                  {task.instructionNote ? <div className="muted" style={{ marginTop: 6 }}>{task.instructionNote}</div> : null}
                </div>
              </div>

              <div
                className="grade-panel compact-grade-panel"
                ref={(node) => { gradePanelRefs.current[index] = node; }}
              >
                <div className="grade-panel-header-row">
                  <div>
                    <strong>Grade completion</strong>
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
              </div>

              {(task.addedToday || task.photoRequired || task.commentRequired) && (
                <div className="compact-flags">
                  {task.addedToday && <span className="flag">{task.isExceptionTask ? 'Ad hoc' : 'Added today'}</span>}
                  {task.photoRequired && <span className="flag required-flag">Forced photo</span>}
                  {task.commentRequired && <span className="flag">Comment required</span>}
                </div>
              )}

              {photos.length > 0 && !unresolvedLowGrade && !localState.resolvedIssue && <CleanerPhotoLightbox photos={photos} title={task.title} framed />}

              {unresolvedLowGrade || localState.resolvedIssue ? (
                <div
                  className={`resolved-issue-panel ${localState.resolvedIssue ? 'resolved-issue-panel-done' : ''}`}
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
                    <strong>{localState.resolvedIssue ? 'Resolved issue recorded' : localState.issueStage === 'needs_issue_photo' ? 'Issue selected — add before photo(s)' : 'Issue recorded — add correction'}</strong>
                    <span className="muted">
                      {localState.resolvedIssue
                        ? `Original score ${localState.issueGrade}/5 · Corrected score ${selectedGrade}/5. Before and after photos remain separated below.`
                        : `Keep the initial ${selectedGrade}/5 issue on record, then capture the corrected result with after photo evidence.`}
                    </span>
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
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void uploadPhoto(task.id, file, 'completion', index);
                      event.target.value = '';
                    }}
                  />
                  <input
                    ref={(node) => {
                      if (node) {
                        afterCorrectionAlbumInputRefs.current[task.id] = node;
                      } else {
                        delete afterCorrectionAlbumInputRefs.current[task.id];
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
                  <div className="issue-photo-split" aria-label={`${task.title} issue evidence`}>
                    <div className="issue-photo-column issue-photo-column-before">
                      <strong>Before photos</strong>
                      {beforePhotos.length > 0 ? (
                        <CleanerPhotoLightbox photos={beforePhotos} title={task.title} photoGroupLabel="Before photos" />
                      ) : (
                        <span className="muted">No before photo yet</span>
                      )}
                      <div className="issue-photo-upload-actions">
                        <label className="button photo-required-button issue-photo-upload-button">
                          Take before photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              void uploadPhoto(task.id, file, 'exception', index);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <label className="button secondary issue-photo-upload-button">
                          Add from album
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
                    </div>
                    <div className="issue-photo-column issue-photo-column-after">
                      <strong>After photos</strong>
                      {afterPhotos.length > 0 ? (
                        <CleanerPhotoLightbox photos={afterPhotos} title={task.title} photoGroupLabel="After photos" />
                      ) : (
                        <span className="muted">No after photo yet</span>
                      )}
                      <div className="issue-photo-upload-actions">
                        <button
                          className="button photo-required-button issue-photo-upload-button"
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openAfterCorrectionPhotoPicker(task.id);
                          }}
                          disabled={localState.saving || !localState.finalGrade}
                        >
                          Take after photo
                        </button>
                        <button
                          className="button secondary issue-photo-upload-button"
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openAfterCorrectionAlbumPicker(task.id);
                          }}
                          disabled={localState.saving || !localState.finalGrade}
                        >
                          Add from album
                        </button>
                      </div>
                    </div>
                  </div>
                  {localState.askAnotherPhoto ? (
                    <div className="add-another-photo-panel">
                      <strong>Would you like to add another photo?</strong>
                      <div className="compact-actions">
                        <label className="button secondary">
                          Take another {localState.lastPhotoType === 'exception' ? 'before' : 'after'} photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              void uploadPhoto(task.id, file, localState.lastPhotoType || 'completion', index);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <label className="button secondary">
                          Add from album
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
                          className="button primary add-another-photo-continue-button"
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
                  {!localState.resolvedIssue && localState.issueStage === 'needs_issue_photo' && !localState.askAnotherPhoto ? null : !localState.resolvedIssue && !localState.askAnotherPhoto ? (
                    <>
                      <label className="builder-field">
                        <span className="muted">Cleaner note</span>
                        <textarea
                          value={localState.note}
                          onChange={(event) => updateTask(task.id, { note: event.target.value, saved: false, statusMessage: '' })}
                          placeholder={task.commentRequired ? 'Add the required note here' : 'Optional note'}
                          rows={3}
                        />
                      </label>
                      <div className="grade-buttons resolved-issue-buttons" aria-label={`Correction action for ${task.title}`}>
                        <button
                          className="grade-button correction-later-button"
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
                          <span>Correct later</span>
                        </button>
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
                            selectCorrectedGrade(task.id, finalGrade, index);
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
              ) : null}

              {!unresolvedLowGrade && !localState.resolvedIssue ? (
                <div className="task-actions compact-actions">
                  <label className={task.photoRequired ? 'button photo-required-button' : 'button secondary'}>
                    {task.photoRequired ? 'Take required photo' : 'Take photo'}
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
                  <label className="button secondary">
                    Add from album
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
              ) : null}

              {!unresolvedLowGrade && !localState.resolvedIssue ? (
                <label className="builder-field" onClick={(event) => event.stopPropagation()}>
                  <span className="muted">Cleaner note</span>
                  <textarea
                    value={localState.note}
                    onChange={(event) => updateTask(task.id, { note: event.target.value, saved: false, statusMessage: '' })}
                    placeholder={task.commentRequired ? 'Add the required note here' : 'Optional note'}
                    rows={3}
                  />
                </label>
              ) : null}

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
