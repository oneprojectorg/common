ALTER TABLE "decision_process_instances" ADD COLUMN "source_data" jsonb;

-- Backfill sourceData from existing live columns so the process builder
-- can read from it immediately after this migration runs.
UPDATE "decision_process_instances" SET "source_data" = jsonb_build_object(
  'name', "name",
  'description', "description",
  'stewardProfileId', "steward_profile_id",
  'phases', "instance_data"->'phases',
  'proposalTemplate', "instance_data"->'proposalTemplate',
  'rubricTemplate', "instance_data"->'rubricTemplate',
  'config', "instance_data"->'config'
);