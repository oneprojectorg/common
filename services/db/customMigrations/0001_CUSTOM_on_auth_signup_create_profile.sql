-- Custom SQL migration file, put you code below! --
CREATE
OR REPLACE FUNCTION public.create_profile_on_signup () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$begin
  insert into public.profiles (id, email, created_at, updated_at)
  values (new.id, new.email, new.created_at, new.updated_at);
  return new;
end;$function$;

DO $$ BEGIN
  CREATE TRIGGER on_auth_signup_create_profile
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION create_profile_on_signup();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;