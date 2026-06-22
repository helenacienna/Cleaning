#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORKSPACE = path.resolve(ROOT, '..');

const DEFAULTS = {
  backupRoot: path.join(WORKSPACE, 'backups', 'cienna-cleaning-daily'),
  cloudRoot: path.join(os.homedir(), 'Library', 'CloudStorage', 'GoogleDrive-helena.cienna@gmail.com', 'My Drive', 'OpenClaw System Backups', 'cienna-cleaning-daily'),
  retainCount: Math.max(3, Number(process.env.CIENNA_CLEANING_BACKUP_RETAIN_COUNT || 14)),
  liveUrl: process.env.CIENNA_CLEANING_LIVE_URL || 'https://web-production-3a1422.up.railway.app/',
  railwayProjectName: process.env.CIENNA_CLEANING_RAILWAY_PROJECT_NAME || 'cienna-cleaning-platform',
  railwayProjectId: process.env.CIENNA_CLEANING_RAILWAY_PROJECT_ID || 'a3af551d-0010-43d2-bf2e-bc4296fbcb89',
  railwayEnvironmentId: process.env.CIENNA_CLEANING_RAILWAY_ENV_ID || '33f3c370-636d-4279-bad3-69deca9aa03a',
  railwayServiceName: process.env.CIENNA_CLEANING_RAILWAY_SERVICE || 'web',
  approvedDeploymentId: process.env.CIENNA_CLEANING_APPROVED_DEPLOYMENT_ID || '5462d84a-9869-4e4a-a088-53e584ca6b8a',
  approvedImageDigest: process.env.CIENNA_CLEANING_APPROVED_IMAGE_DIGEST || 'sha256:4ee02bb886624c3ec1acafcd0c48198275f0a2809afeeea19d87993057d7bc2a',
};

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function safeExec(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    return null;
  }
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) {
    return false;
  }
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function pruneOldRunDirs(rootDir, keepNames = []) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const keep = new Set(keepNames);
  const names = fs.readdirSync(rootDir)
    .filter((name) => !keep.has(name))
    .filter((name) => /^\d{8}-\d{6}$/.test(name))
    .sort()
    .reverse();

  const removed = [];
  for (const stale of names.slice(DEFAULTS.retainCount)) {
    fs.rmSync(path.join(rootDir, stale), { recursive: true, force: true });
    removed.push(stale);
  }
  return removed;
}

function writeLatestPointer(rootDir, payload) {
  writeJson(path.join(rootDir, 'latest.json'), payload);
}

function maybeCopyToCloud(runDir, stamp, latestPayload, manifest) {
  try {
    ensureDir(DEFAULTS.cloudRoot);
    const cloudRunDir = path.join(DEFAULTS.cloudRoot, stamp);
    fs.cpSync(runDir, cloudRunDir, { recursive: true, force: true });
    writeLatestPointer(DEFAULTS.cloudRoot, {
      ...latestPayload,
      manifest: path.join(cloudRunDir, 'manifest.json'),
    });
    const removedRuns = pruneOldRunDirs(DEFAULTS.cloudRoot, ['logs']);
    return { enabled: true, ok: true, runDir: cloudRunDir, removedRuns };
  } catch (error) {
    manifest.warnings.push(`cloud-copy-failed: ${error.message}`);
    return { enabled: true, ok: false, error: error.message, removedRuns: [] };
  }
}

function archiveRepo(targetFile) {
  execFileSync('tar', [
    '--exclude=node_modules',
    '--exclude=.next',
    '--exclude=.git',
    '--exclude=coverage',
    '-czf',
    targetFile,
    '.',
  ], { cwd: ROOT, stdio: 'inherit' });
}

