-- Gives every decision without phase rows one decision_process_phases row and
-- one PHASE profile per instance_data.phases entry, copies the template's
-- proposal form onto instance_data, and links transitions to the rows.
-- Rerunning it is a no-op. Setting op_backfill.instance_ids (a uuid[] literal)
-- limits it to those instances; tests use that, a deploy does not.
DO $$
DECLARE
  -- JS String.prototype.trim's whitespace
  v_trim CONSTANT text := '^[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$';
  v_scope uuid[] := nullif(current_setting('op_backfill.instance_ids', true), '')::uuid[];
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
  -- Rows made by the phase endpoints that leave a JSON phase without a row
  FOR v_instance IN
    SELECT i.id
    FROM decision_process_instances i
    WHERE EXISTS (
        SELECT 1 FROM decision_process_phases p WHERE p.process_instance_id = i.id
      )
      AND (v_scope IS NULL OR i.id = ANY (v_scope))
      AND CASE
        WHEN jsonb_typeof(i.instance_data -> 'phases') = 'array' THEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(i.instance_data -> 'phases') ph
          WHERE NOT EXISTS (
            SELECT 1
            FROM decision_process_phases p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE p.process_instance_id = i.id
              AND coalesce(p.data ->> 'phaseId', pr.slug) = ph ->> 'phaseId'
          )
        )
        ELSE false
      END
    ORDER BY i.created_at, i.id
  LOOP
    RAISE NOTICE 'backfill-phase-rows: skipped instance % (partial rows)', v_instance.id;
    v_skipped := v_skipped + 1;
  END LOOP;

  FOR v_instance IN
    SELECT i.id
    FROM decision_process_instances i
    WHERE NOT EXISTS (
        SELECT 1 FROM decision_process_phases p WHERE p.process_instance_id = i.id
      )
      AND (v_scope IS NULL OR i.id = ANY (v_scope))
    ORDER BY i.created_at, i.id
  LOOP
    -- lockProcessInstance: take the row lock, then re-read under it
    SELECT i.instance_data, dp.process_schema
    INTO v_data, v_process_schema
    FROM decision_process_instances i
    LEFT JOIN decision_processes dp ON dp.id = i.process_id
    WHERE i.id = v_instance.id
    FOR UPDATE OF i;

    CONTINUE WHEN NOT FOUND;

    IF EXISTS (
      SELECT 1 FROM decision_process_phases p WHERE p.process_instance_id = v_instance.id
    ) THEN
      RAISE NOTICE 'backfill-phase-rows: skipped instance % (rows appeared)', v_instance.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT CASE
      WHEN jsonb_typeof(v_data -> 'phases') IS DISTINCT FROM 'array'
        THEN 'no phases'
      WHEN jsonb_array_length(v_data -> 'phases') = 0
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
      -- assertPhaseNameFits: at most 256 code points
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
      CONTINUE;
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
      SELECT e.value AS phase, e.ordinality - 1 AS sort_order
      FROM jsonb_array_elements(v_data -> 'phases') WITH ORDINALITY e
      ORDER BY e.ordinality
    LOOP
      -- phaseRowName: the trimmed name, else the phaseId
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

      -- insertPhaseRows: sort_order is the array index, data is the phase without its name
      INSERT INTO decision_process_phases (process_instance_id, sort_order, profile_id, data)
      VALUES (v_instance.id, v_phase.sort_order, v_profile_id, v_phase.phase - 'name');
    END LOOP;

    v_backfilled := v_backfilled + 1;
  END LOOP;

  -- phaseIdOf: a row's data.phaseId, else its profile slug
  UPDATE decision_process_transitions t
  SET from_phase_id = r.id
  FROM decision_process_phases r
  JOIN profiles pr ON pr.id = r.profile_id
  WHERE t.from_phase_id IS NULL
    AND r.process_instance_id = t.process_instance_id
    AND coalesce(r.data ->> 'phaseId', pr.slug) = t.from_state_id
    AND (v_scope IS NULL OR t.process_instance_id = ANY (v_scope));

  UPDATE decision_process_transitions t
  SET to_phase_id = r.id
  FROM decision_process_phases r
  JOIN profiles pr ON pr.id = r.profile_id
  WHERE t.to_phase_id IS NULL
    AND r.process_instance_id = t.process_instance_id
    AND coalesce(r.data ->> 'phaseId', pr.slug) = t.to_state_id
    AND (v_scope IS NULL OR t.process_instance_id = ANY (v_scope));

  SELECT count(*) INTO v_unlinked
  FROM decision_process_transitions t
  WHERE (v_scope IS NULL OR t.process_instance_id = ANY (v_scope))
    AND EXISTS (
      SELECT 1 FROM decision_process_phases r WHERE r.process_instance_id = t.process_instance_id
    )
    AND (
      t.to_phase_id IS NULL
      OR (t.from_state_id IS NOT NULL AND t.from_phase_id IS NULL)
    );

  RAISE NOTICE 'backfill-phase-rows: backfilled % instances, skipped %, % transitions on instances with phase rows still have an unmatched state id',
    v_backfilled, v_skipped, v_unlinked;
END $$;
