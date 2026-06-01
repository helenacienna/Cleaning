ALTER TABLE "notification_events"
  ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'manager',
  ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "read_at" TIMESTAMPTZ(6);

CREATE INDEX "notification_events_audience_is_read_created_at_idx" ON "notification_events"("audience", "is_read", "created_at");
