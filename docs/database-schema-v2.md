# Database Schema v2

## What changed from v1
This version adds the ideas Chris raised:
- explicit hierarchy: facility -> zone -> task group -> task template
- support for routine, infrequent, and one-off work
- tracking for last done / next due / upcoming due / overdue / not yet organised
- automatic self-population of due task instances
- reschedule / carry-forward rules
- stable hierarchy codes plus dated instance tracking codes

---

## 1) Core model

There are **three different things** in the system:

1. **Structure**
   - Facility
   - Zone
   - Task Group

2. **Reusable definitions**
   - Task Template

3. **Runtime records**
   - Task Instance (a due/scheduled occurrence)
   - Task Execution
   - Task Audit

That separation is important.

- The hierarchy defines where work belongs.
- The template defines what work should happen.
- The instance tracks when that work is due or scheduled.
- Execution/audit tracks what actually happened.

---

## 2) Hierarchy tables

### `facilities`
| column | type | notes |
|---|---|---|
| id | uuid pk | internal id |
| facility_code | text unique | e.g. `FAC01` |
| name | text | |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `zones`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| facility_id | uuid fk -> facilities.id | |
| zone_code | text | e.g. `Z03` within facility |
| full_zone_code | text unique | e.g. `FAC01-Z03` |
| name | text | |
| qr_slug | text unique | scan identifier |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_groups`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| facility_id | uuid fk -> facilities.id | denormalised convenience |
| zone_id | uuid fk -> zones.id | |
| group_code | text | e.g. `G02` |
| full_group_code | text unique | e.g. `FAC01-Z03-G02` |
| name | text | |
| sequence | integer | display order |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 3) Task template table

### `task_templates`
Reusable master task cards.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| task_template_code | text unique | e.g. `FAC01-Z03-G02-T014` |
| facility_id | uuid fk -> facilities.id | |
| zone_id | uuid fk -> zones.id | |
| task_group_id | uuid fk -> task_groups.id | |
| title | text | short task name |
| description | text null | cleaner instructions |
| service_type | text | `routine` / `periodic` / `ad_hoc` |
| recurrence_type | text | `daily` / `weekly` / `monthly` / `custom` / `none` |
| recurrence_rule | jsonb null | future-ready rule storage |
| target_days | jsonb null | e.g. `["mon","wed","fri"]` |
| preferred_time_window | text null | morning / afternoon / flexible |
| default_sequence | integer | default order in group |
| estimated_minutes | integer null | |
| priority | text | critical / standard / optional |
| evidence_requirement | text | none / optional_photo / required_photo / multi_photo |
| comment_requirement | text | none / on_exception / always |
| pass_criteria | text null | |
| safety_notes | text null | |
| auto_generate_instances | boolean | default true for recurring tasks |
| requires_planning | boolean | default true |
| can_be_split | boolean | default false |
| can_be_moved_between_staff | boolean | default true |
| requires_manager_approval_to_skip | boolean | default false |
| missed_task_policy | text | see rules below |
| reschedule_window_days | integer null | optional grace/planning window |
| active | boolean | default true |
| version | integer | default 1 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 4) Due-state tracking on the template

To make monitoring faster, I think we should track summary scheduling fields either on the template itself or in a helper summary table.

### Recommended helper table: `task_template_status`
This keeps runtime due-state off the master definition while still making dashboards easy.

| column | type | notes |
|---|---|---|
| task_template_id | uuid pk fk -> task_templates.id | one row per template |
| last_completed_at | timestamptz null | latest successful completion |
| last_completed_instance_id | uuid null | |
| next_due_at | timestamptz null | next due occurrence |
| next_planning_due_at | timestamptz null | when organiser should see it before due |
| overdue_since_at | timestamptz null | |
| open_instance_count | integer | default 0 |
| unscheduled_instance_count | integer | default 0 |
| status_bucket | text | upcoming / due / overdue / unscheduled / completed_recently |
| updated_at | timestamptz | |

This table is what powers:
- what was last done
- what is next due
- what is overdue
- what is due soon but not organised

---

## 5) Shift / planning tables

### `shift_runs`
A real shift, route, or work pack.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| shift_code | text unique | e.g. `SHIFT-20260601-001` |
| run_date | date | |
| assigned_staff_id | uuid fk -> staff.id null | |
| facility_scope | text | single_facility / multi_facility |
| shift_label | text null | |
| route_label | text null | |
| shift_start_at | timestamptz null | |
| shift_end_at | timestamptz null | |
| organiser_state | text | draft / published / in_progress / closed |
| published_at | timestamptz null | |
| published_by_staff_id | uuid fk -> staff.id null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_instances`
This is the big one: every due, scheduled, overdue, ad hoc, or carried-forward occurrence lives here.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| instance_code | text unique | e.g. `20260601-FAC01-Z03-G02-T014-001` |
| task_template_id | uuid fk -> task_templates.id null | null for fully manual one-off tasks |
| shift_run_id | uuid fk -> shift_runs.id null | null until organised |
| facility_id | uuid fk -> facilities.id | |
| zone_id | uuid fk -> zones.id | |
| task_group_id | uuid fk -> task_groups.id | |
| title_snapshot | text | preserve title at generation time |
| description_snapshot | text null | |
| source_type | text | scheduled / auto_generated / ad_hoc / exception / carry_forward |
| due_at | timestamptz | when task should be completed by |
| planning_due_at | timestamptz null | when organiser should start seeing it |
| scheduled_for_at | timestamptz null | planned time slot |
| assigned_staff_id | uuid fk -> staff.id null | |
| sequence | integer null | day order once organised |
| status | text | upcoming / due / unscheduled / scheduled / in_progress / completed / overdue / carried_forward / skipped / cancelled |
| priority | text | snapshot |
| evidence_requirement | text | snapshot |
| comment_requirement | text | snapshot |
| estimated_minutes | integer null | snapshot |
| rescheduled_from_instance_id | uuid fk -> task_instances.id null | |
| carried_forward_from_instance_id | uuid fk -> task_instances.id null | |
| parent_instance_id | uuid fk -> task_instances.id null | used if split |
| is_exception_task | boolean | default false |
| exception_reason | text null | |
| manually_created | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

