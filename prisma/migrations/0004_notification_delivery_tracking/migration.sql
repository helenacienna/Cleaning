ALTER TABLE "notification_events"
  ADD COLUMN "channel" TEXT,
  ADD COLUMN "target" TEXT,
  ADD COLUMN "delivered_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_error" TEXT;

CREATE INDEX "notification_events_delivered_created_at_idx" ON "notification_events"("delivered", "created_at");
