CREATE TYPE "public"."visibility" AS ENUM('visible', 'hidden');--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD COLUMN "visibility" "visibility" DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "visibility" "visibility" DEFAULT 'visible' NOT NULL;