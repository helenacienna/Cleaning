import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputPath = path.join(root, 'data', 'deploy-status.json');

function safeExec(command) {
  try {
    return execSync(command, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const existing = (() => {
  try {
    return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch {
    return null;
  }
})();

const gitSha = safeExec('git rev-parse --short HEAD');
const gitSubject = safeExec('git log -1 --pretty=%s');
const gitDirty = safeExec('git status --porcelain');

const payload = {
  deployedAt: new Date().toISOString(),
  version: gitSha ? `${gitSha}${gitDirty ? '+local' : ''}` : (existing?.version ?? 'manual'),
  summary: process.env.DEPLOY_SUMMARY
    ?? existing?.summary
    ?? gitSubject
    ?? 'Manual deploy',
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${outputPath}`);
