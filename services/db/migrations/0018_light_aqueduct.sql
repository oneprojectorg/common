ALTER TYPE "public"."decision_proposal_status" ADD VALUE 'selected';--> statement-breakpoint
CREATE TABLE "decision_process_result_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_result_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"selection_rank" integer,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_process_result_selections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_process_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_instance_id" uuid NOT NULL,
	"executed_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"success" boolean NOT NULL,
	"error_message" text,
	"selected_count" integer DEFAULT 0 NOT NULL,
	"pipeline_config" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_process_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_process_result_selections" ADD CONSTRAINT "decision_process_result_selections_process_result_id_decision_process_results_id_fk" FOREIGN KEY ("process_result_id") REFERENCES "public"."decision_process_results"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_process_result_selections" ADD CONSTRAINT "decision_process_result_selections_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_process_results" ADD CONSTRAINT "decision_process_results_process_instance_id_decision_process_instances_id_fk" FOREIGN KEY ("process_instance_id") REFERENCES "public"."decision_process_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "result_selections_result_idx" ON "decision_process_result_selections" USING btree ("process_result_id");--> statement-breakpoint
CREATE INDEX "result_selections_proposal_idx" ON "decision_process_result_selections" USING btree ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_selections_unique_idx" ON "decision_process_result_selections" USING btree ("process_result_id","proposal_id");--> statement-breakpoint
CREATE INDEX "decision_process_results_id_index" ON "decision_process_results" USING btree ("id");--> statement-breakpoint
CREATE INDEX "process_results_instance_date_idx" ON "decision_process_results" USING btree ("process_instance_id","executed_at");--> statement-breakpoint
CREATE INDEX "process_results_success_date_idx" ON "decision_process_results" USING btree ("success","executed_at");--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_process_result_selections" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_process_results" AS PERMISSIVE FOR ALL TO "service_role";
