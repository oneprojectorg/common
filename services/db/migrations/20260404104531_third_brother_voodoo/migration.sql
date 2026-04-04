CREATE TYPE "decision_proposal_review_assignment_status" AS ENUM('pending', 'in_progress', 'awaiting_author_revision', 'ready_for_re_review', 'completed');--> statement-breakpoint
CREATE TYPE "decision_proposal_review_request_state" AS ENUM('requested', 'resubmitted', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TYPE "decision_proposal_review_state" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TABLE "decision_proposal_review_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"reviewer_profile_id" uuid NOT NULL,
	"phase_id" varchar(256) NOT NULL,
	"assigned_proposal_history_id" uuid,
	"status" "decision_proposal_review_assignment_status" DEFAULT 'pending'::"decision_proposal_review_assignment_status" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "proposal_review_assignments_unique" UNIQUE("process_instance_id","proposal_id","reviewer_profile_id","phase_id")
);
--> statement-breakpoint
ALTER TABLE "decision_proposal_review_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_proposal_review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"assignment_id" uuid NOT NULL,
	"state" "decision_proposal_review_request_state" DEFAULT 'requested'::"decision_proposal_review_request_state" NOT NULL,
	"request_comment" text NOT NULL,
	"requested_proposal_history_id" uuid,
	"responded_proposal_history_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now(),
	"responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_proposal_review_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_proposal_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"assignment_id" uuid NOT NULL CONSTRAINT "proposal_reviews_assignment_unique" UNIQUE,
	"state" "decision_proposal_review_state" DEFAULT 'draft'::"decision_proposal_review_state" NOT NULL,
	"review_data" jsonb NOT NULL,
	"overall_comment" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_proposal_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "proposal_review_assignments_process_idx" ON "decision_proposal_review_assignments" ("process_instance_id");--> statement-breakpoint
CREATE INDEX "proposal_review_assignments_proposal_idx" ON "decision_proposal_review_assignments" ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_review_assignments_reviewer_status_idx" ON "decision_proposal_review_assignments" ("reviewer_profile_id","status");--> statement-breakpoint
CREATE INDEX "proposal_review_requests_assignment_idx" ON "decision_proposal_review_requests" ("assignment_id");--> statement-breakpoint
CREATE INDEX "proposal_review_requests_process_state_idx" ON "decision_proposal_review_requests" ("state");--> statement-breakpoint
CREATE INDEX "proposal_reviews_process_state_idx" ON "decision_proposal_reviews" ("state");--> statement-breakpoint
ALTER TABLE "decision_proposal_review_assignments" ADD CONSTRAINT "decision_proposal_review_assignments_UzmQtlvx9amH_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_review_assignments" ADD CONSTRAINT "decision_proposal_review_assignments_dUw7cbZnVY9n_fkey" FOREIGN KEY ("proposal_id") REFERENCES "decision_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_review_assignments" ADD CONSTRAINT "decision_proposal_review_assignments_Kh0XhKrLWfOa_fkey" FOREIGN KEY ("reviewer_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_review_assignments" ADD CONSTRAINT "proposal_review_assignments_assigned_history_fkey" FOREIGN KEY ("process_instance_id","proposal_id","assigned_proposal_history_id") REFERENCES "decision_proposal_history"("process_instance_id","id","history_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_review_requests" ADD CONSTRAINT "decision_proposal_review_requests_F9cAdsDbCl19_fkey" FOREIGN KEY ("assignment_id") REFERENCES "decision_proposal_review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_review_requests" ADD CONSTRAINT "proposal_review_requests_requested_history_fkey" FOREIGN KEY ("requested_proposal_history_id") REFERENCES "decision_proposal_history"("history_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_review_requests" ADD CONSTRAINT "proposal_review_requests_responded_history_fkey" FOREIGN KEY ("responded_proposal_history_id") REFERENCES "decision_proposal_history"("history_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposal_reviews" ADD CONSTRAINT "decision_proposal_reviews_h6ugwYZ5rEL1_fkey" FOREIGN KEY ("assignment_id") REFERENCES "decision_proposal_review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposal_review_assignments" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposal_review_requests" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposal_reviews" AS PERMISSIVE FOR ALL TO "service_role";