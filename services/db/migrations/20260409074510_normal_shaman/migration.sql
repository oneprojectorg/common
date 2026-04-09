ALTER TABLE "decision_process_instances" ADD COLUMN "source_data" jsonb;

-- Backfill sourceData by copying the entire instanceData blob plus the
-- instance-column fields (name, description, stewardProfileId). Copies
-- the full blob rather than cherry-picking fields to avoid null vs
-- undefined mismatches in the Zod encoder. Extra runtime fields
-- (currentPhaseId, stateData, etc.) are harmless — promoteSourceToLive
-- only reads the fields it needs, and autosave will overwrite sourceData
-- with only editor-controlled fields going forward.
UPDATE "decision_process_instances" SET "source_data" =
  "instance_data" || jsonb_build_object(
    'name', "name",
    'description', "description",
    'stewardProfileId', "steward_profile_id"
  );