This table is the organiser board’s main working surface.

---

## 6) Execution and audit tables

### `task_executions`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| task_instance_id | uuid fk -> task_instances.id unique | v1/v2 can keep one current execution row |
| started_at | timestamptz null | |
| completed_at | timestamptz null | |
| completed_by_staff_id | uuid fk -> staff.id null | |
| completion_status | text | completed / skipped / failed / partial |
| completion_comment | text null | |
| exception_reason | text null | |
| scan_source | text null | qr / manual / supervisor |
| issue_raised | boolean | default false |
| issue_id | uuid null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_audits`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| task_instance_id | uuid fk -> task_instances.id | |
| audited_by_staff_id | uuid fk -> staff.id null | |
| audit_score | integer | 1 to 5 |
| audit_status | text | pending / passed / failed / needs_followup |
| audit_comment | text null | |
| rework_required | boolean | default false |
| rework_reason | text null | |
| manager_action | text | none / monitor / reassign / escalate / close |
| audited_at | timestamptz | |
| created_at | timestamptz | |

### `task_photos`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| task_execution_id | uuid fk -> task_executions.id | |
| photo_url | text | |
| photo_type | text | completion / exception / audit |
| uploaded_at | timestamptz | |

---

## 7) Staff table

### `staff`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| staff_code | text unique | e.g. `STF009` |
| full_name | text | |
| role | text | cleaner / organiser / manager / supervisor |
| phone | text null | |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 8) How infrequent and one-off tasks work

### Routine recurring tasks
Examples:
- clean toilets daily
- wipe mirrors every 2 days

Stored as:
- `service_type = routine`
- recurrence fields populated
- `auto_generate_instances = true`

### Infrequent periodic tasks
Examples:
- deep clean vents monthly
- pressure wash quarterly

Stored as:
- `service_type = periodic`
- recurrence fields populated
- `auto_generate_instances = true`
- often longer `planning_due_at` lead time

### One-off / sporadic tasks
Examples:
- spill cleanup
- special owner request
- event recovery clean

Stored as either:
1. `task_templates.service_type = ad_hoc` if it is a reusable “kind” of one-off job, or
2. direct `task_instances.manually_created = true` if it is truly one-time only

That gives flexibility without cluttering the recurring system.

---

## 9) Due generation logic

This is the behavior I recommend.

### For recurring templates
The system should automatically create a `task_instance` when:
- the next due date enters the planning window, or
- the due date arrives, depending on the rule

Suggested fields involved:
- `recurrence_type`
- `recurrence_rule`
- `target_days`
- `planning_due_at`
- `due_at`

### Example lifecycle
1. Template exists for “Clean toilets”
2. System calculates next due = `2026-06-03 09:00`
3. Planning window opens 2 days earlier
4. Instance is created with:
   - `status = unscheduled` or `upcoming`
   - `planning_due_at = 2026-06-01`
   - `due_at = 2026-06-03 09:00`
5. Organiser assigns it to a shift and cleaner
6. Status becomes `scheduled`
7. Cleaner completes it
8. Completion updates `task_template_status.last_completed_at`
9. System calculates the next one

---

## 10) Reschedule and missed-task rules

I think this should be explicit on the template.

### `missed_task_policy`
Recommended values:
- `carry_forward`
- `stay_overdue`
- `skip_and_regenerate`
- `manager_review`

### Suggested behavior
- **Critical routine tasks** -> `carry_forward`
- **Periodic tasks** -> `stay_overdue`
- **Optional tasks** -> `skip_and_regenerate`
- **Sensitive/compliance tasks** -> `manager_review`

### Reschedule handling
When a task is rescheduled:
- keep the original `task_instance`
- either update its schedule fields, or create a linked new instance if business rules require a clean trail
- use:
  - `rescheduled_from_instance_id`
  - `carried_forward_from_instance_id`

My recommendation for audit clarity:
- small date/time changes: same instance
- missed-day carry-forward to another day: new linked instance

---

## 11) Organiser board states

These are the states the organiser board needs to understand:
- `upcoming`
- `due`
- `unscheduled`
- `scheduled`
- `in_progress`
- `completed`
- `overdue`
- `carried_forward`
- `skipped`
- `cancelled`

This will let the board filter by:
- due soon
- overdue
- not organised yet
- published to shift
- in progress

---

## 12) Tracking and record keeping codes

I like your instinct here.

### Stable hierarchy codes
Use readable structure codes:
- Facility: `FAC01`
- Zone: `FAC01-Z03`
- Task group: `FAC01-Z03-G02`
- Task template: `FAC01-Z03-G02-T014`

These should stay stable over time.

### Dated task instance codes
Use a dated occurrence code for tracking:
- `20260601-FAC01-Z03-G02-T014-001`

This gives:
- date
- exact hierarchy location
- exact reusable task
- exact occurrence number if needed

So yes: **date should be in the runtime instance code, not the master task code**.

---

## 13) What monitors what

### Template layer answers:
- what is this task?
- where does it belong?
- how often should it happen?
- what rules apply?

### Template status layer answers:
- when was it last completed?
- when is it next due?
- is it overdue?
- is there unorganised work open?

### Task instance layer answers:
- is this occurrence scheduled yet?
- who is doing it?
- when is it due?
- was it rescheduled or carried forward?

### Execution/audit layer answers:
- was it actually done?
- what proof was attached?
- did it pass review?

---

## 14) Recommended minimal v2 build scope

If we want a practical real-build schema, I would implement these first:
- `facilities`
- `zones`
- `task_groups`
- `staff`
- `task_templates`
- `task_template_status`
- `shift_runs`
- `task_instances`
- `task_executions`
- `task_audits`

Add `task_photos` alongside evidence upload.

---

## 15) My opinion on the model

I think your idea is strong.

The only thing I would tighten is this:
- yes, think of each level as a card in the UI if that helps
- but in the data model, **facility/zone/group are containers**, while **task template + task instance are the real operational units**

That keeps the hierarchy clean and the workflow manageable.

---

## 16) Best next technical step

After this, the next useful artifact is:
1. **Prisma schema for v2**, or
2. **lifecycle diagram** showing template -> due -> scheduled -> completed -> next due

My recommendation: do the **Prisma schema next**, then the lifecycle diagram after that.
