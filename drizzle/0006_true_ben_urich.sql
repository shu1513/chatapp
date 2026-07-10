CREATE TYPE "public"."booking_kind" AS ENUM('scheduled', 'instant');--> statement-breakpoint
CREATE TYPE "public"."instant_request_state" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "instant_call_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"state" "instant_request_state" DEFAULT 'pending' NOT NULL,
	"booking_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "kind" "booking_kind" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "instant_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "instant_call_requests" ADD CONSTRAINT "instant_call_requests_creator_id_creators_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instant_call_requests" ADD CONSTRAINT "instant_call_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instant_call_requests" ADD CONSTRAINT "instant_call_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;