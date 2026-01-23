-- Optimizar función get_workspace_users para soportar paginación
-- Esto mejora el rendimiento al no traer todos los usuarios cuando solo se necesita una página

-- Primero eliminar la función existente para poder cambiar su firma
DROP FUNCTION IF EXISTS get_workspace_users(uuid);

-- Crear la nueva versión con soporte para paginación
CREATE OR REPLACE FUNCTION get_workspace_users(
  workspace_uuid uuid,
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0
)
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
  IF p_limit IS NULL THEN
    -- Si no hay límite, retornar todos los registros con OFFSET
    RETURN QUERY
    SELECT 
      wm.id as membership_id,
      wm.user_id,
      wm.workspace_id,
      wm.role::text,
      wm.status::text,
      wm.created_at,
      wm.created_by_user_id,
      au.email::text,
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
    ORDER BY wm.created_at DESC
    OFFSET p_offset;
  ELSE
    -- Si hay límite, aplicar LIMIT y OFFSET
    RETURN QUERY
    SELECT 
      wm.id as membership_id,
      wm.user_id,
      wm.workspace_id,
      wm.role::text,
      wm.status::text,
      wm.created_at,
      wm.created_by_user_id,
      au.email::text,
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
    ORDER BY wm.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

-- Comentario actualizado
COMMENT ON FUNCTION get_workspace_users(uuid, integer, integer) IS 'Obtiene usuarios de un workspace con paginación. Parámetros: workspace_uuid (requerido), p_limit (opcional, número de registros), p_offset (opcional, desplazamiento para paginación)';

-- Mantener compatibilidad con la versión anterior (sin paginación)
-- Si se llama sin p_limit y p_offset, retorna todos los registros
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
    au.email::text,
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

