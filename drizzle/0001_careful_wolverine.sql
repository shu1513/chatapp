CREATE TYPE "public"."booking_status" AS ENUM('pending_approval', 'confirmed', 'completed', 'declined', 'cancelled', 'refunded', 'no_show_customer', 'no_show_creator');--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"slot" "tstzrange" NOT NULL,
	"status" "booking_status" NOT NULL,
	"price_cents" integer NOT NULL,
	"payment_intent_id" text,
	"room_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_creator_id_creators_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_creator_id_creators_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;