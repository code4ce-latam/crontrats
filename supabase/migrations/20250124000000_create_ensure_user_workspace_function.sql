-- Función SQL atómica para crear workspace y membresía sin condiciones de carrera
-- Esta función verifica si el usuario ya tiene un workspace antes de crear uno nuevo
-- y crea tanto el workspace como la membresía en una sola transacción

CREATE OR REPLACE FUNCTION public.ensure_user_workspace(
  p_user_id uuid,
  p_user_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id uuid;
  v_existing_membership_id uuid;
  v_workspace_name text;
  v_email_prefix text;
BEGIN
  -- Verificar si el usuario ya tiene una membresía activa
  SELECT workspace_id INTO v_existing_membership_id
  FROM public.workspace_members
  WHERE user_id = p_user_id
    AND status = 'ACTIVE'
  LIMIT 1;

  -- Si ya tiene una membresía, retornar el workspace_id existente
  IF v_existing_membership_id IS NOT NULL THEN
    RETURN v_existing_membership_id;
  END IF;

  -- Generar el nombre del workspace basado en el email
  IF p_user_email IS NULL OR p_user_email = '' THEN
    v_email_prefix := 'Usuario';
  ELSIF p_user_email LIKE '%@%' THEN
    v_email_prefix := SPLIT_PART(p_user_email, '@', 1);
  ELSE
    v_email_prefix := p_user_email;
  END IF;

  v_workspace_name := 'Workspace de ' || v_email_prefix;

  -- Crear el workspace
  INSERT INTO public.workspaces (name)
  VALUES (v_workspace_name)
  RETURNING id INTO v_workspace_id;

  -- Verificar nuevamente si el usuario tiene una membresía (protección contra race condition)
  -- Esto puede pasar si dos llamadas se ejecutan en paralelo
  SELECT workspace_id INTO v_existing_membership_id
  FROM public.workspace_members
  WHERE user_id = p_user_id
    AND status = 'ACTIVE'
  LIMIT 1;

  -- Si otra ejecución paralela ya creó una membresía, eliminar el workspace duplicado
  IF v_existing_membership_id IS NOT NULL THEN
    -- Eliminar el workspace duplicado que acabamos de crear
    DELETE FROM public.workspaces WHERE id = v_workspace_id;
    -- Retornar el workspace existente
    RETURN v_existing_membership_id;
  END IF;

  -- Crear la membresía con role OWNER y status ACTIVE
  -- Usar INSERT ... ON CONFLICT para manejar condiciones de carrera
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    created_by_user_id
  )
  VALUES (
    v_workspace_id,
    p_user_id,
    'OWNER',
    'ACTIVE',
    p_user_id
  )
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Verificar nuevamente si el usuario tiene una membresía después del INSERT
  -- (por si hubo un conflicto o si otra ejecución paralela creó la membresía)
  SELECT workspace_id INTO v_existing_membership_id
  FROM public.workspace_members
  WHERE user_id = p_user_id
    AND status = 'ACTIVE'
  LIMIT 1;

  -- Si la membresía existe pero no es la que acabamos de crear, eliminar el workspace duplicado
  IF v_existing_membership_id IS NOT NULL AND v_existing_membership_id != v_workspace_id THEN
    -- Eliminar el workspace duplicado
    DELETE FROM public.workspaces WHERE id = v_workspace_id;
    RETURN v_existing_membership_id;
  END IF;

  RETURN v_workspace_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_user_workspace(uuid, text) IS 'Crea automáticamente un workspace y membresía OWNER para un usuario si no tiene uno. Retorna el workspace_id. Maneja condiciones de carrera eliminando workspaces duplicados.';

