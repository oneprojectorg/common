CREATE TABLE "content_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"content_key" varchar(512) NOT NULL,
	"content_hash" varchar(16) NOT NULL,
	"source_locale" varchar(10) NOT NULL,
	"target_locale" varchar(10) NOT NULL,
	"translated" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_translations_lookup" ON "content_translations" ("content_key","content_hash","target_locale");--> statement-breakpoint
CREATE INDEX "idx_content_translations_key" ON "content_translations" ("content_key");--> statement-breakpoint
CREATE POLICY "service-role" ON "content_translations" AS PERMISSIVE FOR ALL TO "service_role";