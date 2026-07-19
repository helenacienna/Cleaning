import test from 'node:test';
import assert from 'node:assert/strict';

import { splitCleanerEvidencePhotos, shouldRenderSeparatedBeforeAfterEvidence } from '../lib/cleaner-photo-sections.js';

test('incident before and after photos split into separate evidence sections', () => {
  const photos = [
    { id: 'before-1', photoType: 'exception' },
    { id: 'after-1', photoType: 'completion' },
  ];

  const sections = splitCleanerEvidencePhotos(photos);

  assert.deepEqual(sections.beforePhotos.map((photo) => photo.id), ['before-1']);
  assert.deepEqual(sections.afterPhotos.map((photo) => photo.id), ['after-1']);
  assert.equal(shouldRenderSeparatedBeforeAfterEvidence({ photos }), true);
});

test('saved incident grade keeps before and after evidence separated after refresh', () => {
  const photos = [
    { id: 'after-1', photoType: 'completion' },
  ];

  assert.equal(shouldRenderSeparatedBeforeAfterEvidence({ photos, initialGrade: 1, correctedGrade: 4, score: 4 }), true);
});

test('ordinary completion-only photo can stay in the normal gallery', () => {
  const photos = [
    { id: 'general-1', photoType: 'completion' },
  ];

  assert.equal(shouldRenderSeparatedBeforeAfterEvidence({ photos, score: 5 }), false);
});
