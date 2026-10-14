ALTER TABLE "decision_process_instances" ADD COLUMN "next_sms_code" integer DEFAULT 101 NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "sms_code" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_process_sms_code_uniq" ON "decision_proposals" ("process_instance_id","sms_code");