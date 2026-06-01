-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('cleaner', 'organiser', 'manager', 'supervisor');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('routine', 'periodic', 'ad_hoc');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('none', 'daily', 'weekly', 'monthly', 'custom');

-- CreateEnum
CREATE TYPE "TimeWindow" AS ENUM ('morning', 'afternoon', 'flexible');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('critical', 'standard', 'optional');

-- CreateEnum
CREATE TYPE "EvidenceRequirement" AS ENUM ('none', 'optional_photo', 'required_photo', 'multi_photo');

-- CreateEnum
CREATE TYPE "CommentRequirement" AS ENUM ('none', 'on_exception', 'always');

-- CreateEnum
CREATE TYPE "MissedTaskPolicy" AS ENUM ('carry_forward', 'stay_overdue', 'skip_and_regenerate', 'manager_review');

-- CreateEnum
CREATE TYPE "TemplateStatusBucket" AS ENUM ('upcoming', 'due', 'overdue', 'unscheduled', 'completed_recently');

-- CreateEnum
CREATE TYPE "FacilityScope" AS ENUM ('single_facility', 'multi_facility');

-- CreateEnum
CREATE TYPE "OrganiserState" AS ENUM ('draft', 'published', 'in_progress', 'closed');

-- CreateEnum
CREATE TYPE "TaskSourceType" AS ENUM ('scheduled', 'auto_generated', 'ad_hoc', 'exception', 'carry_forward');

