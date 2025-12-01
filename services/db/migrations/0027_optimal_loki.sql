CREATE TABLE "joinProfileRequests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_profile_id" uuid,
	"target_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "joinProfileRequests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "joinProfileRequests" ADD CONSTRAINT "joinProfileRequests_request_profile_id_profiles_id_fk" FOREIGN KEY ("request_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joinProfileRequests" ADD CONSTRAINT "joinProfileRequests_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "joinProfileRequests_request_profile_id_index" ON "joinProfileRequests" USING btree ("request_profile_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "joinProfileRequests_target_profile_id_index" ON "joinProfileRequests" USING btree ("target_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "requestToTarget_idx" ON "joinProfileRequests" USING btree ("request_profile_id","target_profile_id");--> statement-breakpoint
CREATE POLICY "service-role" ON "joinProfileRequests" AS PERMISSIVE FOR ALL TO "service_role";