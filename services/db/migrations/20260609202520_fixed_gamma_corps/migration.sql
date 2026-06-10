DROP INDEX "moderation_submissions_item_idx";--> statement-breakpoint
ALTER TABLE "moderation_submissions" ADD COLUMN "round_id" uuid NOT NULL;