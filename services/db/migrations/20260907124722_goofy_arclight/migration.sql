CREATE TABLE "form_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"parent_id" uuid,
	"schema" jsonb NOT NULL,
	"schema_hash" text GENERATED ALWAYS AS (md5(schema::text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	CONSTRAINT "form_schemas_parent_hash_unique" UNIQUE NULLS NOT DISTINCT("parent_id","schema_hash")
);
--> statement-breakpoint
ALTER TABLE "form_schemas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_proposal_reviews" ADD COLUMN "form_schema_id" uuid;--> statement-breakpoint
CREATE INDEX "proposal_reviews_form_schema_idx" ON "decision_proposal_reviews" ("form_schema_id");--> statement-breakpoint
CREATE INDEX "proposal_reviews_answers_gin" ON "decision_proposal_reviews" USING gin (("review_data" -> 'answers') jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "proposals_data_gin" ON "decision_proposals" USING gin ("proposal_data" jsonb_path_ops);--> statement-breakpoint
ALTER TABLE "form_schemas" ADD CONSTRAINT "form_schemas_parent_id_form_schemas_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "form_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "form_schemas" ADD CONSTRAINT "form_schemas_created_by_profile_id_profiles_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_reviews" ADD CONSTRAINT "decision_proposal_reviews_form_schema_id_form_schemas_id_fkey" FOREIGN KEY ("form_schema_id") REFERENCES "form_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "form_schemas" AS PERMISSIVE FOR ALL TO "service_role";