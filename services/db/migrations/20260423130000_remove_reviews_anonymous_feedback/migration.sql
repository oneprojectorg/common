UPDATE "decision_process_instances"
SET "instance_data" = jsonb_set(
  "instance_data",
  '{config}',
  ("instance_data"->'config') - 'reviewsAnonymousFeedback'
)
WHERE jsonb_typeof("instance_data"->'config') = 'object'
  AND ("instance_data"->'config') ? 'reviewsAnonymousFeedback';
--> statement-breakpoint
UPDATE "decision_processes"
SET "process_schema" = jsonb_set(
  "process_schema",
  '{config}',
  ("process_schema"->'config') - 'reviewsAnonymousFeedback'
)
WHERE jsonb_typeof("process_schema"->'config') = 'object'
  AND ("process_schema"->'config') ? 'reviewsAnonymousFeedback';
