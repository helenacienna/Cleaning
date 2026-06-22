import { getPrisma } from '../lib/prisma.js';
import { createGoogleCalendarClient } from '../lib/google-calendar-service-account.mjs';
import {
  applyShiftRunMirrorPlan,
  buildDesiredShiftRunMirrorEntries,
  createShiftRunSyncPreflight,
  fetchShiftRunsForMirror,
  planShiftRunMirror,
  readShiftRunSyncState,
  resolveShiftRunSyncConfig,
  writeShiftRunSyncState,
} from '../lib/shift-run-google-calendar-sync.mjs';

function parseArgs(argv) {
  const args = {};

  for (const token of argv) {
    if (token === '--commit') {
      args.commit = true;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--help') {
      args.help = true;
      continue;
    }
    if (token === '--allow-bootstrap') {
      args.allowBootstrap = true;
      continue;
    }

    const match = token.match(/^--([^=]+)=(.*)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`Usage: node scripts/sync-shiftruns-google-calendar.mjs [--dry-run|--commit] [--json]\n\nOptions:\n  --dry-run              Plan only (default)\n  --commit               Write to Google Calendar\n  --allow-bootstrap      Required for the first live commit when the local ledger is empty\n  --from=YYYY-MM-DD      Override window start\n  --to=YYYY-MM-DD        Override window end\n  --daysPast=N           Relative window start when --from is omitted\n  --daysFuture=N         Relative window end when --to is omitted\n  --calendarId=ID        Override GOOGLE_CALENDAR_SHIFT_RUNS_ID\n  --statePath=PATH       Override SHIFT_RUN_SYNC_STATE_PATH\n  --timeZone=TZ          Override SHIFT_RUN_SYNC_TIME_ZONE\n  --json                 Print machine-readable output\n`);
  process.exit(0);
}

let config;
try {
  config = resolveShiftRunSyncConfig({ args });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const effectiveCalendarId = config.calendarId ?? '__dry_run_unconfigured__';

if (!config.dryRun && !config.calendarId) {
  console.error('Missing GOOGLE_CALENDAR_SHIFT_RUNS_ID');
  process.exit(1);
}

const prisma = await getPrisma();
if (!prisma) {
  console.error('Database unavailable');
  process.exit(1);
}

const shiftRuns = await fetchShiftRunsForMirror(prisma, config.window);
const { desired, skipped } = buildDesiredShiftRunMirrorEntries(shiftRuns, { timeZone: config.timeZone });
const priorState = await readShiftRunSyncState(config.statePath, {
  calendarId: effectiveCalendarId,
  window: config.window,
});
const plan = planShiftRunMirror({
  desiredEntries: desired,
  priorState,
  window: config.window,
  calendarId: effectiveCalendarId,
});
const preflight = createShiftRunSyncPreflight({ config, priorState, plan });

if (preflight.blockers.length > 0) {
  for (const blocker of preflight.blockers) {
    console.error(blocker);
  }
  process.exit(1);
}

let client = null;
if (!config.dryRun) {
  client = await createGoogleCalendarClient();
  if (!client) {
    console.error('Commit mode requires GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
    process.exit(1);
  }
}

const { nextState, results } = await applyShiftRunMirrorPlan({
  plan,
  priorState,
  calendarId: effectiveCalendarId,
  client,
  dryRun: config.dryRun,
});

if (!config.dryRun) {
  await writeShiftRunSyncState(config.statePath, nextState);
}

await prisma.$disconnect?.();

const output = {
  ok: true,
  dryRun: config.dryRun,
  allowBootstrap: config.allowBootstrap,
  window: config.window,
  timeZone: config.timeZone,
  calendarId: effectiveCalendarId,
  statePath: config.statePath,
  fetchedShiftRuns: shiftRuns.length,
  skipped,
  preflight,
  summary: plan.summary,
  actions: results,
};

if (args.json) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`${config.dryRun ? 'Dry run' : 'Commit'} complete for ${shiftRuns.length} shift runs.`);
  if (preflight.warnings.length > 0) {
    console.log(`Warnings: ${preflight.warnings.join(' | ')}`);
  }
  console.log(JSON.stringify(output, null, 2));
}
