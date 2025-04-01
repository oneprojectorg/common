CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(256),
	"name" varchar(256),
	"avatar_url" text,
	"email" varchar NOT NULL,
	"about" varchar(256),
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE VIEW "public"."users_used_storage" WITH (security_invoker = false) AS (select (storage.foldername("name"))[1] as "user_id", COALESCE(SUM(("metadata"->>'size')::bigint), 0) as "total_size" from "storage"."objects" where "storage"."objects"."bucket_id" = 'assets' group by (storage.foldername("storage"."objects"."name"))[1]);--> statement-breakpoint
CREATE POLICY "service-role" ON "profiles" AS PERMISSIVE FOR ALL TO "service_role";