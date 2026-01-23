-- Función para obtener el nombre de visualización de un usuario desde auth.users
CREATE OR REPLACE FUNCTION public.get_user_display_name(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_name text;
  user_email text;
BEGIN
  -- Obtener el nombre y email del usuario desde auth.users
  SELECT 
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      TRIM(COALESCE(raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(raw_user_meta_data->>'last_name', '')),
      SPLIT_PART(email, '@', 1),
      'Usuario'
    )
  INTO user_name
  FROM auth.users
  WHERE id = user_uuid;

  RETURN user_name;
END;
$$;

-- Comentario sobre la función
COMMENT ON FUNCTION public.get_user_display_name(uuid) IS 'Obtiene el nombre de visualización de un usuario desde auth.users usando user_metadata';

