-- Custom SQL migration file, put your code below! --

-- Fix: sync_user_email() joined on the wrong column. public.users.id is an
-- independently generated UUID, while new.id is the auth.users id, so
-- `where id = new.id` matched zero rows and the trigger silently never synced
-- email changes since Aug 2025. The correct join is on auth_user_id.
CREATE OR REPLACE FUNCTION public.sync_user_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $function$
begin
  update public.users
  set email = new.email,
      updated_at = new.updated_at
  where auth_user_id = new.id;
  return new;
end;
$function$;

-- Backfill rows that drifted while the trigger was dead. users.email is unique,
-- so update one row at a time and skip (with a warning) any row whose target
-- email is already taken, rather than failing the whole migration.
DO $$
DECLARE
  drifted RECORD;
BEGIN
  FOR drifted IN
    SELECT pu.id AS user_id, au.email AS auth_email
    FROM auth.users au
    JOIN public.users pu ON pu.auth_user_id = au.id
    WHERE au.email IS DISTINCT FROM pu.email
  LOOP
    BEGIN
      UPDATE public.users SET email = drifted.auth_email WHERE id = drifted.user_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE WARNING 'sync_user_email backfill skipped user % (email % already in use)',
        drifted.user_id, drifted.auth_email;
    END;
  END LOOP;
END $$;
