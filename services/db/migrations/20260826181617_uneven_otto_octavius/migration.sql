CREATE TABLE "decision_proposal_title_embeddings" (
	"proposal_id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text)
);
--> statement-breakpoint
ALTER TABLE "decision_proposal_title_embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_proposal_title_embeddings" ADD CONSTRAINT "decision_proposal_title_embeddings_kHidlp6fB3VB_fkey" FOREIGN KEY ("proposal_id") REFERENCES "decision_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposal_title_embeddings" AS PERMISSIVE FOR ALL TO "service_role";