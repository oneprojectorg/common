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
BEGIN
  -- Insert user with ON CONFLICT to handle race conditions
  INSERT INTO public.users (auth_user_id, email, created_at, updated_at)
  VALUES (new.id, new.email, new.created_at, new.updated_at)
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        updated_at = EXCLUDED.updated_at
  RETURNING id, profile_id INTO existing_user_id, existing_profile_id;

  -- If user already has a profile, we're done
  IF existing_profile_id IS NOT NULL THEN
    RETURN new;
  END IF;

  -- Generate base slug from email username
  base_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '-', 'g'));
  final_slug := base_slug;

  -- Ensure slug is unique by appending counter if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = final_slug) LOOP
    slug_counter := slug_counter + 1;
    final_slug := base_slug || '-' || slug_counter;
  END LOOP;

  -- Create individual profile
  INSERT INTO public.profiles (entity_type, name, slug, created_at, updated_at)
  VALUES (
    'individual'::public.entity_type,
    COALESCE(split_part(new.email, '@', 1), 'User'),
    final_slug,
    new.created_at,
    new.updated_at
  )
  RETURNING id INTO new_profile_id;

  -- Link profile to user
  UPDATE public.users
  SET profile_id = new_profile_id,
      current_profile_id = new_profile_id
  WHERE auth_user_id = new.id;

  RETURN new;
END;
$function$;
