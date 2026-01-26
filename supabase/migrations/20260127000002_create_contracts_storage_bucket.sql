-- ============================================
-- STORAGE BUCKET: contracts
-- ============================================
-- Nota: En Supabase, los buckets pueden necesitar crearse desde el dashboard
-- o mediante la API. Esta migración intenta crear el bucket si es posible.
-- Si falla, crear manualmente desde el dashboard de Supabase.

-- Intentar crear el bucket 'contracts' como privado
-- Si la extensión storage no está disponible o no tienes permisos,
-- crear manualmente desde el dashboard de Supabase:
-- 1. Ir a Storage en el dashboard
-- 2. Crear nuevo bucket llamado 'contracts'
-- 3. Marcar como privado (no público)
-- 4. Configurar políticas según se define abajo

-- Crear bucket (solo si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false, -- Privado
  52428800, -- 50MB límite por archivo
  NULL -- Permitir todos los tipos MIME
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- POLÍTICAS DE STORAGE PARA contracts
-- ============================================
-- Nota: Las políticas de storage en Supabase se validan mediante funciones
-- que verifican permisos en la base de datos. No podemos parsear el path
-- directamente en SQL, por lo que usamos una función helper.

-- Función helper para verificar acceso a un contrato desde storage_path
-- Esta función extrae el contract_id del path y verifica permisos
CREATE OR REPLACE FUNCTION public.can_access_contract_file(p_storage_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract_id uuid;
  v_workspace_id uuid;
  v_folder_id uuid;
BEGIN
  -- Extraer contract_id del path: contracts/{workspace_id}/{contract_id}/...
  -- El formato es: contracts/{workspace_id}/{contract_id}/main/v{n}/{filename}
  -- o: contracts/{workspace_id}/{contract_id}/attachments/{filename}
  
  -- Intentar extraer contract_id (tercer segmento del path)
  SELECT 
    (string_to_array(p_storage_path, '/'))[3]::uuid INTO v_contract_id;
  
  IF v_contract_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Obtener folder_id del contrato
  SELECT folder_id, workspace_id INTO v_folder_id, v_workspace_id
  FROM public.contracts
  WHERE id = v_contract_id;
  
  IF v_folder_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar que el usuario tiene READ/EDIT/OWNER en la carpeta
  RETURN EXISTS (
    SELECT 1 FROM public.folder_permissions fp
    INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
    WHERE fp.folder_id = v_folder_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'ACTIVE'
      AND fp.access IN ('READ', 'EDIT', 'OWNER')
  );
END;
$$;

-- Política SELECT (download): Usuario puede descargar si puede READ el contrato
CREATE POLICY "Users can download contract files if they can view contract"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND public.can_access_contract_file(name)
  );

-- Política INSERT (upload): Usuario puede subir si puede EDIT el contrato
-- Nota: Esta política se aplica cuando se sube directamente desde el cliente
-- En nuestro caso, usamos signed URLs generadas server-side, pero esta política
-- proporciona una capa adicional de seguridad
CREATE POLICY "Users can upload contract files if they can edit contract"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contracts'
    AND public.can_access_contract_file(name)
  );

-- Política DELETE: Usuario puede eliminar si puede EDIT el contrato
CREATE POLICY "Users can delete contract files if they can edit contract"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contracts'
    AND public.can_access_contract_file(name)
  );

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON FUNCTION public.can_access_contract_file IS 'Verifica si el usuario actual puede acceder a un archivo de contrato basándose en los permisos de la carpeta del contrato';
COMMENT ON POLICY "Users can download contract files if they can view contract" ON storage.objects IS 'Permite descargar archivos de contratos si el usuario tiene READ/EDIT/OWNER en la carpeta del contrato';
COMMENT ON POLICY "Users can upload contract files if they can edit contract" ON storage.objects IS 'Permite subir archivos de contratos si el usuario tiene EDIT/OWNER en la carpeta del contrato';
COMMENT ON POLICY "Users can delete contract files if they can edit contract" ON storage.objects IS 'Permite eliminar archivos de contratos si el usuario tiene EDIT/OWNER en la carpeta del contrato';

