CREATE TABLE "decision_proposal_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "dec_proposal_attachment_unq" UNIQUE("proposal_id","attachment_id")
);
--> statement-breakpoint
ALTER TABLE "decision_proposal_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "post_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposal_attachments" ADD CONSTRAINT "decision_proposal_attachments_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_proposal_attachments" ADD CONSTRAINT "decision_proposal_attachments_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_proposal_attachments" ADD CONSTRAINT "decision_proposal_attachments_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_proposal_attachments_id_index" ON "decision_proposal_attachments" USING btree ("id");--> statement-breakpoint
CREATE INDEX "decision_proposal_attachments_proposal_id_index" ON "decision_proposal_attachments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "decision_proposal_attachments_attachment_id_index" ON "decision_proposal_attachments" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "decision_proposal_attachments_uploaded_by_index" ON "decision_proposal_attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_proposal_attachments" AS PERMISSIVE FOR ALL TO "service_role";
