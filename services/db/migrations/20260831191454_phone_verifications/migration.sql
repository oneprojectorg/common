CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"auth_user_id" uuid NOT NULL,
	"phone" varchar(32) NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "phone_verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "phone_verifications_auth_user_id_index" ON "phone_verifications" ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_verifications_auth_user_id_phone_idx" ON "phone_verifications" ("auth_user_id","phone");--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "phone_verifications" AS PERMISSIVE FOR ALL TO "service_role";
--> statement-breakpoint
-- Record a phone verification that GoTrue performed.
--
-- Network membership reads `phone_verifications`, and GoTrue owns the whole
-- code lifecycle, so our server never witnesses a verification. Without this
-- trigger the table would have no writer, and every phone-only account would
-- sign in and then reach nothing.
--
-- Fires on INSERT as well as UPDATE: an account created with the number already
-- confirmed (`admin.createUser({ phone_confirm: true })`) never issues an
-- UPDATE, and a returning participant who confirms later never issues an
-- INSERT. Both have to land a row.
CREATE OR REPLACE FUNCTION public.record_phone_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- An unconfirmed number is a claim rather than a credential, and a confirmed
  -- account with no number has nothing to record.
  IF new.phone_confirmed_at IS NULL OR new.phone IS NULL OR new.phone = '' THEN
    RETURN new;
  END IF;

  -- GoTrue stores the number without its leading `+`; this table holds E.164
  -- with it. A mismatch would not fail loudly — it would write a second row
  -- per account and break the audit trail rather than the sign-in.
  INSERT INTO public.phone_verifications (auth_user_id, phone, verified_at, provider)
  VALUES (
    new.id,
    CASE WHEN left(new.phone, 1) = '+' THEN new.phone ELSE '+' || new.phone END,
    new.phone_confirmed_at,
    'gotrue'
  )
  ON CONFLICT (auth_user_id, phone) DO UPDATE
    SET verified_at = EXCLUDED.verified_at,
        provider = EXCLUDED.provider,
        updated_at = (now() AT TIME ZONE 'utc'::text),
        -- Confirming again revives a row an operator soft-deleted. The read
        -- path filters `deleted_at`, so leaving it set would let a fresh
        -- verification decide nothing.
        deleted_at = NULL;

  RETURN new;
END;
$function$;
--> statement-breakpoint
-- `UPDATE OF phone_confirmed_at` narrows the fires to the column that matters.
-- The guard above still runs, because the column can be set back to NULL.
DO $$
BEGIN
  CREATE TRIGGER on_auth_phone_confirmed_record_verification
  AFTER INSERT OR UPDATE OF phone_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.record_phone_verification();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Backfill: every account that already holds a confirmed number. `ON CONFLICT`
-- makes this a no-op for a row that is already there.
INSERT INTO public.phone_verifications (auth_user_id, phone, verified_at, provider)
SELECT
  u.id,
  CASE WHEN left(u.phone, 1) = '+' THEN u.phone ELSE '+' || u.phone END,
  u.phone_confirmed_at,
  'gotrue'
FROM auth.users u
WHERE u.phone_confirmed_at IS NOT NULL
  AND u.phone IS NOT NULL
  AND u.phone <> ''
ON CONFLICT (auth_user_id, phone) DO NOTHING;
