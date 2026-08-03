import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import { optimiseTaskPhotoForStorage } from '../lib/task-photo-optimizer.js';

function resetEnv() {
  delete process.env.CIENNA_COST_CONTROL_MODE;
}

test('photo optimiser leaves uploads unchanged outside testing cost-control mode', async () => {
  resetEnv();
  const buffer = Buffer.from('not-an-image');
  const result = await optimiseTaskPhotoForStorage({ buffer, mimeType: 'image/jpeg' });

  assert.equal(result.optimised, false);
  assert.equal(result.mimeType, 'image/jpeg');
  assert.deepEqual(result.buffer, buffer);
});

test('photo optimiser compresses image uploads in testing cost-control mode', async () => {
  process.env.CIENNA_COST_CONTROL_MODE = 'testing';
  try {
    const source = await sharp({
      create: {
        width: 1600,
        height: 1000,
        channels: 3,
        background: '#d4af37',
      },
    }).jpeg({ quality: 95 }).toBuffer();

    const result = await optimiseTaskPhotoForStorage({ buffer: source, mimeType: 'image/jpeg' });
    const metadata = await sharp(result.buffer).metadata();

    assert.equal(result.optimised, true);
    assert.equal(result.mimeType, 'image/webp');
    assert.equal(metadata.width, 900);
    assert.ok(result.buffer.length < source.length);
  } finally {
    resetEnv();
  }
});
