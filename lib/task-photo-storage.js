import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'storage', 'task-photos');

function getSafeFileName(value = '') {
  return String(value || '').split(/[\\/]/).pop();
}

function getTaskPhotoDirectory() {
  if (!process.env.TASK_PHOTO_DIR) {
    return DEFAULT_DIR;
  }

  return path.resolve(/* turbopackIgnore: true */ process.env.TASK_PHOTO_DIR);
}

function getTaskPhotoPath(fileName) {
  const safeFileName = getSafeFileName(fileName);
  if (!safeFileName) {
    return null;
  }

  return path.join(getTaskPhotoDirectory(), safeFileName);
}

function getExtensionFromMimeType(mimeType = '') {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function shouldUseFileStorage() {
  return process.env.TASK_PHOTO_STORAGE === 'filesystem';
}

function createDataPhotoUrl({ buffer, mimeType }) {
  const contentType = mimeType || 'application/octet-stream';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

export async function saveTaskPhotoFile({ photoId, buffer, mimeType }) {
  if (!shouldUseFileStorage()) {
    return createDataPhotoUrl({ buffer, mimeType });
  }

  const extension = getExtensionFromMimeType(mimeType);
  const fileName = `${photoId}.${extension}`;
  const filePath = getTaskPhotoPath(fileName);

  if (!filePath) {
    throw new Error('Invalid task photo file name');
  }

  await mkdir(getTaskPhotoDirectory(), { recursive: true });
  await writeFile(filePath, buffer);

  return `local://${fileName}?contentType=${encodeURIComponent(mimeType || 'application/octet-stream')}`;
}

export function parseStoredPhotoUrl(photoUrl = '') {
  if (photoUrl.startsWith('data:')) {
    const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return {
      kind: 'data',
      contentType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }

  if (photoUrl.startsWith('local://')) {
    const [base, query = ''] = photoUrl.replace('local://', '').split('?');
    const params = new URLSearchParams(query);
    const fileName = getSafeFileName(base);
    if (!fileName) return null;

    return {
      kind: 'local',
      fileName,
      contentType: params.get('contentType') || 'application/octet-stream',
    };
  }

  return null;
}

export async function readStoredPhoto(photoUrl) {
  const parsed = parseStoredPhotoUrl(photoUrl);
  if (!parsed) {
    return null;
  }

  if (parsed.kind === 'data') {
    return parsed;
  }

  const filePath = getTaskPhotoPath(parsed.fileName);
  if (!filePath) {
    return null;
  }

  const buffer = await readFile(filePath);
  return {
    kind: 'local',
    contentType: parsed.contentType,
    buffer,
  };
}

export async function deleteStoredPhoto(photoUrl) {
  const parsed = parseStoredPhotoUrl(photoUrl);
  if (!parsed || parsed.kind !== 'local') {
    return false;
  }

  const filePath = getTaskPhotoPath(parsed.fileName);
  if (!filePath) {
    return false;
  }

  await unlink(filePath).catch((error) => {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  });

  return true;
}
