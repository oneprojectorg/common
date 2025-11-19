ALTER TYPE "public"."entity_type" ADD VALUE 'decision';--> statement-breakpoint
ALTER TABLE "decision_process_instances" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "decision_process_instances" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."decision_process_status";--> statement-breakpoint
CREATE TYPE "public"."decision_process_status" AS ENUM('draft', 'published', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "decision_process_instances" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."decision_process_status";--> statement-breakpoint
ALTER TABLE "decision_process_instances" ALTER COLUMN "status" SET DATA TYPE "public"."decision_process_status" USING "status"::"public"."decision_process_status";--> statement-breakpoint
ALTER TABLE "decision_process_instances" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "decision_process_instances" ADD CONSTRAINT "decision_process_instances_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "decision_process_instances_profile_id_index" ON "decision_process_instances" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "proposal_history_valid_during_gist" ON "decision_proposal_history" USING gist ("valid_during");
