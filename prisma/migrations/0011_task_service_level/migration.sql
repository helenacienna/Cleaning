-- Add the operational service level expected for each task.
CREATE TYPE "ServiceLevel" AS ENUM ('check', 'clean', 'detailed_clean');

ALTER TABLE "task_templates"
  ADD COLUMN "service_level" "ServiceLevel" NOT NULL DEFAULT 'clean';

ALTER TABLE "task_instances"
  ADD COLUMN "service_level" "ServiceLevel" NOT NULL DEFAULT 'clean';