-- CreateEnum
CREATE TYPE "TaskInstanceStatus" AS ENUM ('upcoming', 'due', 'unscheduled', 'scheduled', 'in_progress', 'completed', 'overdue', 'carried_forward', 'skipped', 'cancelled');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('completed', 'skipped', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('pending', 'passed', 'failed', 'needs_followup');

-- CreateEnum
CREATE TYPE "ManagerAction" AS ENUM ('none', 'monitor', 'reassign', 'escalate', 'close');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('completion', 'exception', 'audit');

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "facility_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "zone_code" TEXT NOT NULL,
    "full_zone_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qr_slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_groups" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "group_code" TEXT NOT NULL,
    "full_group_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "staff_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "task_template_code" TEXT NOT NULL,
    "facility_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "task_group_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "service_type" "ServiceType" NOT NULL,
    "recurrence_type" "RecurrenceType" NOT NULL DEFAULT 'none',
    "recurrence_rule" JSONB,
    "target_days" JSONB,
    "preferred_time_window" "TimeWindow",
    "default_sequence" INTEGER NOT NULL,
    "estimated_minutes" INTEGER,
    "priority" "TaskPriority" NOT NULL,
    "evidence_requirement" "EvidenceRequirement" NOT NULL,
    "comment_requirement" "CommentRequirement" NOT NULL,
    "pass_criteria" TEXT,
    "safety_notes" TEXT,
    "auto_generate_instances" BOOLEAN NOT NULL DEFAULT true,
    "requires_planning" BOOLEAN NOT NULL DEFAULT true,
    "can_be_split" BOOLEAN NOT NULL DEFAULT false,
    "can_be_moved_between_staff" BOOLEAN NOT NULL DEFAULT true,
    "requires_manager_approval_to_skip" BOOLEAN NOT NULL DEFAULT false,
    "missed_task_policy" "MissedTaskPolicy" NOT NULL,
    "reschedule_window_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_status" (
    "task_template_id" UUID NOT NULL,
    "last_completed_at" TIMESTAMPTZ(6),
    "last_completed_instance_id" UUID,
    "next_due_at" TIMESTAMPTZ(6),
    "next_planning_due_at" TIMESTAMPTZ(6),
    "overdue_since_at" TIMESTAMPTZ(6),
    "open_instance_count" INTEGER NOT NULL DEFAULT 0,
    "unscheduled_instance_count" INTEGER NOT NULL DEFAULT 0,
    "status_bucket" "TemplateStatusBucket" NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_template_status_pkey" PRIMARY KEY ("task_template_id")
);

-- CreateTable
CREATE TABLE "shift_runs" (
    "id" UUID NOT NULL,
    "shift_code" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "assigned_staff_id" UUID,
    "facility_scope" "FacilityScope" NOT NULL,
    "shift_label" TEXT,
    "route_label" TEXT,
    "shift_start_at" TIMESTAMPTZ(6),
    "shift_end_at" TIMESTAMPTZ(6),
    "organiser_state" "OrganiserState" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "published_by_staff_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_instances" (
    "id" UUID NOT NULL,
    "instance_code" TEXT NOT NULL,
    "task_template_id" UUID,
    "shift_run_id" UUID,
    "facility_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "task_group_id" UUID NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "description_snapshot" TEXT,
    "source_type" "TaskSourceType" NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "planning_due_at" TIMESTAMPTZ(6),
    "scheduled_for_at" TIMESTAMPTZ(6),
    "assigned_staff_id" UUID,
    "sequence" INTEGER,
    "status" "TaskInstanceStatus" NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "evidence_requirement" "EvidenceRequirement" NOT NULL,
    "comment_requirement" "CommentRequirement" NOT NULL,
    "estimated_minutes" INTEGER,
    "rescheduled_from_instance_id" UUID,
    "carried_forward_from_instance_id" UUID,
    "parent_instance_id" UUID,
    "is_exception_task" BOOLEAN NOT NULL DEFAULT false,
    "exception_reason" TEXT,
    "manually_created" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_executions" (
    "id" UUID NOT NULL,
    "task_instance_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "completed_by_staff_id" UUID,
    "completion_status" "CompletionStatus" NOT NULL,
    "completion_comment" TEXT,
    "exception_reason" TEXT,
    "scan_source" TEXT,
    "issue_raised" BOOLEAN NOT NULL DEFAULT false,
    "issue_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_audits" (
    "id" UUID NOT NULL,
    "task_instance_id" UUID NOT NULL,
    "audited_by_staff_id" UUID,
    "audit_score" INTEGER NOT NULL,
    "audit_status" "AuditStatus" NOT NULL,
    "audit_comment" TEXT,
    "rework_required" BOOLEAN NOT NULL DEFAULT false,
    "rework_reason" TEXT,
    "manager_action" "ManagerAction" NOT NULL DEFAULT 'none',
    "audited_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_photos" (
    "id" UUID NOT NULL,
    "task_execution_id" UUID NOT NULL,
    "photo_url" TEXT NOT NULL,
    "photo_type" "PhotoType" NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facilities_facility_code_key" ON "facilities"("facility_code");

-- CreateIndex
CREATE UNIQUE INDEX "zones_full_zone_code_key" ON "zones"("full_zone_code");

-- CreateIndex
CREATE UNIQUE INDEX "zones_qr_slug_key" ON "zones"("qr_slug");

-- CreateIndex
CREATE UNIQUE INDEX "zones_facility_id_zone_code_key" ON "zones"("facility_id", "zone_code");

-- CreateIndex
CREATE UNIQUE INDEX "task_groups_full_group_code_key" ON "task_groups"("full_group_code");

-- CreateIndex
CREATE UNIQUE INDEX "task_groups_zone_id_group_code_key" ON "task_groups"("zone_id", "group_code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_staff_code_key" ON "staff"("staff_code");

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_task_template_code_key" ON "task_templates"("task_template_code");

-- CreateIndex
CREATE UNIQUE INDEX "task_template_status_last_completed_instance_id_key" ON "task_template_status"("last_completed_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_runs_shift_code_key" ON "shift_runs"("shift_code");

-- CreateIndex
CREATE UNIQUE INDEX "task_instances_instance_code_key" ON "task_instances"("instance_code");

-- CreateIndex
CREATE INDEX "task_instances_status_due_at_idx" ON "task_instances"("status", "due_at");

-- CreateIndex
CREATE INDEX "task_instances_assigned_staff_id_due_at_idx" ON "task_instances"("assigned_staff_id", "due_at");

-- CreateIndex
CREATE INDEX "task_instances_shift_run_id_sequence_idx" ON "task_instances"("shift_run_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "task_executions_task_instance_id_key" ON "task_executions"("task_instance_id");

-- CreateIndex
CREATE INDEX "task_audits_task_instance_id_audited_at_idx" ON "task_audits"("task_instance_id", "audited_at");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_task_group_id_fkey" FOREIGN KEY ("task_group_id") REFERENCES "task_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_status" ADD CONSTRAINT "task_template_status_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_status" ADD CONSTRAINT "task_template_status_last_completed_instance_id_fkey" FOREIGN KEY ("last_completed_instance_id") REFERENCES "task_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_runs" ADD CONSTRAINT "shift_runs_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_runs" ADD CONSTRAINT "shift_runs_published_by_staff_id_fkey" FOREIGN KEY ("published_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_shift_run_id_fkey" FOREIGN KEY ("shift_run_id") REFERENCES "shift_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_task_group_id_fkey" FOREIGN KEY ("task_group_id") REFERENCES "task_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_rescheduled_from_instance_id_fkey" FOREIGN KEY ("rescheduled_from_instance_id") REFERENCES "task_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_carried_forward_from_instance_id_fkey" FOREIGN KEY ("carried_forward_from_instance_id") REFERENCES "task_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_parent_instance_id_fkey" FOREIGN KEY ("parent_instance_id") REFERENCES "task_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_task_instance_id_fkey" FOREIGN KEY ("task_instance_id") REFERENCES "task_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_completed_by_staff_id_fkey" FOREIGN KEY ("completed_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_audits" ADD CONSTRAINT "task_audits_task_instance_id_fkey" FOREIGN KEY ("task_instance_id") REFERENCES "task_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_audits" ADD CONSTRAINT "task_audits_audited_by_staff_id_fkey" FOREIGN KEY ("audited_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_photos" ADD CONSTRAINT "task_photos_task_execution_id_fkey" FOREIGN KEY ("task_execution_id") REFERENCES "task_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
