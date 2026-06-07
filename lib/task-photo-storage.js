import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = process.env.TASK_PHOTO_DIR
  ? path.resolve(process.env.TASK_PHOTO_DIR)
  : path.join(MODULE_DIR, '..', 'storage', 'task-photos');

function getExtensionFromMimeType(mimeType = '') {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

export async function saveTaskPhotoFile({ photoId, buffer, mimeType }) {
  const extension = getExtensionFromMimeType(mimeType);
  const fileName = `${photoId}.${extension}`;
  const directory = DEFAULT_DIR;
  const filePath = path.join(directory, fileName);

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
    return {
      kind: 'local',
      fileName: base,
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

  const filePath = path.join(DEFAULT_DIR, parsed.fileName);
  const buffer = await readFile(filePath);
  return {
    kind: 'local',
    contentType: parsed.contentType,
    buffer,
  };
}
