ALTER TABLE "profiles" ADD COLUMN "short_code" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "short_code_scope_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "next_short_code" integer DEFAULT 101 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_short_code_scope_uniq" ON "profiles" ("short_code_scope_id","short_code");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_short_code_scope_id_profiles_id_fkey" FOREIGN KEY ("short_code_scope_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;