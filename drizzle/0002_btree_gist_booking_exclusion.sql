CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- A creator can never have two overlapping bookings that are still "live".
-- Declined/cancelled/refunded bookings free the slot.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("creator_id" WITH =, "slot" WITH &&)
  WHERE (status NOT IN ('declined', 'cancelled', 'refunded'));
--> statement-breakpoint
-- Sanity bounds for availability rules
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_weekday_check"
  CHECK (weekday BETWEEN 0 AND 6);
--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_window_check"
  CHECK (start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute);
