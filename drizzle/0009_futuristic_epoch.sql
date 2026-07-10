ALTER TYPE "public"."instant_request_state" ADD VALUE 'awaiting_auth' BEFORE 'pending';--> statement-breakpoint
ALTER TABLE "instant_call_requests" ADD COLUMN "auth_payment_intent_id" text;