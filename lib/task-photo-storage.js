import { mkdir, readFile, writeFile } from 'node:fs/promises';

const DEFAULT_DIR = 'storage/task-photos';

function trimTrailingSlashes(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function getSafeFileName(value = '') {
  return String(value || '').split(/[\\/]/).pop();
}

function getTaskPhotoDirectory() {
  return trimTrailingSlashes(process.env.TASK_PHOTO_DIR || DEFAULT_DIR);
}

function getTaskPhotoPath(fileName) {
  const safeFileName = getSafeFileName(fileName);
  if (!safeFileName) {
    return null;
  }

  return `${getTaskPhotoDirectory()}/${safeFileName}`;
}

function getExtensionFromMimeType(mimeType = '') {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

export async function saveTaskPhotoFile({ photoId, buffer, mimeType }) {
  const extension = getExtensionFromMimeType(mimeType);
  const fileName = `${photoId}.${extension}`;
  const directory = getTaskPhotoDirectory();
  const filePath = getTaskPhotoPath(fileName);

  if (!filePath) {
    throw new Error('Invalid task photo file name');
  }

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, buffer);

  return `local://${fileName}?contentType=${encodeURIComponent(mimeType)}`;
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
