CREATE TYPE "public"."decision_process_status" AS ENUM('draft', 'active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."profile_relationship_type" AS ENUM('following', 'likes');--> statement-breakpoint
CREATE TYPE "public"."decision_proposal_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."entity_type" ADD VALUE 'proposal';--> statement-breakpoint
CREATE TABLE "decision_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"process_schema" jsonb NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_processes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"decision_data" jsonb NOT NULL,
	"decided_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decision_instances_proposal_id_decided_by_profile_id_unique" UNIQUE("proposal_id","decided_by_profile_id")
);
--> statement-breakpoint
ALTER TABLE "decision_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts_to_profiles" (
	"post_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "posts_to_profiles_post_id_profile_id_pk" PRIMARY KEY("post_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "posts_to_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_process_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"instance_data" jsonb NOT NULL,
	"current_state_id" varchar(256),
	"owner_profile_id" uuid NOT NULL,
	"status" "decision_process_status" DEFAULT 'draft',
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', "decision_process_instances"."name"), 'A') || ' ' || setweight(to_tsvector('english', COALESCE("decision_process_instances"."description", '')), 'B')::tsvector) STORED,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_process_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_categories" (
	"proposal_id" uuid NOT NULL,
	"taxonomy_term_id" uuid NOT NULL,
	CONSTRAINT "decision_categories_proposal_id_taxonomy_term_id_pk" PRIMARY KEY("proposal_id","taxonomy_term_id")
);
--> statement-breakpoint
ALTER TABLE "decision_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_instance_id" uuid NOT NULL,
	"proposal_data" jsonb NOT NULL,
	"submitted_by_profile_id" uuid NOT NULL,
	"profile_id" uuid,
	"status" "decision_proposal_status" DEFAULT 'draft',
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_transition_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_instance_id" uuid NOT NULL,
	"from_state_id" varchar(256),
	"to_state_id" varchar(256) NOT NULL,
	"transition_data" jsonb,
	"triggered_by_profile_id" uuid,
	"transitioned_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decision_transition_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_processes" ADD CONSTRAINT "decision_processes_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_instances" ADD CONSTRAINT "decision_instances_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_instances" ADD CONSTRAINT "decision_instances_decided_by_profile_id_profiles_id_fk" FOREIGN KEY ("decided_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts_to_profiles" ADD CONSTRAINT "posts_to_profiles_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_to_profiles" ADD CONSTRAINT "posts_to_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_process_instances" ADD CONSTRAINT "decision_process_instances_process_id_decision_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."decision_processes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_process_instances" ADD CONSTRAINT "decision_process_instances_owner_profile_id_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_categories" ADD CONSTRAINT "decision_categories_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_categories" ADD CONSTRAINT "decision_categories_taxonomy_term_id_taxonomyTerms_id_fk" FOREIGN KEY ("taxonomy_term_id") REFERENCES "public"."taxonomyTerms"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_process_instance_id_decision_process_instances_id_fk" FOREIGN KEY ("process_instance_id") REFERENCES "public"."decision_process_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_submitted_by_profile_id_profiles_id_fk" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_transition_history" ADD CONSTRAINT "decision_transition_history_process_instance_id_decision_process_instances_id_fk" FOREIGN KEY ("process_instance_id") REFERENCES "public"."decision_process_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_transition_history" ADD CONSTRAINT "decision_transition_history_triggered_by_profile_id_profiles_id_fk" FOREIGN KEY ("triggered_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX  "decision_processes_id_index" ON "decision_processes" USING btree ("id");--> statement-breakpoint
CREATE INDEX  "decision_processes_created_by_profile_id_index" ON "decision_processes" USING btree ("created_by_profile_id");--> statement-breakpoint
CREATE INDEX  "decision_processes_name_gin_index" ON "decision_processes" USING gin (to_tsvector('english', "name"));--> statement-breakpoint
CREATE INDEX  "decision_instances_id_index" ON "decision_instances" USING btree ("id");--> statement-breakpoint
CREATE INDEX  "decision_instances_proposal_id_index" ON "decision_instances" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX  "decision_instances_decided_by_profile_id_index" ON "decision_instances" USING btree ("decided_by_profile_id");--> statement-breakpoint
CREATE INDEX  "posts_to_profiles_post_id_idx" ON "posts_to_profiles" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX  "posts_to_profiles_profile_id_idx" ON "posts_to_profiles" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX  "decision_process_instances_id_index" ON "decision_process_instances" USING btree ("id");--> statement-breakpoint
CREATE INDEX  "decision_process_instances_process_id_index" ON "decision_process_instances" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX  "decision_process_instances_owner_profile_id_index" ON "decision_process_instances" USING btree ("owner_profile_id");--> statement-breakpoint
CREATE INDEX  "decision_process_instances_current_state_id_index" ON "decision_process_instances" USING btree ("current_state_id");--> statement-breakpoint
CREATE INDEX "process_instances_search_index" ON "decision_process_instances" USING gin ("search");--> statement-breakpoint
CREATE INDEX "decision_proposals_id_index" ON "decision_proposals" USING btree ("id");--> statement-breakpoint
CREATE INDEX "decision_proposals_process_instance_id_index" ON "decision_proposals" USING btree ("process_instance_id");--> statement-breakpoint
CREATE INDEX "decision_proposals_submitted_by_profile_id_index" ON "decision_proposals" USING btree ("submitted_by_profile_id");--> statement-breakpoint
CREATE INDEX "decision_proposals_profile_id_index" ON "decision_proposals" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "decision_proposals_status_index" ON "decision_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "decision_transition_history_id_index" ON "decision_transition_history" USING btree ("id");--> statement-breakpoint
CREATE INDEX "decision_transition_history_process_instance_id_index" ON "decision_transition_history" USING btree ("process_instance_id");--> statement-breakpoint
CREATE INDEX "decision_transition_history_to_state_id_index" ON "decision_transition_history" USING btree ("to_state_id");--> statement-breakpoint
CREATE INDEX "decision_transition_history_transitioned_at_index" ON "decision_transition_history" USING btree ("transitioned_at");--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_processes" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_instances" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "posts_to_profiles" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_process_instances" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_categories" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposals" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_transition_history" AS PERMISSIVE FOR ALL TO "service_role";
