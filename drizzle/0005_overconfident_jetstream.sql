CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_exceptions_creator_id_date_unique" UNIQUE("creator_id","date")
);
--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "buffer_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "min_notice_min" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "horizon_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_creator_id_creators_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("user_id") ON DELETE cascade ON UPDATE no action;