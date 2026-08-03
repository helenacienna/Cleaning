import sharp from 'sharp';
import { uploadPhotoTarget } from './cost-control.js';

export async function optimiseTaskPhotoForStorage({ buffer, mimeType }) {
  const target = uploadPhotoTarget();
  const contentType = mimeType || 'application/octet-stream';

  if (!target.enabled || !String(contentType).startsWith('image/')) {
    return { buffer, mimeType: contentType, optimised: false };
  }

  try {
    const optimisedBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: target.maxWidth, withoutEnlargement: true })
      .webp({ quality: target.quality, effort: 4 })
      .toBuffer();

    return {
      buffer: optimisedBuffer,
      mimeType: 'image/webp',
      optimised: true,
      originalBytes: buffer.length,
      optimisedBytes: optimisedBuffer.length,
    };
  } catch (error) {
    console.warn('task-photo-optimise-failed', JSON.stringify({ message: error?.message }));
    return { buffer, mimeType: contentType, optimised: false };
  }
}
