ALTER TABLE "decision_proposal_relationships" DROP CONSTRAINT "decision_proposal_relationships_nMbaSDZa86qq_fkey";--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" DROP CONSTRAINT "decision_proposal_relationships_qDw4vWCBfiKE_fkey";--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" DROP CONSTRAINT "proposal_relationships_no_self_link";--> statement-breakpoint
DROP INDEX "proposal_rel_source_target_type_unique";--> statement-breakpoint
DROP INDEX "proposal_rel_target_type_idx";--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD COLUMN "process_instance_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD COLUMN "source_proposal_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD COLUMN "target_proposal_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" DROP COLUMN "source_profile_id";--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" DROP COLUMN "target_profile_id";--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_rel_pair_type_unique" ON "decision_proposal_relationships" ("source_proposal_id","target_proposal_id","relationship_type") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "proposal_rel_target_proposal_type_idx" ON "decision_proposal_relationships" ("target_proposal_id","relationship_type");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_rel_instance_source_merged_unique" ON "decision_proposal_relationships" ("process_instance_id","source_proposal_id") WHERE "relationship_type" = 'merged' AND "deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD CONSTRAINT "proposal_rel_source_fkey" FOREIGN KEY ("process_instance_id","source_proposal_id") REFERENCES "decision_proposals"("process_instance_id","id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD CONSTRAINT "proposal_rel_target_fkey" FOREIGN KEY ("process_instance_id","target_proposal_id") REFERENCES "decision_proposals"("process_instance_id","id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_relationships" ADD CONSTRAINT "proposal_rel_no_self_link" CHECK ("source_proposal_id" <> "target_proposal_id");