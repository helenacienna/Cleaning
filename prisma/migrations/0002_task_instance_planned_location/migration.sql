ALTER TABLE "task_instances"
  ADD COLUMN "planned_facility_id" UUID,
  ADD COLUMN "planned_zone_id" UUID,
  ADD COLUMN "planned_task_group_id" UUID;

UPDATE "task_instances"
SET
  "planned_facility_id" = "facility_id",
  "planned_zone_id" = "zone_id",
  "planned_task_group_id" = "task_group_id"
WHERE "planned_facility_id" IS NULL
   OR "planned_zone_id" IS NULL
   OR "planned_task_group_id" IS NULL;

ALTER TABLE "task_instances"
  ADD CONSTRAINT "task_instances_planned_facility_id_fkey"
    FOREIGN KEY ("planned_facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "task_instances_planned_zone_id_fkey"
    FOREIGN KEY ("planned_zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "task_instances_planned_task_group_id_fkey"
    FOREIGN KEY ("planned_task_group_id") REFERENCES "task_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "task_instances_planned_facility_id_idx" ON "task_instances"("planned_facility_id");
CREATE INDEX "task_instances_planned_zone_id_idx" ON "task_instances"("planned_zone_id");
CREATE INDEX "task_instances_planned_task_group_id_idx" ON "task_instances"("planned_task_group_id");
