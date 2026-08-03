#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { getPrisma } from '../lib/prisma.js';
import { parseStoredPhotoUrl, readStoredPhoto, saveTaskPhotoFile } from '../lib/task-photo-storage.js';

function parseArgs(argv) {
  const args = { commit: false, limit: null };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--commit') args.commit = true;
    if (value === '--limit' && argv[index + 1]) {
      args.limit = Number.parseInt(argv[index + 1], 10);
      index += 1;
    }
  }
  return args;
}

function requireFilesystemStorage() {
  if (process.env.TASK_PHOTO_STORAGE !== 'filesystem') {
    throw new Error('Set TASK_PHOTO_STORAGE=filesystem before running this migration.');
  }
  if (!process.env.TASK_PHOTO_DIR) {
    throw new Error('Set TASK_PHOTO_DIR to a durable mounted directory before running this migration.');
  }
}

const args = parseArgs(process.argv);
requireFilesystemStorage();
await mkdir(path.resolve(process.env.TASK_PHOTO_DIR), { recursive: true });

const prisma = await getPrisma();
if (!prisma) {
  console.error('No Prisma connection available. Run with DATABASE_URL/Railway environment.');
  process.exit(1);
}

try {
  const rows = await prisma.taskPhoto.findMany({
    where: { photoUrl: { startsWith: 'data:' } },
    select: { id: true, photoUrl: true, photoType: true, uploadedAt: true },
    orderBy: { uploadedAt: 'asc' },
    ...(Number.isFinite(args.limit) && args.limit > 0 ? { take: args.limit } : {}),
  });

  const result = {
    ok: true,
    mode: args.commit ? 'commit' : 'dry-run',
    targetDir: path.resolve(process.env.TASK_PHOTO_DIR),
    scanned: rows.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
    bytesRemovedFromPostgresApprox: 0,
    failures: [],
  };

  for (const row of rows) {
    const parsed = parseStoredPhotoUrl(row.photoUrl);
    if (!parsed?.buffer?.length) {
      result.skipped += 1;
      continue;
    }

    try {
      const nextUrl = await saveTaskPhotoFile({
        photoId: row.id,
        buffer: parsed.buffer,
        mimeType: parsed.contentType,
      });
      const stored = await readStoredPhoto(nextUrl);
      if (!stored || stored.buffer.length !== parsed.buffer.length) {
        throw new Error('Saved file verification failed');
      }

      if (args.commit) {
        await prisma.taskPhoto.updateMany({
          where: { id: row.id, photoUrl: row.photoUrl },
          data: { photoUrl: nextUrl },
        });
      }

      result.migrated += 1;
      result.bytesRemovedFromPostgresApprox += row.photoUrl.length;
    } catch (error) {
      result.failed += 1;
      result.failures.push({ id: row.id, message: error?.message || String(error) });
      if (result.failures.length >= 10) break;
    }
  }

  if (result.failed > 0) result.ok = false;
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
