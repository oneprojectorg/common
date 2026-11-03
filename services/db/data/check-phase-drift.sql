-- Read-only. Lists decisions whose phase rows are out of step with
-- instance_data.phases. Zero rows means every decision is in step.
--
-- Run by hand with psql against each environment, never through migrate:
--   psql "$DATABASE_URL" -f services/db/data/check-phase-drift.sql
--
-- A row's phase id is data->>'phaseId', else its profile slug (phaseIdOf).
-- kind:
--   no_rows  the decision has blob phases and no phase rows
--   partial  the decision has rows, and a blob phase id has no row
--            (backfill-phase-rows.sql skips these)
--   drift    every blob phase id has a row, and a row has no blob phase id
-- missing_rows holds the blob phase ids with no row; extra_rows holds the
-- row phase ids with no blob phase.
--
-- To limit it to some decisions, set this first in the same session:
--   SET op_backfill.instance_ids = '<uuid>,<uuid>';
SELECT *
FROM (
  SELECT
    i.id AS instance_id,
    CASE
      WHEN phase_rows.n = 0 THEN 'no_rows'
      WHEN cardinality(diff.missing_rows) > 0 THEN 'partial'
      ELSE 'drift'
    END AS kind,
    blob.n AS blob_phases,
    phase_rows.n AS row_phases,
    diff.missing_rows,
    diff.extra_rows
  FROM decision_process_instances i
  CROSS JOIN LATERAL (
    SELECT
      count(*)::int AS n,
      coalesce(array_agg(e.phase ->> 'phaseId' ORDER BY e.ord), '{}') AS ids
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(i.instance_data -> 'phases') = 'array'
          THEN i.instance_data -> 'phases'
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY e (phase, ord)
  ) blob
  CROSS JOIN LATERAL (
    SELECT
      count(*)::int AS n,
      coalesce(
        array_agg(coalesce(p.data ->> 'phaseId', pr.slug) ORDER BY p.sort_order),
        '{}'
      ) AS ids
    FROM decision_process_phases p
    JOIN profiles pr ON pr.id = p.profile_id
    WHERE p.process_instance_id = i.id
  ) phase_rows
  CROSS JOIN LATERAL (
    SELECT
      ARRAY(
        SELECT unnest(blob.ids) EXCEPT SELECT unnest(phase_rows.ids) ORDER BY 1
      ) AS missing_rows,
      ARRAY(
        SELECT unnest(phase_rows.ids) EXCEPT SELECT unnest(blob.ids) ORDER BY 1
      ) AS extra_rows
  ) diff
  WHERE (
      nullif(current_setting('op_backfill.instance_ids', true), '') IS NULL
      OR i.id = ANY (string_to_array(
        replace(current_setting('op_backfill.instance_ids', true), ' ', ''), ','
      )::uuid[])
    )
    AND (blob.n > 0 OR phase_rows.n > 0)
) checked
WHERE kind = 'no_rows'
  OR cardinality(missing_rows) > 0
  OR cardinality(extra_rows) > 0
ORDER BY instance_id;
