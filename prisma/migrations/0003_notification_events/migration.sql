CREATE TABLE "notification_events" (
  "id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "tone" TEXT NOT NULL,
  "note" TEXT,
  "delivered" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_events_scope_identifier_key" ON "notification_events"("scope", "identifier");
CREATE INDEX "notification_events_created_at_idx" ON "notification_events"("created_at");
