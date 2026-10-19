-- Run once in the Supabase SQL Editor to enable cross-account study groups.
CREATE TABLE IF NOT EXISTS public.study_groups (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-Z0-9-]{4,12}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

GRANT SELECT ON public.group_members TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_id_user_id_key
  ON public.group_members (group_id, user_id);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own group membership" ON public.group_members;
DROP POLICY IF EXISTS "Users can insert their own group membership" ON public.group_members;
DROP POLICY IF EXISTS "Users can update their own group membership" ON public.group_members;
DROP POLICY IF EXISTS "Users can delete their own group membership" ON public.group_members;

CREATE POLICY "Users can view their own group membership"
ON public.group_members FOR SELECT
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_study_group(
  p_id uuid,
  p_name text,
  p_subject text,
  p_description text,
  p_invite_code text
)
RETURNS TABLE (id uuid, name text, subject text, description text, code text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before creating a study group.';
  END IF;

  IF char_length(trim(p_name)) NOT BETWEEN 1 AND 80
    OR char_length(trim(p_subject)) NOT BETWEEN 1 AND 80
    OR char_length(coalesce(p_description, '')) > 300
    OR upper(trim(p_invite_code)) !~ '^[A-Z0-9-]{4,12}$' THEN
    RAISE EXCEPTION 'Invalid study group details.';
  END IF;

  INSERT INTO public.study_groups (id, name, subject, description, invite_code, created_by)
  VALUES (p_id, trim(p_name), trim(p_subject), coalesce(trim(p_description), ''), upper(trim(p_invite_code)), current_user_id);

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (p_id, current_user_id, 'owner');

  RETURN QUERY
  SELECT sg.id, sg.name, sg.subject, sg.description, sg.invite_code, gm.role
  FROM public.study_groups AS sg
  JOIN public.group_members AS gm ON gm.group_id = sg.id
  WHERE sg.id = p_id AND gm.user_id = current_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_study_group(p_invite_code text)
RETURNS TABLE (id uuid, name text, subject text, description text, code text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_group public.study_groups%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before joining a study group.';
  END IF;

  SELECT sg.* INTO target_group
  FROM public.study_groups AS sg
  WHERE sg.invite_code = upper(trim(coalesce(p_invite_code, '')));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No study group matches that invite code.';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (target_group.id, current_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN QUERY
  SELECT sg.id, sg.name, sg.subject, sg.description, sg.invite_code, gm.role
  FROM public.study_groups AS sg
  JOIN public.group_members AS gm ON gm.group_id = sg.id
  WHERE sg.id = target_group.id AND gm.user_id = current_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_study_groups()
RETURNS TABLE (id uuid, name text, subject text, description text, code text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT sg.id, sg.name, sg.subject, sg.description, sg.invite_code, gm.role
  FROM public.study_groups AS sg
  JOIN public.group_members AS gm ON gm.group_id = sg.id
  WHERE gm.user_id = auth.uid()
  ORDER BY sg.created_at;
$$;

CREATE OR REPLACE FUNCTION public.is_study_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.group_members AS gm
    WHERE gm.group_id = p_group_id AND gm.user_id = auth.uid()
  );
$$;

CREATE TABLE IF NOT EXISTS public.study_group_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  due date,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_group_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  content text NOT NULL DEFAULT '',
  file_name text,
  mime_type text,
  storage_bucket text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((storage_bucket IS NULL) = (storage_path IS NULL))
);

ALTER TABLE public.study_group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_group_notes TO authenticated;

DROP POLICY IF EXISTS "Group members can read shared tasks" ON public.study_group_tasks;
DROP POLICY IF EXISTS "Group members can create shared tasks" ON public.study_group_tasks;
DROP POLICY IF EXISTS "Group members can update shared tasks" ON public.study_group_tasks;
DROP POLICY IF EXISTS "Group members can delete shared tasks" ON public.study_group_tasks;
DROP POLICY IF EXISTS "Group members can read shared notes" ON public.study_group_notes;
DROP POLICY IF EXISTS "Group members can create shared notes" ON public.study_group_notes;
DROP POLICY IF EXISTS "Group members can update shared notes" ON public.study_group_notes;
DROP POLICY IF EXISTS "Group members can delete shared notes" ON public.study_group_notes;

CREATE POLICY "Group members can read shared tasks"
ON public.study_group_tasks FOR SELECT
USING (public.is_study_group_member(group_id));

CREATE POLICY "Group members can create shared tasks"
ON public.study_group_tasks FOR INSERT
WITH CHECK (created_by = auth.uid() AND public.is_study_group_member(group_id));

CREATE POLICY "Group members can update shared tasks"
ON public.study_group_tasks FOR UPDATE
USING (public.is_study_group_member(group_id))
WITH CHECK (public.is_study_group_member(group_id));

CREATE POLICY "Group members can delete shared tasks"
ON public.study_group_tasks FOR DELETE
USING (public.is_study_group_member(group_id));

CREATE POLICY "Group members can read shared notes"
ON public.study_group_notes FOR SELECT
USING (public.is_study_group_member(group_id));

CREATE POLICY "Group members can create shared notes"
ON public.study_group_notes FOR INSERT
WITH CHECK (created_by = auth.uid() AND public.is_study_group_member(group_id));

CREATE POLICY "Group members can update shared notes"
ON public.study_group_notes FOR UPDATE
USING (public.is_study_group_member(group_id))
WITH CHECK (public.is_study_group_member(group_id));

CREATE POLICY "Group members can delete shared notes"
ON public.study_group_notes FOR DELETE
USING (public.is_study_group_member(group_id));

REVOKE ALL ON FUNCTION public.create_study_group(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_study_group(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_study_groups() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_study_group_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_study_group(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_study_group(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_study_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_study_group_member(uuid) TO authenticated;
