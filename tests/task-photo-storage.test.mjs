import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseStoredPhotoUrl, readStoredPhoto, saveTaskPhotoFile } from '../lib/task-photo-storage.js';

function resetStorageEnv() {
  delete process.env.TASK_PHOTO_STORAGE;
  delete process.env.TASK_PHOTO_DIR;
}

test('task photos default to database-backed data URLs for reliable hosted reads', async () => {
  resetStorageEnv();
  const buffer = Buffer.from('photo-bytes');

  const photoUrl = await saveTaskPhotoFile({ photoId: 'photo-1', buffer, mimeType: 'image/png' });
  const parsed = parseStoredPhotoUrl(photoUrl);
  const stored = await readStoredPhoto(photoUrl);

  assert.equal(parsed.kind, 'data');
  assert.equal(stored.contentType, 'image/png');
  assert.deepEqual(stored.buffer, buffer);
});

test('task photos can still use explicit filesystem storage', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'task-photo-storage-'));
  process.env.TASK_PHOTO_STORAGE = 'filesystem';
  process.env.TASK_PHOTO_DIR = directory;

  try {
    const buffer = Buffer.from('disk-photo-bytes');
    const photoUrl = await saveTaskPhotoFile({ photoId: 'photo-2', buffer, mimeType: 'image/jpeg' });
    const parsed = parseStoredPhotoUrl(photoUrl);
    const stored = await readStoredPhoto(photoUrl);
    const savedBuffer = await readFile(path.join(directory, 'photo-2.jpg'));

    assert.equal(parsed.kind, 'local');
    assert.equal(stored.contentType, 'image/jpeg');
    assert.deepEqual(stored.buffer, buffer);
    assert.deepEqual(savedBuffer, buffer);
  } finally {
    resetStorageEnv();
    await rm(directory, { recursive: true, force: true });
  }
});
