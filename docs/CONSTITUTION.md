# Cienna Cleaning App Constitutional Handbook

_Last updated: 2026-07-24_

This handbook defines the non-negotiable rules for developing, restoring, deploying, and auditing the Cienna Cleaning Platform. Its purpose is to prevent source-lineage drift, accidental UI regressions, and "fix one thing, break another" changes.

If a future change conflicts with this handbook, pause and update the handbook deliberately rather than silently drifting away from it.

---

## 1. Core Mission

The app exists to run Cienna cleaning operations reliably in the field.

It must help Chris and the cleaning team:

- see the correct work for the correct facility/day/staff member
- complete active checklists quickly on mobile
- capture grades, notes, skips, and photo evidence reliably
- keep working when connection quality is poor
- generate clear daily reports from actual completed checklist data
- organise facility route/task order without losing operational history

The app is operational infrastructure, not a design experiment. Clarity, reliability, and continuity beat novelty.

---

## 2. Protected Workflows

These workflows are constitutionally protected. Do not change them casually.

### 2.1 Cleaner active checklist

Protected behaviours:

- `/cleaner/[staffSlug]` must load the cleaner's active work.
- Active checklist modal/flow must support task grading, skip submission, required comments, required photo evidence, and correction flows.
- The bottom completion card must show report creation state and a usable `View report` action after completion.
- A task must not count as resolved just because a grade is selected locally; it must be saved or queued successfully.

### 2.2 Photo evidence

Protected behaviours:

- New photo uploads default to database-backed data URLs unless `TASK_PHOTO_STORAGE=filesystem` is explicitly configured.
- Existing photo readback through `/api/task-photos/[photoId]` must remain reliable after refresh/redeploy.
- Incident/before photos and completion/after photos should stay distinguishable.
- Do not revert photo storage to fragile local filesystem defaults.

### 2.3 Offline mode

Protected behaviours:

- Cleaner checklist must retain IndexedDB/offline queue support for grades, skips, and photos.
- Online/offline state and pending sync count should remain visible in the active checklist.
- Queued work must retry when online.
- UI restoration must not overwrite `offlineQueue.js` or remove queue integration unless replacing it with a tested equivalent.

### 2.4 Facility task view

Protected behaviours:

- Dashboard facility cards should open facility board task view by default: `view=tasks`.
- Direct facility board should continue to default safely to task view when no explicit view is supplied.
- Task view should preserve the approved July 14-era route/task-order layout.
- Task view should not show noisy legacy chips/details such as visible `Unallocated`, scheduled-status clutter, or old group-summary badges in the primary task list.
- Facility route/order UI must remain available where restored, including task-order view controls.

### 2.5 Facility task order / routes

Protected behaviours:

- `/api/facility-routes` must support named route retrieval/update.
- `/api/task-template-order` must support task ordering updates.
- Route/order source files and Prisma models/migrations must stay together; do not deploy one without the others.
- Schema support for `CleaningRoute` and `CleaningRouteItem` must not be removed without a migration plan.

### 2.6 Daily report from active checklist

Protected behaviours:

- `/api/cleaner-daily-report` must create a report from selected daily task IDs.
- `/reports/daily` must render the report with supervisor summary, attention/resolved sections where relevant, full checklist, photo evidence, and email/report actions.
- Report parsing must understand current checklist markers:
  - `[grade:x/5]`
  - `[initial-grade:x/5]`
  - `[issue-resolved:true]`
  - `[corrected-score:x/5]`
  - `[correction-later:true]`
  - `[resolution-note] ...`
- Internal markers must not leak into user-facing report notes.
- Resolved/corrected items must prefer corrected score over stale low audit score.

---

## 3. Source of Truth Rules

### 3.1 Main branch

`main` is the deployment branch, but it must be treated as trustworthy only after live/source verification.

Current known-good production baseline after the July 23 repair:

- `2a0bd86` — persistent DB-backed task photos
- `de4cebd` — restored active checklist report lineage
- `9931315` — restored facility route/task-order lineage
- `e404d47` — cleaned restored facility task view and restored health checks
- Railway production deployment `83dd0173` reached SUCCESS for `e404d47`

### 3.2 Recovery branches

Recovery branches may contain valuable old UI/features, but they are not automatically safe to merge.

Important lineage source:

- `origin/recovery/live-ui-20260711` — source for July 14-era facility route/task-order UI and APIs.

Rule: use targeted restoration from recovery branches. Do not blind-merge recovery branches into current `main` unless conflicts and protected workflows have been reviewed.

### 3.3 Dirty local worktrees

Do not deploy from a dirty/mixed local worktree.

Known caution:

- `cienna-cleaning-platform` has previously contained unrelated dirty/reverted files.
- Prefer a clean worktree or fresh branch for production fixes.

Before deploying, run:

```bash
git status --short
git log --oneline -5
```

---

## 4. Change Process

### 4.1 Before changing code

Ask:

1. Which protected workflow does this touch?
2. Is this UI, data, schema, reporting, offline, photo, or deployment behaviour?
3. Am I restoring old code? If yes, what current features could it overwrite?
4. Is there a safer targeted file/commit restore instead of a broad merge?

### 4.2 During code changes

Rules:

