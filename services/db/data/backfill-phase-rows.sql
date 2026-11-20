-- Backfill decision_process_phases from instance_data.phases.
--
-- Run by hand with psql against each environment, never through migrate:
--   psql "$DATABASE_URL" -c "SET op_backfill.instance_ids = '<uuid>,<uuid>'" \
--     -f services/db/data/backfill-phase-rows.sql
--
-- Run it once per environment, only when both #2429 (reads phase rows) and
-- #2430 (writes phase rows) are live there. Before #2430 the app writes only
-- instance_data.phases, so an edit to a backfilled decision never reaches its
-- rows. Run it on one decision first, then with 'all'.
--
-- For each decision with no phase rows, it:
--   - adds one PHASE profile and one decision_process_phases row per
--     instance_data.phases entry, in array order
--   - copies the process's proposalTemplate onto instance_data when the
--     decision has none
-- It then links decision_process_transitions.from_phase_id / to_phase_id to
-- the rows by phase id. Those columns come from PR #2410; apply it first.
--
-- Each decision is locked FOR UPDATE, re-read, filled and committed on its
-- own, so a builder save waits for one decision only. COMMIT needs the DO
-- outside a transaction block: do not use psql -1, BEGIN, or one -c string
-- that holds both the SET and this file. If a decision fails, the run stops;
-- the decisions before it stay committed and a re-run continues.
-- It skips decisions that already have rows, so a re-run is a no-op for them.
-- It skips, with a NOTICE, a decision whose phases fail validation.
--
-- Settings, read once at the start. Use a session SET, not SET LOCAL:
--   op_backfill.instance_ids  required. '<uuid>,<uuid>' limits the run to
--                             those decisions; 'all' runs on every decision.
--                             Unset or blank stops the run before any write.
-- check-missing-phase-rows.sql and strip-blob-phases.sql read instance_ids too.
DO $$
DECLARE
  -- JS String.prototype.trim's whitespace
  v_trim CONSTANT text := '^[\u0009-\u000d    -     　﻿]+|[\u0009-\u000d    -     　﻿]+$';
  v_scope_text text := nullif(btrim(current_setting('op_backfill.instance_ids', true)), '');
  -- NULL means every decision
  v_scope uuid[] := CASE
    WHEN lower(v_scope_text) = 'all' THEN NULL
    ELSE string_to_array(replace(v_scope_text, ' ', ''), ',')::uuid[]
  END;
  v_instance record;
  v_phase record;
  v_data jsonb;
  v_process_schema jsonb;
  v_reason text;
  v_name text;
  v_profile_id uuid;
  v_backfilled integer := 0;
  v_skipped integer := 0;
  v_unlinked integer;
