CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"outbox_id" uuid NOT NULL,
	"event_name" varchar(255) NOT NULL,
	"actor_profile_id" uuid,
	"organization_id" uuid,
	"process_instance_id" uuid,
	"proposal_id" uuid,
	"post_id" uuid,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_name" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "event_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"notification_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"provider_message_id" varchar(255),
	"status" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"activity_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(255) NOT NULL,
	"action_required" boolean DEFAULT false NOT NULL,
	"seen_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "posts_to_organizations_org_id_created_at_post_id_idx";--> statement-breakpoint
CREATE INDEX "posts_to_organizations_org_id_created_at_post_id_idx" ON "posts_to_organizations" ("organization_id","created_at" DESC,"post_id" DESC);--> statement-breakpoint
DROP INDEX "posts_to_profiles_profile_id_created_at_post_id_idx";--> statement-breakpoint
CREATE INDEX "posts_to_profiles_profile_id_created_at_post_id_idx" ON "posts_to_profiles" ("profile_id","created_at" DESC,"post_id" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "activities_outbox_id_idx" ON "activities" ("outbox_id");--> statement-breakpoint
CREATE INDEX "activities_organization_id_created_at_id_idx" ON "activities" ("organization_id","created_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX "activities_process_instance_id_created_at_id_idx" ON "activities" ("process_instance_id","created_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX "activities_proposal_id_created_at_id_idx" ON "activities" ("proposal_id","created_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX "activities_post_id_created_at_id_idx" ON "activities" ("post_id","created_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX "activities_actor_profile_id_idx" ON "activities" ("actor_profile_id");--> statement-breakpoint
CREATE INDEX "event_outbox_unsent_created_at_idx" ON "event_outbox" ("created_at") WHERE sent_at IS NULL;--> statement-breakpoint
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries" ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_provider_message_id_idx" ON "notification_deliveries" ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_activity_id_user_id_idx" ON "notifications" ("activity_id","user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications" ("user_id","created_at" DESC,"id" DESC);--> statement-breakpoint
CREATE INDEX "notifications_user_id_unread_idx" ON "notifications" ("user_id") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_id_needs_action_idx" ON "notifications" ("user_id") WHERE action_required AND read_at IS NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_profile_id_profiles_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_tRCCNWABay1d_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_proposal_id_decision_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "decision_proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_activity_id_activities_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "activities" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "event_outbox" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "notification_deliveries" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "notifications" AS PERMISSIVE FOR ALL TO "service_role";