-- Sequential anonymous display names: "Participant 1", "Participant 2", ...
-- A dedicated sequence gives us a unique, monotonically increasing number per
-- anonymous signup. nextval() is atomic/concurrency-safe; it may skip values on
-- rollback, which is acceptable here (uniqueness is guaranteed, gaps are not).
CREATE SEQUENCE IF NOT EXISTS public.anonymous_user_seq AS bigint START WITH 1;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.create_user_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_profile_id uuid;
  new_profile_user_id uuid;
  base_slug text;
  final_slug text;
  slug_counter integer := 0;
  existing_user_id uuid;
  existing_profile_id uuid;
  display_name text;
BEGIN
  -- Insert user with ON CONFLICT to handle race conditions. NULL emails
  -- (anonymous users) are distinct under the unique index, so anonymous
  -- signups always take the INSERT path.
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

  -- Slug: derive from email username when present, otherwise fall back to
  -- an auth-id-prefixed handle so anonymous users still get a unique slug.
  base_slug := COALESCE(
    NULLIF(lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '-', 'g')), ''),
    'anon-' || substring(new.id::text, 1, 8)
  );
  final_slug := base_slug;

  -- Ensure slug is unique by appending counter if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = final_slug) LOOP
    slug_counter := slug_counter + 1;
    final_slug := base_slug || '-' || slug_counter;
  END LOOP;

  -- Display name: prefer app-provided display_name in raw_user_meta_data,
  -- then email local-part. Anonymous users with neither get a sequential
  -- "Participant N" handle so each is distinguishable in the UI.
  display_name := COALESCE(
    NULLIF(new.raw_user_meta_data->>'display_name', ''),
    NULLIF(split_part(new.email, '@', 1), ''),
    CASE
      WHEN new.is_anonymous THEN 'Participant ' || nextval('public.anonymous_user_seq')
      ELSE 'User'
    END
  );

  -- Create individual profile
  INSERT INTO public.profiles (entity_type, name, slug, created_at, updated_at)
  VALUES (
    'individual'::public.entity_type,
    display_name,
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

  -- Create profileUser as owner of the individual profile
  INSERT INTO public.profile_users (auth_user_id, email, is_owner, profile_id, created_at, updated_at)
  VALUES (new.id, new.email, true, new_profile_id, new.created_at, new.updated_at)
  RETURNING id INTO new_profile_user_id;

  -- Assign the global Admin role to the profileUser
  INSERT INTO public."profileUser_to_access_roles" (profile_user_id, access_role_id, created_at, updated_at)
  SELECT new_profile_user_id, id, new.created_at, new.updated_at
  FROM public.access_roles
  WHERE name = 'Admin' AND profile_id IS NULL
  LIMIT 1;

  RETURN new;
END;
$function$;
