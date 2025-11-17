-- Trigger function to automatically create proposal history on updates
-- This SQL should be added to a migration file manually

-- Drop existing trigger and function if they exist (for migration idempotency)
DROP TRIGGER IF EXISTS proposal_history_trigger ON public.decision_proposals;
DROP FUNCTION IF EXISTS public.create_proposal_history();

-- Create the trigger function
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

    -- Insert the OLD version into history table
    INSERT INTO public.decision_proposal_history (
      proposal_id,
      proposal_data,
      status,
      submitted_by_profile_id,
      profile_id,
      edited_by_profile_id,
      valid_from,
      valid_to,
      created_at
    ) VALUES (
      OLD.id,
      OLD.proposal_data,
      OLD.status,
      OLD.submitted_by_profile_id,
      OLD.profile_id,
      -- Use lastEditedByProfileId if set, otherwise fall back to submitter
      COALESCE(OLD.last_edited_by_profile_id, OLD.submitted_by_profile_id),
      OLD.updated_at,  -- When this version became valid
      NEW.updated_at,  -- When this version was superseded
      NOW()            -- When the history record was created
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER proposal_history_trigger
  BEFORE UPDATE ON public.decision_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_proposal_history();

-- Note: The trigger uses the lastEditedByProfileId field from the proposals table
-- to track who made each edit. Make sure to set this field when updating proposals.
