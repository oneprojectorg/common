-- The auth trigger inserts new.email into public.users (NOT NULL UNIQUE).
-- Supabase anonymous sign-ins (signInAnonymously()) create auth.users rows
-- with email = NULL, which breaks the trigger and surfaces as
-- "Database error creating anonymous user" to the client.
--
-- Synthesise a per-id placeholder when the email is missing. Real users
-- are unaffected (COALESCE returns new.email when non-null).
CREATE OR REPLACE FUNCTION public.create_user_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_profile_id uuid;
  base_slug text;
  final_slug text;
  slug_counter integer := 0;
  existing_user_id uuid;
  existing_profile_id uuid;
  effective_email text;
BEGIN
  effective_email := COALESCE(new.email, 'anon-' || new.id::text || '@public.local');

  INSERT INTO public.users (auth_user_id, email, created_at, updated_at)
  VALUES (new.id, effective_email, new.created_at, new.updated_at)
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        updated_at = EXCLUDED.updated_at
  RETURNING id, profile_id INTO existing_user_id, existing_profile_id;

  IF existing_profile_id IS NOT NULL THEN
    RETURN new;
  END IF;

  base_slug := lower(regexp_replace(split_part(effective_email, '@', 1), '[^a-zA-Z0-9]', '-', 'g'));
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = final_slug) LOOP
    slug_counter := slug_counter + 1;
    final_slug := base_slug || '-' || slug_counter;
  END LOOP;

  INSERT INTO public.profiles (entity_type, name, slug, created_at, updated_at)
  VALUES (
    'individual'::public.entity_type,
    COALESCE(split_part(effective_email, '@', 1), 'User'),
    final_slug,
    new.created_at,
    new.updated_at
  )
  RETURNING id INTO new_profile_id;

  UPDATE public.users
  SET profile_id = new_profile_id,
      current_profile_id = new_profile_id
  WHERE auth_user_id = new.id;

  RETURN new;
END;
$function$;
