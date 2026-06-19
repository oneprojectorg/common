CREATE TABLE "decision_boundaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"taxonomy_term_id" uuid,
	"boundary" geometry(MultiPolygon,4326) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_boundaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "decision_boundaries_name_unique" ON "decision_boundaries" (lower("name"));--> statement-breakpoint
CREATE INDEX "decision_boundaries_taxonomy_term_id_index" ON "decision_boundaries" ("taxonomy_term_id");--> statement-breakpoint
CREATE INDEX "decision_boundaries_boundary_gist_index" ON "decision_boundaries" USING gist ("boundary");--> statement-breakpoint
ALTER TABLE "decision_boundaries" ADD CONSTRAINT "decision_boundaries_taxonomy_term_id_taxonomyTerms_id_fkey" FOREIGN KEY ("taxonomy_term_id") REFERENCES "taxonomyTerms"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_boundaries" AS PERMISSIVE FOR ALL TO "service_role";