- Preserve current photo/offline/report behaviour unless the task explicitly changes it.
- Keep schema, APIs, and UI components in sync.
- Prefer small, purposeful commits over mixed mega-commits.
- If restoring historical UI, compare against current protected behaviour before accepting old files.
- Do not remove tests that protect currently working behaviour.
- **Page-scoped UI change rule:** when a change is requested for a specific page, route, component surface, or workflow, all other pages/routes must remain unchanged unless Chris explicitly asks for broader changes. Treat accidental visual/text/layout drift on unrelated pages as a regression, even if the app still builds.

### 4.3 Before commit

Minimum local gate:

```bash
node --test tests/*.test.mjs
npm run db:validate
npm run build
```

The known Turbopack NFT warning from `next.config.js` / `task-photo-storage.js` is acceptable if the build succeeds and no new warnings appear.

### 4.4 Before deploy

Confirm:

- worktree only contains intended files
- latest commit message describes the operational change
- migration files are included if Prisma schema changed
- protected workflow tests/build pass
- for page-scoped UI changes, capture or compare the changed page plus representative unaffected pages before deploy so unrelated pages are proven unchanged

### 4.5 After deploy

Minimum live smoke checks:

```text
/cleaner/tony                         -> 200
/facility-board/cienna?view=tasks      -> 200
/facility-board/cienna?view=order      -> 200 if route/order work touched
/reports/daily                         -> 200
/api/health                            -> ok when available
/api/cleaner-daily-report empty POST   -> expected 400
/api/task-photos empty POST            -> expected 400
```

Also check content markers when relevant:

- facility task view contains `View options`, `Task view`, `Task order`
- facility task view does not show old task-list clutter (`status-scheduled`, visible `>Unallocated<`, `task-inline-status-info`) in the main task view
- report contains `Supervisor summary`, `Full checklist`, `Email supervisor`
- report does not leak internal markers such as `[grade:`, `[corrected-score:`, `[correction-later:`
- for page-scoped UI changes, compare the changed page and representative unaffected pages against the pre-change record; do not hand-wave unrelated differences as acceptable unless they are clearly live data/order changes rather than source/UI changes

---

## 5. Regression Definitions

A change is a regression if it causes any of the following without explicit approval:

- cleaner checklist loses offline queue support
- photo upload/readback becomes unreliable after refresh/deploy
- facility dashboard opens staff view instead of task view
- facility route/order editor disappears
- daily report cannot be opened from active checklist completion
- report shows internal marker text
- resolved issue report displays stale low score instead of corrected score
- task completion progress counts unsaved local-only grades as completed
- schema changes deploy without matching migration or validation
- app deploys from a dirty/mixed source tree
- a page-scoped UI change alters unrelated pages/routes without explicit approval

---

## 6. Historical Lessons

### July 2026 source-lineage drift

The app had useful features split across source lines:

- newer line: photo reliability, offline checklist queue, correction flow
- July 14 recovery line: facility route/task-order UI, route/order APIs, report lineage

A blind merge was unsafe because it conflicted with current checklist/photo/offline files. The correct repair was targeted restoration: recover the facility/report pieces while preserving current photo/offline functionality.

Lesson: when app behaviour looks "old", check source lineage before assuming a deliberate UI decision.

### Photo storage reliability

Default local filesystem photo storage was fragile in hosted Railway behaviour. DB-backed data URLs are the safe default. Filesystem storage must remain opt-in only.

### Report parser drift

The active checklist stores structured state inside completion comments. Reports must strip markers from user-facing notes and parse corrected/resolved states intentionally.

---

## 7. Feature Status Register

| Area | Current intended status | Notes |
| --- | --- | --- |
| Cleaner active checklist | Protected/current | Keep offline queue and completion report action |
| Photo evidence | Protected/current | DB-backed data URLs by default |
| Offline mode | Protected/current | IndexedDB queue for grade/skip/photo work |
| Facility task view | Protected/restored | July 14 route/task-order lineage plus cleaned task list |
| Facility order view | Protected/restored | Depends on route/order APIs and Prisma models |
| Daily report | Protected/restored | Must parse current checklist markers correctly |
| `/api/health` | Restored | Used for dashboard health smoke checks |
| Remaining work reassignment panel | Known missing/cautious | Existed on recovery branch as `RemainingWorkPanel` + `/api/cleaner-remaining`; not restored on 2026-07-23 because it touches current checklist/offline flow and needs separate careful integration |

---

## 8. How to Restore Historical Code Safely

When pulling from an older branch:

1. Identify exact commits/files that introduced the desired behaviour.
2. List protected current files that must not be overwritten.
3. Restore only the required files.
4. Inspect diffs before commit.
5. Run the full local gate.
6. Deploy.
7. Run live smoke checks.
8. Record the result and any new lesson.

Never use "it compiled" as proof that behaviour is preserved.

---

## 9. Required Evidence for Completion

A development task is not complete until there is evidence.

Acceptable evidence:

- tests passed
- Prisma validation passed
- production build passed
- Railway deployment succeeded
- live route/API checks passed
- live DOM/content marker checks passed
- controlled upload/readback test passed for photo work
- screenshots or browser checks for UI-critical changes

Final updates should name the commit, deployment, and verification performed.
