import test from 'node:test';
import assert from 'node:assert/strict';

import { parseStoredPhotoUrl } from '../lib/task-photo-storage.js';

test('parseStoredPhotoUrl parses local photo URLs', () => {
  assert.deepEqual(parseStoredPhotoUrl('local://photo-1.jpg?contentType=image%2Fjpeg'), {
    kind: 'local',
    fileName: 'photo-1.jpg',
    contentType: 'image/jpeg',
  });
});

test('parseStoredPhotoUrl strips path segments from local photo names', () => {
  assert.deepEqual(parseStoredPhotoUrl('local://../unsafe/photo-1.png?contentType=image%2Fpng'), {
    kind: 'local',
    fileName: 'photo-1.png',
    contentType: 'image/png',
  });
});

test('parseStoredPhotoUrl parses data URLs', () => {
  const parsed = parseStoredPhotoUrl('data:text/plain;base64,aGVsbG8=');
  assert.equal(parsed.kind, 'data');
  assert.equal(parsed.contentType, 'text/plain');
  assert.equal(parsed.buffer.toString('utf8'), 'hello');
});
