-- Read-only. Lists decisions that have phases in instance_data.phases and no
-- phase rows. Run it before #2431 ships: it must return zero rows, because
-- after #2431 a decision with no rows cannot advance, revert or publish.
--
-- Run by hand with psql against each environment, never through migrate:
--   psql "$DATABASE_URL" -c "SET op_backfill.instance_ids = 'all'" \
--     -f services/db/data/check-missing-phase-rows.sql
--
-- op_backfill.instance_ids is required: '<uuid>,<uuid>' limits it to those
-- decisions; 'all' checks every decision.
DO $$
BEGIN
  IF nullif(btrim(current_setting('op_backfill.instance_ids', true)), '') IS NULL THEN
    RAISE EXCEPTION 'check-missing-phase-rows: op_backfill.instance_ids is required: a comma-separated uuid list, or all';
  END IF;
END $$;

WITH settings AS (
  -- NULL means every decision
  SELECT CASE
    WHEN lower(btrim(scope.text)) = 'all' THEN NULL
    ELSE string_to_array(replace(btrim(scope.text), ' ', ''), ',')::uuid[]
  END AS instance_ids
  FROM (SELECT current_setting('op_backfill.instance_ids', true) AS text) scope
)
SELECT i.id AS instance_id, blob.n AS blob_phases
FROM decision_process_instances i
CROSS JOIN settings
CROSS JOIN LATERAL (
  SELECT CASE jsonb_typeof(i.instance_data -> 'phases')
    WHEN 'array' THEN jsonb_array_length(i.instance_data -> 'phases')
    ELSE 0
  END AS n
) blob
WHERE (settings.instance_ids IS NULL OR i.id = ANY (settings.instance_ids))
  AND blob.n > 0
  AND NOT EXISTS (
    SELECT 1 FROM decision_process_phases p WHERE p.process_instance_id = i.id
  )
ORDER BY i.id;
