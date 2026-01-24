CREATE TYPE "poll_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"poll_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "poll_votes_poll_user_unique" UNIQUE("poll_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "poll_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"question" varchar(500) NOT NULL,
	"options" jsonb NOT NULL,
	"status" "poll_status" DEFAULT 'open'::"poll_status" NOT NULL,
	"target_type" varchar(100) NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "polls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "poll_votes_id_index" ON "poll_votes" ("id");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_id_index" ON "poll_votes" ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_votes_user_id_index" ON "poll_votes" ("user_id");--> statement-breakpoint
CREATE INDEX "polls_id_index" ON "polls" ("id");--> statement-breakpoint
CREATE INDEX "polls_profile_id_index" ON "polls" ("profile_id");--> statement-breakpoint
CREATE INDEX "polls_created_by_id_index" ON "polls" ("created_by_id");--> statement-breakpoint
CREATE INDEX "polls_status_index" ON "polls" ("status");--> statement-breakpoint
CREATE INDEX "polls_target_idx" ON "polls" ("target_type","target_id");--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "poll_votes" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "polls" AS PERMISSIVE FOR ALL TO "service_role";