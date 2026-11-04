-- Removes the phases key from instance_data on every decision that has phase
-- rows. A decision with no rows keeps it, as it is the only copy.
--
-- Run it only in release 4, after the app no longer falls back to reading
-- instance_data.phases. Run check-phase-drift.sql with
-- op_backfill.drift_kind = 'no_rows' first and confirm it returns zero rows.
--
-- Run by hand with psql against each environment, never through migrate:
--   psql "$DATABASE_URL" -f services/db/data/strip-blob-phases.sql
--
-- op_backfill.instance_ids = '<uuid>,<uuid>' limits it to those decisions.
UPDATE decision_process_instances i
SET instance_data = i.instance_data - 'phases'
WHERE i.instance_data ? 'phases'
  AND EXISTS (
    SELECT 1 FROM decision_process_phases p WHERE p.process_instance_id = i.id
  )
  AND (
    nullif(btrim(current_setting('op_backfill.instance_ids', true)), '') IS NULL
    OR i.id = ANY (string_to_array(
      replace(nullif(btrim(current_setting('op_backfill.instance_ids', true)), ''), ' ', ''), ','
    )::uuid[])
  );