BEGIN
  IF v_scope_text IS NULL THEN
    RAISE EXCEPTION 'backfill-phase-rows: op_backfill.instance_ids is required: a comma-separated uuid list, or all';
  END IF;

  -- Session-only helpers. They are made here, not above the DO, because a
  -- multi-statement query string runs as one transaction and COMMIT then fails.

  -- instance_data.phases if it is an array, else an empty array
  CREATE OR REPLACE FUNCTION pg_temp.blob_phases(p_instance_data jsonb)
  RETURNS jsonb LANGUAGE sql IMMUTABLE
  AS $fn$
    SELECT CASE jsonb_typeof(p_instance_data -> 'phases')
      WHEN 'array' THEN p_instance_data -> 'phases'
      ELSE '[]'::jsonb
    END
  $fn$;

  -- phaseIdOf: the row whose data.phaseId, else profile slug, is p_phase_id
  CREATE OR REPLACE FUNCTION pg_temp.phase_row_id(p_instance_id uuid, p_phase_id text)
  RETURNS uuid LANGUAGE sql STABLE
  AS $fn$
    SELECT p.id
    FROM decision_process_phases p
    JOIN profiles pr ON pr.id = p.profile_id
    WHERE p.process_instance_id = p_instance_id
      AND coalesce(p.data ->> 'phaseId', pr.slug) = p_phase_id
    LIMIT 1
  $fn$;

  FOR v_instance IN
    SELECT i.id
    FROM decision_process_instances i
    WHERE (v_scope IS NULL OR i.id = ANY (v_scope))
      AND NOT EXISTS (
        SELECT 1 FROM decision_process_phases p WHERE p.process_instance_id = i.id
      )
    ORDER BY i.created_at, i.id
  LOOP
    <<one_instance>>
    BEGIN
      -- lockProcessInstance: take the row lock, then re-read under it
      SELECT i.instance_data, dp.process_schema
      INTO v_data, v_process_schema
      FROM decision_process_instances i
      LEFT JOIN decision_processes dp ON dp.id = i.process_id
      WHERE i.id = v_instance.id
      FOR UPDATE OF i;

      EXIT one_instance WHEN NOT FOUND;

      -- A builder save may have added rows since the loop query
      EXIT one_instance WHEN EXISTS (
        SELECT 1 FROM decision_process_phases p WHERE p.process_instance_id = v_instance.id
      );

      SELECT CASE
        WHEN jsonb_array_length(pg_temp.blob_phases(v_data)) = 0
          THEN 'no phases'
        -- MAX_PHASES_PER_DECISION
        WHEN jsonb_array_length(v_data -> 'phases') > 30
          THEN 'more than 30 phases'
        WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_data -> 'phases') ph
            WHERE jsonb_typeof(ph -> 'phaseId') IS DISTINCT FROM 'string'
              OR ph ->> 'phaseId' = ''
          )
          THEN 'missing phaseId'
        WHEN (
            SELECT count(DISTINCT ph ->> 'phaseId') <> count(*)
            FROM jsonb_array_elements(v_data -> 'phases') ph
          )
          THEN 'duplicate phaseId'
        WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_data -> 'phases') ph
            WHERE jsonb_typeof(ph -> 'name') NOT IN ('string', 'null')
          )
          THEN 'name is not a string'
        -- assertPhasesCanBeMinted: at most MAX_PHASE_NAME_LENGTH (256) characters
        WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_data -> 'phases') ph
            WHERE char_length(coalesce(
              nullif(regexp_replace(ph ->> 'name', v_trim, '', 'g'), ''),
              ph ->> 'phaseId'
            )) > 256
          )
          THEN 'name over 256 characters'
      END
      INTO v_reason;

      IF v_reason IS NOT NULL THEN
        RAISE NOTICE 'backfill-phase-rows: skipped instance % (%)', v_instance.id, v_reason;
        v_skipped := v_skipped + 1;
        EXIT one_instance;
      END IF;

      IF coalesce(jsonb_typeof(v_data -> 'proposalTemplate'), 'null') = 'null'
        AND jsonb_typeof(v_process_schema -> 'proposalTemplate') = 'object' THEN
        UPDATE decision_process_instances
        SET instance_data = jsonb_set(
          instance_data, '{proposalTemplate}', v_process_schema -> 'proposalTemplate'
        )
        WHERE id = v_instance.id;
      END IF;

      FOR v_phase IN
        SELECT e.value AS phase, (e.ordinality - 1)::integer AS sort_order
        FROM jsonb_array_elements(v_data -> 'phases') WITH ORDINALITY e
      LOOP
        -- getPhaseProfileName: the trimmed name, else the phaseId
        v_name := coalesce(
          nullif(regexp_replace(v_phase.phase ->> 'name', v_trim, '', 'g'), ''),
          v_phase.phase ->> 'phaseId'
        );

        -- insertPhaseProfile: a PHASE profile with that name and an 8-hex-char
        -- slug (randomUUID().slice(0, 8)), retried on a slug clash, 3 attempts
        v_profile_id := NULL;
        FOR attempt IN 1..3 LOOP
          INSERT INTO profiles (entity_type, name, slug)
          VALUES ('phase', v_name, left(gen_random_uuid()::text, 8))
          ON CONFLICT (slug) DO NOTHING
          RETURNING id INTO v_profile_id;
          EXIT WHEN v_profile_id IS NOT NULL;
        END LOOP;

        IF v_profile_id IS NULL THEN
          RAISE EXCEPTION 'backfill-phase-rows: no free phase profile slug for instance %', v_instance.id;
        END IF;

        -- insertPhase: sort_order is the array index, data is the phase without its name
        INSERT INTO decision_process_phases (process_instance_id, sort_order, profile_id, data)
        VALUES (v_instance.id, v_phase.sort_order, v_profile_id, v_phase.phase - 'name');
      END LOOP;

      v_backfilled := v_backfilled + 1;
    END;

    COMMIT;
  END LOOP;

  -- Link each unlinked transition and count the ones still unmatched after
  WITH linked AS (
    UPDATE decision_process_transitions t
    SET
      from_phase_id = coalesce(
        t.from_phase_id, pg_temp.phase_row_id(t.process_instance_id, t.from_state_id)
      ),
      to_phase_id = coalesce(
        t.to_phase_id, pg_temp.phase_row_id(t.process_instance_id, t.to_state_id)
      )
    WHERE (v_scope IS NULL OR t.process_instance_id = ANY (v_scope))
      AND EXISTS (
        SELECT 1 FROM decision_process_phases r WHERE r.process_instance_id = t.process_instance_id
      )
      AND (
        t.to_phase_id IS NULL
        OR (t.from_state_id IS NOT NULL AND t.from_phase_id IS NULL)
      )
    RETURNING t.from_state_id, t.from_phase_id, t.to_phase_id
  )
  SELECT count(*) INTO v_unlinked
  FROM linked l
  WHERE l.to_phase_id IS NULL
    OR (l.from_state_id IS NOT NULL AND l.from_phase_id IS NULL);

  RAISE NOTICE 'backfill-phase-rows: backfilled % instances, skipped %, % transitions on instances with phase rows still have an unmatched state id',
    v_backfilled, v_skipped, v_unlinked;
END $$;
