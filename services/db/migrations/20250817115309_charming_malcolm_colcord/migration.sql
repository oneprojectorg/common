CREATE TYPE "public"."profile_relationship_type" AS ENUM('following', 'likes');
CREATE TABLE "profile_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_profile_id" uuid NOT NULL,
	"target_profile_id" uuid NOT NULL,
	"relationship_type" "profile_relationship_type" NOT NULL,
	"pending" boolean,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_relationships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profile_relationships" ADD CONSTRAINT "profile_relationships_source_profile_id_profiles_id_fk" FOREIGN KEY ("source_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_relationships" ADD CONSTRAINT "profile_relationships_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_relationships_source_profile_id_index" ON "profile_relationships" USING btree ("source_profile_id");--> statement-breakpoint
CREATE INDEX "profile_relationships_target_profile_id_index" ON "profile_relationships" USING btree ("target_profile_id");--> statement-breakpoint
CREATE INDEX "profile_relationships_relationship_type_index" ON "profile_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "profile_relationships_source_profile_id_pending_index" ON "profile_relationships" USING btree ("source_profile_id","pending");--> statement-breakpoint
CREATE INDEX "profile_relationships_target_profile_id_pending_index" ON "profile_relationships" USING btree ("target_profile_id","pending");--> statement-breakpoint
CREATE INDEX "profile_relationships_relationship_type_pending_index" ON "profile_relationships" USING btree ("relationship_type","pending");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_relationships_source_profile_id_target_profile_id_relationship_type_index" ON "profile_relationships" USING btree ("source_profile_id","target_profile_id","relationship_type");--> statement-breakpoint
CREATE POLICY "service-role" ON "profile_relationships" AS PERMISSIVE FOR ALL TO "service_role";
