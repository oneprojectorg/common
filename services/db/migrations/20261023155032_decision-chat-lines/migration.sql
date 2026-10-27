CREATE TABLE "decision_chat_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decision_chat_lines_phone_number_e164_chk" CHECK ("phone_number" ~ '^\+[1-9][0-9]{1,14}$')
);
--> statement-breakpoint
ALTER TABLE "decision_chat_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "decision_chat_lines_process_instance_id_uniq" ON "decision_chat_lines" ("process_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_chat_lines_phone_number_uniq" ON "decision_chat_lines" ("phone_number");--> statement-breakpoint
ALTER TABLE "decision_chat_lines" ADD CONSTRAINT "decision_chat_lines_AoyC2gocHOlr_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_chat_lines" AS PERMISSIVE FOR ALL TO "service_role";