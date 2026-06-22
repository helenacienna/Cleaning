ALTER TABLE "staff"
  ADD COLUMN "preferred_time_window" "TimeWindow",
  ADD COLUMN "preferred_shift_label" TEXT,
  ADD COLUMN "availability_notes" TEXT,
  ADD COLUMN "weekly_availability" JSONB;
