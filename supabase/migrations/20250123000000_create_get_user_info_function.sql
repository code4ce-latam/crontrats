-- Función para obtener información completa de un usuario (email, nombres, etc.)
-- Esta función usa SECURITY DEFINER para acceder a auth.users
CREATE OR REPLACE FUNCTION get_user_info(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_info jsonb;
BEGIN
  SELECT jsonb_build_object(
    'email', au.email,
    'first_name', COALESCE(au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'full_name', NULL),
    'last_name', COALESCE(au.raw_user_meta_data->>'last_name', NULL),
    'full_name', COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      CONCAT(
        COALESCE(au.raw_user_meta_data->>'first_name', ''),
        ' ',
        COALESCE(au.raw_user_meta_data->>'last_name', '')
      ),
      SPLIT_PART(au.email, '@', 1)
    )
  )
  INTO user_info
  FROM auth.users au
  WHERE au.id = user_uuid;

  RETURN COALESCE(user_info, jsonb_build_object());
END;
$$;

-- Comentario sobre la función
COMMENT ON FUNCTION get_user_info(uuid) IS 'Obtiene información completa de un usuario desde auth.users (email, nombres, etc.)';

