DROP INDEX "proposals_process_short_code_uniq";--> statement-breakpoint
ALTER TABLE "decision_process_instances" DROP COLUMN "next_short_code";--> statement-breakpoint
ALTER TABLE "decision_proposals" DROP COLUMN "short_code";