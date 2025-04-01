-- This migration creates policies for the storage.objects table in the Supabase storage schema.
-- Bucket creation is handled in the migrate.ts file via the supabase.storage.createBucket() function.
-- createBucket() automatically handles the creation of storage.bucket tables.

-- When seeding, the buckets are simply emptied, rather than deleted and recreated.
-- This is done in the seed.ts file.

-- First, drop all existing policies
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname 
               FROM pg_policies 
               WHERE tablename = 'objects' 
               AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Insert access to user's folder" ON storage.objects FOR INSERT TO public
WITH CHECK (
	bucket_id = 'assets'
	AND (
		select
			auth.uid ()::text
	) = (storage.foldername (name)) [1]
);

CREATE POLICY "Select access to user's folder (req for thumbnail upsert)" ON storage.objects FOR
SELECT TO public USING (
	bucket_id = 'assets'
	AND (
		select
			auth.uid ()::text
	) = (storage.foldername (name)) [1]
);

CREATE POLICY "Update access to user's folder" ON storage.objects FOR
UPDATE TO public USING (
	bucket_id = 'assets'
	AND (
		select
			auth.uid ()::text
	) = (storage.foldername (name)) [1]
);


CREATE POLICY "Delete access to user's folder" ON storage.objects FOR DELETE TO public USING (
	bucket_id = 'assets'
	AND (
		select
			auth.uid ()::text
	) = (storage.foldername (name)) [1]
);