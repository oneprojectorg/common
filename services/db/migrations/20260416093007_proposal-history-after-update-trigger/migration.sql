-- Switch proposal_history_trigger from BEFORE UPDATE to AFTER UPDATE
-- so history captures the NEW (post-update) row instead of OLD (pre-update).
--
-- Why: the BEFORE UPDATE trigger recorded OLD values, so after submitting a
-- proposal (draft → submitted) the latest history row still showed "draft".
-- advancePhase then linked a draft snapshot to the transition.

DROP TRIGGER IF EXISTS proposal_history_trigger ON public.decision_proposals;
DROP FUNCTION IF EXISTS public.create_proposal_history();

CREATE OR REPLACE FUNCTION public.create_proposal_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only create history if actual data changed (not just updatedAt)
  IF (OLD.proposal_data IS DISTINCT FROM NEW.proposal_data) OR
     (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Close the previous open-ended history record
    UPDATE public.decision_proposal_history
    SET valid_during = tstzrange(lower(valid_during), now())
    WHERE id = NEW.id
      AND upper(valid_during) IS NULL;

    -- Snapshot the NEW (post-update) row
    INSERT INTO public.decision_proposal_history (
      id,
      process_instance_id,
      proposal_data,
      status,
      visibility,
      submitted_by_profile_id,
      profile_id,
      last_edited_by_profile_id,
      created_at,
      updated_at,
      deleted_at,
      history_id,
      valid_during,
      history_created_at
    )
    SELECT
      NEW.id,
      NEW.process_instance_id,
      NEW.proposal_data,
      NEW.status,
      NEW.visibility,
      NEW.submitted_by_profile_id,
      NEW.profile_id,
      NEW.last_edited_by_profile_id,
      NEW.created_at,
      NEW.updated_at,
      NEW.deleted_at,
      gen_random_uuid(),
      tstzrange(now(), NULL),
      NOW();
  END IF;

  RETURN NULL; -- return value is ignored for AFTER triggers
END;
$function$;

CREATE TRIGGER proposal_history_trigger
  AFTER UPDATE ON public.decision_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_proposal_history();
