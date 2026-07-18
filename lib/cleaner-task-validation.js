export function countTaskPhotos(taskInstance) {
  return taskInstance?.execution?.photos?.length ?? 0;
}

export function isPhotoEvidenceRequired(taskInstance) {
  return taskInstance?.evidenceRequirement === 'required_photo' || taskInstance?.evidenceRequirement === 'multi_photo';
}

export function isCommentRequiredForGrade(taskInstance, grade) {
  if (taskInstance?.commentRequirement === 'always') {
    return true;
  }

  if (taskInstance?.commentRequirement === 'on_exception') {
    return Number(grade) <= 2;
  }

  return false;
}

export function getCleanerTaskEvidenceFailures({ taskInstance, grade, note, photoCount = countTaskPhotos(taskInstance) }) {
  const failures = [];

  if (isPhotoEvidenceRequired(taskInstance) && photoCount < 1) {
    failures.push('photo');
  }

  if (isCommentRequiredForGrade(taskInstance, grade) && !String(note || '').trim()) {
    failures.push('comment');
  }

  return failures;
}

export function normaliseSkipReason(reason) {
  return String(reason || '').trim();
}

export function isValidSkipReason(reason) {
  return normaliseSkipReason(reason).length >= 5;
}
