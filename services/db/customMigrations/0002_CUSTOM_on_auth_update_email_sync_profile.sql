-- Custom SQL migration file, put you code below! --
CREATE
OR REPLACE FUNCTION public.sync_profile_email () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$begin
  update public.profiles
  set email = new.email,
      updated_at = new.updated_at
  where id = new.id;
  return new;
end;$function$;

DO $$ BEGIN
  CREATE TRIGGER on_auth_update_email_sync_profile
  AFTER
  UPDATE OF email ON auth.users FOR EACH ROW
  EXECUTE FUNCTION sync_profile_email ();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;