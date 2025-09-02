CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "modules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profile_modules" (
	"profile_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"enabled_at" timestamp DEFAULT now() NOT NULL,
	"enabled_by" uuid,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "profile_modules_profile_id_module_id_pk" PRIMARY KEY("profile_id","module_id")
);
--> statement-breakpoint
ALTER TABLE "profile_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profile_modules" ADD CONSTRAINT "profile_modules_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_modules" ADD CONSTRAINT "profile_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "modules_id_index" ON "modules" USING btree ("id");--> statement-breakpoint
CREATE INDEX "modules_slug_index" ON "modules" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "modules_is_active_index" ON "modules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "profile_modules_profile_id_index" ON "profile_modules" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "profile_modules_module_id_index" ON "profile_modules" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "profile_modules_enabled_at_index" ON "profile_modules" USING btree ("enabled_at");--> statement-breakpoint
CREATE POLICY "service-role" ON "modules" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "profile_modules" AS PERMISSIVE FOR ALL TO "service_role";
