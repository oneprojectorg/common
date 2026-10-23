ALTER TABLE "decision_process_instances" ADD COLUMN "next_short_code" integer DEFAULT 101 NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "short_code" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_process_short_code_uniq" ON "decision_proposals" ("process_instance_id","short_code") WHERE "short_code" IS NOT NULL;