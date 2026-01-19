CREATE TABLE "decision_process_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_instance_id" uuid NOT NULL,
	"from_state_id" varchar(256),
	"to_state_id" varchar(256) NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_process_transitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_process_transitions" ADD CONSTRAINT "decision_process_transitions_process_instance_id_decision_process_instances_id_fk" FOREIGN KEY ("process_instance_id") REFERENCES "public"."decision_process_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "decision_process_transitions_id_index" ON "decision_process_transitions" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_transitions_instance_scheduled" ON "decision_process_transitions" USING btree ("process_instance_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_transitions_pending" ON "decision_process_transitions" USING btree ("scheduled_date") WHERE completed_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_transitions_state" ON "decision_process_transitions" USING btree ("process_instance_id","to_state_id");--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_process_transitions" AS PERMISSIVE FOR ALL TO "service_role";
