# Task Card Field Model

## Goal
Make the task card the stable unit that connects:
- organiser planning
- cleaner execution
- manager review
- audit/history/reporting

The main rule: **one reusable task template creates many dated task instances**.

---

## 1) Template fields (reusable master task card)
These should live on the reusable task card.

### Identity
- `id` — internal UUID
- `templateCode` — human-friendly code like `TC-001`
- `title` — short task name
- `description` — clearer instructions for the cleaner
- `active` — on/off without deleting history
- `version` — helps when templates change over time

### Structure / hierarchy
- `facilityId`
- `facilityName`
- `zoneId`
- `zoneName`
- `taskGroupId`
- `taskGroupName`
- `category` — optional broader type like amenities, presentation, safety

### Planning defaults
- `defaultSequence` — replaces/clarifies current job order concept
- `estimatedMinutes`
- `priority` — critical / standard / optional
- `serviceType` — routine / periodic / reactive / compliance
- `defaultAssigneeRole` — cleaner / team lead / specialist

### Recurrence / scheduling rules
- `recurrenceType` — daily / weekly / monthly / custom
- `recurrenceRule` — flexible rule text or RRULE-style field later
- `preferredTimeWindow` — morning / afternoon / flexible
- `targetDays` — e.g. Mon-Fri
- `seasonalRule` — optional

### Completion requirements
- `evidenceRequirement` — none / optional_photo / required_photo / multi_photo
- `commentRequirement` — none / on_exception / always
- `checklistItems` — optional sub-steps
- `passCriteria` — what “done” means
- `safetyNotes` — PPE, chemical, hazard notes

### Exceptions / operations
- `canBeSplit`
- `canBeMovedBetweenStaff`
- `requiresManagerApprovalToSkip`
- `carryForwardMode` — auto / manager_review / never

---

## 2) Scheduled task instance fields (created for a real day/shift)
These should **not** live on the reusable template.

- `id` — instance UUID
- `templateId`
- `shiftId`
- `runDate`
- `staffId`
- `staffName`
- `status` — draft / assigned / in_progress / completed / skipped / failed / carried_forward
- `sequence` — actual order for that day
- `facilityId`
- `zoneId`
- `taskGroupId`
- `plannedStartWindow`
- `plannedEndWindow`
- `publishedAt`
- `publishedBy`
- `source` — scheduled / ad_hoc / exception / carry_forward

This is what the organiser board should mainly move around.

---

## 3) Execution fields (cleaner completes the task)
These belong to the dated task instance result.

- `startedAt`
- `completedAt`
- `completionStatus`
- `completedBy`
- `completionComment`
- `exceptionReason`
- `photos[]`
- `issueRaised` — boolean
- `issueId` — if task created/found an issue
- `geoStamp` — optional later
- `scanSource` — QR / manual / supervisor

---

## 4) QA / manager review fields
These support the manager and organiser flows.

- `auditScore` — your current 1–5 model fits here
- `auditStatus` — pending / passed / failed / needs_followup
- `auditedAt`
- `auditedBy`
- `auditComment`
- `reworkRequired`
- `reworkReason`
- `linkedIncidentId`
- `managerAction` — none / monitor / reassign / escalate / close

---

## 5) Best minimal field set for the next real build
If we keep this lean, I’d start with these first:

### Template
- `id`
- `templateCode`
- `title`
- `description`
- `facilityId`
- `zoneId`
- `taskGroupId`
- `defaultSequence`
- `estimatedMinutes`
- `priority`
- `recurrenceType`
- `targetDays`
- `evidenceRequirement`
- `commentRequirement`
- `active`

### Scheduled instance
- `id`
- `templateId`
- `shiftId`
- `runDate`
- `staffId`
- `status`
- `sequence`
- `source`

### Execution/review
- `startedAt`
- `completedAt`
- `completionComment`
- `exceptionReason`
- `photos[]`
- `auditScore`
- `auditComment`

---

## 6) Mapping from current prototype fields
Current prototype fields already useful:
- `title`
- `templateId`
- `jobOrderNumber`
- `taskGroup`
- `zone`
- `facility`
- `frequency`
- `frequencyType`
- `required`
- `estimatedEffort`
- `lastCompleted`
- `suggestedDue`
- `notes`
- `active`
- `auditScore`
- `issueNote`

Recommended changes:
- `jobOrderNumber` -> split into `templateCode` and `defaultSequence`
- `frequency` -> `recurrenceType`
- `frequencyType` -> `priority`
- `required` -> split into `evidenceRequirement` and `commentRequirement`
- `estimatedEffort` -> `estimatedMinutes` or a clearer duration band
- `lastCompleted` / `suggestedDue` -> derive mostly from task history + schedule logic, not the template itself
- `notes` -> split into `description`, `passCriteria`, and `safetyNotes`

---

## 7) Important design decision
I strongly recommend separating:
1. **Task template**
2. **Scheduled task instance**
3. **Completion/audit record**

If those stay mixed together, the organiser board, cleaner checklist, and manager alerts will get messy fast.

If they stay separate, the whole app flow gets much cleaner:
- organiser moves scheduled instances
- cleaner completes instances
- manager reviews outcomes
- template stays reusable and stable

---

## 8) Suggested next UI changes
To match this model, the task card editor should next add:
- description
- estimated minutes
- priority
- evidence requirement
- comment requirement
- default sequence
- active/inactive

And it should stop pretending that these are template fields:
- last completed
- suggested due

Those belong to runtime scheduling/history.
