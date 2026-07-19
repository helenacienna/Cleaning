export function isCleanerTaskResolvedForProgress(task = {}) {
  return task?.status === 'skipped' || task?.saved === true || Number(task?.score) > 0 || Number(task?.grade) > 0;
}
