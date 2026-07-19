export function splitCleanerEvidencePhotos(photos = []) {
  const beforePhotos = photos.filter((photo) => photo?.photoType === 'exception');
  const afterPhotos = photos.filter((photo) => photo?.photoType === 'completion');
  const generalPhotos = photos.filter((photo) => photo?.photoType !== 'exception' && photo?.photoType !== 'completion');

  return {
    beforePhotos,
    afterPhotos,
    generalPhotos,
  };
}

export function shouldRenderSeparatedBeforeAfterEvidence({ photos = [], initialGrade = null, incidentGrade = null, correctedGrade = null, selectedGrade = null, score = null } = {}) {
  const { beforePhotos, afterPhotos } = splitCleanerEvidencePhotos(photos);
  const gradeForIncidentCheck = Number(incidentGrade ?? initialGrade ?? selectedGrade ?? score);
  const hasIncidentGrade = gradeForIncidentCheck > 0 && gradeForIncidentCheck <= 2;

  // Hard rule: once any before/incident evidence exists, or the task is known to be
  // an incident/correction flow, do not render a combined photo gallery.
  return Boolean(beforePhotos.length || correctedGrade || hasIncidentGrade || (beforePhotos.length && afterPhotos.length));
}
