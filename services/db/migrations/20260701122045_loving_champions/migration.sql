ALTER TABLE "decision_proposal_history" ADD COLUMN "moderation_detached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "moderation_detached_at" timestamp with time zone;--> statement-breakpoint

-- Refresh the proposal_history_trigger so history snapshots capture the new
-- moderation_detached_at column. Without this, a CSAM detach (which sets
-- moderation_detached_at) would not open a new history row on its own.

DROP TRIGGER IF EXISTS proposal_history_trigger ON public.decision_proposals;--> statement-breakpoint
DROP FUNCTION IF EXISTS public.create_proposal_history();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.create_proposal_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF (OLD.proposal_data IS DISTINCT FROM NEW.proposal_data) OR
     (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD.visibility IS DISTINCT FROM NEW.visibility) OR
     (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) OR
     (OLD.moderation_detached_at IS DISTINCT FROM NEW.moderation_detached_at) THEN

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
      moderation_detached_at,
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
      NEW.moderation_detached_at,
      gen_random_uuid(),
      tstzrange(now(), NULL),
      NOW();
  END IF;

  RETURN NULL; -- return value is ignored for AFTER triggers
END;
$function$;--> statement-breakpoint

CREATE TRIGGER proposal_history_trigger
  AFTER UPDATE ON public.decision_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_proposal_history();
