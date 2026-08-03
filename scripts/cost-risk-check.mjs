#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getPrisma } from '../lib/prisma.js';

function formatBytes(bytes = 0) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

async function directorySize(root) {
  if (!root || !fs.existsSync(root)) return { exists: false, bytes: 0, files: 0 };
  let bytes = 0;
  let files = 0;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.promises.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(fullPath).catch(() => null);
        if (stat) {
          bytes += stat.size;
          files += 1;
        }
      }
    }
  }
  return { exists: true, bytes, files };
}

function riskLevel(checks) {
  if (checks.photoDataUrlCount > 0) return 'high';
  if (checks.dbPhotoUrlBytes > 1_000_000) return 'high';
  if (!checks.testingCostControl) return 'medium';
  if (checks.volumePhotoBytes > 5_000_000_000) return 'medium';
  return 'low';
}

const prisma = await getPrisma();
if (!prisma) {
  console.error('No Prisma connection available. Run with DATABASE_URL/Railway environment.');
  process.exit(1);
}

try {
  const [photoSummary] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(LENGTH(photo_url)),0)::bigint AS total_chars,
      COALESCE(AVG(LENGTH(photo_url)),0)::float AS avg_chars,
      COALESCE(MAX(LENGTH(photo_url)),0)::int AS max_chars,
      SUM(CASE WHEN photo_url LIKE 'data:%' THEN 1 ELSE 0 END)::int AS data_url_count,
      SUM(CASE WHEN photo_url LIKE 'local:%' THEN 1 ELSE 0 END)::int AS local_url_count
    FROM task_photos
  `);

  const photoDir = process.env.TASK_PHOTO_DIR || path.join(process.cwd(), 'storage', 'task-photos');
  const volume = await directorySize(photoDir);
  const checks = {
    generatedAt: new Date().toISOString(),
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || 'unknown',
    testingCostControl: ['1', 'true', 'yes', 'testing', 'test'].includes(String(process.env.CIENNA_COST_CONTROL_MODE || '').toLowerCase()),
    taskPhotoStorage: process.env.TASK_PHOTO_STORAGE || 'database-data-url-default',
    taskPhotoDir: photoDir,
    photoRecordCount: Number(photoSummary.count || 0),
    dbPhotoUrlBytes: Number(photoSummary.total_chars || 0),
    dbPhotoUrlHuman: formatBytes(Number(photoSummary.total_chars || 0)),
    dbPhotoUrlAverageBytes: Math.round(Number(photoSummary.avg_chars || 0)),
    dbPhotoUrlMaxBytes: Number(photoSummary.max_chars || 0),
    photoDataUrlCount: Number(photoSummary.data_url_count || 0),
    photoLocalUrlCount: Number(photoSummary.local_url_count || 0),
    volumeExists: volume.exists,
    volumePhotoFiles: volume.files,
    volumePhotoBytes: volume.bytes,
    volumePhotoHuman: formatBytes(volume.bytes),
  };

  const recommendations = [];
  if (checks.photoDataUrlCount > 0) recommendations.push('Photo blobs are present in Postgres; migrate them to file/object storage.');
  if (checks.dbPhotoUrlBytes > 1_000_000) recommendations.push('Postgres photo URL payload is large; check for full image strings in task_photos.photo_url.');
  if (!checks.testingCostControl) recommendations.push('Testing cost-control mode is off; enable it during active testing if photo quality can stay reduced.');
  if (checks.taskPhotoStorage !== 'filesystem') recommendations.push('New uploads are not configured for filesystem/object storage; they may return to database-backed data URLs.');
  if (!checks.volumeExists) recommendations.push('Photo storage directory does not exist; check mounted volume and TASK_PHOTO_DIR.');
  if (checks.volumePhotoBytes > 5_000_000_000) recommendations.push('Photo volume is above 5GB; review retention/archive policy.');
  if (!recommendations.length) recommendations.push('No immediate cost-risk issues detected from app-side checks.');

  const output = {
    ok: true,
    risk: riskLevel(checks),
    checks,
    recommendations,
  };

  console.log(JSON.stringify(output, null, 2));
} finally {
  await prisma.$disconnect();
}
