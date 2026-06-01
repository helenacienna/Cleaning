# Database Schema v1

## Goal
Create a lean first real database structure for Cienna Cleaning that supports:
- reusable task templates
- organiser-board scheduling
- cleaner execution
- manager review and audit
- history without overwriting the master template

This schema assumes **Postgres** and a Next.js app, but the model is generic enough to use with Prisma, Drizzle, Supabase, or plain SQL.

---

## Core design
Separate these concerns:

1. **Task template** — reusable definition of a task
2. **Shift task instance** — dated assigned work generated from a template
3. **Task execution / audit** — what happened when the cleaner ran it

That gives us a clean flow:
- organiser board moves **shift task instances**
- cleaner completes **shift task instances**
- manager reviews **execution/audit**
- templates remain stable and reusable

---

## Main tables

### `facilities`
Represents a site/building.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | display name |
| code | text unique | human-friendly code |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `zones`
A facility sub-area linked to QR workflows.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| facility_id | uuid fk -> facilities.id | |
| name | text | |
| code | text | QR/display code |
| qr_slug | text unique | path-safe scan id |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_groups`
Logical grouping inside a zone.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| zone_id | uuid fk -> zones.id | |
| name | text | |
| sequence | integer | default display order |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `staff`
People who can be assigned work.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| full_name | text | |
| role | text | cleaner / organiser / manager / supervisor |
| phone | text null | optional |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_templates`
Reusable master task cards.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| template_code | text unique | e.g. `TC-001` |
| title | text | short task name |
| description | text null | cleaner instructions |
| facility_id | uuid fk -> facilities.id | denormalised convenience if task is facility-specific |
| zone_id | uuid fk -> zones.id | |
| task_group_id | uuid fk -> task_groups.id | |
| default_sequence | integer | default order within group/zone |
| estimated_minutes | integer | |
| priority | text | critical / standard / optional |
| service_type | text | routine / periodic / reactive / compliance |
| recurrence_type | text | daily / weekly / monthly / custom |
| target_days | jsonb null | e.g. `["mon","tue","wed","thu","fri"]` |
| preferred_time_window | text null | morning / afternoon / flexible |
| evidence_requirement | text | none / optional_photo / required_photo / multi_photo |
| comment_requirement | text | none / on_exception / always |
| pass_criteria | text null | what done means |
| safety_notes | text null | |
| can_be_split | boolean | default false |
| can_be_moved_between_staff | boolean | default true |
| requires_manager_approval_to_skip | boolean | default false |
| carry_forward_mode | text | auto / manager_review / never |
| active | boolean | default true |
| version | integer | default 1 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `shift_runs`
A dated shift or organiser-created work pack.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| run_date | date | |
| facility_id | uuid fk -> facilities.id null | optional if multi-facility run |
| assigned_staff_id | uuid fk -> staff.id null | |
| organiser_state | text | draft / published / in_progress / closed |
| shift_label | text null | |
| shift_start_at | timestamptz null | |
| shift_end_at | timestamptz null | |
| route_label | text null | |
| published_at | timestamptz null | |
| published_by_staff_id | uuid fk -> staff.id null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `shift_tasks`
Generated dated task instances shown on the organiser board.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| shift_run_id | uuid fk -> shift_runs.id | |
| task_template_id | uuid fk -> task_templates.id null | null allowed for ad-hoc tasks |
| source | text | scheduled / ad_hoc / exception / carry_forward |
| title | text | snapshot copy for history |
| description | text null | snapshot copy |
| facility_id | uuid fk -> facilities.id | |
| zone_id | uuid fk -> zones.id | |
| task_group_id | uuid fk -> task_groups.id | |
| assigned_staff_id | uuid fk -> staff.id null | |
| sequence | integer | actual order for this shift |
| planned_start_at | timestamptz null | |
| planned_end_at | timestamptz null | |
| status | text | draft / assigned / in_progress / completed / skipped / failed / carried_forward |
| priority | text | copied from template at generation time |
| evidence_requirement | text | copied from template |
| comment_requirement | text | copied from template |
| estimated_minutes | integer null | copied from template |
| is_detached_exception | boolean | default false |
| detached_reason | text null | |
| carried_forward_from_shift_task_id | uuid fk -> shift_tasks.id null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_executions`
Cleaner execution record for a shift task.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| shift_task_id | uuid fk -> shift_tasks.id unique | one current execution record per task instance in v1 |
| started_at | timestamptz null | |
| completed_at | timestamptz null | |
| completed_by_staff_id | uuid fk -> staff.id null | |
| completion_status | text | completed / skipped / failed / partial |
| completion_comment | text null | |
| exception_reason | text null | |
| scan_source | text null | qr / manual / supervisor |
| issue_raised | boolean | default false |
| issue_id | uuid null | future incident link |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_photos`
Evidence photos attached to execution.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| task_execution_id | uuid fk -> task_executions.id | |
| photo_url | text | storage path/url |
| photo_type | text | completion / exception / audit |
| uploaded_at | timestamptz | |

