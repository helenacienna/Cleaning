# ShiftRun → Google Calendar mirror

This is the first minimal slice of the Cleaning app Google Calendar mirror.

## Scope

- **Direction:** app → Google Calendar only
- **Entity:** `ShiftRun` only
- **Source of truth:** Prisma `shift_runs`
- **Default mode:** dry run
- **Idempotency anchor:** local sync ledger at `data/google-calendar-sync/shift-runs-state.json`

## What it does

The sync job:

1. loads `ShiftRun` rows from Prisma inside a configured date window
2. maps each row into a Google Calendar event payload
3. compares the desired payload fingerprint against the local ledger
4. plans `create`, `update`, and `delete` actions
5. only writes to Google when run with `--commit`
6. only updates the ledger after a successful commit

## Why the local ledger matters

There was no existing Google Calendar integration or remote adoption logic in this repo.

For this first slice, the ledger is the idempotency mechanism:

- `sourceId` = `ShiftRun.id`
- `googleEventId` = the remote Google event created for that shift
- `fingerprint` = SHA-256 of the desired event payload
- `sourceUpdatedAt` = the source `ShiftRun.updatedAt` captured at sync time

That gives us safe repeated dry runs and predictable follow-up commits.

## Important first-live-sync note

Because there is **no remote discovery/adoption flow yet**, the first live sync should use one of these approaches:

1. target a **fresh dedicated Google calendar** for shift runs, or
2. add a one-time adoption/import pass before syncing into an already-used calendar

Without that, a state-less first commit into a reused calendar could create duplicates.

To make that harder to do by accident, commit mode now refuses a first write when the local ledger is empty unless you explicitly pass `--allow-bootstrap` (or set `SHIFT_RUN_SYNC_ALLOW_BOOTSTRAP=true`).

## Config

Environment variables:

- `GOOGLE_CALENDAR_SHIFT_RUNS_ID`
- `SHIFT_RUN_SYNC_DRY_RUN`
- `SHIFT_RUN_SYNC_DAYS_PAST`
- `SHIFT_RUN_SYNC_DAYS_FUTURE`
- `SHIFT_RUN_SYNC_TIME_ZONE`
- `SHIFT_RUN_SYNC_STATE_PATH`
- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`
- or `GOOGLE_SERVICE_ACCOUNT_JSON`
- `SHIFT_RUN_SYNC_ALLOW_BOOTSTRAP`

### Practical local config path

The wider workspace already has a `googleCalendar.mirrorCalendarId` value in the private workspace credentials file. If you intentionally want to test against that same calendar, copy that value into `GOOGLE_CALENDAR_SHIFT_RUNS_ID` in your local `.env` or deployment secrets.

That said, a **dedicated new calendar is still the safer recommendation** for the first live ShiftRun sync, because the existing shared mirror calendar is likely already serving another mirror flow and there is no adoption logic here yet.

## Commands

Dry run:

```bash
npm run ops:calendar:shiftruns:dry-run -- --json
```

Commit:

```bash
npm run ops:calendar:shiftruns:commit -- --json --allow-bootstrap
```

If the ledger already contains synced entries, `--allow-bootstrap` is no longer needed.

Optional window override:

```bash
node scripts/sync-shiftruns-google-calendar.mjs --dry-run --from=2026-06-01 --to=2026-06-30 --json
```

Help:

```bash
node scripts/sync-shiftruns-google-calendar.mjs --help
```

## Event mapping

Each mirrored event includes:

- summary: `Assigned Staff — Shift Label`
- description with shift code, shift run id, organiser state, route, run date, and source updated time
- `extendedProperties.private` markers:
  - `openclawSourceType=shiftRun`
  - `openclawSourceId=<ShiftRun.id>`
  - `openclawShiftCode=<shiftCode>`

If `shiftStartAt` and `shiftEndAt` exist, the event is timed.

If times are missing, the event falls back to an all-day event on `runDate`.

## What is not included yet

- remote event adoption/discovery for pre-existing mirrored events
- conflict resolution against manual calendar edits
- recurring Google events
- background scheduling / cron wiring
- calendar sync for anything other than `ShiftRun`
