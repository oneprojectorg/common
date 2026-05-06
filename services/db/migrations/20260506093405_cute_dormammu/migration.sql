ALTER TABLE "decision_proposal_history" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "location_id" uuid;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "decision_proposals_location_id_index" ON "decision_proposals" ("location_id");--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "decision_proposal_history_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

-- Update proposal_history_trigger to include location_id column
DROP TRIGGER IF EXISTS proposal_history_trigger ON public.decision_proposals;
DROP FUNCTION IF EXISTS public.create_proposal_history();

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
     (OLD.location_id IS DISTINCT FROM NEW.location_id) THEN

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
      location_id,
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
      NEW.location_id,
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