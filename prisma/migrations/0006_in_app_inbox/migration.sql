-- CreateEnum
CREATE TYPE "InboxThreadType" AS ENUM ('operational_alert', 'direct', 'group');

-- CreateEnum
CREATE TYPE "InboxMessageKind" AS ENUM ('note', 'alert', 'status', 'system');

-- CreateEnum
CREATE TYPE "InboxParticipantRole" AS ENUM ('owner', 'member', 'watcher', 'system');

-- AlterTable
ALTER TABLE "notification_events"
  ADD COLUMN "inbox_thread_id" UUID,
  ADD COLUMN "inbox_message_id" UUID;

-- CreateTable
CREATE TABLE "inbox_threads" (
    "id" UUID NOT NULL,
    "thread_key" TEXT,
    "type" "InboxThreadType" NOT NULL DEFAULT 'group',
    "audience" TEXT NOT NULL DEFAULT 'manager',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "scope" TEXT,
    "source_identifier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "facility_id" UUID,
    "zone_id" UUID,
    "task_instance_id" UUID,
    "latest_message_id" UUID,
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inbox_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "sender_staff_id" UUID,
    "sender_key" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "kind" "InboxMessageKind" NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_participants" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "staff_id" UUID,
    "participant_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "InboxParticipantRole" NOT NULL DEFAULT 'member',
    "notification_level" TEXT NOT NULL DEFAULT 'all',
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_read_at" TIMESTAMPTZ(6),
    "last_read_message_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inbox_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_threads_thread_key_key" ON "inbox_threads"("thread_key");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_threads_latest_message_id_key" ON "inbox_threads"("latest_message_id");

-- CreateIndex
CREATE INDEX "inbox_threads_audience_last_message_at_idx" ON "inbox_threads"("audience", "last_message_at");

-- CreateIndex
CREATE INDEX "inbox_threads_type_last_message_at_idx" ON "inbox_threads"("type", "last_message_at");

-- CreateIndex
CREATE INDEX "inbox_threads_facility_id_zone_id_idx" ON "inbox_threads"("facility_id", "zone_id");

-- CreateIndex
CREATE INDEX "inbox_messages_thread_id_created_at_idx" ON "inbox_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "inbox_messages_sender_staff_id_created_at_idx" ON "inbox_messages"("sender_staff_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_participants_thread_id_participant_key_key" ON "inbox_participants"("thread_id", "participant_key");

-- CreateIndex
CREATE INDEX "inbox_participants_staff_id_archived_at_idx" ON "inbox_participants"("staff_id", "archived_at");

-- CreateIndex
CREATE INDEX "inbox_participants_thread_id_unread_count_idx" ON "inbox_participants"("thread_id", "unread_count");

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_inbox_thread_id_fkey" FOREIGN KEY ("inbox_thread_id") REFERENCES "inbox_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_inbox_message_id_fkey" FOREIGN KEY ("inbox_message_id") REFERENCES "inbox_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_threads" ADD CONSTRAINT "inbox_threads_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_threads" ADD CONSTRAINT "inbox_threads_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_threads" ADD CONSTRAINT "inbox_threads_latest_message_id_fkey" FOREIGN KEY ("latest_message_id") REFERENCES "inbox_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "inbox_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_sender_staff_id_fkey" FOREIGN KEY ("sender_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_participants" ADD CONSTRAINT "inbox_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "inbox_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_participants" ADD CONSTRAINT "inbox_participants_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_participants" ADD CONSTRAINT "inbox_participants_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "inbox_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
