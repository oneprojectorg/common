ALTER TABLE "profile_invites" ADD COLUMN "invitee_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "profile_users" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "profile_invites_invitee_profile_idx" ON "profile_invites" ("invitee_profile_id");--> statement-breakpoint
ALTER TABLE "profile_invites" ADD CONSTRAINT "profile_invites_invitee_profile_id_profiles_id_fkey" FOREIGN KEY ("invitee_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;