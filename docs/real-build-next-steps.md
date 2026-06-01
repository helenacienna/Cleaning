# Real Build Next Steps

## Current status
The project now has:
- a Prisma schema
- an initial SQL migration
- a seed script for facilities, zones, task groups, task templates, and template status
- a task library data layer that prefers Prisma data when available
- safe fallback to demo data when database access is not configured

---

## Scripts now available
- `npm run db:generate` — generate Prisma client
- `npm run db:validate` — validate Prisma schema
- `npm run db:format` — format Prisma schema
- `npm run db:migrate` — apply committed migrations to the target database
- `npm run db:seed` — seed the database with initial hierarchy/template data
- `npm run db:setup` — migrate and then seed

---

## What is needed to go live with real data
We need a real `DATABASE_URL` for the target environment.

### Local
Set:
- `DATABASE_URL`

Then run:

```bash
npm run db:setup
```

### Railway
Set environment variable:
- `DATABASE_URL`

Then either:
1. run `npm run db:setup` against the Railway database from a trusted shell, or
2. apply migration + seed through a controlled deployment/release step

---

## Recommended rollout order

### Phase 1 — real task library
- migrate database
- seed base hierarchy + templates
- confirm `/admin/task-cards` reads real Prisma records
- keep organiser board on demo/runtime placeholder data for the moment

### Phase 2 — real organiser task instances
- create seed or generator for `task_instances`
- persist drag/drop changes
- persist draft/published shift state

### Phase 3 — cleaner execution
- write real task completion records
- comments/photos/evidence
- issue/report flow

### Phase 4 — manager oversight
- audits
- low-score queue
- overdue and carry-forward tracking

---

## Recommendation
The next practical move is:
1. get the real database connected
2. run `npm run db:setup`
3. turn on real Prisma-backed task library data in the deployed environment

That is the cleanest first real-build milestone.
