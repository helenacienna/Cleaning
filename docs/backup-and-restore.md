# Cienna Cleaning Backup + Restore

## Primary backup command

From `cienna-cleaning-platform/`:

```bash
npm run backup:live
```

What it captures:
- local code snapshot tarball
- local git state (`git-head`, `git-status`, patch, untracked list)
- local `data/deploy-status.json` if present
- Railway deployment history snapshot
- live DB JSON export
- restore notes and manifest

## Backup locations

- local runs: `backups/cienna-cleaning-daily/<timestamp>/`
- local latest pointer: `backups/cienna-cleaning-daily/latest.json`
- off-machine mirror: `~/Library/CloudStorage/GoogleDrive-helena.cienna@gmail.com/My Drive/OpenClaw System Backups/cienna-cleaning-daily/<timestamp>/`
- off-machine latest pointer: `~/Library/CloudStorage/GoogleDrive-helena.cienna@gmail.com/My Drive/OpenClaw System Backups/cienna-cleaning-daily/latest.json`

## Current approved live rollback anchor

- live URL: `https://web-production-3a1422.up.railway.app/`
- Railway project: `cienna-cleaning-platform`
- service: `web`
- deployment id: `5462d84a-9869-4e4a-a088-53e584ca6b8a`
- image digest: `sha256:4ee02bb886624c3ec1acafcd0c48198275f0a2809afeeea19d87993057d7bc2a`

## Fastest safe rollback order

1. Roll live back in Railway to deployment `5462d84a-9869-4e4a-a088-53e584ca6b8a`.
2. If local code also needs reverting, extract `repo-snapshot.tgz` from the chosen backup run into a clean folder.
3. Use `db-export.json` for data recovery/diffing if the app state also drifted.
4. Verify the app-visible deploy marker and the key cleaner/facility/admin screens.

## Important limitation

`db-export.json` is a structured JSON export, not a native PostgreSQL dump.

That means this backup is now strong and operationally useful, but not yet a full database engine snapshot. If deeper rollback guarantees are needed later, add a native pg dump path or Railway-native DB backup workflow.
