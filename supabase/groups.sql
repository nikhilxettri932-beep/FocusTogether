-- Run or re-run this idempotent script in the Supabase SQL Editor to enable shared study features.
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
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_group_tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

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

CREATE TABLE IF NOT EXISTS public.study_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 2000),
  is_announcement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_group_messages_group_created_idx
  ON public.study_group_messages (group_id, created_at);

ALTER TABLE public.study_group_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.study_group_messages TO authenticated;

DROP POLICY IF EXISTS "Group members can read chat messages" ON public.study_group_messages;
DROP POLICY IF EXISTS "Group members can send chat messages" ON public.study_group_messages;

CREATE POLICY "Group members can read chat messages"
ON public.study_group_messages FOR SELECT TO authenticated
USING (public.is_study_group_member(group_id));

CREATE POLICY "Group members can send chat messages"
ON public.study_group_messages FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_study_group_member(group_id)
  AND (
    NOT is_announcement
    OR EXISTS (
      SELECT 1
      FROM public.group_members AS membership
      WHERE membership.group_id = study_group_messages.group_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'owner'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.study_group_timers (
  group_id uuid PRIMARY KEY REFERENCES public.study_groups(id) ON DELETE CASCADE,
  remaining_seconds integer NOT NULL DEFAULT 1500 CHECK (remaining_seconds BETWEEN 0 AND 1500),
  is_running boolean NOT NULL DEFAULT false,
  is_break boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_running OR started_at IS NOT NULL)
);

ALTER TABLE public.study_group_timers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.study_group_timers TO authenticated;

DROP POLICY IF EXISTS "Group members can read shared timer" ON public.study_group_timers;
DROP POLICY IF EXISTS "Group members can create shared timer" ON public.study_group_timers;
DROP POLICY IF EXISTS "Group members can update shared timer" ON public.study_group_timers;

CREATE POLICY "Group members can read shared timer"
ON public.study_group_timers FOR SELECT TO authenticated
USING (public.is_study_group_member(group_id));

CREATE OR REPLACE FUNCTION public.set_study_group_timer(
  p_group_id uuid,
  p_remaining_seconds integer,
  p_is_running boolean,
  p_is_break boolean
)
RETURNS TABLE (remaining_seconds integer, is_running boolean, is_break boolean, started_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_study_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Join this study group before using its shared timer.';
  END IF;
  IF p_remaining_seconds NOT BETWEEN 0 AND 1500 THEN
    RAISE EXCEPTION 'The shared timer value is out of range.';
  END IF;

  INSERT INTO public.study_group_timers AS timer (
    group_id, remaining_seconds, is_running, is_break, started_at, updated_by, updated_at
  )
  VALUES (
    p_group_id, p_remaining_seconds, p_is_running, p_is_break,
    CASE WHEN p_is_running THEN now() ELSE NULL END, auth.uid(), now()
  )
  ON CONFLICT (group_id) DO UPDATE SET
    remaining_seconds = excluded.remaining_seconds,
    is_running = excluded.is_running,
    is_break = excluded.is_break,
    started_at = excluded.started_at,
    updated_by = excluded.updated_by,
    updated_at = now();

  RETURN QUERY
  SELECT timer.remaining_seconds, timer.is_running, timer.is_break, timer.started_at
  FROM public.study_group_timers AS timer
  WHERE timer.group_id = p_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_study_group_timer(uuid, integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_study_group_timer(uuid, integer, boolean, boolean) TO authenticated;

CREATE TABLE IF NOT EXISTS public.study_group_whiteboard_strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points jsonb NOT NULL CHECK (
    jsonb_typeof(points) = 'array'
    AND jsonb_array_length(points) BETWEEN 1 AND 2000
  ),
  color text NOT NULL DEFAULT '#5144d3' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  width integer NOT NULL DEFAULT 3 CHECK (width BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_group_whiteboard_strokes_group_created_idx
  ON public.study_group_whiteboard_strokes (group_id, created_at);

ALTER TABLE public.study_group_whiteboard_strokes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.study_group_whiteboard_strokes TO authenticated;

DROP POLICY IF EXISTS "Group members can read whiteboard strokes" ON public.study_group_whiteboard_strokes;
DROP POLICY IF EXISTS "Group members can draw whiteboard strokes" ON public.study_group_whiteboard_strokes;
DROP POLICY IF EXISTS "Group owners can clear whiteboards" ON public.study_group_whiteboard_strokes;

CREATE POLICY "Group members can read whiteboard strokes"
ON public.study_group_whiteboard_strokes FOR SELECT TO authenticated
USING (public.is_study_group_member(group_id));

CREATE POLICY "Group members can draw whiteboard strokes"
ON public.study_group_whiteboard_strokes FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_study_group_member(group_id)
);

CREATE POLICY "Group owners can clear whiteboards"
ON public.study_group_whiteboard_strokes FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members AS membership
    WHERE membership.group_id = study_group_whiteboard_strokes.group_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'owner'
  )
);

REVOKE ALL ON FUNCTION public.create_study_group(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_study_group(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_study_groups() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_study_group_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_study_group(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_study_group(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_study_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_study_group_member(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.study_group_file_settings (
  group_id uuid PRIMARY KEY REFERENCES public.study_groups(id) ON DELETE CASCADE,
  members_can_upload boolean NOT NULL DEFAULT true,
  members_can_view_files boolean NOT NULL DEFAULT true,
  members_can_delete_files boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_group_file_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_study_group_files(p_group_id uuid, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.group_members AS membership
    LEFT JOIN public.study_group_file_settings AS settings ON settings.group_id = membership.group_id
    WHERE membership.group_id = p_group_id
      AND membership.user_id = auth.uid()
      AND (
        membership.role = 'owner'
        OR CASE p_action
          WHEN 'upload' THEN coalesce(settings.members_can_upload, true)
          WHEN 'view' THEN coalesce(settings.members_can_view_files, true)
          WHEN 'delete' THEN coalesce(settings.members_can_delete_files, true)
          ELSE false
        END
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_study_group_management(p_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  role text,
  joined_at timestamptz,
  members_can_upload boolean,
  members_can_view_files boolean,
  members_can_delete_files boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members AS owner_members
    WHERE owner_members.group_id = p_group_id
      AND owner_members.user_id = auth.uid()
      AND owner_members.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the group owner can manage this study group.';
  END IF;

  RETURN QUERY
  SELECT
    membership.user_id,
    coalesce(profile.display_name, 'Study friend'),
    membership.role,
    NULL::timestamptz,
    coalesce(settings.members_can_upload, true),
    coalesce(settings.members_can_view_files, true),
    coalesce(settings.members_can_delete_files, true)
  FROM public.group_members AS membership
  LEFT JOIN public.study_member_profiles AS profile ON profile.user_id = membership.user_id
  LEFT JOIN public.study_group_file_settings AS settings ON settings.group_id = membership.group_id
  WHERE membership.group_id = p_group_id
  ORDER BY membership.role, coalesce(profile.display_name, 'Study friend');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_study_group_file_permissions(
  p_group_id uuid,
  p_members_can_upload boolean,
  p_members_can_view_files boolean,
  p_members_can_delete_files boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the group owner can change file permissions.';
  END IF;

  INSERT INTO public.study_group_file_settings (
    group_id, members_can_upload, members_can_view_files, members_can_delete_files, updated_at
  )
  VALUES (
    p_group_id, p_members_can_upload, p_members_can_view_files, p_members_can_delete_files, now()
  )
  ON CONFLICT (group_id) DO UPDATE SET
    members_can_upload = excluded.members_can_upload,
    members_can_view_files = excluded.members_can_view_files,
    members_can_delete_files = excluded.members_can_delete_files,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_study_group_member(p_group_id uuid, p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the group owner can remove members.';
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = p_group_id AND user_id = p_member_id AND role = 'member';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That member could not be removed.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_study_group_files(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_study_group_management(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_study_group_file_permissions(uuid, boolean, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_study_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_study_group_files(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_study_group_management(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_study_group_file_permissions(uuid, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_study_group_member(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Group members can read shared notes" ON public.study_group_notes;
DROP POLICY IF EXISTS "Group members can create shared notes" ON public.study_group_notes;
DROP POLICY IF EXISTS "Group members can update shared notes" ON public.study_group_notes;
DROP POLICY IF EXISTS "Group members can delete shared notes" ON public.study_group_notes;

CREATE POLICY "Group members can read shared notes"
ON public.study_group_notes FOR SELECT
USING (
  public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'view'))
);

CREATE POLICY "Group members can create shared notes"
ON public.study_group_notes FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'upload'))
);

CREATE POLICY "Group members can update shared notes"
ON public.study_group_notes FOR UPDATE
USING (
  public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'delete'))
)
WITH CHECK (
  public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'upload'))
);

CREATE POLICY "Group members can delete shared notes"
ON public.study_group_notes FOR DELETE
USING (
  public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'delete'))
);

CREATE TABLE IF NOT EXISTS public.study_member_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 40),
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 160),
  friend_uid text NOT NULL DEFAULT ('FT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  profile_photo text CHECK (profile_photo IS NULL OR (profile_photo LIKE 'data:image/jpeg;base64,%' AND char_length(profile_photo) <= 400000)),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_member_profiles
  ADD COLUMN IF NOT EXISTS friend_uid text,
  ADD COLUMN IF NOT EXISTS profile_photo text,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';

UPDATE public.study_member_profiles
SET friend_uid = 'FT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
WHERE friend_uid IS NULL;

ALTER TABLE public.study_member_profiles
  ALTER COLUMN friend_uid SET DEFAULT ('FT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  ALTER COLUMN friend_uid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS study_member_profiles_friend_uid_key
ON public.study_member_profiles (friend_uid);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.study_member_profiles'::regclass
      AND conname = 'study_member_profiles_friend_uid_format_check'
  ) THEN
    ALTER TABLE public.study_member_profiles
      ADD CONSTRAINT study_member_profiles_friend_uid_format_check
      CHECK (friend_uid ~ '^FT-[A-F0-9]{12}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.study_member_profiles'::regclass
      AND conname = 'study_member_profiles_profile_photo_check'
  ) THEN
    ALTER TABLE public.study_member_profiles
      ADD CONSTRAINT study_member_profiles_profile_photo_check
      CHECK (profile_photo IS NULL OR (profile_photo LIKE 'data:image/jpeg;base64,%' AND char_length(profile_photo) <= 400000));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.study_member_profiles'::regclass
      AND conname = 'study_member_profiles_bio_check'
  ) THEN
    ALTER TABLE public.study_member_profiles
      ADD CONSTRAINT study_member_profiles_bio_check
      CHECK (char_length(bio) <= 160);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.keep_study_member_friend_uid_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.friend_uid := OLD.friend_uid;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_study_member_friend_uid_immutable() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS study_member_profiles_friend_uid_immutable ON public.study_member_profiles;
CREATE TRIGGER study_member_profiles_friend_uid_immutable
BEFORE UPDATE ON public.study_member_profiles
FOR EACH ROW
EXECUTE FUNCTION public.keep_study_member_friend_uid_immutable();

ALTER TABLE public.study_member_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.study_member_profiles TO authenticated;

DROP POLICY IF EXISTS "Study group friends can view display names" ON public.study_member_profiles;
DROP POLICY IF EXISTS "Users can view their own study profile" ON public.study_member_profiles;
DROP POLICY IF EXISTS "Users can create their own study profile" ON public.study_member_profiles;
DROP POLICY IF EXISTS "Users can update their own study profile" ON public.study_member_profiles;

CREATE POLICY "Users can view their own study profile"
ON public.study_member_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own study profile"
ON public.study_member_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own study profile"
ON public.study_member_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP FUNCTION IF EXISTS public.get_my_study_friends();

CREATE OR REPLACE FUNCTION public.get_my_study_friends()
RETURNS TABLE (user_id uuid, display_name text, group_id uuid, group_name text, friend_uid text, profile_photo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    friend.user_id,
    coalesce(profile.display_name, 'Study friend'),
    study_group.id,
    study_group.name,
    profile.friend_uid,
    profile.profile_photo
  FROM public.group_members AS viewer
  JOIN public.group_members AS friend ON friend.group_id = viewer.group_id
  JOIN public.study_groups AS study_group ON study_group.id = friend.group_id
  LEFT JOIN public.study_member_profiles AS profile ON profile.user_id = friend.user_id
  WHERE viewer.user_id = auth.uid()
    AND friend.user_id <> auth.uid()
  ORDER BY study_group.name, coalesce(profile.display_name, 'Study friend');
$$;

REVOKE ALL ON FUNCTION public.get_my_study_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_study_friends() TO authenticated;

CREATE TABLE IF NOT EXISTS public.study_friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_friend_requests_not_self CHECK (sender_id <> receiver_id),
  CONSTRAINT study_friend_requests_unique_pair UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS study_friend_requests_incoming_pending_idx
ON public.study_friend_requests (receiver_id, created_at DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS study_friend_requests_sender_status_idx
ON public.study_friend_requests (sender_id, status);

ALTER TABLE public.study_friend_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_friend_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_study_friend(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.study_friend_requests AS request
    WHERE request.status = 'accepted'
      AND ((request.sender_id = auth.uid() AND request.receiver_id = p_other_user_id)
        OR (request.receiver_id = auth.uid() AND request.sender_id = p_other_user_id))
  );
$$;

DROP FUNCTION IF EXISTS public.search_study_user(text);

CREATE OR REPLACE FUNCTION public.search_study_user(p_friend_uid text)
RETURNS TABLE (friend_uid text, display_name text, profile_photo text, relationship text, request_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    profile.friend_uid,
    profile.display_name,
    profile.profile_photo,
    CASE
      WHEN public.is_study_friend(profile.user_id) THEN 'friends'
      WHEN EXISTS (
        SELECT 1 FROM public.study_friend_requests AS request
        WHERE request.sender_id = auth.uid() AND request.receiver_id = profile.user_id AND request.status = 'pending'
      ) THEN 'sent'
      WHEN EXISTS (
        SELECT 1 FROM public.study_friend_requests AS request
        WHERE request.receiver_id = auth.uid() AND request.sender_id = profile.user_id AND request.status = 'pending'
      ) THEN 'received'
      ELSE 'none'
    END,
    (
      SELECT request.id FROM public.study_friend_requests AS request
      WHERE request.sender_id = profile.user_id
        AND request.receiver_id = auth.uid()
        AND request.status = 'pending'
      LIMIT 1
    )
  FROM public.study_member_profiles AS profile
  WHERE auth.uid() IS NOT NULL
    AND upper(profile.friend_uid) = upper(trim(p_friend_uid))
    AND profile.user_id <> auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_study_friends()
RETURNS TABLE (user_id uuid, friend_uid text, display_name text, profile_photo text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    profile.user_id,
    profile.friend_uid,
    profile.display_name,
    profile.profile_photo,
    request.created_at
  FROM public.study_friend_requests AS request
  JOIN public.study_member_profiles AS profile
    ON profile.user_id = CASE
      WHEN request.sender_id = auth.uid() THEN request.receiver_id
      ELSE request.sender_id
    END
  WHERE auth.uid() IS NOT NULL
    AND request.status = 'accepted'
    AND (request.sender_id = auth.uid() OR request.receiver_id = auth.uid())
  ORDER BY profile.display_name;
$$;

CREATE OR REPLACE FUNCTION public.get_incoming_study_friend_requests()
RETURNS TABLE (request_id uuid, user_id uuid, friend_uid text, display_name text, profile_photo text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT request.id, profile.user_id, profile.friend_uid, profile.display_name, profile.profile_photo, request.created_at
  FROM public.study_friend_requests AS request
  JOIN public.study_member_profiles AS profile ON profile.user_id = request.sender_id
  WHERE auth.uid() IS NOT NULL
    AND request.receiver_id = auth.uid()
    AND request.status = 'pending'
  ORDER BY request.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.send_study_friend_request(p_friend_uid text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to add a friend.';
  END IF;

  SELECT profile.user_id INTO target_user_id
  FROM public.study_member_profiles AS profile
  WHERE upper(profile.friend_uid) = upper(trim(p_friend_uid));

  IF target_user_id IS NULL OR target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No other account found for that friend UID.';
  END IF;

  IF public.is_study_friend(target_user_id) THEN
    RETURN 'friends';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_friend_requests AS request
    WHERE request.sender_id = target_user_id AND request.receiver_id = auth.uid() AND request.status = 'pending'
  ) THEN
    RETURN 'received';
  END IF;

  INSERT INTO public.study_friend_requests (sender_id, receiver_id, status, created_at)
  VALUES (auth.uid(), target_user_id, 'pending', now())
  ON CONFLICT (sender_id, receiver_id)
  DO UPDATE SET status = 'pending', created_at = now();

  RETURN 'sent';
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_study_friend_request(p_request_id uuid, p_accept boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to respond to a friend request.';
  END IF;

  UPDATE public.study_friend_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END
  WHERE id = p_request_id
    AND receiver_id = auth.uid()
    AND status = 'pending';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 1 AND p_accept THEN
    DELETE FROM public.study_friend_requests AS request
    WHERE request.receiver_id = (
      SELECT accepted.sender_id
      FROM public.study_friend_requests AS accepted
      WHERE accepted.id = p_request_id
    )
      AND request.sender_id = auth.uid()
      AND request.status = 'pending';
  END IF;
  RETURN affected_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.is_study_friend(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_study_user(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_study_friends() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_incoming_study_friend_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_study_friend_request(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_study_friend_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_study_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_study_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_study_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_incoming_study_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_study_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_study_friend_request(uuid, boolean) TO authenticated;

CREATE TABLE IF NOT EXISTS public.study_daily_goals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal_minutes integer NOT NULL DEFAULT 60 CHECK (daily_goal_minutes BETWEEN 1 AND 600),
  weekly_goal_minutes integer NOT NULL DEFAULT 420 CHECK (weekly_goal_minutes BETWEEN 1 AND 4200),
  daily_goal_text text NOT NULL DEFAULT '' CHECK (char_length(daily_goal_text) <= 200),
  daily_goal_date date NOT NULL DEFAULT current_date,
  daily_goal_completed boolean NOT NULL DEFAULT false,
  weekly_goal_text text NOT NULL DEFAULT '' CHECK (char_length(weekly_goal_text) <= 200),
  weekly_goal_week_start date NOT NULL DEFAULT date_trunc('week', current_date)::date,
  weekly_goal_completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_daily_goals
  ADD COLUMN IF NOT EXISTS weekly_goal_minutes integer NOT NULL DEFAULT 420
  CHECK (weekly_goal_minutes BETWEEN 1 AND 4200);

ALTER TABLE public.study_daily_goals
  ADD COLUMN IF NOT EXISTS daily_goal_text text NOT NULL DEFAULT '' CHECK (char_length(daily_goal_text) <= 200),
  ADD COLUMN IF NOT EXISTS daily_goal_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS daily_goal_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_goal_text text NOT NULL DEFAULT '' CHECK (char_length(weekly_goal_text) <= 200),
  ADD COLUMN IF NOT EXISTS weekly_goal_week_start date NOT NULL DEFAULT date_trunc('week', current_date)::date,
  ADD COLUMN IF NOT EXISTS weekly_goal_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.study_daily_goals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.study_daily_goals TO authenticated;

DROP POLICY IF EXISTS "Users can read their own daily goal" ON public.study_daily_goals;
DROP POLICY IF EXISTS "Users can create their own daily goal" ON public.study_daily_goals;
DROP POLICY IF EXISTS "Users can update their own daily goal" ON public.study_daily_goals;

CREATE POLICY "Users can read their own daily goal"
ON public.study_daily_goals FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own daily goal"
ON public.study_daily_goals FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own daily goal"
ON public.study_daily_goals FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.study_focus_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 180),
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_focus_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.study_focus_history TO authenticated;

DROP POLICY IF EXISTS "Users can read their own focus history" ON public.study_focus_history;
DROP POLICY IF EXISTS "Users can add their own focus history" ON public.study_focus_history;
DROP POLICY IF EXISTS "Users can update their own focus history" ON public.study_focus_history;

CREATE POLICY "Users can read their own focus history"
ON public.study_focus_history FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can add their own focus history"
ON public.study_focus_history FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own focus history"
ON public.study_focus_history FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Study group members can read presence" ON realtime.messages;
DROP POLICY IF EXISTS "Study group members can publish presence" ON realtime.messages;

CREATE POLICY "Study group members can read presence"
ON realtime.messages FOR SELECT TO authenticated
USING (CASE
  WHEN realtime.topic() ~ '^study-presence:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN public.is_study_group_member(split_part(realtime.topic(), ':', 2)::uuid)
  ELSE false
END);

CREATE POLICY "Study group members can publish presence"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (CASE
  WHEN realtime.topic() ~ '^study-presence:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN public.is_study_group_member(split_part(realtime.topic(), ':', 2)::uuid)
  ELSE false
END);

DROP POLICY IF EXISTS "Accepted friends can read friend presence" ON realtime.messages;
DROP POLICY IF EXISTS "Accepted friends can publish friend presence" ON realtime.messages;

CREATE POLICY "Accepted friends can read friend presence"
ON realtime.messages FOR SELECT TO authenticated
USING (CASE
  WHEN realtime.topic() ~ '^study-friend-presence:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN (
      (auth.uid() = split_part(realtime.topic(), ':', 2)::uuid AND public.is_study_friend(split_part(realtime.topic(), ':', 3)::uuid))
      OR (auth.uid() = split_part(realtime.topic(), ':', 3)::uuid AND public.is_study_friend(split_part(realtime.topic(), ':', 2)::uuid))
    )
  ELSE false
END);

CREATE POLICY "Accepted friends can publish friend presence"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (CASE
  WHEN realtime.topic() ~ '^study-friend-presence:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN (
      (auth.uid() = split_part(realtime.topic(), ':', 2)::uuid AND public.is_study_friend(split_part(realtime.topic(), ':', 3)::uuid))
      OR (auth.uid() = split_part(realtime.topic(), ':', 3)::uuid AND public.is_study_friend(split_part(realtime.topic(), ':', 2)::uuid))
    )
  ELSE false
END);

CREATE TABLE IF NOT EXISTS public.study_group_resource_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, name)
);

ALTER TABLE public.study_group_notes
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.study_group_resource_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS study_group_notes_group_folder_created_idx
  ON public.study_group_notes (group_id, folder_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS study_group_notes_id_group_id_key
  ON public.study_group_notes (id, group_id);

ALTER TABLE public.study_group_resource_folders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.study_group_resource_folders TO authenticated;

DROP POLICY IF EXISTS "Group members can view resource folders" ON public.study_group_resource_folders;
DROP POLICY IF EXISTS "Group members can create resource folders" ON public.study_group_resource_folders;
DROP POLICY IF EXISTS "Group owners can delete resource folders" ON public.study_group_resource_folders;

CREATE POLICY "Group members can view resource folders"
ON public.study_group_resource_folders FOR SELECT TO authenticated
USING (
  public.is_study_group_member(group_id)
  AND public.can_access_study_group_files(group_id, 'view')
);

CREATE POLICY "Group members can create resource folders"
ON public.study_group_resource_folders FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_study_group_member(group_id)
  AND public.can_access_study_group_files(group_id, 'view')
);

CREATE POLICY "Group owners can delete resource folders"
ON public.study_group_resource_folders FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members AS membership
    WHERE membership.group_id = study_group_resource_folders.group_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'owner'
  )
);

DROP POLICY IF EXISTS "Group members can create shared notes" ON public.study_group_notes;
DROP POLICY IF EXISTS "Group members can update shared notes" ON public.study_group_notes;

CREATE POLICY "Group members can create shared notes"
ON public.study_group_notes FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'upload'))
  AND (
    folder_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.study_group_resource_folders AS folder
      WHERE folder.id = folder_id AND folder.group_id = study_group_notes.group_id
    )
  )
);

CREATE POLICY "Group members can update shared notes"
ON public.study_group_notes FOR UPDATE
USING (
  public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'delete'))
)
WITH CHECK (
  public.is_study_group_member(group_id)
  AND (storage_path IS NULL OR public.can_access_study_group_files(group_id, 'upload'))
  AND (
    folder_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.study_group_resource_folders AS folder
      WHERE folder.id = folder_id AND folder.group_id = study_group_notes.group_id
    )
  )
);

CREATE TABLE IF NOT EXISTS public.study_group_note_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  note_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL CHECK (char_length(trim(comment)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_group_note_comments_note_group_fk
    FOREIGN KEY (note_id, group_id)
    REFERENCES public.study_group_notes(id, group_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS study_group_note_comments_note_created_idx
  ON public.study_group_note_comments (note_id, created_at);

ALTER TABLE public.study_group_note_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.study_group_note_comments TO authenticated;

DROP POLICY IF EXISTS "Group members can read resource comments" ON public.study_group_note_comments;
DROP POLICY IF EXISTS "Group members can comment on resources" ON public.study_group_note_comments;
DROP POLICY IF EXISTS "Comment authors and owners can delete resource comments" ON public.study_group_note_comments;

CREATE POLICY "Group members can read resource comments"
ON public.study_group_note_comments FOR SELECT TO authenticated
USING (
  public.is_study_group_member(group_id)
  AND public.can_access_study_group_files(group_id, 'view')
);

CREATE POLICY "Group members can comment on resources"
ON public.study_group_note_comments FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_study_group_member(group_id)
  AND public.can_access_study_group_files(group_id, 'view')
  AND EXISTS (
    SELECT 1
    FROM public.study_group_notes AS resource
    WHERE resource.id = study_group_note_comments.note_id
      AND resource.group_id = study_group_note_comments.group_id
  )
);

CREATE POLICY "Comment authors and owners can delete resource comments"
ON public.study_group_note_comments FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.group_members AS membership
    WHERE membership.group_id = study_group_note_comments.group_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'owner'
  )
);

DROP POLICY IF EXISTS "Group members can delete own whiteboard strokes" ON public.study_group_whiteboard_strokes;

CREATE POLICY "Group members can delete own whiteboard strokes"
ON public.study_group_whiteboard_strokes FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  AND public.is_study_group_member(group_id)
);
