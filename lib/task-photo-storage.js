import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'storage', 'task-photos');

function getTaskPhotoDirectory() {
  if (!process.env.TASK_PHOTO_DIR) {
    return DEFAULT_DIR;
  }

  return path.resolve(/* turbopackIgnore: true */ process.env.TASK_PHOTO_DIR);
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

  const filePath = path.join(getTaskPhotoDirectory(), parsed.fileName);
  const buffer = await readFile(filePath);
  return {
    kind: 'local',
    contentType: parsed.contentType,
    buffer,
  };
}
