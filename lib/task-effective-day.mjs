const boardDayKeyFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Australia/Brisbane',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatBoardDayKey(value) {
  return boardDayKeyFormatter.format(new Date(value));
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function applyBoardDayToDate(baseDate, boardDayKey) {
  if (!boardDayKey) {
    return new Date(baseDate);
  }

  const [year, month, day] = String(boardDayKey).split('-').map(Number);
  const next = new Date(baseDate);
  next.setFullYear(year, (month ?? 1) - 1, day ?? 1);
  return next;
}

export function deriveOrganiserSchedule({
  currentDueAt,
  anchoredDueAt,
  recurrenceBasis,
  recurrenceType,
  actualBoardDay,
  shiftStartAt,
  laneIndex = 0,
}) {
  const anchorDate = anchoredDueAt ?? currentDueAt;
  const anchorBoardDay = formatBoardDayKey(anchorDate);
  const boardDay = actualBoardDay ?? anchorBoardDay;
  const scheduledForAt = shiftStartAt ? addMinutes(new Date(shiftStartAt), laneIndex * 60) : null;
  const rescheduledDueAt = scheduledForAt ?? applyBoardDayToDate(currentDueAt, boardDay);
  const shouldPreserveDueAt = recurrenceBasis === 'anchored' && recurrenceType !== 'none';
  const dueAt = shouldPreserveDueAt ? anchorDate : rescheduledDueAt;
  const plannedRunDate = shouldPreserveDueAt && boardDay !== anchorBoardDay
    ? new Date(`${boardDay}T00:00:00+10:00`)
    : null;

  return {
    anchorBoardDay,
    boardDay,
    dueAt,
    plannedRunDate,
    scheduledForAt,
  };
}

export function getTaskInstanceBoardDate(taskInstance) {
  return taskInstance?.shiftRun?.runDate ?? taskInstance?.plannedRunDate ?? taskInstance?.dueAt ?? null;
}

export function getTaskInstanceEffectiveDueAt(taskInstance) {
  const boardDate = getTaskInstanceBoardDate(taskInstance);
  const timeSource = taskInstance?.scheduledForAt ?? taskInstance?.dueAt ?? boardDate;

  if (!boardDate || !timeSource) {
    return taskInstance?.scheduledForAt ?? taskInstance?.dueAt ?? null;
  }

  const next = new Date(timeSource);
  const source = new Date(boardDate);
  next.setFullYear(source.getFullYear(), source.getMonth(), source.getDate());
  return next;
}

export function isTaskInstancePastEffectiveDue(taskInstance, now = new Date()) {
  const effectiveDueAt = getTaskInstanceEffectiveDueAt(taskInstance);
  return Boolean(effectiveDueAt) && new Date(effectiveDueAt).getTime() < new Date(now).getTime();
}
