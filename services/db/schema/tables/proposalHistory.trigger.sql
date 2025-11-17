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

    -- Insert the complete OLD row into history using SELECT OLD.*
    -- This automatically copies all columns from the proposals table
    INSERT INTO public.decision_proposal_history
    SELECT
      OLD.*,                                     -- All columns from proposals table
      gen_random_uuid(),                         -- history_id (new unique ID)
      tstzrange(OLD.updated_at, NEW.updated_at), -- valid_during (temporal range)
      NOW();                                     -- history_created_at
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER proposal_history_trigger
  BEFORE UPDATE ON public.decision_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_proposal_history();

-- Note: This trigger uses SELECT OLD.* to copy the entire row from proposals
-- into the history table. When you add or remove columns from the proposals table,
-- ensure you also update the history table structure to match.
--
-- The history table includes ALL columns from proposals, plus three additional columns:
-- - history_id: Unique identifier for this history record
-- - valid_during: Temporal range showing when this version was valid
-- - history_created_at: When this history record was created
