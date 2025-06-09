-- Custom SQL migration file, put you code below! --
CREATE
OR REPLACE FUNCTION public.create_user_on_signup () 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $function$
BEGIN
  insert into public.users (id, email, created_at, updated_at)
  values (new.id, new.email, new.created_at, new.updated_at);
  return new;
END;
$function$;

DO $$ 
BEGIN
  CREATE TRIGGER on_auth_signup_create_user
  AFTER INSERT ON auth.users 
  FOR EACH ROW
  EXECUTE FUNCTION create_user_on_signup();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
