-- Run this in the Supabase SQL editor.
-- Run supabase/groups.sql first. This script configures private Storage buckets.
-- Buckets to create in Storage first:
--   - user-private
--   - group-private
-- Expected file paths:
--   - users/<user-id>/filename.ext
--   - groups/<group-id>/filename.ext

-- NOTE: Do not run ALTER TABLE on storage.objects in the SQL editor.
-- Supabase Storage owns that table and already manages RLS from the Storage UI.
-- Create policies from Storage > Policies or paste only the CREATE POLICY statements below.

DROP POLICY IF EXISTS "Users can view own private files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own private files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own private files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own private files" ON storage.objects;
DROP POLICY IF EXISTS "Group members can view group files" ON storage.objects;
DROP POLICY IF EXISTS "Group members can upload group files" ON storage.objects;
DROP POLICY IF EXISTS "Group members can update group files" ON storage.objects;
DROP POLICY IF EXISTS "Group members can delete group files" ON storage.objects;

CREATE POLICY "Users can view own private files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY "Users can upload own private files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY "Users can update own private files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY "Users can delete own private files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'users'
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY "Group members can view group files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'group-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'groups'
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "Group members can upload group files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'group-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'groups'
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "Group members can update group files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'group-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'groups'
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id::text = split_part(name, '/', 2)
  )
)
WITH CHECK (
  bucket_id = 'group-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'groups'
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "Group members can delete group files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'group-private'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = 'groups'
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id::text = split_part(name, '/', 2)
  )
);

-- Optional: if you want to validate bucket names before upload,
-- make sure the two buckets are created in Storage and are private.
