CREATE TYPE "decision_voter_enrolment_status" AS ENUM('awaiting_address', 'awaiting_agree', 'enrolled');--> statement-breakpoint
CREATE TABLE "decision_voter_enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"boundary_id" uuid,
	"status" "decision_voter_enrolment_status" DEFAULT 'awaiting_address'::"decision_voter_enrolment_status" NOT NULL,
	"attestation_hash" text,
	"attested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decision_voter_enrolments_enrolled_chk" CHECK ("status" <> 'enrolled' OR ("attestation_hash" IS NOT NULL AND "attested_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "decision_voter_enrolments_instance_profile_uniq" ON "decision_voter_enrolments" ("process_instance_id","profile_id");--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ADD CONSTRAINT "decision_voter_enrolments_PbJbomW5dZtL_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ADD CONSTRAINT "decision_voter_enrolments_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ADD CONSTRAINT "decision_voter_enrolments_u8fFQdQ5yk8k_fkey" FOREIGN KEY ("boundary_id") REFERENCES "decision_boundaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_voter_enrolments" AS PERMISSIVE FOR ALL TO "service_role";