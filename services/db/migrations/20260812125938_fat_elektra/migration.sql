CREATE TYPE "decision_proposal_relationship_type" AS ENUM('merged');--> statement-breakpoint
ALTER TYPE "decision_proposal_status" ADD VALUE 'merged';--> statement-breakpoint
CREATE TABLE "decision_proposal_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source_profile_id" uuid NOT NULL,
	"target_profile_id" uuid NOT NULL,
	"relationship_type" "decision_proposal_relationship_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "proposal_relationships_no_self_link" CHECK ("source_profile_id" <> "target_profile_id")
);
--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_rel_source_target_type_unique" ON "decision_proposal_relationships" ("source_profile_id","target_profile_id","relationship_type") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "proposal_rel_target_type_idx" ON "decision_proposal_relationships" ("target_profile_id","relationship_type");--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD CONSTRAINT "decision_proposal_relationships_nMbaSDZa86qq_fkey" FOREIGN KEY ("source_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD CONSTRAINT "decision_proposal_relationships_qDw4vWCBfiKE_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposal_relationships" AS PERMISSIVE FOR ALL TO "service_role";