function runRailwayDeploymentSnapshot(targetFile) {
  const output = execFileSync('railway', [
    'deployment',
    'list',
    '--json',
    '-e', DEFAULTS.railwayEnvironmentId,
    '-s', DEFAULTS.railwayServiceName,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  fs.writeFileSync(targetFile, output);
}

function exportDbSnapshot(targetFile) {
  const hasLocalDb = Boolean(process.env.DATABASE_URL);
  const args = ['node', 'scripts/export-db-backup.mjs', '--out', targetFile];
  if (hasLocalDb) {
    execFileSync(args[0], args.slice(1), { cwd: ROOT, stdio: 'inherit' });
    return 'local';
  }

  execFileSync('railway', [
    'run',
    '-p', DEFAULTS.railwayProjectId,
    '-e', DEFAULTS.railwayEnvironmentId,
    '-s', DEFAULTS.railwayServiceName,
    '--no-local',
    ...args,
  ], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  return 'railway-run';
}

function buildRestoreReadme({ stamp, runDir, manifest }) {
  return `# Cienna Cleaning Backup Restore Notes

Backup captured: ${manifest.createdAt}
Run dir: ${runDir}

## What this backup contains
- \`manifest.json\` — backup manifest and metadata
- \`backup-metadata.json\` — live/deploy/git anchor summary
- \`railway-deployments.json\` — Railway deployment history snapshot
- \`deploy-status.json\` — app-visible deploy marker (if present locally)
- \`git-status.txt\` — local git status at capture time
- \`git-head.txt\` — current git HEAD at capture time
- \`working-tree.patch\` — local working tree diff at capture time
- \`untracked-files.txt\` — untracked file list at capture time
- \`repo-snapshot.tgz\` — restorable code snapshot of \`cienna-cleaning-platform/\`
- \`db-export.json\` — live database JSON export

## Approved live rollback anchor
- Live URL: \`${DEFAULTS.liveUrl}\`
- Railway project: \`${DEFAULTS.railwayProjectName}\`
- Service: \`${DEFAULTS.railwayServiceName}\`
- Deployment ID: \`${DEFAULTS.approvedDeploymentId}\`
- Image digest: \`${DEFAULTS.approvedImageDigest}\`

## Fastest safe rollback order
1. If the live deploy is bad, use Railway to redeploy/rollback to deployment \`${DEFAULTS.approvedDeploymentId}\`.
2. If code also needs to be restored locally, extract \`repo-snapshot.tgz\` into a clean folder.
3. Restore/inspect \`db-export.json\` for live-data recovery or comparison work.
4. Verify the restored app still presents the expected deploy marker and key screens.

## Important note
- \`db-export.json\` is a JSON recovery export, not a native PostgreSQL dump.
- That makes it strong for recovery/diffing, but not a full low-level database snapshot.
- For a deeper future hardening pass, add a native Postgres dump path when infrastructure allows it.
`;
}

async function main() {
  const stamp = nowStamp();
  const runDir = path.join(DEFAULTS.backupRoot, stamp);
  ensureDir(runDir);

  const manifest = {
    schema: 'cienna-cleaning.backup.v1',
    createdAt: new Date().toISOString(),
    hostname: os.hostname(),
    runDir,
    liveUrl: DEFAULTS.liveUrl,
    railwayProjectName: DEFAULTS.railwayProjectName,
    railwayProjectId: DEFAULTS.railwayProjectId,
    railwayEnvironmentId: DEFAULTS.railwayEnvironmentId,
    railwayServiceName: DEFAULTS.railwayServiceName,
    approvedDeploymentId: DEFAULTS.approvedDeploymentId,
    approvedImageDigest: DEFAULTS.approvedImageDigest,
    files: {},
    warnings: [],
  };

  const gitHead = safeExec('git rev-parse HEAD');
  const gitHeadShort = safeExec('git rev-parse --short HEAD');
  const gitHeadSubject = safeExec('git show -s --format=%s HEAD');
  const gitStatus = safeExec('git status --short') ?? '';
  const untrackedFiles = safeExec('git ls-files --others --exclude-standard') ?? '';
  const workingTreePatch = safeExec('git diff --binary') ?? '';

  fs.writeFileSync(path.join(runDir, 'git-head.txt'), `${gitHead ?? 'unknown'}\n${gitHeadShort ?? ''} ${gitHeadSubject ?? ''}\n`);
  fs.writeFileSync(path.join(runDir, 'git-status.txt'), `${gitStatus}\n`);
  fs.writeFileSync(path.join(runDir, 'untracked-files.txt'), `${untrackedFiles}\n`);
  fs.writeFileSync(path.join(runDir, 'working-tree.patch'), workingTreePatch);

  const metadata = {
    capturedAt: manifest.createdAt,
    repoPath: ROOT,
    gitHead,
    gitHeadShort,
    gitHeadSubject,
    liveUrl: DEFAULTS.liveUrl,
    railwayProjectName: DEFAULTS.railwayProjectName,
    railwayProjectId: DEFAULTS.railwayProjectId,
    railwayEnvironmentId: DEFAULTS.railwayEnvironmentId,
    railwayServiceName: DEFAULTS.railwayServiceName,
    approvedDeploymentId: DEFAULTS.approvedDeploymentId,
    approvedImageDigest: DEFAULTS.approvedImageDigest,
  };
  writeJson(path.join(runDir, 'backup-metadata.json'), metadata);

  const deployStatusCopied = copyIfExists(
    path.join(ROOT, 'data', 'deploy-status.json'),
    path.join(runDir, 'deploy-status.json'),
  );
  if (!deployStatusCopied) {
    manifest.warnings.push('deploy-status.json missing locally');
  }

  try {
    runRailwayDeploymentSnapshot(path.join(runDir, 'railway-deployments.json'));
  } catch (error) {
    manifest.warnings.push(`railway-deployment-snapshot-failed: ${error.message}`);
  }

  archiveRepo(path.join(runDir, 'repo-snapshot.tgz'));

  let dbExportMode = null;
  try {
    dbExportMode = exportDbSnapshot(path.join(runDir, 'db-export.json'));
  } catch (error) {
    manifest.warnings.push(`db-export-failed: ${error.message}`);
  }

  const filesToHash = [
    'backup-metadata.json',
    'deploy-status.json',
    'railway-deployments.json',
    'repo-snapshot.tgz',
    'git-head.txt',
    'git-status.txt',
    'untracked-files.txt',
    'working-tree.patch',
    'db-export.json',
  ];

  for (const name of filesToHash) {
    const filePath = path.join(runDir, name);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    manifest.files[name] = {
      bytes: fs.statSync(filePath).size,
      sha256: sha256(filePath),
    };
  }

  manifest.dbExportMode = dbExportMode;

  const restoreReadme = buildRestoreReadme({ stamp, runDir, manifest });
  fs.writeFileSync(path.join(runDir, 'RESTORE.md'), restoreReadme);
  manifest.files['RESTORE.md'] = {
    bytes: fs.statSync(path.join(runDir, 'RESTORE.md')).size,
    sha256: sha256(path.join(runDir, 'RESTORE.md')),
  };

  const removedRuns = pruneOldRunDirs(DEFAULTS.backupRoot, ['logs']);
  manifest.removedRuns = removedRuns;

  writeJson(path.join(runDir, 'manifest.json'), manifest);

  const latestPayload = {
    latestRun: stamp,
    createdAt: manifest.createdAt,
    manifest: path.join(runDir, 'manifest.json'),
    liveUrl: DEFAULTS.liveUrl,
  };
  writeLatestPointer(DEFAULTS.backupRoot, latestPayload);

  const cloud = maybeCopyToCloud(runDir, stamp, latestPayload, manifest);
  if (manifest.warnings.length) {
    writeJson(path.join(runDir, 'manifest.json'), manifest);
  }

  console.log(JSON.stringify({ ok: true, runDir, latestRun: stamp, dbExportMode, removedRuns, cloud, warnings: manifest.warnings }, null, 2));
}

await main();
