-- Función para obtener todos los usuarios de un workspace con su información completa
-- Esta función hace JOIN entre workspace_members, auth.users y profiles
CREATE OR REPLACE FUNCTION get_workspace_users(workspace_uuid uuid)
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  workspace_id uuid,
  role text,
  status text,
  created_at timestamptz,
  created_by_user_id uuid,
  email text,
  first_name text,
  last_name text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.id as membership_id,
    wm.user_id,
    wm.workspace_id,
    wm.role::text,
    wm.status::text,
    wm.created_at,
    wm.created_by_user_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', NULL)::text as first_name,
    COALESCE(au.raw_user_meta_data->>'last_name', NULL)::text as last_name,
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      TRIM(CONCAT(
        COALESCE(au.raw_user_meta_data->>'first_name', ''),
        ' ',
        COALESCE(au.raw_user_meta_data->>'last_name', '')
      )),
      SPLIT_PART(au.email, '@', 1)
    )::text as full_name,
    p.avatar_url::text
  FROM workspace_members wm
  INNER JOIN auth.users au ON wm.user_id = au.id
  LEFT JOIN profiles p ON wm.user_id = p.user_id
  WHERE wm.workspace_id = workspace_uuid
    AND wm.status = 'ACTIVE'
  ORDER BY wm.created_at DESC;
END;
$$;

-- Comentario sobre la función
COMMENT ON FUNCTION get_workspace_users(uuid) IS 'Obtiene todos los usuarios de un workspace con su información completa desde workspace_members, auth.users y profiles';

