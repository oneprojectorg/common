CREATE TABLE "conversation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"conversation_id" uuid NOT NULL,
	"run_id" uuid,
	"agent_id" text,
	"kind" varchar(16) NOT NULL,
	"role" varchar(16),
	"content" jsonb NOT NULL,
	"sms_message_id" uuid,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "conversation_items_kind_chk" CHECK ("kind" IN ('message', 'tool_call', 'tool_output', 'command')),
	CONSTRAINT "conversation_items_role_chk" CHECK ("role" IS NULL OR "role" IN ('user', 'assistant')),
	CONSTRAINT "conversation_items_message_role_chk" CHECK (("kind" = 'message') = ("role" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "conversation_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL,
	"process_instance_id" uuid,
	"phone_number_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"phone_number_id" uuid,
	"auth_user_id" uuid,
	"counterpart_e164" varchar(32),
	"direction" varchar(16) NOT NULL,
	"body" text NOT NULL,
	"provider_sid" text,
	"segments" integer,
	"status" varchar(16) DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sms_messages_direction_chk" CHECK ("direction" IN ('inbound', 'outbound')),
	CONSTRAINT "sms_messages_status_chk" CHECK ("status" IN ('received', 'queued', 'sent', 'delivered', 'failed')),
	CONSTRAINT "sms_messages_counterpart_chk" CHECK ("auth_user_id" IS NOT NULL OR "counterpart_e164" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "sms_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_chat_sessions" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
CREATE INDEX "conversation_items_conversation_created_idx" ON "conversation_items" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_profile_created_idx" ON "conversations" ("profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_chat_sessions_conversation_uniq" ON "decision_chat_sessions" ("conversation_id") WHERE "conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sms_messages_provider_sid_uniq" ON "sms_messages" ("provider_sid") WHERE "provider_sid" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sms_messages_line_created_idx" ON "sms_messages" ("phone_number_id","created_at");--> statement-breakpoint
ALTER TABLE "conversation_items" ADD CONSTRAINT "conversation_items_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_items" ADD CONSTRAINT "conversation_items_sms_message_id_sms_messages_id_fkey" FOREIGN KEY ("sms_message_id") REFERENCES "sms_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_QpIRhQ1iHQfG_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_phone_number_id_decision_phone_numbers_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "decision_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_chat_sessions" ADD CONSTRAINT "decision_chat_sessions_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_phone_number_id_decision_phone_numbers_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "decision_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "conversation_items" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "conversations" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "sms_messages" AS PERMISSIVE FOR ALL TO "service_role";