ALTER TABLE "task_instances"
  ADD COLUMN "planned_run_date" DATE;

CREATE INDEX "task_instances_planned_run_date_idx" ON "task_instances"("planned_run_date");
