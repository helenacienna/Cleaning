# Effective-day integration check (2026-06-10)

## Scope
Narrow deploy-confidence check for anchored-task reschedule/effective-day handling across organiser save and runtime maintenance.

## Repo-grounded verification
- `app/api/organiser-board/route.js`
  - organiser save path calls `deriveOrganiserSchedule(...)`
  - persists `dueAt`, `plannedRunDate`, and `scheduledForAt` from that result into `prisma.taskInstance.update(...)`
- `lib/runtime-maintenance.js`
  - candidate query intentionally casts a wide net (`dueAt`, `scheduledForAt`, `plannedRunDate`, `shiftRun.runDate`)
  - before mutating any candidate, it gates on `isTaskInstancePastEffectiveDue(candidate, now)`
  - that means a task moved later via `plannedRunDate` can be scanned early but is skipped until its effective day actually passes
- `tests/task-effective-day.test.mjs`
  - already proves the pure-function side of both edges:
    - anchored weekly task moved earlier/later keeps anchored `dueAt` and records `plannedRunDate`
    - candidate selection does **not** treat later-moved work as overdue before its effective day

## Verification commands and evidence
- `node --test tests/task-effective-day.test.mjs`
  - passes: 5/5
- Attempted raw integration imports for route/runtime modules under Node test runner
  - route import failed on `next/server` resolution (`ERR_MODULE_NOT_FOUND`, suggests `next/server.js`)
  - runtime-maintenance import failed on extensionless local import resolution for `./notification-center`
  - this repo appears to rely on Next/runtime resolution rather than direct raw-Node module execution for those files

## Confidence read
The live organiser save path and runtime maintenance path are wired to the effective-day helpers in the right places, and the existing targeted tests cover the critical logic outcome. Remaining gap is a true executable route/runtime integration harness outside Next's resolver environment.
