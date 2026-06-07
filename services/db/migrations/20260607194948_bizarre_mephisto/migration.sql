ALTER TABLE "decision_proposal_history" ADD COLUMN "location" geometry(point,4326);--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "location" geometry(point,4326);--> statement-breakpoint
CREATE INDEX "proposals_location_gist_idx" ON "decision_proposals" USING gist ("location");