ALTER TABLE "profiles" ADD COLUMN "short_code" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "short_code_scope_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "next_short_code" integer DEFAULT 101 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_short_code_scope_uniq" ON "profiles" ("short_code_scope_id","short_code") WHERE "short_code" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_short_code_scope_id_profiles_id_fkey" FOREIGN KEY ("short_code_scope_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_short_code_scope_chk" CHECK (("short_code" IS NULL) = ("short_code_scope_id" IS NULL));