### `task_audits`
Manager/supervisor review outcome.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| shift_task_id | uuid fk -> shift_tasks.id | |
| audited_by_staff_id | uuid fk -> staff.id null | |
| audit_score | integer | 1 to 5 |
| audit_status | text | pending / passed / failed / needs_followup |
| audit_comment | text null | |
| rework_required | boolean | default false |
| rework_reason | text null | |
| manager_action | text | none / monitor / reassign / escalate / close |
| audited_at | timestamptz | |
| created_at | timestamptz | |

---

## Relationships

- facility -> many zones
- zone -> many task groups
- task group -> many task templates
- task template -> many shift tasks over time
- shift run -> many shift tasks
- shift task -> one execution record in v1
- shift task -> many audit records possible, though usually latest matters most
- task execution -> many task photos

---

## Recommended enums
Use Postgres enums later if helpful, but plain text + app validation is fine for v1.

Suggested enum values:

### `priority`
- `critical`
- `standard`
- `optional`

### `service_type`
- `routine`
- `periodic`
- `reactive`
- `compliance`

### `recurrence_type`
- `daily`
- `weekly`
- `monthly`
- `custom`

### `evidence_requirement`
- `none`
- `optional_photo`
- `required_photo`
- `multi_photo`

### `comment_requirement`
- `none`
- `on_exception`
- `always`

### `carry_forward_mode`
- `auto`
- `manager_review`
- `never`

### `shift task status`
- `draft`
- `assigned`
- `in_progress`
- `completed`
- `skipped`
- `failed`
- `carried_forward`

### `audit_status`
- `pending`
- `passed`
- `failed`
- `needs_followup`

---

## What the organiser board should edit
The organiser board should mostly edit fields on `shift_tasks`:
- `assigned_staff_id`
- `sequence`
- `shift_run_id`
- `planned_start_at` / `planned_end_at`
- `facility_id` / `zone_id` / `task_group_id` in exception cases
- `status` when publishing or carrying forward

It should **not** directly edit the reusable template unless the user is intentionally editing the master card.

---

## What the task card editor should edit
The task card editor should update `task_templates`:
- title
- description
- group/zone/facility links
- default sequence
- estimated minutes
- priority
- recurrence settings
- evidence/comment rules
- active flag

It should **not** own runtime fields like:
- last completed
- suggested due
- current cleaner
- today’s status
- audit score on a dated run

---

## Fields from the prototype to map now

| current prototype field | v1 schema mapping |
|---|---|
| `templateId` | `task_templates.template_code` or separate external code |
| `jobOrderNumber` | `task_templates.default_sequence` |
| `title` | `task_templates.title` |
| `taskGroup` | `task_groups.name` |
| `zone` | `zones.name` |
| `facility` | `facilities.name` |
| `frequency` | `task_templates.recurrence_type` |
| `frequencyType` | `task_templates.priority` |
| `required` | split into `evidence_requirement` + `comment_requirement` |
| `estimatedEffort` | `estimated_minutes` or a derived display band |
| `notes` | `description` / `pass_criteria` / `safety_notes` |
| `active` | `task_templates.active` |
| `auditScore` | `task_audits.audit_score` |
| `issueNote` | `task_audits.audit_comment` or execution exception note |

---

## Leanest build-first scope
If we want to keep v1 tight, build these first:
- `facilities`
- `zones`
- `task_groups`
- `staff`
- `task_templates`
- `shift_runs`
- `shift_tasks`
- `task_executions`
- `task_audits`

Add `task_photos` once image upload/evidence becomes real.

---

## Important constraint for the real app
Do not rely on mutable display names as joins.
Use ids everywhere:
- facility_id
- zone_id
- task_group_id
- staff_id
- task_template_id
- shift_task_id

Names should be display data only.

---

## Recommended next step
After this, the next practical move is to create either:
1. a **Postgres SQL migration**, or
2. a **Prisma schema**

My recommendation: **Prisma schema first if you want app-speed**, or **raw SQL first if you want data-model clarity before codegen**.
