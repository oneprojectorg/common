CREATE TABLE "decision_proposal_history" (
	"id" uuid NOT NULL,
	"process_instance_id" uuid NOT NULL,
	"proposal_data" jsonb NOT NULL,
	"status" "decision_proposal_status" DEFAULT 'draft',
	"submitted_by_profile_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"last_edited_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"valid_during" "tstzrange" NOT NULL,
	"history_created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "last_edited_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "decision_proposal_history_process_instance_id_decision_process_instances_id_fk" FOREIGN KEY ("process_instance_id") REFERENCES "public"."decision_process_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "decision_proposal_history_submitted_by_profile_id_profiles_id_fk" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "decision_proposal_history_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "decision_proposal_history_last_edited_by_profile_id_profiles_id_fk" FOREIGN KEY ("last_edited_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "prop_hist_process_instance_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "public"."decision_process_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "prop_hist_submitted_by_fkey" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "prop_hist_profile_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "prop_hist_last_edited_by_fkey" FOREIGN KEY ("last_edited_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "decision_proposal_history_history_id_index" ON "decision_proposal_history" USING btree ("history_id");--> statement-breakpoint
CREATE INDEX "decision_proposal_history_id_index" ON "decision_proposal_history" USING btree ("id");--> statement-breakpoint
CREATE INDEX "decision_proposal_history_process_instance_id_index" ON "decision_proposal_history" USING btree ("process_instance_id");--> statement-breakpoint
CREATE INDEX "proposal_history_temporal_idx" ON "decision_proposal_history" USING btree ("id","valid_during");--> statement-breakpoint
CREATE INDEX "proposal_history_edited_by_idx" ON "decision_proposal_history" USING btree ("last_edited_by_profile_id");--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_last_edited_by_profile_id_profiles_id_fk" FOREIGN KEY ("last_edited_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "decision_proposals_last_edited_by_profile_id_index" ON "decision_proposals" USING btree ("last_edited_by_profile_id");--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposal_history" AS PERMISSIVE FOR ALL TO "service_role";

-- Trigger function to automatically create proposal history on updates
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

    -- Insert the complete OLD row into history with explicit column names
    INSERT INTO public.decision_proposal_history (
      -- Columns from proposals table
      id,
      process_instance_id,
      proposal_data,
      status,
      submitted_by_profile_id,
      profile_id,
      last_edited_by_profile_id,
      created_at,
      updated_at,
      deleted_at,
      -- History-specific columns
      history_id,
      valid_during,
      history_created_at
    )
    SELECT
      OLD.id,
      OLD.process_instance_id,
      OLD.proposal_data,
      OLD.status,
      OLD.submitted_by_profile_id,
      OLD.profile_id,
      OLD.last_edited_by_profile_id,
      OLD.created_at,
      OLD.updated_at,
      OLD.deleted_at,
      -- History-specific values
      gen_random_uuid(),                         -- history_id
      tstzrange(OLD.updated_at, NEW.updated_at), -- valid_during
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
