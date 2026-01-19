CREATE TYPE "public"."join_profile_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "profile_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_profile_id" uuid NOT NULL,
	"target_profile_id" uuid NOT NULL,
	"status" "join_profile_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profile_requests" ADD CONSTRAINT "profile_requests_request_profile_id_profiles_id_fk" FOREIGN KEY ("request_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_requests" ADD CONSTRAINT "profile_requests_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_requests_request_profile_id_index" ON "profile_requests" USING btree ("request_profile_id");--> statement-breakpoint
CREATE INDEX "profile_requests_target_profile_id_index" ON "profile_requests" USING btree ("target_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requestToTarget_idx" ON "profile_requests" USING btree ("request_profile_id","target_profile_id");--> statement-breakpoint
CREATE POLICY "service-role" ON "profile_requests" AS PERMISSIVE FOR ALL TO "service_role";