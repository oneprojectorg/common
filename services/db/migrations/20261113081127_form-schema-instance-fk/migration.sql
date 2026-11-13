ALTER TABLE "decision_form_schemas" ADD CONSTRAINT "form_schemas_process_instance_uniq" UNIQUE("process_instance_id","id");--> statement-breakpoint
ALTER TABLE "decision_proposals" DROP CONSTRAINT "decision_proposals_form_schema_id_decision_form_schemas_id_fkey";--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "proposals_form_schema_fkey" FOREIGN KEY ("process_instance_id","form_schema_id") REFERENCES "decision_form_schemas"("process_instance_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
